#!/usr/bin/env node
/**
 * Prova MECANICA de que um lote mudou APENAS apresentacao nos arquivos que sao
 * `contractSources` de fixture de rede.
 *
 * POR QUE ISTO EXISTE. O `fixtureRegistryFingerprint` do manifest inclui
 * `contractSourceFingerprint`, que e o sha256 dos ARQUIVOS listados em
 * `contractSources` de cada fixture de rede. Esses arquivos estao no hash por
 * um motivo legitimo: se o model, o endpoint ou a PAGINA mudam, a resposta de
 * rede gravada na fixture pode ter virado mentira, e comparar pixel contra
 * fixture stale nao prova nada. Por isso o bind de before/after e igualdade
 * dura.
 *
 * O problema medido: um codemod que so troca `className` numa dessas paginas
 * move o hash de bytes sem mudar UMA requisicao sequer. O guard dispara, o par
 * before/after e recusado, e a prova de pixel do lote fica impossivel — que e
 * exatamente o caso para o qual a esteira foi construida.
 *
 * A SAIDA ERRADA seria normalizar `className` para fora do
 * `contractSourceFingerprint`. Isso resolveria este lote e desligaria o guard
 * PARA SEMPRE, para todo lote futuro, por decisao de quem estava com pressa. O
 * default tem que continuar conservador.
 *
 * A SAIDA CERTA e esta: manter o hash como esta e exigir prova mecanica, por
 * lote, de que o delta e confinado a categorias que comprovadamente NAO mudam
 * o contrato de rede:
 *
 *   1. o VALOR de um atributo JSX `className`
 *   2. um `import` do modulo de entidades de design
 *
 * O metodo e deliberadamente conservador: o AST LOCALIZA as regioes
 * permitidas, elas sao removidas dos DOIS lados, e o que sobra tem que ser
 * BYTE-IDENTICO. Qualquer mudanca fora da lista — uma chamada de API a mais,
 * um parametro, um `useEffect`, um import que nao seja de entidade —
 * sobrevive a remocao e faz o arquivo REPROVAR. Nao ha heuristica de
 * similaridade e nao ha limiar: e identidade ou e falha.
 *
 * Falha fechada em todos os eixos: parser que nao roda REPROVA, arquivo que
 * sumiu REPROVA, ref git que nao resolve REPROVA. Nenhum caminho devolve PASS
 * por omissao.
 *
 *     node scripts/verify-contract-source-delta.mjs --base HEAD \
 *       --field-before <sha256> --field-after <sha256> --out verdict.json
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import console from "node:console";

import { parse } from "@babel/parser";

/*
 * FRONTEND_ROOT e a raiz do APP medido; REPO_ROOT e a raiz do repositorio GIT
 * que o contem — e os dois NAO tem relacao fixa de profundidade.
 *
 * A primeira versao cravava `REPO_ROOT = FRONTEND_ROOT/..`, o que so vale no
 * layout do alvo (`<app>/frontend` dentro do repo do app). No repo
 * canonico do processo isso resolvia para `/home/augusto/code`, que nao e
 * repositorio git nenhum — e TODAS as chamadas `git show` deste script rodariam
 * fora de qualquer repo, falhando de um jeito que parece "arquivo ausente".
 *
 * Agora o app vem de TOKENIZE_APP_ROOT (ou do proprio layout) e o repo git e
 * DESCOBERTO com `git rev-parse --show-toplevel`, que e a unica fonte correta.
 */
const FRONTEND_ROOT = path.resolve(
  process.env.TOKENIZE_APP_ROOT ||
    path.join(path.dirname(new URL(import.meta.url).pathname), "..")
);

function descobrirRepoGit(desde) {
  try {
    return execFileSync("git", ["-C", desde, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    throw new Error(
      `nao ha repositorio git em ${desde} nem acima dele; este verificador compara ` +
        "a worktree contra um ref, entao precisa de um repo"
    );
  }
}

const REPO_ROOT = descobrirRepoGit(FRONTEND_ROOT);

const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const BASE_REF = arg("--base", "HEAD");
const ENTITY_MODULE = arg("--entities", "design-entities");
const FIELD = arg("--field", "fixtureRegistryFingerprint");
const FIELD_BEFORE = arg("--field-before");
const FIELD_AFTER = arg("--field-after");
const OUT = arg("--out");

/** Marcador que substitui uma regiao permitida. Igual nos dois lados. */
const REDACTED = " <permitido> ";

class VerifyError extends Error {}

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function sourceAt(ref, repoRelative) {
  try {
    return git(["show", ref + ":" + repoRelative]);
  } catch {
    return null;
  }
}

function parseSource(code, label) {
  try {
    return parse(code, {
      sourceType: "module",
      plugins: [
        "jsx",
        "typescript",
        "classProperties",
        "optionalChaining",
        "nullishCoalescingOperator",
        "dynamicImport",
        "objectRestSpread",
      ],
      errorRecovery: false,
    });
  } catch (error) {
    throw new VerifyError("parser falhou em " + label + ": " + error.message);
  }
}

/**
 * Caminha o AST sem depender de @babel/traverse: visita todo objeto que tenha
 * `type`, recursivamente. Mais burro que um visitor de verdade, e nao erra por
 * falta de um tipo no mapa de visitas.
 */
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node.type === "string") visit(node);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments") {
      continue;
    }
    walk(node[key], visit);
  }
}

/** Regioes [start,end) que podem mudar sem afetar contrato de rede. */
function permittedRanges(ast) {
  const ranges = [];
  walk(ast, (node) => {
    if (
      node.type === "JSXAttribute" &&
      node.name &&
      node.name.type === "JSXIdentifier" &&
      node.name.name === "className" &&
      node.value &&
      typeof node.value.start === "number"
    ) {
      ranges.push([node.value.start, node.value.end, "replace"]);
      return;
    }
    if (
      node.type === "ImportDeclaration" &&
      node.source &&
      typeof node.source.value === "string" &&
      node.source.value.includes(ENTITY_MODULE) &&
      typeof node.start === "number"
    ) {
      /*
       * DELECAO, nao marcador. O import de entidade existe SO no lado depois;
       * trocar por um marcador criaria um token que o lado antes nao tem e o
       * arquivo reprovaria por uma diferenca que o proprio verificador
       * inventou. Foi o primeiro defeito real deste script.
       */
      ranges.push([node.start, node.end, "delete"]);
    }
  });
  return ranges.sort((a, b) => a[0] - b[0]);
}

/**
 * Remove as regioes permitidas e normaliza o vazio que elas deixam.
 *
 * O import de entidade existe SO no lado depois; apagar o texto deixaria uma
 * linha em branco que o lado antes nao tem. Dai o colapso de linhas vazias —
 * aplicado aos DOIS lados, entao nao mascara nada assimetrico.
 */
function redact(code, ranges) {
  let out = "";
  let cursor = 0;
  for (const [start, end, mode] of ranges) {
    if (start < cursor) continue;
    out += code.slice(cursor, start) + (mode === "delete" ? "" : REDACTED);
    cursor = end;
    /*
     * Deletar so o NO deixa a linha vazia onde o import estava, e o lado antes
     * nao tem essa linha. O colapso de vazias abaixo nao resolve, porque ele so
     * remove vazia CONSECUTIVA. Entao a delecao consome o resto da linha
     * quando o que sobra ate a quebra e apenas espaco. Segundo defeito real
     * deste script, achado com o lote 2 na mao.
     */
    if (mode === "delete") {
      const rest = code.slice(cursor);
      const eaten = rest.match(/^[ \t]*\r?\n/);
      if (eaten) cursor += eaten[0].length;
    }
  }
  out += code.slice(cursor);
  return out
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : line))
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");
}

function firstDifference(a, b) {
  const al = a.split("\n");
  const bl = b.split("\n");
  for (let i = 0; i < Math.max(al.length, bl.length); i += 1) {
    if (al[i] !== bl[i]) {
      return {
        line: i + 1,
        before: (al[i] === undefined ? "<ausente>" : al[i]).slice(0, 120),
        after: (bl[i] === undefined ? "<ausente>" : bl[i]).slice(0, 120),
      };
    }
  }
  return null;
}

function contractSources() {
  const file = path.join(FRONTEND_ROOT, "tests/visual/network-fixtures.json");
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const fixtures = Array.isArray(raw) ? raw : (raw.fixtures || []);
  const sources = new Set();
  for (const fixture of fixtures) {
    for (const source of fixture.contractSources || []) sources.add(source);
  }
  return [...sources].sort();
}

function main() {
  if (!FIELD_BEFORE || !FIELD_AFTER) {
    throw new VerifyError(
      "--field-before e --field-after sao obrigatorios: o veredito e fixado ao par observado"
    );
  }
  try {
    git(["rev-parse", "--verify", BASE_REF + "^{commit}"]);
  } catch {
    throw new VerifyError("--base " + BASE_REF + " nao resolve para um commit");
  }

  const sources = contractSources();
  const changed = [];
  const failures = [];

  for (const repoRelative of sources) {
    const absolute = path.join(REPO_ROOT, repoRelative);
    const before = sourceAt(BASE_REF, repoRelative);
    if (!existsSync(absolute)) {
      failures.push({ file: repoRelative, reason: "arquivo ausente na worktree" });
      continue;
    }
    if (before === null) {
      failures.push({ file: repoRelative, reason: "ausente em " + BASE_REF });
      continue;
    }
    const after = readFileSync(absolute, "utf8");
    if (before === after) continue;

    changed.push(repoRelative);
    try {
      const redactedBefore = redact(
        before,
        permittedRanges(parseSource(before, repoRelative + "@" + BASE_REF))
      );
      const redactedAfter = redact(
        after,
        permittedRanges(parseSource(after, repoRelative + "@worktree"))
      );
      if (redactedBefore !== redactedAfter) {
        failures.push({
          file: repoRelative,
          reason: "delta fora das categorias permitidas",
          difference: firstDifference(redactedBefore, redactedAfter),
        });
      }
    } catch (error) {
      failures.push({ file: repoRelative, reason: error.message });
    }
  }

  const verdict = {
    schemaVersion: "1.0.0",
    tool: "verify-contract-source-delta",
    baseRef: git(["rev-parse", BASE_REF]).trim(),
    entityModule: ENTITY_MODULE,
    field: FIELD,
    fieldBefore: FIELD_BEFORE,
    fieldAfter: FIELD_AFTER,
    permittedCategories: ["jsx-classname-attribute-value", "design-entity-import"],
    contractSourcesInspected: sources.length,
    changedContractSources: changed,
    failures,
    verdict: failures.length === 0 ? "PASS" : "FAIL",
  };

  if (OUT) {
    mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
    writeFileSync(path.resolve(OUT), JSON.stringify(verdict, null, 2) + "\n");
  }

  console.log("contract-source delta · base " + verdict.baseRef.slice(0, 8));
  console.log("  contractSources inspecionados : " + sources.length);
  console.log("  mudados por este lote         : " + changed.length);
  for (const file of changed) console.log("    " + file);
  for (const failure of failures) {
    console.log("  REPROVOU " + failure.file + ": " + failure.reason);
    if (failure.difference) {
      console.log("    linha " + failure.difference.line);
      console.log("      antes : " + failure.difference.before);
      console.log("      depois: " + failure.difference.after);
    }
  }
  console.log("  VEREDITO: " + verdict.verdict);
  if (verdict.verdict !== "PASS") process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error("verify-contract-source-delta PAROU: " + error.message);
  process.exitCode = 2;
}
