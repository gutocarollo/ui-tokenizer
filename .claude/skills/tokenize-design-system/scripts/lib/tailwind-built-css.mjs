/**
 * tailwind-built-css.mjs — o CSS BUILDADO como oraculo de "ja esta em contrato".
 *
 * O DEFEITO QUE ESTE MODULO MATA. O detector de contrato existente de
 * `measure-disposition.mjs` procurava seletor `.classe` no CSS FONTE. Isso ve
 * `.tooltip` e `.input-label`, escritos a mao, e NAO VE nada do que o Tailwind v4
 * GERA a partir de token. Medido no alvo: `duration-fast` (--duration-fast),
 * `duration-surface`, `duration-control`, `ease-standard` sao utilities cuja regra
 * inteira e `transition-duration: var(--duration-fast)` — consumo puro de motion
 * token, indistinguivel de contrato — e caiam no estrato 6 ("vocabulario de
 * layout"), como se fossem `flex` ou `absolute`. O estrato 6 estava
 * SUPERESTIMADO e o 4 SUBESTIMADO.
 *
 * ── POR QUE O COMPILADOR E NAO `yarn build` ──────────────────────────────────
 *
 * As duas rotas produzem o mesmo CSS — `@tailwindcss/vite` e um wrapper de
 * `@tailwindcss/node`, o mesmo pacote que este modulo carrega, da MESMA versao
 * instalada no alvo. A escolha e do compilador direto por quatro razoes medidas:
 *
 *   1. NAO MUTA O ALVO. `yarn build` escreve `dist/`. A regra desta fase e que o
 *      alvo nao e mutado; um oraculo que precisa sujar o alvo para medir nao pode
 *      rodar em cima de arvore limpa nem em CI de PR.
 *   2. ATRIBUIVEL POR CLASSE. `candidatesToCss(cands)` devolve um array ALINHADO
 *      com a entrada, `null` para o que o motor nao gera. O `dist/index.css` e uma
 *      linha minificada de 216 KB onde reencontrar o candidato exige desescapar
 *      seletor (`.p-2\.5`, `.h-\[34px\]`, `.hover\:bg-x:hover`) — parsing fragil
 *      justamente nos casos que mais importam.
 *   3. NAO CONTAMINA COM TERCEIRO. O `dist/index.css` carrega Toastify, KaTeX e
 *      highlight.js. Um grep de `.classe` la creditaria `.Toastify__toast` como
 *      contrato do design system do app.
 *   4. CUSTO. 88 ms de `loadDesignSystem` + 5 ms de `candidatesToCss` para 362
 *      classes, contra minutos de `vite build`.
 *
 * A substituicao e FALSIFICAVEL e foi falsificada contra o artefato real. O
 * `dist/index.css` buildado em 2026-07-30 traz, byte a byte:
 *
 *     .duration-fast{--tw-duration:var(--duration-fast);transition-duration:var(--duration-fast)}
 *     .ease-standard{--tw-ease:var(--ease-standard);transition-timing-function:var(--ease-standard)}
 *     .w-60{width:calc(var(--spacing) * 60)}
 *
 * que e o que `candidatesToCss` devolve para os mesmos candidatos.
 *
 * ── O DISCRIMINADOR: TOKEN DO APP, NAO QUALQUER `var()` ──────────────────────
 *
 * "Regra consome var(--token) => esta em contrato" e a versao INGENUA da regra, e
 * ela e um falso-verde de 1.210 usos. Em Tailwind v4 quase toda utility numerica
 * consome var: `w-60` e `calc(var(--spacing) * 60)`, `transition-colors` e
 * `var(--default-transition-duration)`, `animate-spin` e `var(--animate-spin)`.
 * Nenhuma dessas e decisao de design do app — `--spacing`, `--animate-spin`,
 * `--container-2xl`, `--blur-md`, `--radius-lg`, `--text-sm` sao variaveis do
 * TEMA PADRAO do Tailwind (419 declaracoes em `tailwindcss/theme.css`). Aceitar
 * a regra ingenua rotularia `w-60` (266 usos) de "ja tokenizado".
 *
 * O discriminador e a PROCEDENCIA da variavel:
 *
 *     esta em contrato  <=>  a regra gerada consome >= 1 var declarada pelo
 *                            PROPRIO APP (entry CSS + os @import relativos dele)
 *                            e ausente do tema padrao do Tailwind.
 *
 * Medido no alvo: 606 variaveis do app, 419 do tema padrao, INTERSECCAO ZERO — o
 * app nunca redeclara um default do Tailwind, entao nao ha empate a desempatar
 * aqui. `interseccao` e publicada no relatorio; se um dia deixar de ser 0, a
 * decisao de quem vence passa a ser do dono e o numero muda a vista.
 *
 * `--tw-*` sao variaveis internas do motor (`--tw-duration`, `--tw-border-style`)
 * e caem fora por construcao: nao sao declaradas em arquivo do app.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/** Entradas CSS candidatas, em ordem de probabilidade. */
const ENTRADAS = [
  "src/index.css", "src/styles/index.css", "src/main.css", "src/app.css",
  "src/styles/globals.css", "app/globals.css", "styles/globals.css", "index.css",
];

const TEM_TAILWIND = /@import\s+["']tailwindcss|@tailwind\s+(?:base|utilities)/;

/** Comentario CSS fora antes de qualquer extracao: `color.tokens.json` num
 *  comentario vira os "seletores" `.json` e `.tokens` no regex ingenuo. */
const semComentario = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");

/** `--nome:` declarada no texto. */
export function declaracoesDeVar(texto) {
  const s = new Set();
  for (const m of semComentario(texto).matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)) s.add(m[1]);
  return s;
}

/**
 * `.classe` em POSICAO DE SELETOR — nao em comentario, nao em valor de
 * declaracao, nao dentro de string.
 *
 * O regex ingenuo (`/\.([a-zA-Z][\w-]+)/g` no texto cru, que era o detector
 * anterior) colhe 14 falsos positivos no alvo: `.json`/`.tokens` do comentario
 * `GENERATED FROM tokens/color.tokens.json`, `.ttf`/`.txt` de `url()`,
 * `.w3`/`.org`/`.ai`/`.claude`/`.md` de URL em comentario, e
 * `.bg-theme-bg-secondary`/`.item-active-hover` de prosa em comentario.
 *
 * A PRIMEIRA versao desta funcao trocava um defeito por outro: pegava so o
 * trecho antes do `{` de cada bloco separado por `}`, e com isso PERDIA todo
 * seletor aninhado — `.sidebar-items:after`, `.fade-up-border` e
 * `.radio-container` vivem dentro de `@media`/`@layer` no `src/index.css`, e o
 * primeiro `{` do chunk era o do at-rule. Teria removido 3 usos legitimos do
 * estrato 4 se passasse. Por isso a estrategia e subtrativa: apaga o que
 * comprovadamente NAO e seletor (comentario, string, valor de declaracao) e le o
 * que sobra, em vez de tentar adivinhar onde o seletor comeca.
 */
export function seletoresDeClasse(texto) {
  const s = new Set();
  const t = semComentario(texto)
    .replace(/"[^"]*"|'[^']*'/g, '""')          // string: url("x.ttf"), content
    .replace(/:\s*[^;{}]*(?=[;}])/g, ":");      // valor: `prop: <valor>;`
  // `:hover {` e `:root {` sobrevivem: o valor so casa terminado por `;` ou `}`.
  for (const m of t.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) s.add(m[1]);
  return s;
}

/** A entrada CSS do app: a primeira que existe E puxa o Tailwind. */
export function entradaCss(root) {
  return ENTRADAS.map((p) => path.join(root, p))
    .find((p) => existsSync(p) && TEM_TAILWIND.test(readFileSync(p, "utf8"))) ?? null;
}

/** Segue os `@import "./relativo.css"` a partir da entrada. Import de PACOTE
 *  (`tailwindcss`) fica fora: sao arquivos de terceiro, nao contrato do app. */
function grafoDeImports(entry) {
  const vistos = new Set();
  const fila = [entry];
  const arquivos = [];
  while (fila.length) {
    const f = fila.shift();
    if (vistos.has(f) || !existsSync(f)) continue;
    vistos.add(f);
    let t;
    try { t = readFileSync(f, "utf8"); } catch { continue; }
    arquivos.push({ file: f, texto: t });
    for (const m of semComentario(t).matchAll(/@import\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
      fila.push(path.resolve(path.dirname(f), spec));
    }
  }
  return arquivos;
}

/**
 * O detector CEGO — seletor `.classe` escrito a mao no CSS FONTE. Continua
 * existindo porque e o unico disponivel quando o compilador nao carrega, e a
 * regra da fase e degradar DECLARANDO, nao parar de medir. Quem o usa sozinho
 * SUBESTIMA o estrato 4 pelo tanto que o motor gera a partir de token.
 */
export function contratoDoCssFonte(root) {
  const entrada = entradaCss(root);
  const arquivos = entrada ? grafoDeImports(entrada) : [];
  const seletoresCustom = new Set();
  for (const { texto } of arquivos) for (const c of seletoresDeClasse(texto)) seletoresCustom.add(c);
  return {
    entrada: entrada ? path.relative(root, entrada) : null,
    arquivos: arquivos.map((a) => path.relative(root, a.file)),
    seletoresCustom,
  };
}

/**
 * Carrega o oraculo. NUNCA lanca: devolve `{ disponivel:false, motivo }` para
 * quem chama DECLARAR a degradacao. Cair de volta em silencio para o detector de
 * seletor `.classe` — que e justamente o detector cego — e o modo de falha que
 * este modulo existe para tornar impossivel.
 */
export async function carregarCssBuildado(root) {
  const falha = (motivo) => ({
    disponivel: false, motivo,
    varsDoApp: new Set(), varsPadraoTailwind: new Set(), seletoresCustom: new Set(),
    interseccaoVars: 0, entrada: null, tailwindVersao: null, resolvidoDe: null,
    classificar: () => new Map(),
  });

  const entrada = ENTRADAS.map((p) => path.join(root, p))
    .find((p) => existsSync(p) && TEM_TAILWIND.test(readFileSync(p, "utf8")));
  if (!entrada) {
    return falha(`nenhuma entrada CSS com \`@import "tailwindcss"\` entre: ${ENTRADAS.join(", ")}`);
  }

  const req = createRequire(path.join(root, "package.json"));
  let tw, twPkg, resolvidoDe;
  try {
    resolvidoDe = req.resolve("@tailwindcss/node");
    tw = await import(pathToFileURL(resolvidoDe).href);
  } catch (e) {
    return falha(`@tailwindcss/node nao resolve a partir de ${root} (${e.code ?? e.message})`);
  }
  if (typeof tw.__unstable__loadDesignSystem !== "function") {
    return falha(`@tailwindcss/node sem __unstable__loadDesignSystem (API mudou)`);
  }
  try { twPkg = JSON.parse(readFileSync(req.resolve("tailwindcss/package.json"), "utf8")).version; }
  catch { twPkg = null; }

  let ds;
  try {
    ds = await tw.__unstable__loadDesignSystem(readFileSync(entrada, "utf8"), {
      base: path.dirname(entrada),
      onDependency() {},
    });
  } catch (e) {
    return falha(`loadDesignSystem falhou em ${entrada}: ${e.message}`);
  }

  /* procedencia das variaveis */
  const arquivosDoApp = grafoDeImports(entrada);
  const varsDoApp = new Set();
  const seletoresCustom = new Set();
  for (const { texto } of arquivosDoApp) {
    for (const v of declaracoesDeVar(texto)) varsDoApp.add(v);
    for (const c of seletoresDeClasse(texto)) seletoresCustom.add(c);
  }
  const varsPadraoTailwind = new Set();
  try {
    const themeCss = readFileSync(req.resolve("tailwindcss/theme.css"), "utf8");
    for (const v of declaracoesDeVar(themeCss)) varsPadraoTailwind.add(v);
  } catch {
    return falha(`tailwindcss/theme.css nao resolve — sem ele nao da para separar token do app de default do Tailwind, e a regra ingenua creditaria w-60/animate-spin como contrato`);
  }
  const interseccao = [...varsDoApp].filter((v) => varsPadraoTailwind.has(v));
  const ehTokenDoApp = (v) => varsDoApp.has(v) && !varsPadraoTailwind.has(v);

  /**
   * @param {string[]} candidatos
   * @returns {Map<string,{gerada:boolean,tokensDoApp:string[],css:string|null}>}
   */
  const classificar = (candidatos) => {
    const out = new Map();
    if (!candidatos.length) return out;
    let css;
    try { css = ds.candidatesToCss(candidatos); }
    catch { return out; } // motor recusou o lote inteiro: nada e creditado
    for (let i = 0; i < candidatos.length; i++) {
      const c = css[i] ?? null;
      const vars = c ? [...new Set([...c.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))] : [];
      out.set(candidatos[i], { gerada: c !== null, tokensDoApp: vars.filter(ehTokenDoApp), css: c });
    }
    return out;
  };

  return {
    disponivel: true, motivo: null,
    entrada: path.relative(root, entrada),
    tailwindVersao: twPkg, resolvidoDe,
    arquivosDoApp: arquivosDoApp.map((a) => path.relative(root, a.file)),
    varsDoApp, varsPadraoTailwind, seletoresCustom,
    interseccaoVars: interseccao.length,
    ehTokenDoApp, classificar,
  };
}
