import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  analyzeRouteImpact,
  classifyGlobalFanout,
  discoverRoutes,
} from "./route-impact.mjs";

function write(root, relative, content) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}

function fixtureProject() {
  const root = mkdtempSync(path.join(os.tmpdir(), "route-impact-"));
  write(
    root,
    "jsconfig.json",
    JSON.stringify({
      compilerOptions: {
        allowJs: true,
        jsx: "react-jsx",
        paths: { "@/*": ["./src/*"] },
      },
    })
  );
  write(
    root,
    "src/main.jsx",
    `
      import { createBrowserRouter } from "react-router-dom";
      import App from "@/App";
      import Login from "@/Login";
      export const router = createBrowserRouter([
        {
          path: "/",
          element: <App />,
          children: [
            {
              path: "/",
              lazy: async () => {
                const { default: Home } = await import("@/Home");
                return { element: <Home /> };
              },
            },
            { path: "/login", element: <Login /> },
            {
              path: "/workspace/:slug",
              lazy: async () => {
                const { default: Workspace } = await import("@/Workspace");
                return { element: <Workspace /> };
              },
              children: [{ path: "t/:threadSlug" }],
            },
            {
              path: "*",
              lazy: async () => {
                const { default: Missing } = await import("@/Missing");
                return { element: <Missing /> };
              },
            },
          ],
        },
      ]);
    `
  );
  write(
    root,
    "src/App.jsx",
    `import "./index.css"; export default function App(){ return null }`
  );
  write(
    root,
    "src/Login.jsx",
    `import Button from "./shared/Button"; export default function Login(){ return <Button/> }`
  );
  write(
    root,
    "src/Home.jsx",
    `import Button from "./shared/Button"; export default function Home(){ return <Button/> }`
  );
  write(
    root,
    "src/Workspace.jsx",
    `export default function Workspace(){ return null }`
  );
  write(
    root,
    "src/Missing.jsx",
    `export default function Missing(){ return null }`
  );
  write(
    root,
    "src/shared/Button.jsx",
    `export default function Button(){ return <button/> }`
  );
  write(root, "src/index.css", `@import "./theme.css";`);
  write(root, "src/theme.css", `:root { --color: red; }`);
  write(root, "src/orphan.jsx", `export default 1;`);
  write(root, "tokens/color.tokens.json", `{}`);
  write(root, "tailwind.config.js", `export default {};`);
  return root;
}

test("discovers nested, merged, dynamic, and wildcard routes from the AST", () => {
  const root = fixtureProject();
  try {
    const result = discoverRoutes({ frontendRoot: root });
    assert.deepEqual(result.declarationErrors, []);
    assert.deepEqual(
      result.routes.map((route) => route.pathPattern),
      ["*", "/", "/login", "/workspace/:slug", "/workspace/:slug/t/:threadSlug"]
    );
    const home = result.routes.find((route) => route.pathPattern === "/");
    assert.equal(home.definitions.length, 2);
    assert.match(home.componentModule, /Home\.jsx$/);
    assert.ok(home.componentModules.some((file) => file.endsWith("App.jsx")));
    const thread = result.routes.find(
      (route) => route.pathPattern === "/workspace/:slug/t/:threadSlug"
    );
    assert.equal(thread.routeKind, "dynamic");
    assert.deepEqual(thread.parameterNames, ["slug", "threadSlug"]);
    assert.match(thread.componentModule, /Workspace\.jsx$/);
    assert.equal(
      result.routes.find((route) => route.pathPattern === "*").routeKind,
      "wildcard"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reverse imports select exact consumers and shared layouts fan out", () => {
  const root = fixtureProject();
  try {
    const button = analyzeRouteImpact({
      frontendRoot: root,
      changedFiles: [path.join(root, "src/shared/Button.jsx")],
    });
    assert.equal(button.coverageComplete, true);
    assert.deepEqual(
      button.affectedRoutes.map((route) => route.pathPattern),
      ["/", "/login"]
    );

    const app = analyzeRouteImpact({
      frontendRoot: root,
      changedFiles: [path.join(root, "src/App.jsx")],
    });
    assert.equal(app.coverageComplete, true);
    assert.deepEqual(
      app.affectedRoutes.map((route) => route.pathPattern),
      ["*", "/", "/login", "/workspace/:slug", "/workspace/:slug/t/:threadSlug"]
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("global CSS, token sources, and Tailwind configuration fan out", () => {
  const root = fixtureProject();
  try {
    for (const [relative, reason] of [
      ["src/index.css", "global-css"],
      ["tokens/color.tokens.json", "token-consumer"],
      ["tailwind.config.js", "tailwind-config"],
      ["jsconfig.json", "shared-layout"],
    ]) {
      const file = path.join(root, relative);
      assert.ok(classifyGlobalFanout(file, root).includes(reason));
      const result = analyzeRouteImpact({
        frontendRoot: root,
        changedFiles: [file],
      });
      assert.equal(result.coverageComplete, true);
      assert.equal(result.affectedRoutes.length, 5);
      assert.ok(result.fanOutReasons.includes(reason));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("deleted and orphaned changes fail closed", () => {
  const root = fixtureProject();
  try {
    const deleted = analyzeRouteImpact({
      frontendRoot: root,
      changedFiles: [path.join(root, "src/deleted.jsx")],
    });
    assert.equal(deleted.coverageComplete, false);
    assert.deepEqual(deleted.gaps.deletedChangedFiles, ["src/deleted.jsx"]);

    const orphan = analyzeRouteImpact({
      frontendRoot: root,
      changedFiles: [path.join(root, "src/orphan.jsx")],
    });
    assert.equal(orphan.coverageComplete, false);
    assert.deepEqual(orphan.gaps.uncoveredChangedFiles, ["src/orphan.jsx"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unresolved local import in a changed consumer fails closed", () => {
  const root = fixtureProject();
  try {
    write(
      root,
      "src/Login.jsx",
      `import Missing from "./does-not-exist"; export default function Login(){ return <Missing/> }`
    );
    const result = analyzeRouteImpact({
      frontendRoot: root,
      changedFiles: [path.join(root, "src/Login.jsx")],
    });
    assert.equal(result.coverageComplete, false);
    assert.deepEqual(result.gaps.unresolvedImports, [
      {
        importer: "src/Login.jsx",
        specifier: "./does-not-exist",
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
