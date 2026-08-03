#!/usr/bin/env node
/**
 * scaffold-tokens — o bootstrap de UM alvo virgem, explícito e idempotente.
 *
 * POR QUE EXISTE, e por que NÃO é um passo automático do laço. Medido em
 * 2026-08-03 no primeiro alvo virgem real: `CLASSIFIED` recusa o alvo porque
 * `resolveProjectLayout` exige um arquivo DTCG. Havia duas saídas erradas e uma
 * certa:
 *
 *   ERRADA 1 — afrouxar o guard (devolver `tokenFile: null`). VETADO pelo dono
 *              em 2026-08-03: relaxar checagem fail-closed para alcançar fase
 *              adiante é reportar progresso não conquistado. E o próprio guard
 *              já nomeia a ação do operador: *"Add tokenization.config.json
 *              with tokenFile"*.
 *   ERRADA 2 — escaffoldar dentro do laço, em silêncio. O laço passaria a
 *              MUTAR um repositório que ninguém mandou mutar, no meio de uma
 *              varredura — e a primeira vez que isso acontecesse num repo de
 *              cliente seria a última.
 *   CERTA   — um comando SEPARADO, que o operador roda uma vez por alvo. É a
 *              forma que D5 do dono pede: unidade revisável e revertível
 *              (arquivos novos, commit próprio, relatório), nunca escrita
 *              difusa.
 *
 * O QUE ELE ESCREVE, e o que deliberadamente NÃO escreve. Só o ESQUELETO que
 * faz a topologia resolver: `tokenization.config.json` (declara sourceRoots e
 * tokenFile) e um DTCG vazio. NENHUM token entra aqui — token é produto da
 * fase DECIDED, com nome julgado pelo oráculo. Um scaffold que já viesse com
 * tokens estaria decidindo naming fora do lugar onde o naming se decide.
 *
 * Idempotente e NÃO-DESTRUTIVO: arquivo existente nunca é sobrescrito. Alvo
 * já configurado sai com exit 0 e `criados: []`.
 *
 * Uso:
 *   node scaffold-tokens.mjs --root <app> [--source-roots <csv>] [--json]
 *
 * Exit:
 *   0  esqueleto presente (criado agora, ou já existia)
 *   1  não foi possível: sem package.json, nenhuma raiz de fonte encontrada,
 *      ou config existente inconsistente (aponta tokenFile que não existe)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_PATH = fileURLToPath(import.meta.url);

const CANDIDATOS_DE_FONTE = ["src", "app", "components"];
const TOKEN_FILE_PADRAO = "tokens/color.tokens.json";

/** DTCG vazio, mas VÁLIDO: `$schema` declara o formato; nada de token. */
export function esqueletoDTCG() {
  return {
    $schema: "https://schemas.designtokens.org/1.0/tokens.schema.json",
    $description:
      "Esqueleto criado por scaffold-tokens. Tokens entram pela fase DECIDED, nunca à mão.",
  };
}

export function planejarScaffold(root, sourceRootsPedidas = null) {
  if (!existsSync(path.join(root, "package.json"))) {
    return { erro: `package.json não existe em ${root} — isto não parece ser a raiz de um app` };
  }

  const configExistente = ["tokenization.config.json", "tokens/tokenization.config.json"]
    .map((rel) => path.join(root, rel))
    .find(existsSync);

  const sourceRoots = (sourceRootsPedidas ?? CANDIDATOS_DE_FONTE).filter((rel) =>
    existsSync(path.join(root, rel))
  );
  if (!sourceRoots.length) {
    return {
      erro:
        `nenhuma raiz de fonte encontrada em ${root} (testadas: ` +
        `${(sourceRootsPedidas ?? CANDIDATOS_DE_FONTE).join(", ")}) — passe --source-roots`,
    };
  }

  if (configExistente) {
    const valores = JSON.parse(readFileSync(configExistente, "utf8"));
    const alvoToken = valores.tokenFile ?? TOKEN_FILE_PADRAO;
    // Config que aponta para um arquivo ausente é INCONSISTENTE, não virgem:
    // criar o arquivo por baixo dela esconderia um erro de configuração.
    if (!existsSync(path.join(root, alvoToken))) {
      return {
        erro:
          `${configExistente} declara tokenFile "${alvoToken}" e o arquivo não existe. ` +
          `Config inconsistente não é alvo virgem — conserte a config ou crie o arquivo.`,
      };
    }
    return { criar: [], configFile: configExistente, tokenFile: alvoToken, sourceRoots };
  }

  /*
   * FAIL-CLOSED contra MEIO PIPELINE — e o autor deste arquivo foi a primeira
   * vítima (2026-08-03). A versão anterior criava config + DTCG e paravam aí;
   * `preflight-tokens` então acusava, com razão, *"pipeline PARCIAL: script
   * tokens:build AUSENTE, tokens/*.tokens.json existe — parcial é quebra, não
   * estado"*. Um scaffold que produz exatamente o estado que o guard vizinho
   * declara quebrado é pior que scaffold nenhum: ele converte um alvo VIRGEM
   * (que o laço sabe atravessar) num alvo QUEBRADO (que o laço recusa).
   *
   * O DTCG só nasce junto de quem o compila. Gerar o compilador (DTCG → CSS
   * custom properties sob `--color-*`) é peça própria, não efeito colateral
   * deste esqueleto.
   */
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  if (!pkg.scripts?.["tokens:build"]) {
    return {
      erro:
        `${root} não define o script "tokens:build". Criar o DTCG sem o compilador ` +
        `produziria pipeline PARCIAL, que preflight-tokens recusa (e recusa certo): ` +
        `alvo virgem viraria alvo quebrado. Adicione o pipeline de build de tokens ` +
        `do alvo primeiro — este comando só escreve o esqueleto de topologia.`,
    };
  }

  const criar = [
    {
      rel: "tokenization.config.json",
      conteudo: { sourceRoots, tokenFile: TOKEN_FILE_PADRAO },
    },
  ];
  if (!existsSync(path.join(root, TOKEN_FILE_PADRAO))) {
    criar.push({ rel: TOKEN_FILE_PADRAO, conteudo: esqueletoDTCG() });
  }
  return { criar, configFile: null, tokenFile: TOKEN_FILE_PADRAO, sourceRoots };
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (flag, fallback = null) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  if (argv.includes("--help") || !arg("--root")) {
    console.log(
      "scaffold-tokens.mjs --root <app> [--source-roots <csv>] [--json]\n\n" +
        "Cria APENAS o esqueleto (tokenization.config.json + DTCG vazio) de um alvo virgem.\n" +
        "Não sobrescreve arquivo existente. Tokens entram pela fase DECIDED."
    );
    process.exit(argv.includes("--help") ? 0 : 1);
  }
  const root = path.resolve(arg("--root"));
  const pedidas = arg("--source-roots")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
  const plano = planejarScaffold(root, pedidas);
  if (plano.erro) {
    console.error(`scaffold-tokens: ${plano.erro}`);
    process.exit(1);
  }
  for (const { rel, conteudo } of plano.criar) {
    const destino = path.join(root, rel);
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(destino, `${JSON.stringify(conteudo, null, 2)}\n`);
  }
  const saida = {
    root,
    criados: plano.criar.map((c) => c.rel),
    sourceRoots: plano.sourceRoots,
    tokenFile: plano.tokenFile,
  };
  console.log(
    argv.includes("--json")
      ? JSON.stringify(saida, null, 1)
      : plano.criar.length
        ? `scaffold: criados ${saida.criados.join(", ")} (fontes: ${saida.sourceRoots.join(", ")})`
        : `scaffold: nada a fazer — o alvo já declara tokenFile ${saida.tokenFile}`
  );
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(MODULE_PATH)) {
  main();
}
