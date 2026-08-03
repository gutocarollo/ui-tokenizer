#!/usr/bin/env node
/**
 * context-clusters.mjs — agrupa ocorrencias por CONTEXTO SEMANTICO, que e a
 * unidade de decisao que o grafo manda usar.
 *
 * O erro que este script corrige: perguntar "qual o novo nome do token X?".
 * Essa pergunta forca rename em massa e e invalida quando o token e consumido em
 * contextos diferentes — `surface-hover` tem 337 usos em 13 owners, e nao existe
 * UM nome certo para os 337.
 *
 * `reference/end-to-end-workflow.md` §9 ja definia o eixo certo:
 *
 *     Group first by semantic context:
 *       owner · native tag and implicit/explicit role · nearest landmark ·
 *       component · anatomy · property · interaction state · route area ·
 *       theme · viewport
 *
 * A decisao e POR CLUSTER DE CONTEXTO. E, dentro do cluster, o nome nao e
 * escolha livre: ele e DERIVADO dos proprios eixos, pela lei
 * `owner.anatomia.propriedade[.variante][.estado]`. A IA nao inventa nome — ela
 * so entra quando a derivacao fica ambigua, e o humano so quando restam dois
 * contratos materialmente defensaveis (§9, ultima linha).
 *
 * Uso:
 *   node context-clusters.mjs --root <app> --token surface-hover
 *   node context-clusters.mjs --root <app> --all        # todos os que violam
 *   node context-clusters.mjs --root <app> --json
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { resolveRoot, resolveSourceRoots } from "./lib/paths.mjs";
import { findUseOwner } from "./find-owner.mjs";
import { readVocabulary, PREFIX_PROPERTY } from "./score-naming.mjs";
import { prefixAlternation, lawSlotFor } from "./lib/utility-families.mjs";
import { contextClusterConfidence } from "./lib/confidence-policy.mjs";

const ROOT = resolveRoot();
// Raízes vindas da TOPOLOGIA do alvo (nunca `src` cravado — o 1º alvo de fora
// tinha `app`). `SRC_ROOTS[0]` é a base para o caminho relativo do componente:
// com mais de uma raiz, cada arquivo relativiza contra a raiz que o contém.
const SRC_ROOTS = resolveSourceRoots(ROOT);
const raizDe = (file) =>
  SRC_ROOTS.find((raiz) => file.startsWith(`${raiz}${path.sep}`)) ?? SRC_ROOTS[0];

/*
 * As palavras proibidas pela lei (§2, §3.1) — a lista tem que ser a MESMA que o
 * guard executavel usa (`tools/gates/ds-naming-law.py`, FORBIDDEN). Ela cresceu
 * de tres para CINCO em 2026-08-01, quando `label` e `foreground` foram banidas
 * junto com a troca de anatomia e propriedade (§5.6), e esta copia ficou para
 * tras — divergencia entre a lei e o motor que a aplica.
 *
 * Aqui a lista define o que conta como VIOLACAO a migrar, entao ela e o que o
 * censo enxerga. Medido no alvo de referencia antes de mudar: zero classes
 * `*-label-*` ou `*-foreground-*`, entao o corpus nao muda — mas um alvo que as
 * tivesse ficaria com elas invisiveis, e o silencio pareceria limpeza.
 */
const FORBIDDEN = ["surface", "semantic", "content", "label", "foreground"];

/* --------------------------------------------------------------- varredura -- */

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(jsx?|tsx?)$/.test(entry)) yield p;
  }
}

/**
 * Contexto do uso, lido para tras a partir do offset.
 *
 * Sao os eixos do §9 que dao para extrair estaticamente. `nearest landmark`,
 * `route area`, `theme` e `viewport` exigem DOM renderizado — ficam declarados
 * como ausentes em vez de chutados.
 */
function contextOf(text, offset, file) {
  const before = text.slice(Math.max(0, offset - 900), offset);
  const open = before.lastIndexOf("<");
  const frag = open >= 0 ? before.slice(open) : "";
  const tag = (frag.match(/^<([A-Za-z][\w.]*)/) ?? [])[1] ?? null;
  const role = (frag.match(/role=["']([a-z-]+)["']/) ?? [])[1] ?? null;
  const type = (frag.match(/type=["']([a-z]+)["']/) ?? [])[1] ?? null;
  const disabled = /\bdisabled\b|aria-disabled/.test(frag);
  const selected = /aria-selected|aria-current|data-selected/.test(frag);

  const rel = path.relative(raizDe(file), file);
  const parts = rel.split(path.sep);
  const base = parts.pop().replace(/\.(jsx?|tsx?)$/, "");
  const component = base === "index" ? parts[parts.length - 1] ?? base : base;
  // area de rota aproximada pelo primeiro segmento sob src/
  const area = parts[0] ?? "(raiz)";

  return { tag, role, type, component, area, disabled, selected };
}

/**
 * Estado de interacao. TRES fontes, nesta precedencia:
 *   1. prefixo de variante Tailwind (`hover:`) — o mais forte, e do consumo
 *   2. atributo no elemento (`disabled`, `aria-selected`)
 *   3. a palavra de estado dentro do NOME DO TOKEN ANTIGO
 *
 * A fonte 3 existe porque medido: 5 ocorrencias de `surface-selected` caiam num
 * nome derivado com estado `hover`, e 4 de `surface-hover` caiam em nome SEM
 * estado. O nome antigo carrega estado e ignora-lo perde o contrato.
 */
const KNOWN_STATES = ["hover", "focus", "active", "disabled", "visited", "checked", "open", "selected"];

function stateOf(variantPrefix, ctx, oldToken) {
  const vs = (variantPrefix || "").split(":").filter(Boolean);
  const fromVariant = vs.filter((v) => KNOWN_STATES.includes(v));
  if (fromVariant.length) return fromVariant.join("-");
  if (ctx.disabled) return "disabled";
  if (ctx.selected) return "selected";
  const fromOld = (oldToken || "").split("-").find((w) => KNOWN_STATES.includes(w));
  return fromOld ?? null;
}

/**
 * Variante, extraida do nome do token antigo.
 *
 * Medido: `button-background-color-hover` puxava de CINCO primitivos diferentes
 * porque `destructive-tint`, `warning-tint` e `success-tint` colapsavam no mesmo
 * nome. Sao variantes, e a lei §4.4 tem slot para elas — o derivador so nao o
 * preenchia. Sem isso o token novo teria que aliasar 5 valores, que e impossivel.
 */
function variantOf(oldToken, vocabulary) {
  const words = (oldToken || "").split("-");
  return words.find((w) => vocabulary.variants.includes(w)) ?? null;
}

/**
 * DIVERGENCIA CONTEXTUAL, no sentido do §9: expor, nunca apagar.
 *
 * Token cujo nome declara um estado, consumido SEM o prefixo daquele estado, e
 * um fundo estatico usando um token de interacao. Renomear em silencio apagaria
 * a evidencia; o processo tem que reportar.
 */
function divergenceOf(variantPrefix, oldToken) {
  const declared = (oldToken || "").split("-").find((w) => KNOWN_STATES.includes(w));
  if (!declared) return null;
  const applied = (variantPrefix || "").split(":").includes(declared);
  return applied ? null : `token declara estado \`${declared}\` e e consumido sem o prefixo \`${declared}:\``;
}

/**
 * Nome DERIVADO do contexto pela lei. Nao e sugestao livre.
 * Retorna null quando falta o eixo obrigatorio (owner), porque nome sem owner e
 * pote de tinta — a lei §7.4 tira 30 pontos disso.
 */
function deriveName({ owner, property, variant, state, anatomy }) {
  if (!owner) return null;
  /* ORDEM CORRIGIDA 2026-08-01: variante logo apos a entidade (GRAMMAR §6). */
  const parts = [owner];
  if (variant) parts.push(variant);
  if (anatomy) parts.push(anatomy);
  parts.push(property);
  if (state) parts.push(state);
  return parts.join("-");
}

/* -------------------------------------------------------------------- main -- */

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const voc = readVocabulary();

// longest-first: unsorted, `rounded` consumes `rounded-t` and `p` consumes `px`.
const PRE = prefixAlternation();
const alvo = arg("--token");
const tokenRx = alvo
  ? new RegExp(`(?<![\\w-])((?:[a-z-]+:)*)(${PRE})-(${alvo})(?![\\w-])`, "g")
  : new RegExp(`(?<![\\w-])((?:[a-z-]+:)*)(${PRE})-((?:${FORBIDDEN.join("|")})-[a-z0-9-]+)(?![\\w-])`, "g");

const ocorrencias = [];
/*
 * POPULAÇÃO EXAMINADA — não é o mesmo que ocorrências ACHADAS, e confundir as
 * duas produz verdade vácua. `absolute-completion.mjs:320` recusa
 * `population <= 0` justamente porque "resíduo zero sobre população zero" é
 * afirmação sem lastro. Num alvo sem palavra banida, "achadas" é 0; o que dá
 * lastro ao zero é dizer QUANTOS sítios foram olhados.
 */
const examinado = { arquivos: 0, sitiosDeClasse: 0 };
for (const f of SRC_ROOTS.flatMap((raiz) => [...files(raiz)])) {
  const text = readFileSync(f, "utf8");
  examinado.arquivos += 1;
  examinado.sitiosDeClasse += (text.match(/class(?:Name)?\s*=/g) ?? []).length;
  for (const m of text.matchAll(tokenRx)) {
    const [, variantPrefix, prefix, token] = m;
    const line = text.slice(0, m.index).split("\n").length;
    const ctx = contextOf(text, m.index, f);
    const { owner, signal } = findUseOwner({ file: f, tag: ctx.tag, role: ctx.role, type: ctx.type }, voc.owners);
    // FALHA FECHADA. `property` alimenta `deriveName`, e o nome derivado tem que
    // ser parseavel de volta pela lei. Um prefixo de radius/spacing/tipografia
    // produziria `card-border-radius`, cujo segmento `border-radius` nao esta em
    // §4.3 — vira REMAINDER e a nota do proprio nome cai por um defeito que o
    // derivador criou. Sem slot, o cluster vai para decisao com o motivo escrito.
    const property = lawSlotFor(prefix, voc);
    const cssProperty = PREFIX_PROPERTY[prefix] ?? null;
    const lawGap = property ? null
      : `familia \`${prefix}-\` (${cssProperty}) nao tem slot em §4.3 da lei`;
    const state = stateOf(variantPrefix, ctx, token);
    const variant = variantOf(token, voc);
    const divergence = divergenceOf(variantPrefix, token);
    ocorrencias.push({
      file: path.relative(ROOT, f), line, token, prefix, variantPrefix: variantPrefix || null,
      owner: owner ?? null, ownerSignal: signal ?? null, property, cssProperty, lawGap, state, variant, divergence,
      tag: ctx.tag, role: ctx.role, component: ctx.component, area: ctx.area,
    });
  }
}

/**
 * Chave de cluster = os eixos do §9 que temos estaticamente.
 *
 * O eixo de propriedade usa `property` (slot da lei) e cai para `cssProperty`
 * quando a lei nao tem slot. Sem esse fallback, TODA familia sem slot vira
 * `?` e `rounded-`, `p-` e `gap-` no mesmo elemento colapsam num unico cluster
 * — a fila de decisao perderia justamente a informacao que a torna acionavel, e
 * o motivo reportado seria o da primeira ocorrencia sorteada como amostra.
 */
const chave = (o) => [o.owner ?? "?", o.tag ?? "?", o.role ?? "-", o.component, o.property ?? o.cssProperty ?? "?", o.variant ?? "-", o.state ?? "-", o.area].join(" | ");

const clusters = new Map();
for (const o of ocorrencias) {
  const k = chave(o);
  if (!clusters.has(k)) clusters.set(k, { key: k, sample: o, occurrences: [], tokens: new Set() });
  const c = clusters.get(k);
  c.occurrences.push(o);
  c.tokens.add(o.token);
}

/**
 * Valor fisico do token antigo, para detectar divergencia DENTRO do cluster.
 *
 * Sem isso o mapa proporia um nome que teria de aliasar dois primitivos — o que e
 * impossivel. Medido: 10 dos 29 primeiros nomes eram multi-valor.
 */
const tokensJson = path.join(ROOT, "tokens/color.tokens.json");
const VALUES = new Map();
if (existsSync(tokensJson)) {
  const J = JSON.parse(readFileSync(tokensJson, "utf8"));
  const walk = (node, p = []) => {
    for (const [k, v] of Object.entries(node)) {
      if (k === "$type" || k === "$description") continue;
      if (k === "$root") VALUES.set(p.join("."), v?.$value);
      else if (v && typeof v === "object" && "$value" in v) VALUES.set([...p, k].join("."), v.$value);
      else if (v && typeof v === "object") walk(v, [...p, k]);
    }
  };
  walk(J);
}
/*
 * INDICE POR SUFIXO — o que substituiu o lookup de familia unica.
 *
 * DEFEITO CORRIGIDO EM 2026-08-01, e ele era o mais caro do motor. A linha antiga
 * era:
 *
 *     VALUES.get(`semantic.light.surface.${token.replace(/^surface-/, "")}`)
 *
 * com a familia CRAVADA no caminho. Todo token que nao fosse `surface-*` errava o
 * lookup e virava `(sem valor: ...)`. Medido contra o alvo: **478 de 3.321
 * ocorrencias resolvidas — 14,4%**. Com a derivacao abaixo: **3.321 de 3.321, 100%**.
 *
 * A consequencia em cadeia era o defeito de verdade. Sem hex dos dois lados,
 * `converge-tokens.mjs` Linha 198 recebe `null` do `deltaE` e registra
 * `{ name: "cor", weight: 40, score: 0 }` — o MAIOR sinal do orcamento de
 * confianca, zerado. Resultado medido: **1.449 dos 1.457 pares** que a
 * convergencia mandava para o humano tinham o sinal de cor morto. A fila humana
 * nao era ambiguidade; era um sinal desligado — exatamente o modo de falha que o
 * docstring do `tokenize.mjs` diz existir para prevenir.
 *
 * E a ironia era o diagnostico: `surface` e uma das cinco palavras BANIDAS. A
 * unica familia que o resolvedor enxergava era a que a lei proibe — residuo da
 * epoca em que so `surface-*` estava sendo migrado, do mesmo feitio do
 * `--ext ts,tsx` que fez o miner varrer 2% do app e imprimir sucesso.
 *
 * POR QUE INDICE DE SUFIXO, e nao so trocar `surface` pela familia do token: o
 * caminho tambem cravava o TIER (`semantic`) e o TEMA (`light`). Os dois sao
 * convencao do alvo de hoje, nao lei. Indexar pelos ultimos segmentos resolve
 * `content-primary` em `<qualquer>.content.primary` sem saber como o alvo batizou
 * seus tiers. Empate entre temas e resolvido por preferencia estavel (claro
 * primeiro), porque toda a comparacao de ΔE roda dentro de um tema so — alternar
 * tornaria a fusao nao-deterministica.
 */
const BY_SUFFIX = new Map();
for (const [caminho, valor] of VALUES) {
  const seg = caminho.split(".");
  const sufixo = seg.slice(-2).join(".");
  const claro = /(^|\.)light(\.|$)/.test(caminho);
  const atual = BY_SUFFIX.get(sufixo);
  // primeira escrita vence; tema claro sobrepoe um escuro ja gravado
  if (!atual || (claro && !atual.claro)) BY_SUFFIX.set(sufixo, { valor, claro });
}

const primitiveOf = (token) => {
  const corte = token.indexOf("-");
  if (corte > 0) {
    const porFamilia = BY_SUFFIX.get(`${token.slice(0, corte)}.${token.slice(corte + 1)}`);
    if (porFamilia) return porFamilia.valor;
  }
  // token de segmento unico (`background`, `border`) ou familia que o alvo nao separa
  const direto = BY_SUFFIX.get(token) ?? null;
  return direto ? direto.valor : null;
};

const lista = [...clusters.values()]
  .map((c) => {
    const s = c.sample;
    // sem slot na lei nao ha nome derivavel, por mais claro que o contexto seja
    const proposed = s.lawGap
      ? null
      : deriveName({ owner: s.owner, property: s.property, variant: s.variant, state: s.state, anatomy: null });
    // valor dominante do cluster; o resto e DIVERGENCIA a expor, nao a apagar (§9)
    const byValue = new Map();
    for (const o of c.occurrences) {
      const v = primitiveOf(o.token) ?? `(sem valor: ${o.token})`;
      byValue.set(v, (byValue.get(v) ?? 0) + 1);
    }
    const ordered = [...byValue.entries()].sort((a, b) => b[1] - a[1]);
    const dominant = ordered[0]?.[0] ?? null;
    const divergent = c.occurrences.filter((o) => (primitiveOf(o.token) ?? `(sem valor: ${o.token})`) !== dominant);
    return {
      ...c,
      tokens: [...c.tokens],
      count: c.occurrences.length,
      proposedName: proposed,
      dominantPrimitive: dominant,
      valueSpread: ordered.length,
      divergentCount: divergent.length,
      divergentOccurrences: divergent.slice(0, 8),
      stateDivergences: c.occurrences.filter((o) => o.divergence).length,
      needsDecision: !proposed,
      reason: proposed ? null : (s.lawGap ?? "owner nao determinado pelo contexto renderizado"),
    };
  })
  .map((cluster) => {
    const confidence = contextClusterConfidence(cluster);
    return {
      ...cluster,
      confidence,
      needsDecision: confidence.band === "low",
    };
  })
  .sort((a, b) => b.count - a.count)
  /*
   * O `clusterId` NASCE AQUI, e é o MESMO id que o `cluster-packet` carrega.
   *
   * DEFEITO REAL que isto fecha (review adversarial, 2026-08-01): o
   * `batch-contract` declarava `targetClusterIds` derivados da chave do
   * contrato final, e o `cluster-packet` declarava ids por índice. Medido no run
   * root: **0 de 236** ids do lote existiam entre os packets, e **0 de 3.119**
   * `occurrenceIds` existiam no censo — com `tokenization-runner validate`
   * devolvendo `valid:true`, porque o contrato não tem check de integridade
   * referencial para esses campos.
   *
   * Referência pendurada dentro de artefato que o verificador carimba como
   * válido é exatamente a classe de defeito que este repositório existe para
   * caçar. Atribuir o id na LISTA — e não no emissor — faz o mesmo id fluir para
   * `clusters.json`, daí para `converged.json` pela convergência, e daí para o
   * `batch-contract`, sem ninguém precisar recalcular nada.
   */
  .map((c, i) => ({ ...c, clusterId: `cluster-${String(i + 1).padStart(5, "0")}` }));

const total = ocorrencias.length;
const derivados = lista.filter((c) => c.confidence.band === "high");
const cobertos = derivados.reduce((s, c) => s + c.count, 0);

/* ─────────────────────────────────────────── o envelope de CLASSIFIED ───── */
/*
 * `--emit-artifacts <dir> --run-config <path>` transforma o resultado desta
 * análise nos DOIS artefatos que a transição para CLASSIFIED exige:
 * `cluster-packet` (um por cluster) e um `inventory-report` de kind `ownerless`.
 *
 * POR QUE AQUI DENTRO, e não num script separado que leia `clusters.json`. O
 * `cluster-packet` exige `occurrenceIds` COMPLETO, e a saída `--json` deste
 * mesmo script trunca as ocorrências em 6 por cluster (a linha logo abaixo).
 * Um emissor externo teria de escolher entre reprocessar tudo de novo ou emitir
 * uma lista mutilada com cara de completa — e a segunda é a classe de defeito
 * que este repositório passou o dia caçando. Aqui a lista inteira está viva em
 * memória.
 *
 * LIMITE DECLARADO: `occurrenceIds` sai como `<arquivo>:<linha>:<token>`, um id
 * derivado do sítio, e NÃO o `occurrenceId` do censo canônico. A razão é que
 * este script ainda faz a própria varredura de `src/` em vez de ler
 * `design-occurrences.ndjson` — por isso ele enxerga 5.639 sítios de className
 * onde o extrator canônico acha 13.869 ocorrências em 17 kinds. Ligar os dois é
 * trabalho próprio, rastreado em `docs/pending/`; enquanto não acontece, o id é
 * estável e reproduzível, mas é DESTE script, não do censo. Não o cite como se
 * fosse o mesmo.
 */
const emitDir = arg("--emit-artifacts");
if (emitDir) {
  const runConfigPath = arg("--run-config");
  if (!runConfigPath) {
    console.error("--emit-artifacts exige --run-config <path> (o header vem da ancora da corrida)");
    process.exit(1);
  }
  const { envelopeFrom, fingerprint } = await import("../../../../scripts/lib/artifact-envelope.mjs");
  const { mkdirSync: mkd, writeFileSync: wf, existsSync: ex } = await import("node:fs");
  const env = envelopeFrom(runConfigPath);
  mkd(emitDir, { recursive: true });

  /*
   * REFERENCIA E RELATIVA AO RUN ROOT, e aponta para a COPIA materializada.
   *
   * `resolveArtifactRefPath` (artifact-contract.mjs:485-491) recusa caminho
   * absoluto: "Artifact references must be run-relative". A razao e integridade
   * — um run root tem que poder ser movido, arquivado ou inspecionado noutra
   * maquina sem que as refs apontem para o disco de quem o gerou.
   *
   * E a ref ao run-config aponta para `<runRoot>/config.json`, a copia que o
   * `init` materializou, NAO para o arquivo de origem em `<alvo>/.tokenize/`.
   * Sao dois arquivos com o mesmo conteudo e destinos diferentes: o de origem
   * pode ser regenerado por um `anchor-run` novo e mudar de sha256, e a ref
   * ficaria apontando para bytes que a corrida nunca viu.
   */
  const runRoot = arg("--run-root") ?? path.dirname(path.resolve(emitDir));
  const configNoRun = path.join(runRoot, "config.json");
  const refRunConfig = ex(configNoRun)
    ? env.ref("run-config", configNoRun, { relativeTo: runRoot })
    : env.ref("run-config", runConfigPath, { relativeTo: runRoot });

  const sitioId = (o) => `${o.file}:${o.line}:${o.token}`;
  const pacotes = lista.map((c) => {
    // Uma variante de estilo por VALOR FISICO distinto dentro do cluster: e
    // exatamente a divergencia que a §9 manda expor em vez de apagar.
    const porValor = new Map();
    for (const o of c.occurrences) {
      const v = primitiveOf(o.token) ?? `(sem valor: ${o.token})`;
      if (!porValor.has(v)) porValor.set(v, []);
      porValor.get(v).push(o);
    }
    const styleVariants = [...porValor.entries()].map(([valor, ocs]) => ({
      styleFingerprint: fingerprint({ valor, tokens: [...new Set(ocs.map((o) => o.token))].sort() }),
      rawValues: [...new Set(ocs.map((o) => o.token))].sort(),
      frequency: ocs.length,
      locations: ocs.slice(0, 64).map((o) => ({ file: o.file, line: Math.max(1, o.line), column: 1 })),
      // O cluster agrupa por CONTEXTO renderizado, nao por igualdade provada de
      // CSS. Declarar EXACT_SET aqui seria afirmar uma prova que este script nao
      // produz; OBSERVED_EQUIVALENT e o que a evidencia sustenta.
      equivalenceLevel: porValor.size === 1 ? "OBSERVED_EQUIVALENT" : "NOT_EQUIVALENT",
    }));
    return {
      ...env.header("cluster-packet"),
      clusterId: c.clusterId,
      occurrenceIds: [...new Set(c.occurrences.map(sitioId))],
      contextFingerprint: fingerprint(c.key ?? c.sample ?? {}),
      styleVariants,
      evidenceRefs: [refRunConfig],
      confidence: c.confidence,
      classificationStatus:
        c.confidence.band === "high" ? "classified" : "requires-human",
    };
  });

  /*
   * ZERO CLUSTER NÃO SE ESCREVE COMO ARQUIVO VAZIO.
   *
   * A versão anterior gravava `cluster-packets.ndjson` sempre, e num alvo sem
   * nenhum cluster o resultado era um arquivo de 1 byte. O contrato o recusa
   * (`NDJSON artifact is empty`) e recusa CERTO: arquivo vazio é
   * indistinguível de produtor que morreu no meio. Medido 2026-08-03 na
   * primeira cobaia externa.
   *
   * E o zero DAQUELE alvo não era "não havia nada": o censo achou 35 mil
   * ocorrências em 12 tipos — 13.131 `utility-class`, 9.872 `inline-style`,
   * 5.447 `svg-presentation` — e ESTE classificador consome só
   * `utility-class` que carregue palavra banida. Zero aqui significa
   * *"a forma que eu varro não aparece neste alvo"*, e é isso que o relatório
   * passa a DIZER, em vez de deixar um arquivo vazio insinuando outra coisa.
   */
  const pacotesPath = pacotes.length ? path.join(emitDir, "cluster-packets.ndjson") : null;
  if (pacotesPath) wf(pacotesPath, pacotes.map((p) => JSON.stringify(p)).join("\n") + "\n");

  const baixaConfianca = lista.filter((c) => c.confidence.band === "low");
  const relatorio = {
    ...env.header("inventory-report"),
    reportId: "classified/ownerless",
    inventoryKind: "ownerless",
    inputArtifactRefs: [
      refRunConfig,
      ...(pacotesPath ? [env.ref("cluster-packet", pacotesPath, { relativeTo: runRoot })] : []),
    ],
    counts: {
      // `population` = o que foi EXAMINADO (sítios de classe olhados). Antes era
      // `total` (as ocorrências achadas), e num alvo limpo isso dava 0 —
      // população vácua, que o avaliador de conclusão recusa por contrato.
      population: examinado.sitiosDeClasse,
      filesExamined: examinado.arquivos,
      violations: total,
      clusters: lista.length,
      classified: lista.length - baixaConfianca.length,
      requiresHuman: baixaConfianca.length,
      unapprovedResidual: baixaConfianca.reduce((s, c) => s + c.count, 0),
    },
    /*
     * O ESCOPO DECLARADO, e ele é o que torna o zero legível. `population` é
     * a contagem que ESTE classificador examinou; `scopeKinds` diz o que ele
     * consome. Sem isto, "0 clusters" e "alvo limpo" viram a mesma frase — e
     * são coisas diferentes.
     */
    scope: {
      occurrenceKinds: ["utility-class"],
      criterion: "utility-class cuja classe carrega palavra banida (§3.1)",
      note:
        pacotes.length === 0
          ? "zero cluster nesta forma; outras formas de débito do alvo (inline-style, svg-presentation, css-declaration) são de OUTRO classificador, não deste"
          : null,
    },
    detailArtifactRefs: [],
    // `reconciled` afirma que o inventario fecha com o censo. Ele so pode ser
    // verdadeiro quando NENHUM cluster ficou sem nome — senao ha populacao que o
    // relatorio conta e nao explica.
    reconciled: baixaConfianca.length === 0,
  };
  const relatorioPath = path.join(emitDir, "inventory-ownerless.json");
  wf(relatorioPath, JSON.stringify(relatorio, null, 1) + "\n");

  console.error(
    `CLASSIFIED emitido: ${pacotes.length} cluster-packet${pacotes.length ? "" : " (nenhum: escopo declarado no relatorio)"} + 1 inventory-report` +
      ` (${relatorio.counts.classified} classificados, ${relatorio.counts.requiresHuman} para humano)`
  );
}

if (argv.includes("--json")) {
  console.log(JSON.stringify({ total, clusters: lista.map((c) => ({ ...c, occurrences: c.occurrences.slice(0, 6) })) }, null, 1));
} else if (!emitDir) {
  console.log(`ocorrencias que violam a lei : ${total}`);
  console.log(`CLUSTERS DE CONTEXTO         : ${lista.length}   <- a unidade de decisao`);
  console.log(`  com nome DERIVADO da lei   : ${derivados.length} clusters, ${cobertos} ocorrencias (${(100 * cobertos / total).toFixed(1)}%)`);
  console.log(`  precisam de decisao        : ${lista.length - derivados.length} clusters, ${total - cobertos} ocorrencias\n`);
  console.log(`${"n".padStart(4)}  ${"token antigo".padEnd(28)}${"nome DERIVADO do contexto".padEnd(40)}contexto`);
  console.log("-".repeat(132));
  for (const c of lista.slice(0, Number(arg("--limit") ?? 30))) {
    const s = c.sample;
    const ctx = `${s.tag ?? "?"}${s.role ? `[${s.role}]` : ""} em ${s.component} (${s.area})`;
    console.log(
      `${String(c.count).padStart(4)}  ${c.tokens.join(",").slice(0, 27).padEnd(28)}${(c.proposedName ?? "— DECISAO NECESSARIA").padEnd(40)}${ctx}`
    );
  }
}
