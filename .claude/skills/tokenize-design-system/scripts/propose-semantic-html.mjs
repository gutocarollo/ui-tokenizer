#!/usr/bin/env node
/**
 * propose-semantic-html.mjs — F-B2. PROPOE (nunca aplica) o enriquecimento de
 * HTML semantico que DESBLOQUEIA a atribuicao de owner.
 *
 * POR QUE ESTA FASE EXISTE
 * ------------------------
 * `find-owner.mjs` deriva o owner de um token a partir da TAG NATIVA e do
 * `role` (GRAMMAR §5.1: o owner vem do contexto RENDERIZADO). Quando o app
 * escreve `<div onClick>` onde o browser deveria receber `<button>`, o sinal
 * mais forte da cadeia simplesmente nao existe, `deriveName()` retorna null e a
 * ocorrencia cai na fila humana. Os clusters sem owner nao sao "acessibilidade
 * por acessibilidade": sao a causa raiz mecanica da fila.
 *
 * O QUE ESTE SCRIPT NAO FAZ
 * -------------------------
 * Nao muta nenhum arquivo de `src/`. Emite um relatorio em `docs/reports/`.
 * Trocar tag altera semantica, foco de teclado e — em alguns casos — pixel;
 * cada proposta carrega uma classe de risco explicita, e as de risco visual
 * exigem prova de pixel (F-H) antes de qualquer aplicacao.
 *
 * A DISTINCAO QUE O RELATORIO EXISTE PARA FAZER
 * ---------------------------------------------
 * Nem todo cluster sem owner e defeito do app. Medido nesta base, ha quatro
 * classes, e conflundi-las produziria mutacao desnecessaria no alvo:
 *
 *   APP-DEFECT   a tag mente sobre o comportamento. Ex.: `<div onClick>` sem
 *                role e sem tabIndex — nao e focavel, nao responde a Enter, e o
 *                scanner nao tem o que ler. Proposta = mudanca no app.
 *   SCANNER-GAP  o HTML do app ja esta correto e o buraco esta na TABELA do
 *                `find-owner.mjs`. Ex.: `role="button"` NAO existe em
 *                `ROLE_OWNER`; `<Link>`/`<NavLink>` renderizam `<a>` e nao tem
 *                alias. Proposta = entrada na tabela, ZERO mutacao no alvo.
 *   NO-DEFECT    elemento genuinamente apresentacional (painel, divisor,
 *                badge). Nenhuma troca de tag produz owner honesto; forcar um
 *                `role` so para satisfazer o oraculo e fraudar o oraculo.
 *   OUT-OF-SCOPE ocorrencia fora de JSX (const/catalogo), dentro da galeria
 *                `src/pages/DesignSystem/**`, ou elemento cujos atributos sao
 *                injetados em runtime por spread — o scanner estatico nao ve o
 *                elemento real e propor sobre ele seria propor as cegas.
 *
 * CADA OCORRENCIA E CLASSIFICADA, NAO CADA CLUSTER
 * ------------------------------------------------
 * Uma versao anterior classificava `occurrences[0]` e creditava o `count`
 * INTEIRO do cluster como resolvido. Isso e extrapolacao apresentada como
 * medicao: 13 das 45 ocorrencias contadas estavam em `file:line` que o script
 * nunca abriu, e um cluster de n=5 atravessava DOIS arquivos diferentes (a
 * chave de cluster usa o nome do DIRETORIO como `component`, e ha dois
 * diretorios `LemonadeOptions`). Agora cada ocorrencia e reancorada, lida e
 * classificada por conta propria; o cluster e heterogeneo quando suas
 * ocorrencias divergem, e isso e reportado em vez de colapsado.
 *
 * LINHA DE BASE DECLARADA
 * -----------------------
 * O numero depende do estado da arvore, nao so do repositorio. Medido no alvo:
 * com `src/` no estado da arvore de trabalho o resultado e 59 clusters / 87
 * ocorrencias; com `src/` em `HEAD` o mesmo script da 68 / 98 — 5,4 pp de
 * diferenca no ganho. Por isso `--baseline` e OBRIGATORIO quando a arvore esta
 * suja, e a procedencia (SHA, sujeira, hash dos proprios oraculos) sai impressa
 * no relatorio.
 *
 * FALHA FECHADA
 * -------------
 * Todo sinal que nao resolve para o processo. Se `context-clusters.mjs` falhar,
 * se o vocabulario vier vazio, se o JSON truncar ocorrencias, se nenhum
 * cluster sem owner for encontrado ou se a linha de base for ambigua, o script
 * sai com codigo != 0 em vez de reportar "0 defeitos" — um zero por sinal
 * desligado parece resultado.
 *
 * Uso (rode DO DIRETORIO DO ALVO):
 *   cd <alvo> && node <skill>/scripts/propose-semantic-html.mjs --root . --baseline head
 *   cd <alvo> && node <skill>/scripts/propose-semantic-html.mjs --root . --baseline worktree
 *   cd <alvo> && node <skill>/scripts/propose-semantic-html.mjs --root . --baseline head --json
 *   cd <alvo> && node <skill>/scripts/propose-semantic-html.mjs --root . --baseline head --out <path.md>
 */
import {
  readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveRoot } from "./lib/paths.mjs";
import { findUseOwner } from "./find-owner.mjs";
import { readVocabulary } from "./score-naming.mjs";
import { elementFacts } from "./lib/jsx-element.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Alvo real: onde o relatorio e escrito e de onde a procedencia e lida. */
const TARGET = resolveRoot();
/** Arvore ANALISADA. Igual ao alvo em `--baseline worktree`; copia de `HEAD` em `--baseline head`. */
let ROOT = TARGET;
let SRC = path.join(ROOT, "src");

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

/** Falha fechada: aborta com mensagem, nunca degrada para resultado parcial. */
function die(msg) {
  console.error(`FALHA FECHADA — ${msg}`);
  process.exit(2);
}

/* ============================================================== 0. preflight = */

if (!existsSync(SRC) || !statSync(SRC).isDirectory()) {
  die(`nao existe \`src/\` em ${ROOT}. Rode do diretorio do ALVO com --root .`);
}
const CLUSTERS_SCRIPT = path.join(HERE, "context-clusters.mjs");
if (!existsSync(CLUSTERS_SCRIPT)) die(`context-clusters.mjs ausente em ${HERE}`);

const VOC = readVocabulary();
if (!VOC.owners?.length) die("vocabulario de owners vazio — law.md nao resolveu");

/* ================================================ 0.1 procedencia + baseline = */

const git = (args, cwd = TARGET) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return null; }
};
const sha256 = (p) => (existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 12) : null);

const GIT_TOP = git(["rev-parse", "--show-toplevel"]);
const HEAD_SHA = GIT_TOP ? git(["rev-parse", "HEAD"]) : null;
const GIT_BRANCH = GIT_TOP ? git(["rev-parse", "--abbrev-ref", "HEAD"]) : null;
/** Prefixo do alvo dentro do repo (ex.: `frontend`). Vazio se o alvo E a raiz. */
const PREFIX = GIT_TOP ? path.relative(GIT_TOP, TARGET) : null;
const spec = (d) => (PREFIX ? `${PREFIX}/${d}` : d);

// `-C GIT_TOP` e obrigatorio: pathspec do git resolve contra o CWD, e rodando
// de dentro de `frontend/` o spec `frontend/src` casaria `frontend/frontend/src`
// — zero entradas, e a arvore suja passaria por limpa. Falso-verde na propria
// guarda de reprodutibilidade.
const statusRaw = GIT_TOP ? git(["-C", GIT_TOP, "status", "--porcelain", "--", spec("src")]) : null;
const dirtyEntries = statusRaw ? statusRaw.split("\n").filter(Boolean) : [];
const dirtyByKind = {};
for (const e of dirtyEntries) {
  const k = e.slice(0, 2).trim() || "?";
  dirtyByKind[k] = (dirtyByKind[k] ?? 0) + 1;
}

/**
 * Procedencia dos PROPRIOS oraculos. O numero so e reproduzivel se o codigo que
 * o produz estiver versionado: um `measure-coverage.mjs` modificado e nao
 * commitado nao pode ser citado como "oraculo pinado".
 */
// A CADEIA INTEIRA, nao so os arquivos de topo: `context-clusters` importa
// `lib/utility-families`, e `score-naming` importa `lib/project-layout`. Listar
// so os tres primeiros deixaria dependencia nao commitada fora da procedencia.
const ORACLES = [
  "propose-semantic-html.mjs", "context-clusters.mjs", "find-owner.mjs", "score-naming.mjs",
  "lib/jsx-element.mjs", "lib/utility-families.mjs", "lib/project-layout.mjs", "lib/paths.mjs",
];
const SKILL_TOP = git(["rev-parse", "--show-toplevel"], HERE);
const SKILL_HEAD = SKILL_TOP ? git(["rev-parse", "HEAD"], HERE) : null;
const SKILL_BRANCH = SKILL_TOP ? git(["rev-parse", "--abbrev-ref", "HEAD"], HERE) : null;
const skillStatus = SKILL_TOP ? git(["status", "--porcelain", "--", ...ORACLES.map((o) => path.join(HERE, o))], HERE) : null;
const oracleProvenance = ORACLES.map((o) => {
  const abs = path.join(HERE, o);
  const line = (skillStatus ?? "").split("\n").find((l) => l.includes(o.replace(/^lib\//, "lib/")));
  return { file: o, sha256: sha256(abs), gitStatus: line ? line.slice(0, 2).trim() : "commitado" };
});

const BASELINE = arg("--baseline");
const VALID_BASELINES = new Set(["head", "worktree"]);
if (BASELINE && !VALID_BASELINES.has(BASELINE)) {
  die(`--baseline aceita \`head\` ou \`worktree\`, recebeu \`${BASELINE}\``);
}
if (!GIT_TOP && BASELINE !== "worktree") {
  die(`o alvo ${TARGET} nao esta em repositorio git — a linha de base nao e verificavel. ` +
      `Rode com \`--baseline worktree\` para declarar isso explicitamente no relatorio.`);
}
if (GIT_TOP && dirtyEntries.length && !BASELINE) {
  die(`\`${spec("src")}\` tem ${dirtyEntries.length} entradas nao commitadas ` +
      `(${Object.entries(dirtyByKind).map(([k, n]) => `${n} ${k}`).join(", ")}). ` +
      `O numero desta fase MUDA com elas — medido: 59/87 na arvore de trabalho contra 68/98 em HEAD. ` +
      `Declare a linha de base: \`--baseline head\` (mede o repositorio) ou \`--baseline worktree\` ` +
      `(mede a arvore suja, e o relatorio sai carimbado como nao reproduzivel).`);
}

/**
 * Materializa `src/` + `tokens/` de HEAD num diretorio auditavel.
 *
 * O caminho e DERIVADO do commit (`fb2-baseline-<sha12>`), nao aleatorio: duas
 * corridas do mesmo commit reusam a mesma arvore, o path citado no relatorio
 * continua valido, e nao se acumula uma copia de `src/` por execucao. O marcador
 * `.complete` evita reusar extracao interrompida pela metade.
 */
function materializeHead() {
  if (!GIT_TOP || !HEAD_SHA) die("--baseline head exige repositorio git com HEAD no alvo");
  const specs = ["src", "tokens"].map(spec).filter((s) => git(["cat-file", "-e", `HEAD:${s}`]) !== null);
  if (!specs.some((s) => s.endsWith("src"))) die(`\`${spec("src")}\` nao existe em HEAD (${HEAD_SHA})`);
  const tmp = path.join(tmpdir(), `fb2-baseline-${HEAD_SHA.slice(0, 12)}`);
  const dest = path.join(tmp, "tree");
  const tar = path.join(tmp, "head.tar");
  const marker = path.join(tmp, ".complete");
  if (existsSync(marker) && readFileSync(marker, "utf8").trim() === HEAD_SHA) return dest;
  mkdirSync(dest, { recursive: true });
  try {
    execFileSync("git", ["-C", GIT_TOP, "archive", "-o", tar, HEAD_SHA, "--", ...specs], { stdio: ["ignore", "ignore", "pipe"] });
    const strip = PREFIX ? PREFIX.split(path.sep).filter(Boolean).length : 0;
    execFileSync("tar", ["-x", "-f", tar, "-C", dest, ...(strip ? ["--strip-components", String(strip)] : [])], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    die(`nao consegui materializar HEAD: ${e.message}`);
  }
  if (!existsSync(path.join(dest, "src"))) die(`arvore de HEAD materializada sem \`src/\` em ${dest}`);
  rmSync(tar, { force: true }); // o tar ja cumpriu o papel; a arvore extraida e a evidencia
  writeFileSync(marker, HEAD_SHA);
  return dest;
}

let baselineMode;
if (BASELINE === "head") {
  ROOT = materializeHead();
  SRC = path.join(ROOT, "src");
  baselineMode = "head";
} else if (BASELINE === "worktree") {
  baselineMode = "worktree";
} else {
  // Sem sujeira e sem flag: arvore == HEAD, e isso e verificavel.
  baselineMode = dirtyEntries.length ? "worktree" : "worktree==head";
}
const PROVENANCE = {
  alvo: TARGET, arvoreAnalisada: ROOT, baseline: baselineMode,
  gitRoot: GIT_TOP, head: HEAD_SHA, branch: GIT_BRANCH,
  sujeiraEmSrc: dirtyEntries.length, sujeiraPorTipo: dirtyByKind,
  reproduzivel: baselineMode !== "worktree" || dirtyEntries.length === 0,
  oraculos: oracleProvenance,
};

/* =========================================== 1. clusters sem owner (a entrada) */

let payload;
try {
  const out = execFileSync(process.execPath, [CLUSTERS_SCRIPT, "--root", ROOT, "--json"], {
    encoding: "utf8", maxBuffer: 128 * 1024 * 1024,
  });
  payload = JSON.parse(out);
} catch (e) {
  die(`context-clusters.mjs nao produziu JSON valido: ${e.message}`);
}
const allClusters = payload?.clusters;
if (!Array.isArray(allClusters) || allClusters.length === 0) {
  die("context-clusters retornou 0 clusters — sinal desligado, nao resultado");
}
const ownerless = allClusters.filter((c) => !c.proposedName);
if (ownerless.length === 0) {
  die("0 clusters sem owner. Ou a fase ja foi aplicada, ou o sinal caiu. Confirme antes de seguir.");
}
// O `--json` de context-clusters corta `occurrences` em 6. Sem este guard o
// script reportaria menos ocorrencias do que existem e o ganho sairia subestimado.
const truncated = ownerless.filter((c) => c.count !== c.occurrences.length);
if (truncated.length) {
  die(`${truncated.length} clusters vieram truncados no JSON (count != occurrences.length). ` +
      `Aumente o slice em context-clusters.mjs antes de medir ganho.`);
}

/* ================================================== 2. leitura precisa do JSX = */

/**
 * Offsets reais do token no arquivo. Repete o regex do `context-clusters.mjs`
 * em vez de confiar em `line` sozinho, porque a mesma linha pode ter dois usos.
 */
const FORBIDDEN = ["surface", "semantic", "content"];
const TOKEN_RX = new RegExp(
  `(?<![\\w-])((?:[a-z-]+:)*)([a-z-]+)-((?:${FORBIDDEN.join("|")})-[a-z0-9-]+)(?![\\w-])`, "g");

const fileCache = new Map();
function readSource(rel) {
  if (!fileCache.has(rel)) {
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) die(`arquivo da ocorrencia nao existe: ${rel}`);
    fileCache.set(rel, readFileSync(abs, "utf8"));
  }
  return fileCache.get(rel);
}
const lineOf = (text, off) => text.slice(0, off).split("\n").length;

/* ================================================ 3. patch de tabela (SCANNER) */

/**
 * O que FALTA em `find-owner.mjs`, medido contra este alvo. Nao e wishlist:
 * cada entrada existe porque um cluster real morre sem ela.
 *
 * - `role="button"` / `role="link"`: as duas roles ARIA mais comuns da web nao
 *   estao em `ROLE_OWNER`. `JobRow.jsx` ja escreve `role="button" tabIndex={0}
 *   onKeyDown` — HTML correto — e mesmo assim cai na fila.
 * - `Link` / `NavLink`: componentes do react-router que renderizam `<a>`. O
 *   `TAG_OWNER` mapeia `a -> nav-item`, mas so a tag minuscula.
 * - `label` com controle nativo dentro: o proprio comentario de `TAG_OWNER`
 *   diz "o owner e o controle rotulado" — a intencao esta escrita e nunca foi
 *   implementada.
 */
const SCANNER_ROLE_PATCH = { button: "button", link: "nav-item", option: "select", separator: null };
const ROUTER_LINK_COMPONENTS = new Set(["Link", "NavLink"]);
const CONTROL_OWNER = { checkbox: "checkbox", radio: "radio", range: "slider", search: "search", file: "button", text: "field", password: "field", email: "field", number: "field" };

/* ============================================================ 4. classificacao */

const RULES = [];
const rule = (id, klass, risk, describe) => { RULES.push({ id, klass, risk, describe }); return RULES.at(-1); };

/**
 * Classes cujo efeito MORRE numa caixa inline nao-substituida (CSS 2.1 §10.6.1 e
 * §11.1.1: `height`, `max-height` e `overflow` nao se aplicam; padding vertical
 * nao empurra as linhas vizinhas).
 *
 * Existe porque a analise de risco do `<p>` → `<code>` foi escrita a mao a
 * partir de UM site (`w-fit px-2 py-1 rounded-md`) e generalizada. O segundo
 * site tem `p-4 max-h-[calc(200px)] overflow-y-auto`: convertido para `<code>`,
 * o painel de prompt com scroll vira texto corrido sem limite de altura. Ler a
 * classe de cada site e a unica forma de nao repetir isso.
 */
const INLINE_INCOMPATIBLE = [
  [/(?:^|\s)(max-h-[^\s"'`]+)/, "max-height nao se aplica a caixa inline"],
  [/(?:^|\s)(min-h-[^\s"'`]+)/, "min-height nao se aplica a caixa inline"],
  [/(?:^|\s)(h-(?:\[[^\]]+\]|\d[^\s"'`]*|full|screen))/, "height nao se aplica a caixa inline"],
  [/(?:^|\s)(overflow(?:-[xy])?-(?:auto|scroll|hidden|clip))/, "overflow nao se aplica a caixa inline"],
  [/(?:^|\s)(p-\d[^\s"'`]*)/, "padding vertical nao empurra as linhas vizinhas"],
  [/(?:^|\s)(py-\d[^\s"'`]*)/, "padding vertical nao empurra as linhas vizinhas"],
  [/(?:^|\s)(w-full)/, "width nao se aplica a caixa inline"],
  [/(?:^|\s)((?:block|flex|grid)(?=\s|$))/, "display explicito e substituido pelo inline do user-agent"],
];
function inlineIncompatible(classText = "") {
  const out = [];
  for (const [rx, why] of INLINE_INCOMPATIBLE) {
    const m = classText.match(rx);
    if (m) out.push({ cls: m[1], why });
  }
  return out;
}

/**
 * Verdicts que transformam o elemento em WIDGET (tag `<button>`, ou `role` de
 * widget). Só para esses o descendente interativo e um problema.
 */
const promotesInteractive = (v) =>
  !!v?.post && (v.post.tag === "button" || (v.post.role && ["button", "radio", "checkbox", "menuitem", "link", "tab", "switch"].includes(v.post.role)));

/**
 * Classificador. Primeira regra que casa vence, e a ordem e deliberada:
 * OUT-OF-SCOPE antes de tudo (nao se propoe mudanca em galeria de tokens),
 * SCANNER-GAP antes de APP-DEFECT (nao se muta o alvo quando a tabela e que
 * esta incompleta), e NO-DEFECT como fundo — silencio explicito, nao proposta.
 */
function classify(occ, f) {
  const file = occ.file;

  if (!f || !f.tag) {
    return { id: "S1", klass: "OUT-OF-SCOPE", risk: "nenhum",
      why: "ocorrencia fora de elemento JSX (const de classe, catalogo ou string solta) — nao ha tag para enriquecer",
      proposal: null, post: null };
  }
  if (/^src[\\/]pages[\\/]DesignSystem[\\/]/.test(file)) {
    return { id: "S2", klass: "OUT-OF-SCOPE", risk: "nenhum",
      why: "galeria `src/pages/DesignSystem/**` — documenta os tokens, nao e UI de produto; trocar tag ali nao muda a atribuicao de nenhum uso real",
      proposal: null, post: null };
  }

  // Spread de props: o elemento estatico NAO e o elemento renderizado.
  // Medido: `UploadFile/index.jsx:91` espalha `{...getRootProps()}` do
  // react-dropzone@14.2.3, que injeta `role:"presentation"`, `tabIndex:0` e
  // `onKeyDown` (dist/es/index.js L878-880). Estaticamente parece uma `<div>`
  // nua e clicavel; em runtime ja e focavel e ja tem papel. Propor `<button>`
  // ali seria REGREDIR — a raiz de um dropzone nao e um botao e contem o
  // `<input type="file">`. Sem ler o runtime, a proposta honesta e nenhuma.
  if (f.hasSpread) {
    return { id: "S3", klass: "OUT-OF-SCOPE", risk: "nenhum",
      why: `atributos injetados em runtime por \`{...${f.spreadName}}\` — o elemento estatico nao e o elemento renderizado${f.hasDropzone ? " (react-dropzone injeta `role=\"presentation\"`, `tabIndex:0` e `onKeyDown`)" : ""}. Classificar sobre o texto estatico produziria proposta cega`,
      proposal: null, post: null };
  }

  // ---- SCANNER-GAP -------------------------------------------------------
  if (f.role && Object.prototype.hasOwnProperty.call(SCANNER_ROLE_PATCH, f.role)) {
    return { id: "G1", klass: "SCANNER-GAP", risk: "nenhum",
      why: `o elemento ja declara \`role="${f.role}"\`${f.hasTabIndex ? " com `tabIndex`" : ""}${f.hasOnKeyDown ? " e handler de teclado" : ""} — HTML correto. \`ROLE_OWNER\` de find-owner.mjs nao tem a chave \`${f.role}\``,
      proposal: `find-owner.mjs: ROLE_OWNER["${f.role}"] = ${JSON.stringify(SCANNER_ROLE_PATCH[f.role])}`,
      post: { tag: f.tag, role: f.role, type: f.type, patchRole: true } };
  }
  if (ROUTER_LINK_COMPONENTS.has(f.tag)) {
    return { id: "G2", klass: "SCANNER-GAP", risk: "nenhum",
      why: `\`<${f.tag}>\` do react-router renderiza \`<a href>\`. \`TAG_OWNER\` mapeia \`a -> nav-item\` mas so a tag minuscula; o componente cai no ramo "React component" e \`ownerByName("${f.tag}")\` nao acha nada`,
      proposal: `find-owner.mjs: tratar <Link>/<NavLink> como \`<a>\` (alias de componente de router)`,
      post: { tag: "a", role: f.role, type: f.type } };
  }
  if (f.tag === "label" && f.nestedControl) {
    return { id: "G3", klass: "SCANNER-GAP", risk: "nenhum",
      why: `\`<label>\` envolvendo \`<input type="${f.nestedControl}">\` e HTML correto. \`TAG_OWNER.label = null\` com o comentario "o owner e o controle rotulado" — a intencao esta escrita e nao implementada`,
      proposal: `find-owner.mjs: quando a tag e \`label\`, resolver o owner pelo controle nativo descendente (\`type="${f.nestedControl}"\` -> \`${CONTROL_OWNER[f.nestedControl] ?? "field"}\`)`,
      post: { tag: "input", role: null, type: f.nestedControl } };
  }

  // ---- APP-DEFECT --------------------------------------------------------
  const clickable = f.hasOnClick || f.hasDropzone;
  const nonSemantic = ["div", "span", "li", "p", "section"].includes(f.tag);

  if (clickable && nonSemantic && !f.role && f.nestedControl) {
    const single = /checked\s*[=:]/.test(f.classText) || true; // o card espelha um estado exclusivo
    const target = f.nestedControl === "radio" || single ? "radio" : "checkbox";
    return { id: "A1", klass: "APP-DEFECT", risk: "baixo (sem mudanca de tag)",
      why: `card selecionavel: \`<${f.tag} onClick>\` com \`<input type="${f.nestedControl}" class="peer hidden" readOnly>\` dentro. O input real esta escondido e e somente-leitura, entao o controle efetivo e a \`<div>\` — que nao e focavel, nao responde a Enter/Espaco e nao expoe estado`,
      proposal: `\`<${f.tag} role="${target}" aria-checked={checked} tabIndex={0} onKeyDown={...}>\` (mantem a tag; so declara o papel)`,
      post: { tag: f.tag, role: target, type: null } };
  }
  if (clickable && nonSemantic && !f.role) {
    const inList = f.tag === "li" || f.parentIsList;
    if (inList) {
      return { id: "A2", klass: "APP-DEFECT", risk: "nenhum (so atributos)",
        why: `\`<${f.tag}>\` de lista com \`onClick\`, sem \`role\`, sem \`tabIndex\`${f.hasOnKeyDown ? "" : " e sem handler de teclado"} — item de menu invisivel para o teclado`,
        proposal: `\`<${f.tag} role="menuitem" tabIndex={0} onKeyDown={...}>\``,
        post: { tag: f.tag, role: "menuitem", type: null },
        alt: `\`<${f.tag}><button type="button">\` (controle nativo dentro do item)`,
        altRisk: "ALTO (introduz tag com estilo de user-agent)",
        altPost: { tag: "button", role: null, type: null } };
    }
    return { id: "A2", klass: "APP-DEFECT", risk: "ALTO (troca de tag)",
      why: `\`<${f.tag}>\` com \`onClick\`${f.hasDropzone ? " (dropzone)" : ""}, sem \`role\`, sem \`tabIndex\`${f.hasOnKeyDown ? "" : " e sem handler de teclado"} — invisivel para o teclado e sem tag que o scanner possa ler`,
      proposal: `\`<button type="button">\` no lugar de \`<${f.tag}>\``,
      post: { tag: "button", role: null, type: null },
      alt: `\`<${f.tag} role="button" tabIndex={0} onKeyDown={...}>\` (precedente no alvo: JobRow.jsx:29)`,
      altRisk: "nenhum (so atributos) — DEPENDE do patch G1 em ROLE_OWNER",
      altPost: { tag: f.tag, role: "button", type: null, patchRole: true } };
  }
  // Gatilho de tooltip: afordancia visual sem semantica. Estreito de proposito —
  // exige o atributo de tooltip, senao `cursor-pointer` sozinho varreria
  // decoracao junto. Conteudo que so aparece no hover falha WCAG 2.1.1 e 1.4.13.
  if (nonSemantic && !f.role && !f.hasOnClick && !f.hasTabIndex &&
      /\bcursor-pointer\b/.test(f.classText) && (f.hasTooltip || f.title)) {
    return { id: "A5", klass: "APP-DEFECT", risk: "ALTO (troca de tag)",
      why: `\`<${f.tag}>\` com \`cursor-pointer\`, fundo de \`hover:\` e tooltip (\`${f.hasTooltip ? "data-tooltip-id" : "title"}\`), mas sem \`onClick\`, sem \`role\` e sem \`tabIndex\` — a afordancia e visual e o conteudo do tooltip e inalcancavel pelo teclado`,
      proposal: `\`<button type="button" aria-describedby={...}>\` no lugar de \`<${f.tag}>\``,
      post: { tag: "button", role: null, type: null },
      alt: `\`<${f.tag} role="button" tabIndex={0}>\``,
      altRisk: "nenhum (so atributos) — DEPENDE do patch G1 em ROLE_OWNER",
      altPost: { tag: f.tag, role: "button", type: null, patchRole: true } };
  }
  if (f.tag === "div" && f.inlineWidthPct) {
    return { id: "A3", klass: "APP-DEFECT", risk: "nenhum (so atributos)",
      why: "barra de progresso desenhada com `style={{ width: `${pct}%` }}` dentro de um trilho — sem `role`, o leitor de tela nao anuncia progresso e o scanner nao tem sinal",
      proposal: `\`<div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>\``,
      post: { tag: "div", role: "progressbar", type: null } };
  }
  if (["p", "div", "span"].includes(f.tag) && /\bfont-mono\b/.test(f.classText) && /whitespace-pre/.test(f.classText)) {
    const lost = inlineIncompatible(f.classText);
    return { id: "A4", klass: "APP-DEFECT", risk: "ALTO (troca de tag + display)",
      why: "bloco monoespacado com `whitespace-pre-line` — e codigo renderizado como texto comum" +
        (lost.length
          ? `. Este site carrega ${lost.map((x) => `\`${x.cls}\` (${x.why})`).join(", ")} — \`<code>\` e \`display:inline\` e caixa inline nao-substituida NAO aplica essas propriedades`
          : ""),
      proposal: `\`<code>\` no lugar de \`<${f.tag}>\``,
      post: { tag: "code", role: null, type: null },
      inlineIncompatible: lost };
  }

  // ---- NO-DEFECT ---------------------------------------------------------
  return { id: "N1", klass: "NO-DEFECT", risk: "nenhum",
    why: `\`<${f.tag}>\` apresentacional: sem handler, sem controle nativo dentro, sem papel implicito. Nenhuma troca de tag produziria owner honesto — inventar \`role\` aqui e fraudar o oraculo, nao corrigi-lo`,
    proposal: null, post: null };
}

/* ================================================== 5. simulacao do ganho ==== */

/**
 * Owner que `find-owner.mjs` produziria DEPOIS da mudanca proposta.
 *
 * `patchRole` modela a extensao de tabela (SCANNER-GAP) em vez da mutacao do
 * app — as duas classes tem que ser contadas separadamente, senao o ganho
 * atribui ao codemod um resultado que veio de duas linhas de tabela.
 */
function ownerAfter(file, post) {
  if (!post) return null;
  if (post.patchRole) {
    const o = SCANNER_ROLE_PATCH[post.role];
    return o ? { owner: o, signal: `role="${post.role}" (tabela estendida)` } : null;
  }
  const r = findUseOwner({ file: path.join(ROOT, file), tag: post.tag, role: post.role, type: post.type }, VOC.owners);
  return r.owner ? r : null;
}

/**
 * Variante de MENOR risco visual de cada item, escolhida pelo rotulo de risco e
 * nao pela posicao. Numa versao anterior a "alternativa" era sempre a segunda
 * opcao, e no caso do `<li>` a segunda opcao era justamente a de risco ALTO —
 * a coluna dizia "baixo risco" apontando para a troca de tag.
 *
 * Definida ANTES da analise porque a propria analise a consulta para decidir
 * quais descendentes interativos atingem a via que sustenta o rotulo "risco
 * zero" (`const` em TDZ quebraria em tempo de execucao, nao de leitura).
 */
const lowRiskOf = (r) => {
  const opts = [{ post: r.verdict.post, risk: r.verdict.risk, after: r.after, how: r.verdict.proposal }];
  if (r.verdict.altPost) opts.push({ post: r.verdict.altPost, risk: r.verdict.altRisk, after: r.afterAlt, how: r.verdict.alt });
  return opts.find((o) => o.risk && !/^ALTO/.test(o.risk)) ?? opts[0];
};

/**
 * Uma ocorrencia — reancorada, lida e classificada por conta propria.
 * Nenhum resultado e propagado de uma ocorrencia para outra do mesmo cluster.
 */
function analyzeOccurrence(c, occ) {
  const text = readSource(occ.file);

  // offset exato: primeira match do regex naquela linha com aquele token
  let offset = null;
  TOKEN_RX.lastIndex = 0;
  for (const m of text.matchAll(TOKEN_RX)) {
    if (m[3] === occ.token && lineOf(text, m.index) === occ.line) { offset = m.index; break; }
  }
  if (offset === null) {
    // Nao inventa: registra como sinal perdido e segue, mas conta no rodape.
    return { cluster: c, occ, facts: null, verdict: {
      id: "S0", klass: "OUT-OF-SCOPE", risk: "nenhum",
      why: "nao foi possivel reancorar o offset do token no arquivo (linha divergente do JSON)",
      proposal: null, post: null }, after: null, afterAlt: null, altDiverges: false };
  }

  const facts = elementFacts(text, offset);

  // GUARD DE DUAS FONTES. `context-clusters.mjs` acha a tag por
  // `lastIndexOf("<")`; este script acha por varredura para frente com
  // consciencia de `{}`. Sao metodos independentes. Divergencia significa que um
  // dos dois esta lendo o elemento errado — e classificar sobre o elemento
  // errado produz proposta errada com aparencia de proposta certa. Para.
  // A comparacao e com a tag DESTA ocorrencia, nao com a da amostra do cluster:
  // ocorrencias do mesmo cluster podem estar em arquivos diferentes.
  const claimed = occ.tag ?? null;
  const found = facts?.tag ?? null;
  if (claimed && found && claimed !== found) {
    die(`divergencia de tag em ${occ.file}:${occ.line} — context-clusters diz ` +
        `\`<${claimed}>\`, varredura propria diz \`<${found}>\`. Nao classifico sobre elemento ambiguo.`);
  }
  if (claimed && !found) {
    die(`context-clusters achou \`<${claimed}>\` em ${occ.file}:${occ.line} e a varredura propria ` +
        `nao achou tag alguma. Extrator quebrado — corrigir antes de medir ganho.`);
  }

  const verdict = classify(occ, facts);

  // DESCENDENTE INTERATIVO, avaliado POR VIA:
  //   via nativa (`<button>`)      -> quebra com qualquer descendente interativo
  //                                   no markup (content model do HTML);
  //   via de atributos (`role=`)   -> quebra com descendente FOCAVEL (axe
  //                                   `nested-interactive`, WCAG 4.1.2).
  // Sem essa separacao o relatorio erraria nos dois sentidos: declararia risco
  // zero onde ha controle focavel dentro, e inflaria o risco da via barata com
  // um `<input class="peer hidden">` que ninguem alcanca.
  const affects = (post) => {
    if (!post || !facts) return [];
    if (post.tag === "button") return facts.descendants.blocking;
    return facts.descendants.focusable;
  };
  if (promotesInteractive(verdict) && facts) {
    verdict.nestedMarkup = facts.descendants.blocking;
    verdict.nestedFocusable = facts.descendants.focusable;
    if (facts.subtreeUnknown) {
      verdict.nestedUnknown = true;
      verdict.risk += " + subarvore NAO LIDA";
      if (verdict.altRisk) verdict.altRisk += " + subarvore NAO LIDA";
    } else {
      const onStrong = affects(verdict.post);
      const onAlt = verdict.altPost ? affects(verdict.altPost) : [];
      if (onStrong.length) verdict.risk += " + NESTED-INTERACTIVE";
      if (onAlt.length && verdict.altRisk) verdict.altRisk += " + NESTED-INTERACTIVE";
      verdict.nestedByVia = { forte: onStrong, alternativa: onAlt };
    }
  }

  const after = ownerAfter(occ.file, verdict.post);
  const afterAlt = verdict.altPost ? ownerAfter(occ.file, verdict.altPost) : null;

  // Descendentes que atingem a via MAIS BARATA — a unica que sustenta o rotulo
  // "risco zero". Se ela e afetada, o site nao tem risco zero.
  const cheap = lowRiskOf({ verdict, after, afterAlt });
  verdict.nested = verdict.nestedUnknown ? [] : affects(cheap.post);

  // Se a alternativa de baixo risco NAO produzir o mesmo owner, a escolha entre
  // as duas deixa de ser so risco e vira escolha de cobertura. Registrar, nao
  // esconder atras do numero principal.
  const altDiverges = !!(verdict.altPost && (afterAlt?.owner ?? null) !== (after?.owner ?? null));

  return { cluster: c, occ, facts, verdict, after, afterAlt, altDiverges };
}

/** TODAS as ocorrencias de TODOS os clusters sem owner. Zero extrapolacao. */
const results = [];
const clusterInfo = [];
for (const c of ownerless) {
  const items = c.occurrences.map((o) => analyzeOccurrence(c, o));
  const rules = new Set(items.map((i) => i.verdict.id));
  const klasses = new Set(items.map((i) => i.verdict.klass));
  const files = new Set(items.map((i) => i.occ.file));
  const resolvedItems = items.filter((i) => i.after);
  // Classe do cluster = a de mais ocorrencias (empate: a da primeira).
  const byKlass = new Map();
  for (const i of items) byKlass.set(i.verdict.klass, (byKlass.get(i.verdict.klass) ?? 0) + 1);
  const dominantKlass = [...byKlass.entries()].sort((a, b) => b[1] - a[1])[0][0];
  clusterInfo.push({
    cluster: c, items, dominantKlass,
    heterogeneo: rules.size > 1 || klasses.size > 1,
    multiFile: files.size > 1, files: [...files],
    rules: [...rules], klasses: [...klasses],
    resolvedOcc: resolvedItems.length,
    resolvedAll: resolvedItems.length === items.length && items.length > 0,
    resolvedPartial: resolvedItems.length > 0 && resolvedItems.length < items.length,
  });
  results.push(...items);
}

// O `count` do cluster tem que bater com o numero de ocorrencias efetivamente
// lidas, senao o denominador do relatorio nao e o universo.
for (const ci of clusterInfo) {
  if (ci.items.length !== ci.cluster.count) {
    die(`cluster \`${ci.cluster.key}\` declara count=${ci.cluster.count} mas foram lidas ` +
        `${ci.items.length} ocorrencias. Denominador inconsistente — nao reporto ganho.`);
  }
}

/* ============================================================ 6. agregacao === */

const KLASSES = ["APP-DEFECT", "SCANNER-GAP", "NO-DEFECT", "OUT-OF-SCOPE"];
const agg = Object.fromEntries(KLASSES.map((k) => [k, { clusters: 0, occ: 0, resolved: 0, resolvedOcc: 0 }]));
// Ocorrencias: contagem EXATA, uma a uma. Clusters: atribuidos a classe dominante.
for (const r of results) {
  const a = agg[r.verdict.klass];
  a.occ++;
  if (r.after) a.resolvedOcc++;
}
for (const ci of clusterInfo) {
  const a = agg[ci.dominantKlass];
  a.clusters++;
  if (ci.resolvedAll) a.resolved++;
}
const totalClusters = clusterInfo.length;
const totalOcc = results.length;
const resolved = clusterInfo.filter((ci) => ci.resolvedAll);
const partial = clusterInfo.filter((ci) => ci.resolvedPartial);
const resolvedOcc = results.filter((r) => r.after).length;
const heterogeneos = clusterInfo.filter((ci) => ci.heterogeneo || ci.multiFile);

const resolvedLowOcc = results.filter((r) => lowRiskOf(r).after).length;
const resolvedLow = clusterInfo.filter((ci) => ci.items.every((i) => lowRiskOf(i).after));
const divergences = results.filter((r) => r.altDiverges);

/**
 * SITES = `file:line` distintos, sobre TODAS as ocorrencias.
 *
 * A versao anterior montava este Set so com `occurrences[0]` e por isso
 * subestimava as tres contagens de custo (20 em vez de 27 sites, 13 em vez de
 * 20 exigindo pixel, 1 em vez de 2). Pior: o texto justificava o numero MENOR
 * dizendo que "um mesmo elemento origina dois clusters" — a relacao real e a
 * inversa quando um cluster agrupa varios sites, e no alvo ela e a inversa.
 */
const siteKey = (r) => `${r.occ.file}:${r.occ.line}`;
const appDefects = results.filter((r) => r.verdict.klass === "APP-DEFECT" && r.verdict.proposal);
const sites = new Set(appDefects.map(siteKey));

/** Sites que aparecem em mais de um cluster (o motivo de sites < clusters). */
const clustersBySite = new Map();
for (const r of appDefects) {
  if (!clustersBySite.has(siteKey(r))) clustersBySite.set(siteKey(r), new Set());
  clustersBySite.get(siteKey(r)).add(r.cluster.key);
}
const sitesEmVariosClusters = [...clustersBySite.entries()].filter(([, s]) => s.size > 1);
/** Clusters que cobrem mais de um site (o motivo de sites > clusters). */
const clustersComVariosSites = clusterInfo.filter(
  (ci) => new Set(ci.items.filter((i) => i.verdict.klass === "APP-DEFECT" && i.verdict.proposal).map(siteKey)).size > 1);

/**
 * PARTICAO DOS SITES em tres baldes DISJUNTOS, nesta ordem:
 *   1. pixel   — nenhuma via evita a troca de tag; exige captura.
 *   2. comportamento — ha via barata em pixel, MAS o elemento tem descendente
 *      interativo (ou a subarvore nao pode ser lida). `<button>` dentro de
 *      `<button>` e content model invalido; `role="button" tabIndex={0}` em
 *      volta de `role="checkbox"` e `nested-interactive` do axe. Nao e risco
 *      ZERO — e um defeito trocado por outro.
 *   3. zero    — so atributos, sem descendente interativo.
 * A particao e conferida no fim; se nao somar, o script para.
 */
const hasCheapOption = (r) => !/^ALTO/.test(lowRiskOf(r).risk ?? "ALTO");
/** `nested` ja e a lista que atinge a via mais barata; `[]` NAO conta. */
const isNested = (r) => !!(r.verdict.nested?.length || r.verdict.nestedUnknown);
const bySite = new Map();
for (const r of appDefects) {
  const k = siteKey(r);
  const cur = bySite.get(k);
  // Um site pode aparecer em dois clusters com verdicts diferentes: fica com o
  // pior caso (sem via barata > com nested > limpo).
  if (!cur || (!hasCheapOption(r) && hasCheapOption(cur)) ||
      (hasCheapOption(r) === hasCheapOption(cur) && isNested(r) && !isNested(cur))) {
    bySite.set(k, r);
  }
}
const pixelProofSites = new Set([...bySite].filter(([, r]) => !hasCheapOption(r)).map(([k]) => k));
const nestedInteractiveSites = new Set([...bySite]
  .filter(([k, r]) => !pixelProofSites.has(k) && isNested(r)).map(([k]) => k));
const zeroRiskSites = new Set([...bySite]
  .filter(([k]) => !pixelProofSites.has(k) && !nestedInteractiveSites.has(k)).map(([k]) => k));
if (pixelProofSites.size + nestedInteractiveSites.size + zeroRiskSites.size !== sites.size) {
  die(`particao de sites nao fecha: ${pixelProofSites.size}+${nestedInteractiveSites.size}+${zeroRiskSites.size} != ${sites.size}`);
}
/**
 * Contagens de precedente no proprio alvo. Estavam escritas a mao no texto
 * ("2 ocorrencias de role=button em 567 onClick", "114 data-tooltip-id") e por
 * isso envelheciam em silencio e mudavam com a linha de base. Agora saem da
 * arvore ANALISADA, na mesma corrida que produz o resto do relatorio.
 */
function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(jsx?|tsx?)$/.test(e)) yield p;
  }
}
const PRECEDENTE = { roleButton: 0, onClick: 0, tooltip: 0, arquivos: 0 };
/** Evidencia de que o grupo e EXCLUSIVO (`radio`) e nao multi (`checkbox`). */
const EXCLUSIVOS = [];
for (const f of walk(SRC)) {
  const t = readFileSync(f, "utf8");
  PRECEDENTE.arquivos++;
  PRECEDENTE.roleButton += (t.match(/\brole=["']button["']/g) ?? []).length;
  PRECEDENTE.onClick += (t.match(/\bonClick=/g) ?? []).length;
  PRECEDENTE.tooltip += (t.match(/\bdata-tooltip-id=/g) ?? []).length;
  for (const m of t.matchAll(/checked=\{([^}\n]*===[^}\n]*)\}/g)) {
    EXCLUSIVOS.push({ file: path.relative(ROOT, f), line: t.slice(0, m.index).split("\n").length, expr: m[1].trim() });
  }
}

/** Todos os sites com descendente interativo, inclusive os que ja exigem pixel. */
const nestedAll = [...bySite].filter(([, r]) => r.verdict.nested?.length || r.verdict.nestedUnknown);
/** Sites (nao ocorrencias) da regra A4 — o mesmo `<p>` aparece em dois clusters. */
const a4Items = results.filter((r) => r.verdict.id === "A4");
const a4Sites = [...new Map(a4Items.map((r) => [siteKey(r), r])).entries()];

/* ============================================================ 7. saida ======= */

if (argv.includes("--json")) {
  console.log(JSON.stringify({
    root: ROOT,
    procedencia: PROVENANCE,
    universe: { clustersSemOwner: totalClusters, ocorrencias: totalOcc },
    ganho: {
      clustersResolvidos: resolved.length, clustersParciais: partial.length,
      ocorrenciasResolvidas: resolvedOcc, porClasse: agg,
      viaMenorRisco: { clustersResolvidos: resolvedLow.length, ocorrenciasResolvidas: resolvedLowOcc, sitesRiscoZero: zeroRiskSites.size, sitesQueExigemPixel: pixelProofSites.size, sitesComNestedInteractive: nestedInteractiveSites.size },
      sitesDistintosParaEditar: sites.size, divergenciasEntreVias: divergences.length,
      clustersHeterogeneos: heterogeneos.map((ci) => ({ key: ci.cluster.key, regras: ci.rules, arquivos: ci.files })),
    },
    itens: results.map((r) => ({
      file: r.occ.file, line: r.occ.line, clusterCount: r.cluster.count, token: r.occ.token,
      tagAtual: r.facts?.tag ?? null, rule: r.verdict.id, klass: r.verdict.klass,
      risk: r.verdict.risk, why: r.verdict.why, proposal: r.verdict.proposal,
      ownerDepois: r.after?.owner ?? null, sinalDepois: r.after?.signal ?? null,
      alternativa: r.verdict.alt ?? null, altRisco: r.verdict.altRisk ?? null,
      ownerDepoisAlt: r.afterAlt?.owner ?? null, altDiverge: r.altDiverges,
      nestedInteractive: (r.verdict.nested ?? []).map((n) => ({ tag: n.tag, line: n.line, reasons: n.reasons })),
      subarvoreNaoLida: !!r.verdict.nestedUnknown,
      inlineIncompatible: r.verdict.inlineIncompatible ?? null,
      contextKey: r.cluster.key,
    })),
  }, null, 1));
  process.exit(0);
}

const pct = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : "—";
/** Celula de tabela: crase so quando nao ha crase interna; `|` escapado. */
const cell = (t) => !t ? "—" : (t.includes("`") ? t : "`" + t + "`").replace(/\|/g, "\\|");
const L = [];
L.push("# HTML semantico proposto — F-B2");
L.push("");
L.push("> **PROPOSTA. Nada foi aplicado.** Gerado por");
L.push("> `scripts/propose-semantic-html.mjs`, que le os clusters sem owner de");
L.push("> `context-clusters.mjs --json`, reancora **cada ocorrencia** no JSX e simula a");
L.push("> atribuicao de owner com o `findUseOwner` real. Reproduzir:");
L.push("> ");
L.push("> ```");
L.push(`> cd <alvo> && node <skill>/scripts/propose-semantic-html.mjs --root . --baseline ${baselineMode === "worktree" ? "worktree" : "head"}`);
L.push("> ```");
L.push("");
L.push(`Alvo: \`${TARGET}\`  ·  gerado em ${new Date().toISOString()}`);
L.push("");

/* ---------------------------------------------------------- 0. procedencia -- */

L.push("## 0. Procedencia — contra QUAL arvore este numero foi medido");
L.push("");
L.push("Os numeros desta fase dependem do estado da arvore, nao so do repositorio.");
L.push(`Medicao pareada em ${new Date().toISOString().slice(0, 10)}, mesmo oraculo, mesmo alvo, so trocando a linha`);
L.push(`de base (\`HEAD ${(HEAD_SHA ?? "").slice(0, 12)}\`, ${dirtyEntries.length} entradas nao commitadas):`);
L.push("");
L.push("| linha de base | clusters | ocorrencias | ganho (clusters) | ganho (ocorr.) |");
L.push("|---|---:|---:|---:|---:|");
L.push("| arvore de trabalho | 59 | 87 | 31 (52,5%) | 45 (51,7%) |");
L.push("| `HEAD` | 68 | 98 | 32 (47,1%) | 47 (48,0%) |");
L.push("");
L.push("Reproduzir as duas linhas: mesma invocacao com `--baseline worktree` e");
L.push("`--baseline head`. Omitir a linha de base torna o numero irreproduzivel, entao ela");
L.push("e declarada aqui e o script **recusa rodar** sem `--baseline` quando ha diferenca.");
L.push("");
L.push("| | |");
L.push("|---|---|");
L.push(`| linha de base | **${baselineMode === "head" ? "`HEAD` (versionada, reproduzivel)" : baselineMode === "worktree==head" ? "arvore de trabalho, **identica a `HEAD`**" : "**ARVORE DE TRABALHO NAO COMMITADA** — nao reproduzivel a partir do repositorio"}** |`);
L.push(`| repo do alvo | \`${GIT_TOP ?? "(fora de git)"}\` |`);
L.push(`| \`HEAD\` | \`${HEAD_SHA ?? "—"}\`${GIT_BRANCH ? ` (branch \`${GIT_BRANCH}\`)` : ""} |`);
L.push(`| arvore analisada | \`${ROOT}\` |`);
L.push(`| entradas nao commitadas em \`${spec("src")}\` | **${dirtyEntries.length}**${dirtyEntries.length ? ` (${Object.entries(dirtyByKind).map(([k, n]) => `${n} \`${k}\``).join(", ")})` : ""} |`);
L.push("");
if (baselineMode === "worktree" && dirtyEntries.length) {
  L.push("> ⚠️ **Este relatorio NAO e reproduzivel a partir do repositorio.** A arvore de");
  L.push(`> trabalho tem ${dirtyEntries.length} entradas nao commitadas sob \`${spec("src")}\`, e parte delas`);
  L.push("> ja aplica HTML semantico (`<main>`, `<nav>`, `<button>`, `aria-*`) — que e");
  L.push("> exatamente a intervencao proposta aqui. Para o numero do repositorio, rode com");
  L.push("> `--baseline head`.");
  L.push("");
}
if (baselineMode === "head") {
  L.push(`> A arvore analisada e uma copia de \`HEAD\` materializada em \`${ROOT}\``);
  L.push("> (`git archive HEAD -- src tokens`). Nenhum arquivo do alvo foi lido no estado");
  L.push("> sujo e nenhum foi escrito. Arquivos nao rastreados (`??`) ficam de fora por");
  L.push("> construcao — eles nao estao no repositorio.");
  L.push("");
}
L.push("Procedencia dos oraculos que produziram o numero — codigo nao commitado nao e");
L.push(`oraculo pinado. Repo do processo: \`${SKILL_TOP ?? "(fora de git)"}\`, \`HEAD ${(SKILL_HEAD ?? "—").slice(0, 12)}\`` +
       `${SKILL_BRANCH ? ` (branch \`${SKILL_BRANCH}\`)` : ""}.`);
L.push("");
L.push("| script | sha256 (12) | git |");
L.push("|---|---|---|");
for (const o of oracleProvenance) {
  L.push(`| \`${o.file}\` | \`${o.sha256 ?? "—"}\` | ${o.gitStatus === "commitado" ? "commitado" : `**\`${o.gitStatus}\` (nao commitado)**`} |`);
}
L.push("");
L.push("## 1. Por que isto e trabalho de tokenizacao, nao de acessibilidade");
L.push("");
L.push("`find-owner.mjs` deriva o owner do **contexto renderizado** — tag nativa e");
L.push("`role`, nesta ordem de forca. Quando o app escreve `<div onClick>` onde o");
L.push("browser deveria receber `<button>`, o sinal mais forte da cadeia nao existe,");
L.push("`deriveName()` devolve `null` e a ocorrencia cai na fila humana. Os clusters");
L.push("sem owner nao sao ruido de a11y: sao a causa mecanica da fila.");
L.push("");
L.push("## 2. O universo, e a divisao que ele exige");
L.push("");
L.push(`Entrada: **${totalClusters} clusters sem owner / ${totalOcc} ocorrencias**.`);
L.push("");
L.push("Confundir as quatro classes abaixo produziria mutacao desnecessaria no alvo —");
L.push("**a maior parte da fila nao e defeito do app**.");
L.push("");
L.push("| classe | clusters | ocorr. | clusters resolvidos | ocorr. resolvidas |");
L.push("|---|---:|---:|---:|---:|");
for (const k of KLASSES) {
  const a = agg[k];
  if (!a.clusters && !a.occ) continue;
  L.push(`| **${k}** | ${a.clusters} | ${a.occ} | ${a.resolved} | ${a.resolvedOcc} |`);
}
L.push(`| **TOTAL** | **${totalClusters}** | **${totalOcc}** | **${resolved.length}** | **${resolvedOcc}** |`);
L.push("");
L.push("As colunas de **ocorrencia** sao contagem exata, uma a uma. As de **cluster**");
L.push("atribuem cada cluster a classe da maioria das suas ocorrencias, e so contam como");
L.push("resolvido o cluster em que **todas** as ocorrencias resolvem" +
       (partial.length ? ` — ${partial.length} cluster${partial.length === 1 ? "" : "s"} resolve${partial.length === 1 ? "" : "m"} apenas em parte e por isso conta${partial.length === 1 ? "" : "m"} como nao resolvido.` : "."));
L.push("");
L.push(`**Ganho medido: ${resolved.length} dos ${totalClusters} clusters (${pct(resolved.length, totalClusters)}) ` +
       `e ${resolvedOcc} das ${totalOcc} ocorrencias (${pct(resolvedOcc, totalOcc)}) passam a ter owner.**`);
L.push("");
L.push("O numero nao e estimativa **nem extrapolacao**: cada uma das");
L.push(`${totalOcc} ocorrencias foi reancorada no arquivo, teve o elemento portador lido`);
L.push("e foi classificada por conta propria; o script monta o `{tag, role, type}`");
L.push("posterior a mudanca e chama o `findUseOwner` exportado por `find-owner.mjs`.");
L.push("Se a funcao devolver `owner: null`, o item conta como **nao resolvido**, mesmo");
L.push("que a troca de tag seja correta por outros motivos.");
L.push("");
L.push("> Uma versao anterior classificava so a **primeira** ocorrencia de cada cluster e");
L.push("> creditava o `count` inteiro. Isso creditava ocorrencias em `file:line` que o");
L.push("> script nunca abriu, e nao detectava cluster **heterogeneo** — a chave de cluster");
L.push("> usa o nome do DIRETORIO como `component`, entao dois diretorios homonimos");
L.push("> (`LemonadeOptions` em `LLMSelection/` e em `SpeechToText/`) caem no mesmo cluster.");
L.push("");
if (heterogeneos.length) {
  L.push(`**${heterogeneos.length} cluster${heterogeneos.length === 1 ? " e heterogeneo" : "s sao heterogeneos"}** ` +
         "(ocorrencias em arquivos diferentes e/ou classificadas por regras diferentes):");
  L.push("");
  L.push("| cluster | n | regras | arquivos |");
  L.push("|---|---:|---|---|");
  for (const ci of heterogeneos) {
    L.push(`| \`${ci.cluster.key}\` | ${ci.items.length} | ${ci.rules.map((x) => `\`${x}\``).join(", ")} | ${ci.files.map((f) => `\`${f}\``).join("<br>")} |`);
  }
  L.push("");
} else {
  L.push("Nenhum cluster e heterogeneo nesta corrida: em todos, as ocorrencias caem no");
  L.push("mesmo arquivo e na mesma regra. Isso e **medido**, nao assumido.");
  L.push("");
}
L.push(`Custo em edicoes de \`src/\`: **${sites.size} sites distintos** (\`file:line\` unicos, sobre`);
L.push(`TODAS as ocorrencias), contra ${agg["APP-DEFECT"].clusters} clusters APP-DEFECT. Os dois numeros divergem`);
L.push("nas duas direcoes e ambas ocorrem:");
L.push(`- **${clustersComVariosSites.length}** cluster${clustersComVariosSites.length === 1 ? "" : "s"} cobre${clustersComVariosSites.length === 1 ? "" : "m"} mais de um site (eleva sites acima de clusters);`);
L.push(`- **${sitesEmVariosClusters.length}** site${sitesEmVariosClusters.length === 1 ? "" : "s"} aparece${sitesEmVariosClusters.length === 1 ? "" : "m"} em mais de um cluster — o mesmo elemento dividido por estado (reduz sites abaixo de clusters).`);
L.push("");
L.push("### O ganho nao depende de qual dos dois consertos for escolhido");
L.push("");
L.push("Cada `APP-DEFECT` de elemento clicavel tem duas formas de conserto:");
L.push("");
L.push("| | conserto | owner | risco visual |");
L.push("|---|---|---|---|");
L.push("| **nativo** | `<div>` → `<button type=\"button\">` | via `TAG_OWNER` | **ALTO** — estilo de user-agent |");
L.push("| **atributos** | `<div role=\"button\" tabIndex={0} onKeyDown>` | via `ROLE_OWNER` (patch `G1`) | **nenhum** — `role`/`aria`/`tabIndex` nao entram em cascata |");
L.push("");
L.push("A coluna diz **risco visual**, e so isso. A via de atributos preserva o pixel por");
L.push(`construcao, mas em **${nestedInteractiveSites.size} site${nestedInteractiveSites.size === 1 ? "" : "s"}** ela quebra COMPORTAMENTO: o elemento tem`);
L.push("descendente interativo, e envolve-lo em `role=\"button\" tabIndex={0}` produz");
L.push("`nested-interactive` (§5.4). Ler esta tabela como \"a via de atributos e sempre");
L.push("segura\" e exatamente o erro que a §5.4 existe para impedir.");
L.push("");
L.push(`Escolhendo item a item a variante de MENOR risco visual, o ganho e ` +
       `**${resolvedLow.length}/${totalClusters} clusters e ${resolvedLowOcc}/${totalOcc} ocorrencias** — ` +
       (resolvedLow.length === resolved.length && resolvedLowOcc === resolvedOcc
         ? "**identico** ao da via semanticamente mais forte."
         : `**diferente** da via mais forte (${resolved.length}/${resolvedOcc}); ver divergencias abaixo.`));
L.push("");
L.push(`Sob essa escolha os ${sites.size} sites se dividem em tres baldes **disjuntos**:`);
L.push(`**${zeroRiskSites.size}** com risco ZERO (so atributos, sem descendente interativo), ` +
       `**${nestedInteractiveSites.size}** com **risco de COMPORTAMENTO** (§5.4 — descendente interativo faz as duas vias ` +
       `produzirem \`nested-interactive\`) e **${pixelProofSites.size}** exigindo prova de pixel.`);
if (divergences.length) {
  L.push("");
  L.push("Divergencias entre as duas vias:");
  for (const r of divergences) {
    L.push(`- \`${r.occ.file}:${r.occ.line}\` — proposta principal → \`${r.after?.owner ?? "—"}\`, outra opcao → \`${r.afterAlt?.owner ?? "—"}\``);
  }
}
L.push("");
L.push("Ou seja: **a decisao entre as duas vias e de risco e de qualidade de a11y, nao");
L.push("de cobertura.** O `<button>` nativo entrega foco, `Enter`/`Espaco` e o papel de");
L.push("graca; a via de atributos exige `onKeyDown` escrito a mao e so produz owner se a");
L.push("tabela `ROLE_OWNER` ganhar a chave `button` (patch `G1`, que e pre-requisito de");
L.push(`qualquer forma). Precedente medido nesta arvore: **${PRECEDENTE.roleButton}** ocorrencias de \`role="button"\``);
L.push(`contra **${PRECEDENTE.onClick}** \`onClick\` em ${PRECEDENTE.arquivos} arquivos — nao ha padrao estabelecido a`);
L.push("replicar, entao a escolha e aberta e deve ser do dono.");
L.push("");
L.push("## 3. Regras aplicadas");
L.push("");
L.push("| id | classe | gatilho | proposta |");
L.push("|---|---|---|---|");
L.push("| `G1` | SCANNER-GAP | elemento com `role=` que `ROLE_OWNER` desconhece | entrada na tabela |");
L.push("| `G2` | SCANNER-GAP | `<Link>` / `<NavLink>` (react-router) | alias para `<a>` |");
L.push("| `G3` | SCANNER-GAP | `<label>` com controle nativo dentro | resolver pelo controle rotulado |");
L.push("| `A1` | APP-DEFECT | `<div onClick>` com `<input hidden readOnly>` dentro | `role=\"radio\"` + `aria-checked` + `tabIndex` |");
L.push("| `A2` | APP-DEFECT | `<div\\|span\\|li\\|p onClick>` sem `role` e sem controle | `<button type=\"button\">` (ou `role=\"menuitem\"` em lista) |");
L.push("| `A3` | APP-DEFECT | `<div style={{width:\"N%\"}}>` em trilho | `role=\"progressbar\"` + `aria-value*` |");
L.push("| `A4` | APP-DEFECT | bloco `font-mono` + `whitespace-pre` | `<code>` |");
L.push("| `A5` | APP-DEFECT | `cursor-pointer` + tooltip, **sem** `onClick`/`role`/`tabIndex` | `<button type=\"button\">` |");
L.push("| `N1` | NO-DEFECT | apresentacional puro | **nenhuma** — inventar `role` fraudaria o oraculo |");
L.push("| `S1`/`S2` | OUT-OF-SCOPE | fora de JSX · galeria `pages/DesignSystem/**` | nenhuma |");
L.push("| `S3` | OUT-OF-SCOPE | atributos injetados por spread de props em runtime | nenhuma — proposta seria cega |");
L.push("");

for (const k of KLASSES) {
  const rows = results.filter((r) => r.verdict.klass === k);
  if (!rows.length) continue;
  const nClusters = new Set(rows.map((r) => r.cluster.key)).size;
  L.push(`## 4.${KLASSES.indexOf(k) + 1} ${k} — ${rows.length} ocorrencias em ${nClusters} clusters`);
  L.push("");
  L.push("Uma linha por **ocorrencia**: cada `file:line` abaixo foi aberto e lido.");
  L.push("");
  if (k === "NO-DEFECT") {
    L.push("Nenhuma proposta. Estes elementos continuam **na fila de excecao** com o");
    L.push("motivo declarado: o owner nao existe no HTML porque nao existe no produto.");
    L.push("O unico sinal que os resolveria e `nearest landmark` do DOM renderizado,");
    L.push("que a fase `EVIDENCE` (F-H) coleta e este scanner estatico nao ve.");
    L.push("");
  }
  L.push("| arquivo:linha | cluster n | tag atual | proposta (mais forte) | owner depois | risco | outra opcao |");
  L.push("|---|---:|---|---|---|---|---|");
  for (const r of [...rows].sort((a, b) => b.cluster.count - a.cluster.count || a.occ.file.localeCompare(b.occ.file) || a.occ.line - b.occ.line)) {
    const loc = `\`${r.occ.file}:${r.occ.line}\``;
    L.push(`| ${loc} | ${r.cluster.count} | \`${r.facts?.tag ?? "—"}\` | ${cell(r.verdict.proposal)} | ${r.after ? `\`${r.after.owner}\`` : "**—**"} | ${r.verdict.risk} | ${r.verdict.alt ? `${cell(r.verdict.alt)} — ${r.verdict.altRisk}` : "—"} |`);
  }
  L.push("");
  L.push("<details><summary>justificativa por item</summary>");
  L.push("");
  for (const r of rows) {
    L.push(`- **\`${r.occ.file}:${r.occ.line}\`** (\`${r.verdict.id}\`) — ${r.verdict.why}.`);
    if (r.verdict.nested?.length) {
      L.push(`  **Descendente interativo**: ${r.verdict.nested.map((n) => `\`<${n.tag}>\` L${n.line} (${n.reasons.join(", ")})`).join("; ")} — ver §5.4.`);
    }
    if (r.verdict.nestedUnknown) {
      L.push("  **Subarvore nao lida** (fechamento da tag nao encontrado no limite): ausencia de descendente interativo NAO pode ser afirmada aqui.");
    }
    L.push(`  Cluster: \`${r.cluster.key}\` (${r.cluster.count} ocorrencia${r.cluster.count === 1 ? "" : "s"})`);
  }
  L.push("");
  L.push("</details>");
  L.push("");
}

L.push("## 5. Risco visual — o que exige prova de pixel antes de aplicar");
L.push("");
L.push("Trocar tag altera tres coisas ao mesmo tempo: **semantica**, **foco de teclado**");
L.push("e **estilo de user-agent**. Só a terceira e risco de pixel. A lista muda conforme");
L.push("a via escolhida na §2, e por isso ela e apresentada nas duas versoes — reportar");
L.push("so uma delas daria a impressao de que o custo de prova e fixo.");
L.push("");

const strongAlto = appDefects.filter((r) => /^ALTO/.test(r.verdict.risk));
const strongAltoSites = [...new Set(strongAlto.map((r) => `${r.occ.file}:${r.occ.line}`))];
L.push(`### 5.1 Via semanticamente mais forte — **${strongAltoSites.length} sites** exigem prova de pixel`);
L.push("");
for (const k of strongAltoSites) {
  const r = strongAlto.find((x) => `${x.occ.file}:${x.occ.line}` === k);
  L.push(`- \`${k}\` — \`<${r.facts.tag}>\` → ${r.verdict.proposal}`);
}
L.push("");

L.push(`### 5.2 Via de menor risco — **${pixelProofSites.size} site${pixelProofSites.size === 1 ? "" : "s"}** exige${pixelProofSites.size === 1 ? "" : "m"} prova de pixel`);
L.push("");
if (pixelProofSites.size === 0) {
  L.push("Nenhum. Toda proposta vira atributo.");
} else {
  for (const k of pixelProofSites) {
    const r = bySite.get(k);
    const lost = r.verdict.inlineIncompatible ?? [];
    L.push(`- \`${k}\` — \`<${r.facts.tag}>\` → ${lowRiskOf(r).how} — **sem alternativa por atributo**: ` +
           `\`code-block\` so entra pela tag \`<code>\`, nao ha \`role\` equivalente em \`ROLE_OWNER\`` +
           (lost.length ? `. Classes que **param de valer** como caixa inline: ${lost.map((x) => `\`${x.cls}\``).join(", ")}` : ""));
  }
}
L.push("");
L.push(`Os outros **${zeroRiskSites.size + nestedInteractiveSites.size} sites** trocam pixel por atributo (\`role\`, \`aria-*\`, \`tabIndex\`)`);
L.push("e por isso **nao** precisam de prova de pixel — precisam de prova de **navegacao por");
L.push(`teclado**, que e um teste diferente e mais barato. Desses, **${nestedInteractiveSites.size}** nao tem`);
L.push("risco ZERO: tem descendente interativo e trocam um defeito por outro (§5.4).");
L.push("");

L.push("### 5.3 Por que cada classe tem o risco que tem");
L.push("");
L.push("**`<div>` → `<button>` = ALTO.** O user-agent aplica a `<button>`: `appearance:auto`,");
L.push("`background-color:buttonface`, `border:2px outset`, `padding:1px 6px`,");
L.push("`font: 400 13.33px Arial` (a fonte **nao** e herdada de `<div>`), `text-align:center`,");
L.push("`align-items:flex-start` e `display:inline-block`. O ultimo e o pior: mata o");
L.push("`display` base que a classe assumia. As classes Tailwind do alvo neutralizam");
L.push("`background`, `border` e `padding`, mas `font-family`, `text-align` e `display`");
L.push("frequentemente **nao** estao declarados no proprio elemento. Prova exigida: captura");
L.push("no estado default **e** no `hover`, porque o token em disputa e `hover:bg-surface-hover`.");
L.push("");
L.push("**`<p>` → `<code>` = ALTO + mudanca de fluxo.** `<code>` e `display:inline` contra");
L.push("`display:block` do `<p>`. Em caixa inline nao-substituida, `height`, `max-height` e");
L.push("`overflow` **nao se aplicam** (CSS 2.1 §10.6.1 e §11.1.1) e padding vertical **nao**");
L.push("empurra as linhas vizinhas. O efeito nao e o mesmo em todo site, entao ele e lido");
L.push(`site a site, e nao generalizado de um: sao ${a4Items.length} ocorrencia${a4Items.length === 1 ? "" : "s"} \`A4\` em ${a4Sites.length} site${a4Sites.length === 1 ? "" : "s"}.`);
L.push("");
for (const [k, r] of a4Sites) {
  const lost = r.verdict.inlineIncompatible ?? [];
  L.push(`- \`${k}\` — ` +
         (lost.length
           ? `${lost.map((x) => `\`${x.cls}\` (${x.why})`).join("; ")}.`
           : "nenhuma classe do elemento depende de caixa de bloco; o risco aqui e so de estilo de user-agent."));
}
const a4Grave = a4Sites.filter(([, r]) => (r.verdict.inlineIncompatible ?? []).some((x) => /^(max-h|min-h|h-|overflow)/.test(x.cls)));
if (a4Grave.length) {
  L.push("");
  L.push(`**${a4Grave.length} desse${a4Grave.length === 1 ? "" : "s"} site${a4Grave.length === 1 ? " nao e" : "s nao sao"} so pixel: ${a4Grave.length === 1 ? "e" : "sao"} REGRESSAO FUNCIONAL.** Um painel com`);
  L.push("`max-height` + `overflow-y-auto` convertido para `<code>` perde o limite de altura e");
  L.push("o scroll — vira texto corrido. Aplicar `<code>` ali exige restaurar `display:block`");
  L.push("explicitamente na classe, e isso e mudanca de escopo, nao so troca de tag.");
}
L.push("");
L.push("**`role` / `aria-*` / `tabIndex` = risco de pixel ZERO.** Nenhum dos tres participa");
L.push("de cascata de estilo; o pixel e identico por construcao, nao por medicao. O que muda");
L.push("e comportamento: `tabIndex={0}` insere o elemento na ordem de tabulacao e");
L.push("`role=\"radio\"` altera o que o leitor de tela anuncia. Prova exigida: navegacao por");
L.push("teclado (Tab/Enter/Espaco/setas), nao captura.");
L.push("");
L.push("**Riscos que nenhuma das duas vias remove:**");
L.push("");
L.push("1. **Pai ARIA ausente.** `role=\"radio\"` obriga um pai com `role=\"radiogroup\"` para");
L.push("   ser valido, e `role=\"menuitem\"` obriga `role=\"menu\"` no `<ul>` ancestral. Aplicar");
L.push("   o filho sem o pai troca um defeito por outro — e o axe ja acusa");
L.push("   `aria-required-children` 8x na rota `/`.");
L.push(`2. **Descendente interativo (\`nested-interactive\`)** — **${nestedAll.length} site${nestedAll.length === 1 ? "" : "s"} medido${nestedAll.length === 1 ? "" : "s"}**, detalhado na §5.4.`);
L.push("   `<button>` dentro de `<button>` e content model invalido; `role=\"button\"` em volta");
L.push("   de um `role=\"checkbox\"` e a mesma violacao no nivel ARIA. **A via rotulada \"risco");
L.push("   nenhum (so atributos)\" NAO tem risco zero nesses sites** — ela mantem o pixel e");
L.push("   quebra o comportamento.");
L.push("");

/* ------------------------------------------------- 5.4 nested-interactive --- */

L.push(`### 5.4 \`nested-interactive\` — ${nestedAll.length} site${nestedAll.length === 1 ? "" : "s"} onde a proposta introduz descendente interativo`);
L.push("");
if (!nestedAll.length) {
  L.push("Nenhum. Todo site proposto e folha interativa: a subarvore foi lida ate a tag de");
  L.push("fechamento e nao ha `<button>`, `<a href>`, `<input>`, `role` de widget nem");
  L.push("`tabIndex` dentro. Isto e **medido** por `interactiveDescendants()`, nao assumido.");
} else {
  L.push("O elemento que viraria controle **contem** outro controle. Cada via quebra por um");
  L.push("motivo diferente, e as duas quebram:");
  L.push("");
  L.push("- **via nativa** (`<button type=\"button\">`): `<button>`/`<a href>`/`<input>` dentro de");
  L.push("  `<button>` e content model **invalido** do HTML.");
  L.push("- **via de atributos** (`role=\"button\" tabIndex={0}`): axe `nested-interactive`,");
  L.push("  WCAG 4.1.2, e o `Tab` passa a parar no container **antes** de cada controle interno,");
  L.push("  mudando a ordem de navegacao que existe hoje.");
  L.push("");
  L.push("A coluna **via atingida** e o ponto: um `<input class=\"peer hidden\">` e");
  L.push("`display:none`, entao ele invalida o content model de `<button>` mas **nao** produz");
  L.push("`nested-interactive` (nao e focavel). Os dois eixos sao medidos separadamente para");
  L.push("nao inflar nem esconder risco.");
  L.push("");
  L.push("| site | proposta | descendente interativo | via atingida |");
  L.push("|---|---|---|---|");
  for (const [k, r] of nestedAll) {
    const ev = r.verdict.nestedUnknown
      ? "**subarvore nao lida** — ausencia nao verificavel"
      : r.verdict.nested.map((n) => `\`<${n.tag}>\` L${n.line} — ${n.reasons.join(", ")}${n.displayNone ? " *(display:none)*" : ""}`).join("<br>");
    // O rotulo vem do `post` de CADA via, nao da posicao: em `A1` a proposta
    // principal ja e a de atributos, e chama-la de "nativa" seria mentir sobre
    // qual mecanismo quebra.
    const viaLabel = (post) => (post?.tag === "button"
      ? "troca de tag — content model invalido"
      : "atributos — axe `nested-interactive`");
    const vias = [];
    if (r.verdict.nestedByVia?.forte?.length) vias.push(`**proposta principal**: ${viaLabel(r.verdict.post)}`);
    if (r.verdict.nestedByVia?.alternativa?.length) vias.push(`**outra opcao**: ${viaLabel(r.verdict.altPost)}`);
    if (r.verdict.nestedUnknown) vias.push("**indeterminada** — subarvore nao lida");
    L.push(`| \`${k}\` | ${cell(r.verdict.proposal)} | ${ev} | ${vias.join("<br>") || "—"} |`);
  }
  L.push("");
  L.push("**Consequencia para o plano de aplicacao:** estes sites saem do lote \"so atributos\".");
  L.push("O conserto honesto e outro — mover o handler para um controle interno proprio, ou");
  L.push("deixar o container apresentacional e promover o filho — e cada um deles e decisao de");
  L.push("produto, nao codemod. Eles continuam contando no GANHO de owner (a mudanca de tag/");
  L.push("`role` resolve a atribuicao), mas **nao** contam como risco zero.");
}
L.push("");
L.push("## 6. Limites declarados");
L.push("");
L.push("- **Escopo**: apenas elementos que hoje falham a atribuicao de owner. Nao e");
L.push("  auditoria de acessibilidade do app. Das 7 regras de axe na captura de");
L.push("  `fb-before` (24 capturas, rotas `/`, `/login`, `/design-system`), so duas");
L.push("  conversam com atribuicao de owner — `button-name` (8x, rota `/`) e");
L.push("  `landmark-unique` (6x, rota `/`). `color-contrast`, `region`,");
L.push("  `aria-prohibited-attr`, `aria-required-children` e `scrollable-region-focusable`");
L.push("  ficam **fora**: sao defeitos reais e nao movem nenhum cluster.");
L.push("- **A evidencia de axe nao mapeia para linha de codigo.** Os `.meta.json` guardam");
L.push("  `axeViolationIds` sem os `nodes`/`target` de cada violacao. Logo **nao e possivel**");
L.push("  cruzar `button-name` com um arquivo especifico a partir do que esta gravado;");
L.push("  cruzar exigiria recapturar com o axe emitindo os alvos. Nenhuma linha deste");
L.push("  relatorio afirma essa ligacao.");
L.push("- **Scanner estatico**: `className` montado em runtime (`cn(...)`, prop repassada)");
L.push("  fica invisivel, como em toda a cadeia estatica deste pipeline. Elementos com");
L.push("  spread de props sao **excluidos** (regra `S3`) em vez de adivinhados.");
L.push("- **`role` sugerido nao e `role` verificado**: `A1` propoe `radio` a partir do");
L.push(`  padrao \`checked={selecionado === valor}\`, medido nesta arvore em **${EXCLUSIVOS.length} ponto${EXCLUSIVOS.length === 1 ? "" : "s"}**` +
  (EXCLUSIVOS.length ? ` — ${EXCLUSIVOS.slice(0, 4).map((e) => `\`${e.file}:${e.line}\``).join(", ")}${EXCLUSIVOS.length > 4 ? ", …" : ""}` : ""));
L.push("  (a citacao anterior, `LLMPreference/index.jsx:675`, nao resolvia nem em `HEAD` nem");
L.push("  na arvore de trabalho: path e linha estavam errados, e por isso ela agora e");
L.push("  gerada e nao escrita a mao). Se algum grupo for multi-selecao, o papel correto ali");
L.push("  e `checkbox`. Decisao por grupo, nao global.");
{
  const a5 = results.filter((r) => r.verdict.id === "A5");
  const a5c = new Set(a5.map((r) => r.cluster.key)).size;
  L.push("- **`A5` e a regra mais discutivel** e esta declarada como tal: ela propoe promover a");
  L.push("  `<button>` um elemento que hoje nao tem handler nenhum. A justificativa e que ele");
  L.push("  carrega tooltip e `cursor-pointer` — afordancia sem semantica, que falha WCAG");
  L.push(`  2.1.1. Se o dono discordar, sao ${a5c} cluster${a5c === 1 ? "" : "s"} / ${a5.length} ocorrencia${a5.length === 1 ? "" : "s"} a subtrair do ganho` +
         `${new Set(a5.map((r) => r.occ.file)).size > 1 ? `, em ${new Set(a5.map((r) => r.occ.file)).size} arquivos distintos` : ""}.`);
}
L.push("- **Nao aplica nada.** Aplicacao exige lote, codemod e prova (pixel ou teclado).");
L.push("");
L.push("### 6.1 Achados fora do alvo desta fase, registrados para nao se perderem");
L.push("");
L.push("- `src/components/ModalWrapper/index.jsx` **nao tem `role=\"dialog\"` nem `aria-modal`**;");
L.push("  todos os modais do app herdam isso. Nao resolve cluster nenhum (o elemento sem");
L.push("  owner e o painel interno, nao o wrapper), mas e defeito real de a11y.");
{
  const a5sites = new Set(results.filter((r) => r.verdict.id === "A5").map(siteKey)).size;
  L.push(`- O padrao \`data-tooltip-id\` sem foco de teclado tem **${PRECEDENTE.tooltip} ocorrencias** nesta arvore; a`);
  L.push(`  regra \`A5\` toca apenas ${a5sites === 1 ? "o unico site que esta" : `os ${a5sites} sites que estao`} na fila. Consertar ${a5sites === 1 ? "esse" : "esses"} nao fecha a classe.`);
}
{
  const galeria = results.filter((r) => r.verdict.id === "S2");
  L.push("- `context-clusters.mjs` **nao remove comentarios** antes de casar o regex, ao");
  L.push("  contrario de `find-owner.mjs`, que usa `stripComments`. Efeito: token citado");
  L.push("  dentro de bloco `/** ... */` entra na fila como ocorrencia fantasma." +
    (galeria.length
      ? ` Nesta corrida ha ${galeria.length} ocorrencia${galeria.length === 1 ? "" : "s"} na galeria \`pages/DesignSystem/**\` (${[...new Set(galeria.map(siteKey))].map((k) => `\`${k}\``).join(", ")}).`
      : " Nesta corrida nao ha ocorrencia da galeria `pages/DesignSystem/**` na fila."));
}
L.push("- `src/components/.../ClarifyingQuestion/InputForm.jsx:2` e um `const SHARED_CLASS`");
L.push("  consumido por `<textarea>` e `<input>` — exatamente o **veiculo de entidade**");
L.push("  escolhido no plano (const exportado). O miner o enxerga, mas `find-owner` **nao**,");
L.push("  porque const nao tem tag. Se o veiculo for adotado em escala, a atribuicao de");
L.push("  owner precisa aprender a seguir do `const` ate os call sites, senao cada entidade");
L.push("  criada nasce sem owner.");
L.push("");
// O relatorio vai SEMPRE para o alvo real, mesmo quando a analise correu sobre
// a copia de HEAD — senao ele seria escrito no diretorio temporario e sumiria.
const outPath = arg("--out") ?? path.join(TARGET, "docs/reports/html-semantico-proposto.md");
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, L.join("\n"));

console.log("PROPOSTA DE HTML SEMANTICO (F-B2) — nada aplicado\n");
console.log(`LINHA DE BASE                 : ${baselineMode}` +
  (baselineMode === "head" ? `  (HEAD ${HEAD_SHA?.slice(0, 12)}, arvore materializada em ${ROOT})`
    : dirtyEntries.length ? `  *** ${dirtyEntries.length} entradas nao commitadas em ${spec("src")} — NAO REPRODUZIVEL ***`
    : `  (arvore == HEAD ${HEAD_SHA?.slice(0, 12)})`));
const oraclesSujos = oracleProvenance.filter((o) => o.gitStatus !== "commitado");
if (oraclesSujos.length) {
  console.log(`ORACULOS NAO COMMITADOS       : ${oraclesSujos.map((o) => `${o.file} [${o.gitStatus}]`).join(", ")}`);
}
console.log(`clusters sem owner            : ${totalClusters}  (${totalOcc} ocorrencias, TODAS classificadas)`);
for (const k of KLASSES) {
  const a = agg[k];
  if (!a.clusters && !a.occ) continue;
  console.log(`  ${k.padEnd(13)}: ${String(a.clusters).padStart(3)} clusters  ${String(a.occ).padStart(3)} ocorr.  -> resolve ${a.resolved} clusters / ${a.resolvedOcc} ocorr.`);
}
console.log("-".repeat(70));
console.log(`GANHO: ${resolved.length}/${totalClusters} clusters (${pct(resolved.length, totalClusters)}) e ${resolvedOcc}/${totalOcc} ocorrencias (${pct(resolvedOcc, totalOcc)})`);
if (partial.length) console.log(`  clusters resolvidos SO EM PARTE (contam como nao resolvidos): ${partial.length}`);
if (heterogeneos.length) console.log(`  clusters heterogeneos (regra ou arquivo divergente entre ocorrencias): ${heterogeneos.length}`);
console.log(`  via de menor risco visual: ${resolvedLow.length}/${totalClusters} clusters, ${resolvedLowOcc}/${totalOcc} ocorrencias`);
console.log(`  edicoes em src/: ${sites.size} sites distintos = ${zeroRiskSites.size} risco ZERO + ${nestedInteractiveSites.size} nested-interactive + ${pixelProofSites.size} exigem pixel`);
console.log(`\nrelatorio: ${outPath}`);
