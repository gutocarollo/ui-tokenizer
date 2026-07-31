#!/usr/bin/env node
/**
 * validate-cookbook.mjs — o cookbook nao pode ensinar um nome que a lei reprova.
 *
 * POR QUE ESTE ARQUIVO EXISTE. Em 2026-08-01 o dono perguntou "qual e o path
 * disso aqui?" sobre uma bateria de 12 nomes que eu havia rodado contra o
 * oraculo. Resposta honesta: NAO TINHA PATH — era um heredoc inline, descartado
 * ao terminar. A verificacao mais deterministica do dia nao era reexecutavel.
 * Um cookbook cujos exemplos ninguem re-verifica envelhece exatamente como os
 * docs que este projeto passou o dia retratando.
 *
 * O CONTRATO. Todo nome escrito na coluna "token pela lei" do cookbook e
 * submetido ao mesmo oraculo que julga um token de producao (`scoreName`), com
 * o vocabulario lido da LEI (nao de uma copia). Regra:
 *
 *   - nota 100 e o esperado; qualquer criterio reprovado e FALHA,
 *   - salvo quando a linha declara `⚠` e a secao de EXCECOES do proprio
 *     cookbook justifica (ex.: LAW GAP conhecido). Excecao sem justificativa
 *     escrita e falha — nao ha carve-out silencioso.
 *
 * O cookbook e markdown porque neste repo a LEI e markdown lida por maquina
 * (§4.3 do GRAMMAR e parseada). Mesma convencao: uma fonte, dois leitores.
 *
 * Usage:
 *   node validate-cookbook.mjs                       # usa o cookbook canonico
 *   node validate-cookbook.mjs --cookbook <path>
 *   node validate-cookbook.mjs --json
 *
 * Exit: 0 = todo exemplo conforma; 1 = ha exemplo que a lei reprova.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scoreName, readVocabulary } from "./score-naming.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/** O cookbook mora junto da lei; o espelho da skill e o fallback portatil. */
const CANDIDATOS = [
  path.resolve(AQUI, "../reference/cookbook.md"),
  path.resolve(AQUI, "../../../../docs/law/cookbook.md"),
];

function acharCookbook(argv) {
  const i = argv.indexOf("--cookbook");
  if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]);
  const achado = CANDIDATOS.find((p) => existsSync(p));
  if (!achado) {
    throw new Error(
      "cookbook.md nao encontrado. Procurado em:\n  " + CANDIDATOS.join("\n  ")
    );
  }
  return achado;
}

/**
 * Extrai os exemplos das tabelas markdown.
 *
 * Uma linha de exemplo tem a coluna do token pela lei marcada com backticks e
 * fica numa tabela cujo cabecalho contem "token pela lei" (case-insensitive).
 * Qualquer outra tabela do documento e ignorada — prosa e tabela de apoio nao
 * viram assercao por acidente.
 */
export function extrairExemplos(markdown) {
  const linhas = markdown.split("\n");
  const exemplos = [];
  let colunaToken = -1;
  let colunaSituacao = -1;
  let colunaAntigo = -1;
  let dentro = false;
  let secao = "";

  for (let n = 0; n < linhas.length; n += 1) {
    const linha = linhas[n];
    if (linha.startsWith("#")) {
      secao = linha.replace(/^#+\s*/, "").trim();
      dentro = false;
      continue;
    }
    if (!linha.trim().startsWith("|")) {
      dentro = false;
      continue;
    }
    const celulas = linha.split("|").slice(1, -1).map((c) => c.trim());
    const ehSeparador = celulas.every((c) => /^:?-{2,}:?$/.test(c));
    if (ehSeparador) continue;

    if (!dentro) {
      const cab = celulas.map((c) => c.toLowerCase());
      colunaToken = cab.findIndex((c) => c.includes("token pela lei"));
      if (colunaToken < 0) continue;
      colunaSituacao = cab.findIndex((c) => c.includes("situa"));
      colunaAntigo = cab.findIndex(
        (c) => c.includes("antigo") || c.includes("hoje")
      );
      dentro = true;
      continue;
    }

    const bruto = celulas[colunaToken] ?? "";
    const excecao = /⚠/.test(bruto) || /⚠/.test(linha);
    for (const m of bruto.matchAll(/`([a-z0-9][a-z0-9.-]*)`/g)) {
      exemplos.push({
        token: m[1],
        secao,
        linha: n + 1,
        excecao,
        situacao: colunaSituacao >= 0 ? celulas[colunaSituacao] : "",
        antigo: colunaAntigo >= 0 ? celulas[colunaAntigo] : "",
      });
    }
  }
  return exemplos;
}

/** As excecoes precisam estar JUSTIFICADAS por escrito no proprio cookbook. */
export function extrairExcecoes(markdown) {
  const i = markdown.search(/^#+\s*Exce(ç|c)(õ|o)es/im);
  if (i < 0) return "";
  return markdown.slice(i);
}

/**
 * O nome no cookbook e escrito com PONTOS (`button.label`, a forma da lei).
 * O oraculo julga a forma CONSUMIDA, com hifens. A traducao e mecanica e fica
 * aqui, num lugar so, para que o cookbook fale a lingua da lei e o teste fale a
 * lingua do codigo sem ninguem reescrever nada a mao.
 */
export function paraFormaConsumida(nomeDaLei) {
  return nomeDaLei.replace(/\./g, "-");
}

export function validarCookbook(markdown, vocabulario, universoExtra = new Set()) {
  const exemplos = extrairExemplos(markdown);
  const excecoes = extrairExcecoes(markdown);
  /*
   * O UNIVERSO DO COOKBOOK E O PROPRIO COOKBOOK. O criterio `state-with-base`
   * (§5.4) exige que um token de ESTADO tenha o par default ao lado — e num
   * cookbook isso e literal: se a tabela ensina `button.primary.background-color.hover`
   * sem ensinar `button.primary.background-color`, a tabela esta incompleta, e o
   * leitor nao tem para onde ir no estado default. Passar um universo vazio
   * silenciaria exatamente a incompletude que este validador existe para achar.
   */
  const universo = new Set([
    ...universoExtra,
    ...exemplos.map((e) => paraFormaConsumida(e.token)),
  ]);
  const resultados = exemplos.map((ex) => {
    const consumido = paraFormaConsumida(ex.token);
    const r = scoreName(consumido, vocabulario, universo);
    const reprovados = r.criteria.filter((c) => !c.ok);
    const justificado =
      ex.excecao && excecoes.includes(ex.token);
    return {
      ...ex,
      consumido,
      score: r.score,
      reprovados: reprovados.map((c) => ({ criterio: c.c, nota: c.note })),
      justificado,
      conforma: reprovados.length === 0 || justificado,
    };
  });
  const falhas = resultados.filter((r) => !r.conforma);
  const excecoesSemJustificativa = resultados.filter(
    (r) => r.excecao && !r.justificado
  );
  return { resultados, falhas, excecoesSemJustificativa };
}

function main(argv) {
  const cookbookPath = acharCookbook(argv);
  const markdown = readFileSync(cookbookPath, "utf8");
  const vocabulario = readVocabulary();
  const { resultados, falhas, excecoesSemJustificativa } = validarCookbook(
    markdown,
    vocabulario
  );

  if (argv.includes("--json")) {
    process.stdout.write(
      JSON.stringify(
        { cookbook: cookbookPath, total: resultados.length, resultados },
        null,
        2
      ) + "\n"
    );
    return falhas.length === 0 ? 0 : 1;
  }

  const cem = resultados.filter((r) => r.score === 100).length;
  process.stdout.write(
    `cookbook: ${path.relative(process.cwd(), cookbookPath)}\n` +
      `exemplos: ${resultados.length} · nota 100: ${cem} · excecoes declaradas: ` +
      `${resultados.filter((r) => r.excecao).length}\n`
  );

  for (const f of falhas) {
    process.stdout.write(
      `\nREPROVADO  ${f.token}  (${f.secao}, linha ${f.linha}) nota ${f.score}\n` +
        f.reprovados
          .map((c) => `    ${c.criterio}: ${(c.nota ?? "").slice(0, 100)}`)
          .join("\n") +
        "\n"
    );
  }
  for (const e of excecoesSemJustificativa) {
    process.stdout.write(
      `\nEXCECAO SEM JUSTIFICATIVA  ${e.token} (linha ${e.linha}) — ` +
        "declare o motivo na secao Excecoes do cookbook.\n"
    );
  }

  if (falhas.length === 0) {
    process.stdout.write("\nCOOKBOOK OK — nenhum exemplo reprovado pela lei.\n");
    return 0;
  }
  process.stdout.write(`\nCOOKBOOK FAIL — ${falhas.length} exemplo(s).\n`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
