import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const CODE_EXTENSIONS = [".jsx", ".js", ".tsx", ".ts", ".mjs", ".cjs"];
const RESOLVABLE_EXTENSIONS = [
  ...CODE_EXTENSIONS,
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
];
const GRAPH_FILE_PATTERN = /\.(?:[cm]?[jt]sx?|css|scss|sass|less)$/i;
const DESIGN_FILE_PATTERN =
  /\.(?:[cm]?[jt]sx?|css|scss|sass|less|json|svg|png|jpe?g|webp|gif|woff2?|ttf|otf)$/i;
const LOCAL_SPECIFIER_PATTERN = /^(?:\.{1,2}\/|@\/)/;
const SENSITIVE_ROUTE_PARAM_PATTERN =
  /(?:^|_)(?:code|credential|password|secret|session|token)(?:$|_)/i;

function normalizeAbsolute(file) {
  return path.normalize(path.resolve(file));
}

function toPosix(file) {
  return file.split(path.sep).join("/");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

function scriptKindFor(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".ts")) return ts.ScriptKind.TS;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".json")) return ts.ScriptKind.JSON;
  return ts.ScriptKind.JS;
}

function propertyName(node) {
  if (!node?.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) {
    return node.name.text;
  }
  return null;
}

function property(object, name) {
  return object.properties.find(
    (item) =>
      (ts.isPropertyAssignment(item) ||
        ts.isShorthandPropertyAssignment(item) ||
        ts.isMethodDeclaration(item)) &&
      propertyName(item) === name
  );
}

function literalText(node) {
  if (
    ts.isStringLiteralLike(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return node.text;
  }
  return null;
}

function routeParamNames(pattern) {
  return uniqueSorted(
    [...pattern.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1])
  );
}

function normalizeRoutePath(routePath) {
  if (routePath === "*") return "*";
  const normalized = `/${String(routePath).replace(/^\/+/, "")}`
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");
  return normalized || "/";
}

function composeRoutePath(parentPath, declaredPath) {
  if (declaredPath === "*") {
    return parentPath && parentPath !== "/"
      ? `${normalizeRoutePath(parentPath)}/*`
      : "*";
  }
  if (declaredPath.startsWith("/")) return normalizeRoutePath(declaredPath);
  if (!parentPath || parentPath === "/") {
    return normalizeRoutePath(declaredPath);
  }
  return normalizeRoutePath(`${parentPath}/${declaredPath}`);
}

function readCompilerConfig(frontendRoot) {
  const configPath = ["jsconfig.json", "tsconfig.json"]
    .map((name) => path.join(frontendRoot, name))
    .find(existsSync);
  if (!configPath) {
    return {
      compilerOptions: {
        allowJs: true,
        jsx: ts.JsxEmit.Preserve,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
      aliases: [["@/", path.join(frontendRoot, "src")]],
    };
  }

  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    const message = ts.flattenDiagnosticMessageText(
      loaded.error.messageText,
      "\n"
    );
    throw new Error(`Cannot parse ${configPath}: ${message}`);
  }
  const parsed = ts.parseJsonConfigFileContent(
    loaded.config,
    ts.sys,
    frontendRoot
  );
  const compilerOptions = {
    ...parsed.options,
    allowJs: true,
    jsx: parsed.options.jsx ?? ts.JsxEmit.Preserve,
  };
  const basePath =
    compilerOptions.pathsBasePath ??
    (compilerOptions.baseUrl
      ? path.resolve(frontendRoot, compilerOptions.baseUrl)
      : frontendRoot);
  const aliases = Object.entries(loaded.config.compilerOptions?.paths ?? {})
    .flatMap(([from, targets]) =>
      (targets ?? []).map((target) => [
        from.replace(/\*$/, ""),
        path.resolve(basePath, String(target).replace(/\*$/, "")),
      ])
    )
    .sort((a, b) => b[0].length - a[0].length);
  if (!aliases.some(([prefix]) => prefix === "@/")) {
    aliases.push(["@/", path.join(frontendRoot, "src")]);
  }
  return { compilerOptions, aliases };
}

function candidateFiles(base) {
  const output = [base];
  for (const extension of RESOLVABLE_EXTENSIONS) {
    output.push(`${base}${extension}`);
  }
  for (const extension of RESOLVABLE_EXTENSIONS) {
    output.push(path.join(base, `index${extension}`));
  }
  return output;
}

function existingFile(candidates) {
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return normalizeAbsolute(candidate);
    }
  }
  return null;
}

export function createModuleResolver({ frontendRoot }) {
  const root = normalizeAbsolute(frontendRoot);
  const { compilerOptions, aliases } = readCompilerConfig(root);

  return function resolveModule(specifier, fromFile) {
    let customBase = null;
    for (const [prefix, target] of aliases) {
      if (specifier.startsWith(prefix)) {
        customBase = path.join(target, specifier.slice(prefix.length));
        break;
      }
    }
    if (!customBase && specifier.startsWith(".")) {
      customBase = path.resolve(path.dirname(fromFile), specifier);
    }
    if (customBase) {
      const customResolved = existingFile(candidateFiles(customBase));
      if (customResolved) return customResolved;
    }

    const resolved = ts.resolveModuleName(
      specifier,
      fromFile,
      compilerOptions,
      ts.sys
    ).resolvedModule?.resolvedFileName;
    if (!resolved || resolved.includes(`${path.sep}node_modules${path.sep}`)) {
      return null;
    }
    return normalizeAbsolute(resolved.replace(/\.d\.[cm]?ts$/, ""));
  };
}

function importBindings(sourceFile) {
  const bindings = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = literalText(statement.moduleSpecifier);
    if (!specifier || !statement.importClause) continue;
    if (statement.importClause.name) {
      bindings.set(statement.importClause.name.text, specifier);
    }
    const named = statement.importClause.namedBindings;
    if (named && ts.isNamespaceImport(named)) {
      bindings.set(named.name.text, specifier);
    } else if (named && ts.isNamedImports(named)) {
      for (const element of named.elements) {
        bindings.set(element.name.text, specifier);
      }
    }
  }
  return bindings;
}

function collectRouteModules(node, bindings, resolveModule, routerFile) {
  const specs = [];
  const guardNames = [];
  const unresolvedSpecs = [];

  function visit(current) {
    if (
      ts.isCallExpression(current) &&
      current.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const specifier = current.arguments[0]
        ? literalText(current.arguments[0])
        : null;
      if (specifier) specs.push(specifier);
    }
    if (
      ts.isJsxSelfClosingElement(current) ||
      ts.isJsxOpeningElement(current)
    ) {
      const tag = current.tagName;
      if (ts.isIdentifier(tag)) {
        const name = tag.text;
        if (bindings.has(name)) specs.push(bindings.get(name));
        if (/^(?:Private|Admin|Manager|SingleUser)Route$/.test(name)) {
          guardNames.push(name);
        }
      }
    }
    if (ts.isIdentifier(current) && bindings.has(current.text)) {
      const parent = current.parent;
      if (
        ts.isJsxExpression(parent) ||
        ts.isPropertyAssignment(parent) ||
        ts.isReturnStatement(parent)
      ) {
        specs.push(bindings.get(current.text));
      }
    }
    ts.forEachChild(current, visit);
  }
  visit(node);

  const modules = [];
  for (const specifier of uniqueSorted(specs.filter(Boolean))) {
    const resolved = resolveModule(specifier, routerFile);
    if (resolved) modules.push(resolved);
    else if (LOCAL_SPECIFIER_PATTERN.test(specifier)) {
      unresolvedSpecs.push(specifier);
    }
  }
  return {
    modules: uniqueSorted(modules),
    guardNames: uniqueSorted(guardNames),
    unresolvedSpecs: uniqueSorted(unresolvedSpecs),
  };
}

function routeArrayFromSource(sourceFile) {
  let routeArray = null;
  function visit(node) {
    if (
      !routeArray &&
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) &&
        node.expression.text === "createBrowserRouter") ||
        (ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "createBrowserRouter")) &&
      node.arguments[0] &&
      ts.isArrayLiteralExpression(node.arguments[0])
    ) {
      routeArray = node.arguments[0];
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return routeArray;
}

export function discoverRoutes({
  frontendRoot,
  routerFile = path.join(frontendRoot, "src", "main.jsx"),
}) {
  const root = normalizeAbsolute(frontendRoot);
  const router = normalizeAbsolute(routerFile);
  if (!existsSync(router)) {
    throw new Error(`Router file does not exist: ${router}`);
  }
  const sourceText = readFileSync(router, "utf8");
  const sourceFile = ts.createSourceFile(
    router,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(router)
  );
  const routeArray = routeArrayFromSource(sourceFile);
  if (!routeArray) {
    throw new Error(
      `No createBrowserRouter([...]) declaration found in ${router}`
    );
  }
  const bindings = importBindings(sourceFile);
  const resolveModule = createModuleResolver({ frontendRoot: root });
  const rawRoutes = [];
  const declarationErrors = [];

  function visitArray(array, parentPath, inheritedModules, inheritedGuards) {
    for (const element of array.elements) {
      if (!ts.isObjectLiteralExpression(element)) {
        declarationErrors.push({
          code: "unsupported-route-expression",
          text: element.getText(sourceFile).slice(0, 160),
        });
        continue;
      }
      visitObject(element, parentPath, inheritedModules, inheritedGuards);
    }
  }

  function visitObject(object, parentPath, inheritedModules, inheritedGuards) {
    const pathProperty = property(object, "path");
    let declaredPath = null;
    if (pathProperty && ts.isPropertyAssignment(pathProperty)) {
      declaredPath = literalText(pathProperty.initializer);
      if (declaredPath === null) {
        const position = sourceFile.getLineAndCharacterOfPosition(
          pathProperty.getStart(sourceFile)
        );
        declarationErrors.push({
          code: "non-literal-route-path",
          line: position.line + 1,
          column: position.character + 1,
          text: pathProperty.initializer.getText(sourceFile).slice(0, 160),
        });
      }
    }

    const ownNodes = ["element", "lazy"]
      .map((name) => property(object, name))
      .filter(Boolean)
      .map((node) => (ts.isPropertyAssignment(node) ? node.initializer : node));
    const own = ownNodes.reduce(
      (result, node) => {
        const found = collectRouteModules(
          node,
          bindings,
          resolveModule,
          router
        );
        result.modules.push(...found.modules);
        result.guardNames.push(...found.guardNames);
        result.unresolvedSpecs.push(...found.unresolvedSpecs);
        return result;
      },
      { modules: [], guardNames: [], unresolvedSpecs: [] }
    );
    own.modules = uniqueSorted(own.modules);
    own.guardNames = uniqueSorted(own.guardNames);
    own.unresolvedSpecs = uniqueSorted(own.unresolvedSpecs);

    const currentPath =
      declaredPath === null
        ? parentPath
        : composeRoutePath(parentPath, declaredPath);
    const componentModules = uniqueSorted([
      ...inheritedModules,
      ...own.modules,
    ]);
    const guardNames = uniqueSorted([...inheritedGuards, ...own.guardNames]);

    if (declaredPath !== null) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        object.getStart(sourceFile)
      );
      const wildcard =
        declaredPath === "*" ||
        currentPath === "*" ||
        currentPath.endsWith("/*");
      const params = routeParamNames(currentPath);
      rawRoutes.push({
        pathPattern: currentPath,
        declaredPath,
        routeKind: wildcard ? "wildcard" : params.length ? "dynamic" : "static",
        wildcard,
        dynamic: params.length > 0,
        parameterNames: params,
        componentModule: own.modules.at(-1) ?? componentModules.at(-1) ?? null,
        componentModules,
        ownComponentModules: own.modules,
        guardNames,
        unresolvedSpecs: own.unresolvedSpecs,
        source: {
          file: toPosix(path.relative(root, router)),
          line: position.line + 1,
          column: position.character + 1,
        },
      });
    }

    const children = property(object, "children");
    if (
      children &&
      ts.isPropertyAssignment(children) &&
      ts.isArrayLiteralExpression(children.initializer)
    ) {
      visitArray(
        children.initializer,
        currentPath,
        componentModules,
        guardNames
      );
    } else if (children) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        children.getStart(sourceFile)
      );
      declarationErrors.push({
        code: "unsupported-children-expression",
        line: position.line + 1,
        column: position.character + 1,
        text: children.getText(sourceFile).slice(0, 160),
      });
    }
  }

  visitArray(routeArray, "", [], []);

  const merged = new Map();
  for (const route of rawRoutes) {
    const existing = merged.get(route.pathPattern);
    if (!existing) {
      merged.set(route.pathPattern, {
        ...route,
        definitions: [route.source],
      });
      continue;
    }
    existing.componentModules = uniqueSorted([
      ...existing.componentModules,
      ...route.componentModules,
    ]);
    existing.ownComponentModules = uniqueSorted([
      ...existing.ownComponentModules,
      ...route.ownComponentModules,
    ]);
    existing.guardNames = uniqueSorted([
      ...existing.guardNames,
      ...route.guardNames,
    ]);
    existing.unresolvedSpecs = uniqueSorted([
      ...existing.unresolvedSpecs,
      ...route.unresolvedSpecs,
    ]);
    existing.definitions.push(route.source);
    if (route.ownComponentModules.length) {
      existing.componentModule = route.componentModule;
    }
  }

  return {
    routerFile: router,
    routes: [...merged.values()].sort((a, b) =>
      a.pathPattern.localeCompare(b.pathPattern)
    ),
    declarationErrors,
  };
}

function collectModuleSpecifiers(sourceFile) {
  const specifiers = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      const specifier = literalText(node.moduleSpecifier);
      if (specifier) specifiers.push(specifier);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      node.arguments[0]
    ) {
      const specifier = literalText(node.arguments[0]);
      if (specifier) specifiers.push(specifier);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return uniqueSorted(specifiers);
}

function collectCssImports(text) {
  return uniqueSorted(
    [
      ...text.matchAll(
        /@(?:import|use|forward)\s+(?:url\(\s*)?["']([^"']+)["']/g
      ),
    ].map((match) => match[1])
  );
}

export function buildImportGraph({
  frontendRoot,
  sourceRoot = path.join(frontendRoot, "src"),
}) {
  const root = normalizeAbsolute(frontendRoot);
  const source = normalizeAbsolute(sourceRoot);
  const resolveModule = createModuleResolver({ frontendRoot: root });
  const graph = new Map();
  const unresolvedImports = [];

  for (const file of walkFiles(source).filter((item) =>
    GRAPH_FILE_PATTERN.test(item)
  )) {
    const absolute = normalizeAbsolute(file);
    const text = readFileSync(absolute, "utf8");
    const specifiers = CODE_EXTENSIONS.some((extension) =>
      absolute.endsWith(extension)
    )
      ? collectModuleSpecifiers(
          ts.createSourceFile(
            absolute,
            text,
            ts.ScriptTarget.Latest,
            true,
            scriptKindFor(absolute)
          )
        )
      : collectCssImports(text);
    const targets = new Set();
    for (const specifier of specifiers) {
      const target = resolveModule(specifier, absolute);
      if (target) {
        targets.add(target);
      } else if (LOCAL_SPECIFIER_PATTERN.test(specifier)) {
        unresolvedImports.push({
          importer: absolute,
          specifier,
        });
      }
    }
    graph.set(absolute, targets);
  }
  return { graph, unresolvedImports };
}

export function invertImportGraph(graph) {
  const reverse = new Map();
  for (const [importer, targets] of graph) {
    for (const target of targets) {
      if (!reverse.has(target)) reverse.set(target, new Set());
      reverse.get(target).add(importer);
    }
  }
  return reverse;
}

function repoRootFor(frontendRoot) {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: frontendRoot,
    encoding: "utf8",
  }).trim();
}

function gitLines(frontendRoot, args) {
  return execFileSync("git", args, {
    cwd: frontendRoot,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveInputFile(frontendRoot, repoRoot, input) {
  if (path.isAbsolute(input)) return normalizeAbsolute(input);
  const normalized = toPosix(input).replace(/^\.\//, "");
  if (normalized.startsWith("frontend/")) {
    return normalizeAbsolute(path.join(repoRoot, normalized));
  }
  return normalizeAbsolute(path.join(frontendRoot, normalized));
}

export function changedFilesFromArgs({
  frontendRoot,
  files = [],
  since = null,
  includeWorkingTree = true,
}) {
  const root = normalizeAbsolute(frontendRoot);
  const repoRoot = repoRootFor(root);
  if (files.length) {
    return uniqueSorted(
      files
        .flatMap((item) => String(item).split(","))
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => resolveInputFile(root, repoRoot, item))
    );
  }

  const relativeFrontend = toPosix(path.relative(repoRoot, root)) || ".";
  const changed = [];
  if (since) {
    changed.push(
      ...gitLines(root, [
        "diff",
        "--name-only",
        "--diff-filter=ACMRD",
        `${since}...HEAD`,
        "--",
        relativeFrontend,
      ])
    );
  }
  if (includeWorkingTree) {
    changed.push(
      ...gitLines(root, [
        "diff",
        "--name-only",
        "--diff-filter=ACMRD",
        "HEAD",
        "--",
        relativeFrontend,
      ]),
      ...gitLines(root, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "--",
        relativeFrontend,
      ])
    );
  }
  return uniqueSorted(
    changed.map((item) => normalizeAbsolute(path.join(repoRoot, item)))
  );
}

export function classifyGlobalFanout(file, frontendRoot) {
  const relative = toPosix(path.relative(frontendRoot, file));
  const reasons = [];
  if (
    relative === "tailwind.config.js" ||
    relative.startsWith("tailwind.config.") ||
    relative.startsWith("postcss.config.") ||
    relative.startsWith("vite.config.") ||
    relative === "jsconfig.json" ||
    /^tsconfig(?:\.[^.]+)?\.json$/.test(relative) ||
    relative === "components.json"
  ) {
    reasons.push(
      relative.startsWith("tailwind") ? "tailwind-config" : "shared-layout"
    );
  }
  if (
    relative.startsWith("tokens/") ||
    /(?:^|\/)(?:design-)?tokens?(?:\/|\.|-)/i.test(relative)
  ) {
    reasons.push("token-consumer");
  }
  if (
    relative === "src/index.css" ||
    /^src\/styles\/(?:generated\/|globals?\.|themes?\/)/i.test(relative)
  ) {
    reasons.push("global-css");
  }
  if (/(?:^|\/)(?:theme|themes)(?:\/|\.|-)/i.test(relative)) {
    reasons.push("theme");
  }
  if (/\.(?:woff2?|ttf|otf)$/i.test(relative)) reasons.push("font");
  return uniqueSorted(reasons);
}

export function isRouteImpactCandidate(file, frontendRoot) {
  const absolute = normalizeAbsolute(file);
  const relative = toPosix(path.relative(frontendRoot, absolute));
  return (
    (relative.startsWith("src/") && DESIGN_FILE_PATTERN.test(absolute)) ||
    classifyGlobalFanout(absolute, frontendRoot).length > 0
  );
}

function reverseReachable(start, reverseGraph) {
  const reached = new Set([start]);
  const distance = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    for (const parent of reverseGraph.get(current) ?? []) {
      if (reached.has(parent)) continue;
      reached.add(parent);
      distance.set(parent, distance.get(current) + 1);
      queue.push(parent);
    }
  }
  return { reached, distance };
}

function relativeRecordPath(frontendRoot, file) {
  const relative = toPosix(path.relative(frontendRoot, file));
  return relative.startsWith("../") ? toPosix(file) : relative;
}

export function analyzeRouteImpact({
  frontendRoot,
  changedFiles,
  routerFile = path.join(frontendRoot, "src", "main.jsx"),
}) {
  const root = normalizeAbsolute(frontendRoot);
  const sourceRoot = path.join(root, "src");
  const routeDiscovery = discoverRoutes({
    frontendRoot: root,
    routerFile,
  });
  const { graph, unresolvedImports } = buildImportGraph({
    frontendRoot: root,
    sourceRoot,
  });
  const reverse = invertImportGraph(graph);
  const routes = routeDiscovery.routes;
  const allRoutePatterns = routes.map((route) => route.pathPattern);
  const affected = new Set();
  const changed = [];
  const uncoveredChangedFiles = [];
  const deletedChangedFiles = [];
  const unresolvedChangedFiles = [];
  const fanOutReasons = new Set();

  for (const input of uniqueSorted(changedFiles.map(normalizeAbsolute))) {
    const exists = existsSync(input);
    const relative = relativeRecordPath(root, input);
    const globalReasons = classifyGlobalFanout(input, root);
    const entry = {
      file: relative,
      status: exists ? "present" : "deleted-or-unresolved",
      fanOutReasons: globalReasons,
      affectedRoutes: [],
    };

    if (!exists) {
      deletedChangedFiles.push(relative);
      changed.push(entry);
      continue;
    }
    if (!DESIGN_FILE_PATTERN.test(input)) {
      entry.status = "unsupported-file-kind";
      unresolvedChangedFiles.push(relative);
      changed.push(entry);
      continue;
    }
    if (globalReasons.length || input === routeDiscovery.routerFile) {
      for (const route of allRoutePatterns) affected.add(route);
      for (const reason of globalReasons.length
        ? globalReasons
        : ["shared-layout"]) {
        fanOutReasons.add(reason);
      }
      entry.affectedRoutes = allRoutePatterns;
      changed.push(entry);
      continue;
    }

    const { reached, distance } = reverseReachable(input, reverse);
    const routeHits = [];
    for (const route of routes) {
      const matchedModules = route.componentModules.filter((module) =>
        reached.has(module)
      );
      if (!matchedModules.length) continue;
      affected.add(route.pathPattern);
      const hops = Math.min(
        ...matchedModules.map((module) => distance.get(module))
      );
      routeHits.push({ pathPattern: route.pathPattern, hops });
    }
    entry.affectedRoutes = routeHits
      .sort(
        (a, b) => a.hops - b.hops || a.pathPattern.localeCompare(b.pathPattern)
      )
      .map((item) => item.pathPattern);

    if (!entry.affectedRoutes.length) {
      entry.status = "uncovered";
      uncoveredChangedFiles.push(relative);
    }
    changed.push(entry);
  }

  const unresolvedRouteModules = routes
    .filter(
      (route) =>
        !route.componentModules.length || route.unresolvedSpecs.length > 0
    )
    .map((route) => ({
      pathPattern: route.pathPattern,
      unresolvedSpecs: route.unresolvedSpecs,
      hasComponentModule: route.componentModules.length > 0,
    }));
  const relevantUnresolvedImports = unresolvedImports
    .filter(({ importer }) =>
      changedFiles.map(normalizeAbsolute).includes(importer)
    )
    .map(({ importer, specifier }) => ({
      importer: relativeRecordPath(root, importer),
      specifier,
    }));
  const affectedRoutes = routes.filter((route) =>
    affected.has(route.pathPattern)
  );
  const coverageComplete =
    changed.length > 0 &&
    deletedChangedFiles.length === 0 &&
    unresolvedChangedFiles.length === 0 &&
    uncoveredChangedFiles.length === 0 &&
    routeDiscovery.declarationErrors.length === 0 &&
    unresolvedRouteModules.length === 0 &&
    relevantUnresolvedImports.length === 0;

  return {
    schemaVersion: "1.0.0",
    routerFile: relativeRecordPath(root, routeDiscovery.routerFile),
    routeCount: routes.length,
    changedFiles: changed,
    affectedRoutes,
    fanOutReasons: uniqueSorted(fanOutReasons),
    coverageComplete,
    gaps: {
      emptyChangeSet: changed.length === 0,
      deletedChangedFiles: uniqueSorted(deletedChangedFiles),
      unresolvedChangedFiles: uniqueSorted(unresolvedChangedFiles),
      uncoveredChangedFiles: uniqueSorted(uncoveredChangedFiles),
      routeDeclarationErrors: routeDiscovery.declarationErrors,
      unresolvedRouteModules,
      unresolvedImports: relevantUnresolvedImports,
    },
  };
}

export function hasSensitiveRouteParameter(routePattern) {
  return routeParamNames(routePattern).some((name) =>
    SENSITIVE_ROUTE_PARAM_PATTERN.test(name)
  );
}

export function routeNameFromPath(routePath) {
  if (routePath === "/") return "home";
  return routePath
    .replace(/^\//, "")
    .replace(/:([A-Za-z0-9_]+)/g, "$1")
    .replace(/\*/g, "wildcard")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
