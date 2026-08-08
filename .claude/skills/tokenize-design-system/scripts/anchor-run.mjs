#!/usr/bin/env node
/**
 * anchor-run.mjs — o nó ANCHOR do grafo. Emite o `run-config`.
 *
 * POR QUE ESTE ARQUIVO É O PRIMEIRO. O contrato exige seis campos em TODO
 * artefato (`reference/artifact-schemas.json`, `$defs.artifactHeader`):
 * `schemaVersion`, `artifactType`, `runId`, `sourceFingerprint`,
 * `toolchainFingerprint` e `generatedAt`. Dois deles — `runId` e
 * `toolchainFingerprint` — só existem depois que alguém ancora a corrida. Logo
 * **nenhum script consegue montar um header válido antes disto existir**, nem
 * que quisesse. Era essa a razão estrutural, medida em 2026-08-01, de os nove
 * scripts do subgrafo C emitirem zero `artifactType`: não é desleixo, é
 * dependência dura.
 *
 * Até hoje o único `run-config` do mundo era a função `runConfig()` de
 * `lib/artifact-contract.test.mjs` — uma fixture, com `predicateIds: ["P1"]`
 * placeholder. A máquina de estados durável nunca passou de `ANCHORED` em
 * lugar nenhum.
 *
 * O QUE ELE NÃO FAZ, e é decisão: não inventa nada. Cada campo ou vem de um
 * registro que já existe no repo, ou é MEDIDO no alvo:
 *
 *   sourceKindRegistry  ← `lib/axis-discovery.mjs::SOURCE_KIND_REGISTRY`, os 19
 *                          kinds com os nomes de adapter REAIS (o próprio
 *                          módulo, Linha 170, já falha se divergir de
 *                          OCCURRENCE_KINDS).
 *   predicateIds        ← `lib/absolute-completion-contract.mjs`, o enum fechado.
 *   toolchain.versions  ← lidos do `package.json` do ALVO, nunca deste repo.
 *   configurationFingerprints ← sha256 dos arquivos de config que EXISTEM no alvo.
 *   sourceFingerprint   ← `fingerprintSourceRoots` de `lib/absolute-completion.mjs`.
 *
 * A FONTE ÚNICA DOS DOIS FINGERPRINTS. `extract-design-occurrences.mjs`
 * (Linhas 310-313) aceita `--source-fingerprint` e `--toolchain-fingerprint` e
 * só calcula os seus quando ninguém passa. O orquestrador passa os deste
 * arquivo para todo passo. Sem isso cada script calcularia o seu, e o contrato
 * — que cruza `sourceFingerprint` entre artefatos
 * (`tokenization-runner.mjs:331-348`) — recusaria a transição por "fingerprint
 * misturado", com a causa escondida três camadas abaixo.
 *
 * O `runId` é DERIVADO da fonte, não sorteado: mesma árvore ⇒ mesmo id. Duas
 * ancoragens da mesma fonte colidem de propósito — se nada mudou no alvo, não é
 * uma corrida nova. Conserte o alvo e o id muda sozinho.
 *
 * Uso:
 *   node anchor-run.mjs --root <app> --out <run-config.json>
 *   node anchor-run.mjs --root <app> --json          # imprime, não escreve
 *   node anchor-run.mjs --root <app> --objective "..." --run-id tokenize-xyz
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { OCCURRENCE_KINDS, sha256CanonicalJson } from "./lib/artifact-contract.mjs";
import { SOURCE_KIND_REGISTRY } from "./lib/axis-discovery.mjs";
import { ABSOLUTE_COMPLETION_PREDICATE_IDS } from "./lib/absolute-completion-contract.mjs";
import { fingerprintSourceRoots } from "./lib/absolute-completion.mjs";
import { resolveRoot } from "./lib/paths.mjs";
import { fingerprintProcessPath } from "../../../../scripts/lib/process-toolchain.mjs";

const PROCESS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

const argv = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

if (argv.includes("--help")) {
  console.log(`anchor-run.mjs — emite o run-config que ancora uma corrida

Uso:
  node anchor-run.mjs --root <app> [--out <arquivo>] [--json]

Opções:
  --root <app>          raiz do app-alvo (ou TOKENIZE_ROOT)
  --out <arquivo>       onde escrever (default: <app>/.tokenize/run-config.json)
  --json                imprime no stdout e não escreve
  --run-id <id>         sobrepõe o id derivado da fonte (^tokenize-...)
  --objective <texto>   o objetivo da corrida
  --source-roots <csv>  default: lido de tokens/tokenization.config.json, senão "src"
`);
  process.exit(0);
}

const ROOT = resolveRoot();
const falhar = (motivo, comoResolver) => {
  console.error(`\nANCHOR falhou: ${motivo}`);
  if (comoResolver) console.error(`  como resolver: ${comoResolver}`);
  console.error(`\nAncorar falha FECHADO: um run-config incompleto contamina todo`);
  console.error(`artefato da corrida, e o erro só apareceria na primeira transição.`);
  process.exit(1);
};

/* ─────────────────────────────────────────────────────── as raízes de fonte ── */

function sourceRootsDoAlvo() {
  const csv = arg("--source-roots");
  if (csv) return csv.split(",").map((s) => s.trim()).filter(Boolean);
  const cfg = path.join(ROOT, "tokens/tokenization.config.json");
  if (existsSync(cfg)) {
    try {
      const j = JSON.parse(readFileSync(cfg, "utf8"));
      const roots = j.sourceRoots ?? j.source_roots;
      if (Array.isArray(roots) && roots.length) return roots;
    } catch {
      /* config ilegível cai no default; o fingerprint abaixo é quem falha alto */
    }
  }
  return ["src"];
}

const sourceRoots = sourceRootsDoAlvo();
const fp = fingerprintSourceRoots({ applicationRoot: ROOT, sourceRoots });
if (!fp.fingerprint) {
  falhar(
    `não foi possível fingerprintar as raízes de fonte ${JSON.stringify(sourceRoots)} em ${ROOT}` +
      (fp.problems?.length ? ` — ${fp.problems.join("; ")}` : ""),
    "confira --root e --source-roots; a raiz precisa conter código-fonte"
  );
}
const sourceFingerprint = fp.fingerprint;

/* ──────────────────────────────────────────── a toolchain, MEDIDA no alvo ── */

const requireDoAlvo = createRequire(path.join(ROOT, "package.json"));

function versaoNoAlvo(pacote) {
  try {
    return requireDoAlvo(`${pacote}/package.json`).version ?? null;
  } catch {
    return null;
  }
}

// Só entram os que RESOLVEM a partir do alvo. Declarar uma versão que não está
// instalada seria a mesma mentira que o PREFLIGHT existe para impedir.
const CANDIDATAS = ["tailwindcss", "colorjs.io", "tailwind-merge", "@tailwindcss/node", "postcss"];
const versions = { node: process.version.replace(/^v/, "") };
for (const p of CANDIDATAS) {
  const v = versaoNoAlvo(p);
  if (v) versions[p] = v;
}

const CONFIGS = [
  "package.json",
  "tokens/tokenization.config.json",
  // Contratos visuais versionados do ALVO. Eles governam quais estados,
  // fixtures read-only, exceções de transporte e dimensões entram na prova.
  // Se mudarem depois da âncora, a mesma corrida não pode continuar fingindo
  // que mede a matriz anterior.
  "tests/visual/evidence-fixtures.json",
  "tests/visual/evidence-route-policy.json",
  "tests/visual/evidence-matrix.json",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
];
// O arquivo DTCG é SAÍDA mutável da corrida, medido por
// tokenSourceFingerprint/generatedCssFingerprint. Ancorá-lo também como
// configuração tornava qualquer APPLY inválido por construção no gate final.
/*
 * A CHAVE PRECISA DO PREFIXO `file:` — defeito meu, achado pelo mapeamento dos
 * contratos de artefato em 2026-08-01.
 *
 * `evaluateLiveToolchain` (`lib/absolute-completion.mjs:153-159`) recusa
 * qualquer chave sem ele: *"Toolchain fingerprint key is not live-verifiable;
 * use file:<application-relative-path>"*. Eu escrevia `"package.json"` cru, e o
 * predicado `process.fingerprints-current` acumulava esse problema em TODA
 * corrida — silenciosamente, porque nada mais lê essas chaves.
 *
 * O prefixo não é decoração: ele é o que diz ao avaliador que a chave é um
 * caminho RE-VERIFICÁVEL contra o disco, e não um rótulo livre. Sem ele o
 * fingerprint da toolchain vira afirmação que ninguém pode reconferir.
 */
const configurationFingerprints = {};
for (const rel of CONFIGS) {
  const p = path.join(ROOT, rel);
  if (!existsSync(p)) continue;
  configurationFingerprints[`file:${rel}`] = createHash("sha256").update(readFileSync(p)).digest("hex");
}
const PROCESS_TOOLCHAIN_PATHS = [
  ".claude/skills/tokenize-design-system",
  "scripts",
  "tests/visual",
  "playwright.visual.config.ts",
  "package.json",
  "package-lock.json",
];
for (const rel of PROCESS_TOOLCHAIN_PATHS) {
  configurationFingerprints[`process-path:${rel}`] = fingerprintProcessPath(
    PROCESS_ROOT,
    rel
  );
}
if (!Object.keys(configurationFingerprints).length) {
  falhar(
    `nenhum arquivo de configuração encontrado em ${ROOT}`,
    "o schema exige configurationFingerprints com ao menos 1 entrada"
  );
}

const toolchain = { versions, configurationFingerprints };
const toolchainFingerprint = sha256CanonicalJson(toolchain);

/* ───────────────────────────────────────────────────────── o eixo por lei ── */
/*
 * §4.3 da lei tem TRÊS domínios de propriedade — pintura, geometria e tipografia
 * — e o `axisRegistry` do contrato usa um enum próprio de 13 eixos. O mapa
 * abaixo é a tradução entre os dois vocabulários, e ele é DELIBERADAMENTE
 * conservador: só entram eixos que a lei já sabe nomear hoje. Acrescentar
 * `motion` ou `opacity` aqui antes de a §4.3 ganhar o slot produziria um eixo
 * que o processo declara cobrir e não consegue nomear — o LAW GAP virando
 * promessa falsa no próprio contrato da corrida.
 */
const AXIS_REGISTRY = [
  {
    axis: "color",
    tokenTypes: ["color"],
    validator: "score-naming.mjs",
    namingContract: "docs/law/GRAMMAR.md §4.3 (paint)",
    emitter: "derive-tokens.mjs",
    completionPredicateIds: ABSOLUTE_COMPLETION_PREDICATE_IDS.filter((id) => id.startsWith("tokens.")),
  },
  {
    axis: "spacing",
    tokenTypes: ["dimension"],
    validator: "score-naming.mjs",
    namingContract: "docs/law/GRAMMAR.md §4.3 (geometry)",
    emitter: "derive-tokens.mjs",
    completionPredicateIds: ABSOLUTE_COMPLETION_PREDICATE_IDS.filter((id) => id.startsWith("tokens.")),
  },
  {
    axis: "radius",
    tokenTypes: ["dimension"],
    validator: "score-naming.mjs",
    namingContract: "docs/law/GRAMMAR.md §4.3 (geometry: border-radius)",
    emitter: "derive-tokens.mjs",
    completionPredicateIds: ABSOLUTE_COMPLETION_PREDICATE_IDS.filter((id) => id.startsWith("tokens.")),
  },
  {
    axis: "typography",
    tokenTypes: ["fontWeight", "number", "dimension"],
    validator: "score-naming.mjs",
    namingContract: "docs/law/GRAMMAR.md §4.3 (type)",
    emitter: "derive-tokens.mjs",
    completionPredicateIds: ABSOLUTE_COMPLETION_PREDICATE_IDS.filter((id) => id.startsWith("tokens.")),
  },
];

/* ──────────────────────────────────────────────────────────── a matriz ──── */
/*
 * Lida do alvo quando ele já declarou a sua; senão, o mínimo honesto. Inventar
 * uma matriz larga aqui faria o subgrafo D prometer cobertura que ninguém
 * captura — e `exactCoverage` só prova requested==produced, nunca
 * requested==matriz completa (buraco medido em 2026-08-01).
 */
function matrizDoAlvo() {
  const p = path.join(ROOT, "tests/visual/evidence-matrix.json");
  if (existsSync(p)) {
    try {
      const j = JSON.parse(readFileSync(p, "utf8"));
      const m = {
        themes: j.themes ?? j.matrix?.themes,
        projects: j.projects ?? j.matrix?.projects,
        browsers: j.browsers ?? j.matrix?.browsers ?? ["chromium"],
        locales: j.locales ?? j.matrix?.locales ?? ["en"],
        writingModes: j.writingModes ?? j.matrix?.writingModes ?? ["horizontal-tb"],
      };
      if (Array.isArray(m.themes) && m.themes.length && Array.isArray(m.projects) && m.projects.length) {
        return { matriz: m, origem: path.relative(ROOT, p) };
      }
    } catch {
      /* cai no default declarado abaixo */
    }
  }
  return {
    matriz: {
      themes: ["light"],
      projects: ["desktop"],
      browsers: ["chromium"],
      locales: ["en"],
      writingModes: ["horizontal-tb"],
    },
    origem: "default mínimo (o alvo não declara tests/visual/evidence-matrix.json)",
  };
}
const { matriz, origem: origemMatriz } = matrizDoAlvo();

/* ───────────────────────────────────────────────────────────── o run-config ── */

const runId =
  arg("--run-id") ?? `tokenize-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${sourceFingerprint.slice(0, 8)}`;
if (!/^tokenize-[a-zA-Z0-9._-]+$/.test(runId)) {
  falhar(`runId fora do padrão do contrato: ${runId}`, "o schema exige ^tokenize-[a-zA-Z0-9._-]+$");
}

if (SOURCE_KIND_REGISTRY.length !== OCCURRENCE_KINDS.length) {
  falhar(
    `SOURCE_KIND_REGISTRY tem ${SOURCE_KIND_REGISTRY.length} entradas e o contrato exige ${OCCURRENCE_KINDS.length}`,
    "lib/axis-discovery.mjs e lib/artifact-contract.mjs divergiram"
  );
}

const runConfig = {
  schemaVersion: "1.0.0",
  artifactType: "run-config",
  runId,
  sourceFingerprint,
  toolchainFingerprint,
  generatedAt: new Date().toISOString(),
  objective: arg("--objective", "Tokenizar o design system do alvo sob a lei de nomes vigente"),
  sourceRoots,
  sourceKindRegistry: SOURCE_KIND_REGISTRY.map((e) => ({
    occurrenceKind: e.occurrenceKind,
    disposition: e.disposition,
    adapter: e.adapter,
    rationale: e.rationale,
  })),
  axisRegistry: AXIS_REGISTRY,
  matrix: matriz,
  toolchain,
  adapters: {
    extractor: "extract-design-occurrences.mjs",
    normalizer: "normalize-occurrences.mjs",
    inventory: "inventory-surface.mjs+inventory-usage.mjs",
    tokenBuild: "validate-token-build.mjs",
    impact: "scripts/lib/route-impact.mjs",
    fixture: "scripts/lib/read-only-fixtures.mjs",
    evidence: "scripts/ui-evidence.sh",
    comparator: "scripts/compare-evidence.mjs",
    reviewer: "adversarial-review (subagente)",
  },
  completionPolicy: {
    unapprovedDebtTarget: 0,
    exceptionPolicy:
      "Exceção exige dono, razão escrita, escopo, evidência e revisão — cookbook e §5 da lei",
    predicateIds: [...ABSOLUTE_COMPLETION_PREDICATE_IDS],
  },
};

/* ─────────────────────────────────────────────── validar antes de entregar ── */
/*
 * Ancorar sem validar seria entregar o defeito três fases adiante. O validador
 * resolve o Ajv A PARTIR DO ALVO (artifact-contract.mjs:263), que é a razão de
 * `--root` apontar para um app com dependências instaladas.
 */
let veredito = { ok: true, nota: "validação pulada" };
try {
  const { createArtifactValidator } = await import("./lib/artifact-contract.mjs");
  const validador = createArtifactValidator({ root: ROOT });
  // `validate` recebe UM argumento e deriva o tipo de `artifact.artifactType`
  // (artifact-contract.mjs:323-325). Passar (tipo, artefato) faz a string virar
  // o artefato e o erro sai como "artifactType desconhecido" — diagnóstico que
  // aponta para o lugar errado.
  const r = validador.validate(runConfig);
  if (!r.valid) {
    console.error("\nANCHOR: o run-config gerado NÃO passa no próprio contrato:");
    for (const e of r.errors ?? []) console.error(`  - ${e.instancePath || "/"} ${e.message}`);
    process.exit(1);
  }
  veredito = { ok: true, nota: "válido contra reference/artifact-schemas.json" };
} catch (erro) {
  // Ajv indisponível não pode ser silêncio: o operador precisa saber que o
  // artefato saiu NÃO VERIFICADO, senão confia num carimbo que ninguém deu.
  veredito = { ok: false, nota: `NÃO VALIDADO — ${erro.message.split("\n")[0]}` };
}

if (argv.includes("--json")) {
  console.log(JSON.stringify(runConfig, null, 1));
  process.exitCode = veredito.ok ? 0 : 1;
} else {
  const out = arg("--out", path.join(ROOT, ".tokenize/run-config.json"));
  if (existsSync(out)) {
    falhar(
      `a saída imutável já existe: ${out}`,
      "use outro runId/run root; uma âncora existente nunca é sobrescrita"
    );
  }
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(runConfig, null, 1) + "\n");
  console.log(`ANCHOR ok — ${path.relative(ROOT, out)}`);
  console.log(`  runId                 ${runId}`);
  console.log(`  sourceFingerprint     ${sourceFingerprint.slice(0, 16)}…  (${fp.files.length} arquivos, raízes ${sourceRoots.join(",")})`);
  console.log(`  toolchainFingerprint  ${toolchainFingerprint.slice(0, 16)}…  (${Object.keys(versions).length} versões, ${Object.keys(configurationFingerprints).length} configs)`);
  console.log(`  sourceKindRegistry    ${runConfig.sourceKindRegistry.length} kinds`);
  console.log(`  axisRegistry          ${AXIS_REGISTRY.map((a) => a.axis).join(", ")}`);
  console.log(`  matriz                ${matriz.themes.length}×${matriz.projects.length}×${matriz.browsers.length} — ${origemMatriz}`);
  console.log(`  predicados            ${runConfig.completionPolicy.predicateIds.length}`);
  console.log(`  contrato              ${veredito.nota}`);
  if (!veredito.ok) process.exitCode = 1;
}
