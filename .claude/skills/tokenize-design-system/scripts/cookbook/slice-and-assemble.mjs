#!/usr/bin/env node
/**
 * slice-and-assemble.mjs — a cola DETERMINISTICA entre os dois workflows do cookbook.
 *
 * POR QUE ESTE ARQUIVO EXISTE. O dono perguntou: "qual foi o algoritmo que voce
 * rodou para montar o cookbook? esta mapeado num agente do repositorio?".
 * Resposta honesta na hora: NAO. Os dois fan-outs de agente estavam salvos como
 * script de workflow, mas a cola entre eles — fatiar a descoberta por capitulo,
 * montar o markdown, re-pontuar e promover — era heredoc Python inline, no
 * scratchpad, ja perdido. Exatamente o mesmo defeito de "qual e o path disso
 * aqui?", um nivel acima: o resultado era versionado, o METODO nao.
 *
 * O ALGORITMO, em 6 passos. Os impares sao DETERMINISTICOS (este arquivo); os
 * pares sao MODELO (os dois .workflow.js ao lado). Nenhum passo de modelo
 * escreve no cookbook sem passar por um passo deterministico depois.
 *
 *   1. DESCOBRIR   [modelo] 01-descobrir-universo.workflow.js
 *                  N agentes medem situacao visual por produto: cada uma com
 *                  entidade candidata, anatomia, propriedade, variante, estado,
 *                  classe atual e path:linha. Saida: um JSON por produto.
 *
 *   2. FATIAR      [deterministico] este arquivo, `slice`
 *                  Particiona as situacoes por CAPITULO usando o mapa fixo
 *                  CAPITULOS (entidade -> capitulo). O que nao casa com
 *                  entidade nenhuma vai para `sobras.json` — e esse balde e o
 *                  produto mais valioso do passo, porque e a lista de
 *                  componentes que os produtos tem e a lei nao tem (§5.5).
 *                  MOTIVO DE EXISTIR: sem fatiar, cada agente le o arquivo
 *                  inteiro. Medido em 2026-08-01: 8 agentes apontados para um
 *                  JSON de 350 KB queimaram contexto e travaram sem devolver
 *                  nada. Fatiado (13-48 KB por capitulo), a mesma rodada fechou.
 *
 *   3. GERAR       [modelo] 02-gerar-capitulos.workflow.js
 *                  Um agente por capitulo, cada um lendo SO a sua fatia, obrigado
 *                  a rodar `scoreName` nos proprios nomes antes de devolver.
 *                  Mais um agente para as sobras, que TRIA em: mapeia para
 *                  entidade existente / pede entidade nova com evidencia /
 *                  nao e entidade.
 *
 *   4. MONTAR      [deterministico] este arquivo, `assemble`
 *                  Junta os capitulos em markdown. Duas regras que nao sao
 *                  cosmeticas: (a) nome que nao casa TOKEN_LIMPO — porque veio
 *                  anotado, tipo `card.background-color (variant PENDENTE)` —
 *                  NAO entra na tabela, vai para Excecoes; (b) duplicata
 *                  (mesmo token para a mesma situacao) e descartada.
 *
 *   5. REVALIDAR   [deterministico] este arquivo, `promote`
 *                  Re-pontua as excecoes com o UNIVERSO REAL do cookbook. Isto
 *                  nao e refinamento: cada agente do passo 3 so enxergava os
 *                  proprios nomes, entao `state-with-base` reprovava um `.hover`
 *                  cujo par base fora escrito por OUTRO agente. Medido: de 85
 *                  excecoes, 69 pontuavam 100 quando julgadas contra o cookbook
 *                  inteiro. Sem este passo, 69 linhas boas ficariam no lixo.
 *                  Aqui tambem cai o unico conserto mecanico permitido: remover
 *                  `container` redundante quando a entidade nao tem outras
 *                  partes (§7.2) — e so vale se o nome resultante der 100.
 *
 *   6. VALIDAR     [deterministico] ../validate-cookbook.mjs (arquivo separado,
 *                  porque roda tambem no teste e no pre-commit)
 *                  Todo nome da coluna "token pela lei" passa pelo oraculo, com
 *                  os proprios exemplos do cookbook como universo. Excecao sem
 *                  justificativa escrita e FALHA.
 *
 * O QUE ESTE ALGORITMO NAO E: nao e uma fase do `tokenize.mjs`. O pipeline de 17
 * fases governa a MIGRACAO de um alvo (inventariar, classificar, aplicar, provar
 * pixel). O cookbook e outra coisa — um documento derivado da lei mais a medicao,
 * que nao muta codigo. Ficam separados de proposito.
 *
 * Usage:
 *   node slice-and-assemble.mjs slice     --descoberta <json> --out <dir>
 *   node slice-and-assemble.mjs assemble  --capitulos <json> --cookbook <md>
 *   node slice-and-assemble.mjs promote   --cookbook <md>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/** Entidade -> capitulo. Mapa FIXO: o particionamento nao pode variar por corrida. */
export const CAPITULOS = Object.freeze({
  botao: ["button", "badge", "pill"],
  campo: ["field", "select", "checkbox", "radio", "toggle", "slider", "search"],
  overlay: ["modal", "drawer", "popover", "menu", "tooltip", "overlay"],
  dados: ["card", "data-table", "list-row", "stat", "chart", "progress"],
  shell: ["page", "sidebar", "nav-item", "toolbar", "logo", "thread-item", "workspace-item"],
  texto: ["chat-message", "prompt", "code-block", "markdown", "attachment", "citation"],
  feedback: ["avatar", "banner", "toast", "skeleton", "empty-state"],
  global: ["divider", "focus-ring"],
});

/** Um token limpo: sem anotacao, sem parenteses, sem prosa. */
export const TOKEN_LIMPO = /^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.[a-z][a-z0-9-]*)*$/;

export function capituloDe(entidade) {
  const e = String(entidade || "").toLowerCase().split(":").pop().trim().split(/\s/)[0];
  for (const [cap, ents] of Object.entries(CAPITULOS)) if (ents.includes(e)) return cap;
  return "sobras";
}

/** Passo 2 — particiona a descoberta por capitulo. */
export function slice(descoberta) {
  const baldes = {};
  for (const produto of Object.keys(descoberta)) {
    for (const familia of descoberta[produto]?.families ?? []) {
      const cap = capituloDe(familia.ownerCandidate);
      for (const s of familia.situations ?? []) {
        (baldes[cap] ??= []).push({
          produto,
          familia: familia.family,
          entidade: capituloDe(familia.ownerCandidate) === "sobras"
            ? familia.ownerCandidate
            : String(familia.ownerCandidate).split(":").pop().trim(),
          path: familia.path,
          situation: s.situation,
          anatomy: s.anatomy,
          cssProperty: s.cssProperty,
          variant: s.variant,
          state: s.state,
          currentClassOrToken: s.currentClassOrToken,
          evidence: s.evidence,
        });
      }
    }
  }
  return baldes;
}

/** Passo 4 — capitulos -> markdown, separando o que nao e token limpo. */
export function assemble(capitulos) {
  const vistos = new Set();
  const tabelas = [];
  const excecoes = [];
  capitulos.forEach((c, i) => {
    const titulo = String(c.capitulo).replace(/^#+\s*/, "").split("—")[0].split("(")[0].trim();
    const linhas = [];
    for (const l of c.linhas ?? []) {
      const tok = String(l.tokenPelaLei ?? "").trim();
      const chave = `${tok}::${l.situacao}`;
      if (!TOKEN_LIMPO.test(tok)) { excecoes.push({ titulo, ...l, motivo: "nome anotado com pendência" }); continue; }
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      linhas.push(l);
    }
    tabelas.push({ n: i + 1, titulo, linhas, lawGap: c.lawGap ?? [], humano: c.humano ?? [] });
  });
  return { tabelas, excecoes };
}

/**
 * Passo 5 — re-pontua com o universo real e promove o que passa.
 * `scorer` e injetado para o teste nao depender de um alvo.
 */
export function promote(excecoes, universo, scorer) {
  const promovidas = [];
  const ficam = [];
  for (const e of excecoes) {
    let tok = String(e.tokenPelaLei ?? e.tok ?? "").trim();
    if (!TOKEN_LIMPO.test(tok)) { ficam.push({ ...e, motivo: "nome anotado com pendência" }); continue; }
    let r = scorer(tok, universo);
    if (r.score !== 100 && r.redundante && tok.includes(".container.")) {
      const alt = tok.replace(".container.", ".");
      const r2 = scorer(alt, universo);
      if (r2.score === 100) { tok = alt; r = r2; }
    }
    if (r.score === 100) promovidas.push({ ...e, tokenPelaLei: tok });
    else ficam.push({ ...e, tokenPelaLei: tok, motivo: `nota ${r.score}` });
  }
  return { promovidas, ficam };
}

function arg(argv, nome) {
  const i = argv.indexOf(nome);
  return i >= 0 ? argv[i + 1] : null;
}

async function main(argv) {
  const cmd = argv[0];
  if (cmd === "slice") {
    const src = JSON.parse(readFileSync(arg(argv, "--descoberta"), "utf8"));
    const out = arg(argv, "--out") ?? ".";
    mkdirSync(out, { recursive: true });
    const baldes = slice(src.result ?? src);
    for (const [cap, itens] of Object.entries(baldes)) {
      writeFileSync(path.join(out, `${cap}.json`), JSON.stringify(itens, null, 1));
      process.stdout.write(`${cap.padEnd(10)} ${String(itens.length).padStart(4)} situações\n`);
    }
    return 0;
  }
  process.stderr.write("comandos: slice | assemble | promote (ver o cabeçalho)\n");
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await main(process.argv.slice(2)));
}
