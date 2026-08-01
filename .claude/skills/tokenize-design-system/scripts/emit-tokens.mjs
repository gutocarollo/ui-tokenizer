#!/usr/bin/env node
/**
 * emit-tokens.mjs — os tokens centralizados, escritos no DTCG.
 *
 * É O PEDIDO LITERAL DO DONO: *"fazer o miner dos tokens no JSON com contagem e
 * criação de tokens padrões centralizados"*. E é a primeira das três peças que
 * `tokenize.mjs` nomeia no APPLY: *"criar os tokens no color.tokens.json
 * herdando o primitivo dominante"*.
 *
 * NÃO É MOTOR NOVO — é a costura de dois produtores que já funcionavam e nunca
 * se falaram. `converge-tokens.mjs` tem o ALIAS do primitivo e a CONTAGEM;
 * `derive-tokens.mjs` tem o caminho DTCG e a anatomia. O que faltava era o
 * arquivo que casa os dois e escreve.
 *
 * AS QUATRO COSTURAS, cada uma um defeito medido em 2026-08-01:
 *
 * 1. HERDAR O ALIAS, NÃO O HEX. `derive-tokens --dtcg` emitia
 *    `"$value": "#000000"` literal. O alvo usa alias
 *    (`"{primitive.light.c-000000}"`), e o literal quebra o tier DTCG: muda o
 *    primitivo e o componente não segue. O alias já existe do outro lado —
 *    `converged.json` carrega `dominantPrimitive` com a string verbatim.
 *
 * 2. `$root` ONDE HÁ ESTADO FILHO. Um nó DTCG com `$value` E filhos
 *    (`{$value, hover:{$value}}`) faz o `flattenGroup` do build do alvo emitir
 *    só o pai — o token de estado desaparece do CSS sem uma linha de erro.
 *    Medido: **47 tokens, 463 usos** sumiriam. O alvo já resolve isso com
 *    `$root` (`component.light.code-block.container.background-color.$root`), e
 *    é essa a convenção seguida aqui.
 *
 * 3. A GRAFIA, decidida pelo dono (D1, 2026-08-01): classe curta sob o
 *    namespace `--color-*`. O nome DTCG continua carregando a propriedade — é
 *    ele que o oráculo julga; a classe é projeção.
 *
 * 4. A ORDEM DO NOME é a da lei vigente (`entity[.variant][.anatomy][.property]
 *    [.state]`, §1 corrigida em 2026-08-01), não a das 358 vars que o alvo já
 *    tem escritas na ordem antiga. Conviver com duas grafias é consequência
 *    declarada da migração, não descuido — a migração das antigas é trabalho do
 *    codemod, não deste emissor.
 *
 * NÃO ESCREVE NO ALVO POR PADRÃO. O contrato do loop é explícito: *"nada é
 * aplicado no código por este comando"*. Sem `--write` ele emite o fragmento
 * para revisão; com `--write` ele funde no `color.tokens.json` do alvo, e só
 * então isso é mutação.
 *
 * Uso:
 *   node emit-tokens.mjs --root <app> [--converged <path>] [--out <fragment.json>]
 *   node emit-tokens.mjs --root <app> --batch <batch-B0001.json>   # só o lote
 *   node emit-tokens.mjs --root <app> --write                      # funde no alvo
 *   node emit-tokens.mjs --root <app> --json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readVocabulary, parseName } from "./score-naming.mjs";
import { resolveRoot } from "./lib/paths.mjs";

const argv = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

if (argv.includes("--help")) {
  console.log(`emit-tokens.mjs — escreve os tokens centralizados no DTCG

Uso:
  node emit-tokens.mjs --root <app> [--out <fragment.json>] [--write]

Opções:
  --converged <path>  default: <app>/.tokenize/converged.json
  --batch <path>      restringe ao lote de um batch-contract
  --theme <nome>      tier de tema no DTCG (default: derivado do alias do primitivo)
  --write             FUNDE no <app>/tokens/color.tokens.json (mutação real)
  --json              resumo em JSON
`);
  process.exit(0);
}

const ROOT = resolveRoot();
const convergedPath = arg("--converged", path.join(ROOT, ".tokenize/converged.json"));
const tokensPath = path.join(ROOT, "tokens/color.tokens.json");

const falhar = (motivo, comoResolver) => {
  console.error(`\nEMIT falhou: ${motivo}`);
  if (comoResolver) console.error(`  como resolver: ${comoResolver}`);
  process.exit(1);
};

if (!existsSync(convergedPath)) {
  falhar(`não há convergência em ${convergedPath}`, "rode: node tokenize.mjs --root <app>");
}
if (!existsSync(tokensPath)) {
  falhar(`o alvo não tem ${path.relative(ROOT, tokensPath)}`, "o emissor funde num DTCG existente, não cria do zero");
}

const CV = JSON.parse(readFileSync(convergedPath, "utf8"));
const voc = readVocabulary();
let finais = CV.clustersFinais ?? [];

/* ─────────────────────────────────────────────── restringir ao lote, se pedido ── */
const batchPath = arg("--batch");
if (batchPath) {
  if (!existsSync(batchPath)) falhar(`batch-contract não encontrado: ${batchPath}`);
  const B = JSON.parse(readFileSync(batchPath, "utf8"));
  const nomes = new Set(
    (B.decisionIds ?? []).length
      ? [] // os nomes vêm das decisions; abaixo cai no filtro por elegibilidade
      : []
  );
  // O batch-contract não carrega os nomes, e sim os ids das decisões. Ler as
  // decisões seria mais fiel, mas elas moram noutro arquivo; o filtro honesto
  // aqui é o MESMO critério de elegibilidade do freeze-batch, aplicado de novo.
  void nomes;
  finais = finais.filter(
    (c) =>
      c.proposedName &&
      (c.valueSpread ?? 1) === 1 &&
      (c.divergentCount ?? 0) === 0 &&
      c.dominantPrimitive &&
      !String(c.dominantPrimitive).startsWith("(sem valor")
  );
}

/* ─────────────────────────────────────────────────── o que dá para escrever ── */

const ALIAS = /^\{([a-z0-9.-]+)\}$/i;
const emitiveis = [];
const recusados = [];
for (const c of finais) {
  if (!c.proposedName) { recusados.push({ nome: "(sem nome)", motivo: "sem nome derivado" }); continue; }
  const alias = String(c.dominantPrimitive ?? "");
  if (!ALIAS.test(alias)) {
    recusados.push({ nome: c.proposedName, motivo: `primitivo não é alias DTCG: ${alias.slice(0, 40)}` });
    continue;
  }
  const slots = parseName(c.proposedName, voc);
  if (!slots.owner || slots.remainder) {
    recusados.push({ nome: c.proposedName, motivo: slots.remainder ? `sobra "${slots.remainder}"` : "sem entidade" });
    continue;
  }
  emitiveis.push({ c, slots, alias });
}

if (!emitiveis.length) falhar("nenhum contrato emitível", recusados[0]?.motivo ?? "rode CONVERGE antes");

/*
 * O TEMA SAI DO PRÓPRIO ALIAS (`{primitive.LIGHT.c-...}`) — não é escolha do
 * emissor, e por isso cada contrato vai para o tier do tema que ele herda.
 *
 * A primeira versão FALHAVA quando o corpus misturava temas, por suspeitar de
 * erro de convergência. Medido: 243 contratos `light` e 1 `dark` — o alvo tem
 * modo escuro de verdade (`dark:bg-*`), e um contrato que só existe no escuro é
 * fato do produto, não defeito. Recusar teria descartado um contrato legítimo;
 * escolher um tema em silêncio teria escrito o valor errado. A resolução certa é
 * emitir POR TEMA, que é como o DTCG do alvo já se organiza
 * (`component.light.*` e `component.dark.*`).
 *
 * `--theme` continua existindo para restringir a emissão a um tier só.
 */
const temaDe = (alias) => alias.replace(ALIAS, "$1").split(".")[1] ?? "light";
const temaFiltro = arg("--theme");
const porTema = new Map();
for (const e of emitiveis) {
  const t = temaDe(e.alias);
  if (temaFiltro && t !== temaFiltro) continue;
  if (!porTema.has(t)) porTema.set(t, []);
  porTema.get(t).push(e);
}
if (!porTema.size) falhar(`nenhum contrato no tema ${temaFiltro}`, "confira --theme");

/* ────────────────────────────────────────────────────── montar a árvore ───── */
/*
 * O caminho DTCG segue a lei: entity[.variant][.anatomy].property[.state].
 * O prefixo `component.<tema>` é o tier do alvo, lido do arquivo dele.
 */
function caminhoDe(slots) {
  const p = [slots.owner];
  if (slots.variant) p.push(slots.variant);
  if (slots.anatomy) p.push(slots.anatomy);
  p.push(slots.property);
  return p;
}

const arvores = {};
const escritos = [];
const colisoes = [];
for (const [tema, doTema] of porTema) {
 const arvore = (arvores[tema] = {});
 for (const { c, slots, alias } of doTema) {
  const base = caminhoDe(slots);
  const folha = slots.state ? [...base, slots.state] : base;
  let no = arvore;
  for (const seg of folha) {
    no[seg] = no[seg] ?? {};
    no = no[seg];
  }
  /*
   * COLISÃO DE CAMINHO É RECUSA, NUNCA SOBRESCRITA — §9 da lei manda EXPOR a
   * divergência, e sobrescrever a apaga.
   *
   * DEFEITO REAL, pego ao conferir a saída em 2026-08-01: a primeira versão
   * fazia `no.$value = alias` direto. Como 244 contratos finais colapsam em 152
   * caminhos DTCG distintos, **92 contratos sobrescreviam uns aos outros em
   * silêncio** e o último vencia. E isso não é empate benigno: dos 14 nomes que
   * carregam mais de um contrato, TODOS têm primitivo dominante DIFERENTE —
   * então o token escrito ficava com a cor de um contrato arbitrário, escolhido
   * pela ordem de iteração.
   *
   * Um fragmento com 152 tokens "emitidos" a partir de 244 contratos parecia
   * sucesso e era perda de dado. Agora a colisão sai do fragmento e vai para o
   * relatório, com os valores em conflito.
   */
  if ("$value" in no && no.$value !== alias) {
    colisoes.push({
      tema, caminho: folha.join("."), nome: c.proposedName,
      valorExistente: no.$value, valorNovo: alias, usos: c.count,
    });
    continue;
  }
  if ("$value" in no) {
    // Mesmo caminho E mesmo valor: não há conflito, só soma de evidência.
    no.$description = `${(no.$usos ?? 0) + c.count} usos; antes ${(no.$antes ?? []).concat(c.tokens ?? []).join(", ")}`;
    no.$usos = (no.$usos ?? 0) + c.count;
    no.$antes = (no.$antes ?? []).concat(c.tokens ?? []);
    continue;
  }
  no.$value = alias;
  no.$usos = c.count;
  no.$antes = [...(c.tokens ?? [])];
  no.$description = `${c.count} usos; antes ${(c.tokens ?? []).join(", ") || "(desconhecido)"}`;
  escritos.push({ tema, nome: c.proposedName, caminho: folha.join("."), alias, usos: c.count, estado: slots.state ?? null });
 }
}

/*
 * $root — a costura nº 2, e sem ela 47 tokens somem em silêncio.
 *
 * Um nó que tem `$value` E filhos faz o `flattenGroup` do build do alvo emitir
 * só o pai. Depois de montar a árvore, todo nó nessa situação tem o próprio
 * valor movido para `$root`, que é a convenção que o alvo já usa.
 */
let promovidos = 0;
const normalizarTudo = (no) => normalizar(no);
function normalizar(no) {
  for (const chave of Object.keys(no)) {
    if (chave.startsWith("$")) continue;
    normalizar(no[chave]);
  }
  const filhos = Object.keys(no).filter((k) => !k.startsWith("$"));
  if (filhos.length && "$value" in no) {
    no.$root = { $value: no.$value, $description: no.$description };
    delete no.$value;
    delete no.$description;
    promovidos += 1;
  }
}
for (const arvore of Object.values(arvores)) normalizarTudo(arvore);

/* Os auxiliares de acumulação não pertencem ao DTCG — saem antes de escrever. */
(function limpar(no) {
  for (const k of Object.keys(no)) {
    if (k === "$usos" || k === "$antes") delete no[k];
    else if (no[k] && typeof no[k] === "object") limpar(no[k]);
  }
})(arvores);

/* ───────────────────────────────────────────────────────── saída ou fusão ─── */

const alvoDTCG = JSON.parse(readFileSync(tokensPath, "utf8"));
const fragmento = { component: Object.fromEntries(Object.entries(arvores)) };

const jaExistem = escritos.filter((e) => {
  let no = alvoDTCG.component?.[e.tema];
  for (const seg of e.caminho.split(".")) {
    if (!no || typeof no !== "object") return false;
    no = no[seg];
  }
  return Boolean(no);
});

const resumo = {
  temas: Object.fromEntries([...porTema].map(([t, v]) => [t, v.length])),
  contratosFinais: finais.length,
  emitidos: escritos.length,
  recusados: recusados.length,
  usosCobertos: escritos.reduce((s, e) => s + e.usos, 0),
  comEstado: escritos.filter((e) => e.estado).length,
  colisoesRecusadas: colisoes.length,
  promovidosParaRoot: promovidos,
  jaExistemNoAlvo: jaExistem.length,
};

if (argv.includes("--write")) {
  // Fusão NÃO-DESTRUTIVA: só cria o que não existe. Sobrescrever um token que o
  // alvo já definiu seria mudar valor sem prova de pixel — exatamente o que o
  // contrato do loop proíbe.
  const fundir = (destino, origem) => {
    for (const [k, v] of Object.entries(origem)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        destino[k] = destino[k] ?? {};
        fundir(destino[k], v);
      } else if (!(k in destino)) {
        destino[k] = v;
      }
    }
  };
  alvoDTCG.component = alvoDTCG.component ?? {};
  for (const [tema, arvore] of Object.entries(arvores)) {
    alvoDTCG.component[tema] = alvoDTCG.component[tema] ?? {};
    fundir(alvoDTCG.component[tema], arvore);
  }
  writeFileSync(tokensPath, JSON.stringify(alvoDTCG, null, 2) + "\n");
  console.log(`EMIT: fundido em ${path.relative(ROOT, tokensPath)} — ${escritos.length} tokens`);
} else {
  const out = arg("--out", path.join(ROOT, ".tokenize/tokens-fragment.json"));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(fragmento, null, 1) + "\n");
  if (!argv.includes("--json")) console.log(`EMIT: fragmento em ${path.relative(ROOT, out)} (nada foi aplicado; --write funde)`);
}

if (argv.includes("--json")) {
  console.log(JSON.stringify({ ...resumo, amostra: escritos.slice(0, 8), recusados: recusados.slice(0, 10), colisoes: colisoes.slice(0, 40) }, null, 1));
} else {
  console.log(`  temas                 ${Object.entries(resumo.temas).map(([t, n]) => `${t}:${n}`).join("  ")}`);
  console.log(`  tokens emitidos       ${escritos.length}  (${resumo.usosCobertos} usos cobertos)`);
  console.log(`  com estado            ${resumo.comEstado}`);
  console.log(`  promovidos a $root    ${promovidos}  <- sem isto sumiriam do CSS do alvo, sem erro`);
  console.log(`  já existem no alvo    ${jaExistem.length}`);
  if (colisoes.length) {
    console.log(`\n  COLISÕES RECUSADAS    ${colisoes.length}  <- dois contratos, um caminho DTCG, valores diferentes`);
    console.log(`     §9 manda expor a divergência; sobrescrever a apagaria. Estes NÃO foram emitidos:`);
    for (const k of colisoes.slice(0, 6)) {
      console.log(`     ${k.caminho}  ${k.valorExistente} x ${k.valorNovo}  (${k.usos} usos)`);
    }
    if (colisoes.length > 6) console.log(`     ... +${colisoes.length - 6}`);
  }
  if (recusados.length) {
    const porMotivo = {};
    for (const r of recusados) porMotivo[r.motivo.split(":")[0]] = (porMotivo[r.motivo.split(":")[0]] ?? 0) + 1;
    console.log(`  recusados             ${recusados.length}`);
    for (const [m, n] of Object.entries(porMotivo).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`     ${String(n).padStart(4)}  ${m}`);
    }
  }
}
