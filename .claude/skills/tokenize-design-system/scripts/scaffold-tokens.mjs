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
const SD_CONFIG = "style-dictionary.config.json";
/** Versão major de Style Dictionary com DTCG nativo (`$value`/`$type`). */
const SD_VERSAO = "^5.5.0";

/**
 * O COMPILADOR NÃO É NOSSO — e não deve ser (LEI ZERO).
 *
 * DTCG → CSS custom properties é problema resolvido. O canon deste repo já
 * havia feito a pesquisa e medido a adoção (`docs/ESTADO.md`): Style Dictionary
 * **1,95M downloads/semana** contra 51,7k do `@terrazzo/cli` — 38× — e suporte
 * DTCG nativo desde a v4 (auto-detecta `$value`, propaga `$type` de grupo).
 * Escrever um flattener nosso seria reinventar com 1 usuário.
 *
 * O ENCAIXE COM TAILWIND v4, conferido na doc oficial (tailwindcss.com,
 * `theme.mdx` e `colors.mdx`) e não adivinhado:
 *
 * - variável no namespace `--color-*` DENTRO de `@theme` gera as utilities
 *   (`bg-*`, `text-*`, `fill-*`) — é exatamente o que a lei deste repo fixa
 *   (`law.md` Linha 399);
 * - `@theme` pode viver em arquivo PRÓPRIO, importado depois de
 *   `@import "tailwindcss"` — o padrão documentado *"Share theme variables
 *   across projects"*. Logo o compilador escreve um arquivo só dele, e nada
 *   do app precisa ser reescrito.
 *
 * E o encaixe usa recurso EXISTENTE do Style Dictionary, sem format custom: o
 * `css/variables` aceita `selector`, então `selector: "@theme"` emite o bloco
 * na forma que o Tailwind consome. `outputReferences: true` preserva o alias
 * `{primitivo}` como `var(...)` — obrigatório aqui, porque o tier DTCG exige
 * que o componente SIGA o primitivo; achatar para hex quebraria a herança
 * (foi a 1ª das quatro costuras que `emit-tokens.mjs` documenta).
 */
export function configDoCompilador(sourceRoots, root = ".") {
  /*
   * A raiz pode chegar RELATIVA ("app", o que `planejarScaffold` produz) ou
   * ABSOLUTA. Resolver contra `root` cobre as duas; `path.relative` cru cobria
   * só a absoluta, e essa foi a 9ª ocorrência da família dominante deste
   * projeto — só que desta vez o TESTE participou do erro: eu o alimentei com
   * a forma que imaginei (`/alvo/app`) em vez da que o produtor passa, ele
   * ficou verde, e o build real escreveu o CSS TRÊS NÍVEIS ACIMA, dentro do
   * repositório do processo. Guard abaixo: `buildPath` que escapa do alvo é
   * recusa, não arquivo.
   */
  const destino = path.posix.join(raizRelativa(root, sourceRoots[0]), "styles/generated/");
  return {
    source: ["tokens/**/*.tokens.json"],
    platforms: {
      css: {
        transformGroup: "css",
        buildPath: destino,
        files: [
          {
            destination: "theme.css",
            format: "css/variables",
            options: {
              // O bloco que o Tailwind v4 consome; `:root` não gera utility.
              selector: "@theme",
              // Alias preservado como var() — o componente segue o primitivo.
              outputReferences: true,
            },
          },
        ],
      },
    },
  };
}

/**
 * A raiz de fonte como caminho POSIX relativo ao alvo — fonte única desta
 * normalização, e ela existe porque a mesma conta feita a olho errou DUAS vezes
 * no mesmo arquivo (2026-08-03).
 *
 * A raiz chega RELATIVA ("app", o que `planejarScaffold` produz) ou ABSOLUTA.
 * `path.relative` cru só acerta a absoluta: com a relativa ele a resolve contra
 * o CWD, e o CWD é o repositório do PROCESSO. Resultado medido: o compilador
 * escreveu o CSS em `../../../ui-tokenizer-v2/app/styles/generated/`, isto é,
 * dentro do repo da ferramenta, e o teste ficou verde porque eu o alimentei com
 * a forma que imaginei em vez da que o produtor passa.
 */
export function raizRelativa(root, sourceRoot) {
  const rel = path
    .relative(path.resolve(root), path.resolve(root, sourceRoot))
    .split(path.sep)
    .join("/");
  if (!rel || rel.startsWith("..") || path.posix.isAbsolute(rel)) {
    throw new Error(
      `raiz de fonte "${sourceRoot}" não está dentro de ${root} — ` +
        `o compilador escreveria fora do alvo`
    );
  }
  return rel;
}

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

  /*
   * PIPELINE DO ALVO VENCE. Se o alvo já tem `tokens:build`, ele já decidiu como
   * compila os tokens dele — impor a nossa config de Style Dictionary por cima
   * seria o processo reescrevendo o build de um app que funciona. Só alvo SEM
   * compilador nenhum recebe o nosso, e aí ele vem COMPLETO (config + script +
   * dependência declarada), nunca pela metade.
   */
  const precisaCompilador = !pkg.scripts?.["tokens:build"];
  const compilador = precisaCompilador ? configDoCompilador(sourceRoots, root) : null;
  const cssGerado = compilador
    ? path.posix.join(
        compilador.platforms.css.buildPath,
        compilador.platforms.css.files[0].destination
      )
    : null;

  const criar = [
    {
      rel: "tokenization.config.json",
      conteudo: {
        sourceRoots,
        tokenFile: TOKEN_FILE_PADRAO,
        ...(cssGerado ? { themeFile: cssGerado } : {}),
      },
    },
  ];
  if (!existsSync(path.join(root, TOKEN_FILE_PADRAO))) {
    criar.push({ rel: TOKEN_FILE_PADRAO, conteudo: esqueletoDTCG() });
  }
  if (compilador && !existsSync(path.join(root, SD_CONFIG))) {
    criar.push({ rel: SD_CONFIG, conteudo: compilador });
  }

  /*
   * O `tokens:build` do alvo nasce JUNTO do DTCG — nunca depois. A versão
   * anterior criava o DTCG e parava, produzindo o "pipeline PARCIAL" que
   * `preflight-tokens` declara quebra (e declara certo): um alvo VIRGEM, que o
   * laço atravessa, viraria um alvo QUEBRADO, que o laço recusa. O autor deste
   * arquivo foi a primeira vítima do próprio guard, em 2026-08-03.
   *
   * Instalar a dependência NÃO é papel deste comando: mexer em node_modules do
   * alvo é ação do operador. Ele declara e reporta; se faltar instalar, o
   * `preflight-tokens` falha fechado com a mensagem do gerenciador.
   */
  const pacote = { ...pkg };
  let pacoteMudou = false;
  if (precisaCompilador) {
    pacote.scripts = { ...pkg.scripts, "tokens:build": `style-dictionary build --config ${SD_CONFIG}` };
    pacoteMudou = true;
    if (!pkg.devDependencies?.["style-dictionary"] && !pkg.dependencies?.["style-dictionary"]) {
      pacote.devDependencies = { ...pkg.devDependencies, "style-dictionary": SD_VERSAO };
    }
  }
  if (pacoteMudou) criar.push({ rel: "package.json", conteudo: pacote });

  return {
    criar,
    configFile: null,
    tokenFile: TOKEN_FILE_PADRAO,
    sourceRoots,
    cssGerado,
    // O ÚNICO passo manual, e ele é declarado em voz alta: sem este import o
    // build passa verde e nenhuma utility existe — a falha silenciosa que este
    // projeto inteiro existe para impedir. A prova fica no CSS BUILDADO
    // (`validate-token-build.mjs --css ... --class ...`), nunca na config.
    importarNoEntryCss: cssGerado
      ? `@import "./${path.posix.relative(raizRelativa(root, sourceRoots[0]), cssGerado)}";`
      : null,
    instalar: pacoteMudou ? "instale as dependências do alvo (o gerenciador do lockfile)" : null,
  };
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
    cssGerado: plano.cssGerado ?? null,
    passosManuais: [plano.instalar, plano.importarNoEntryCss ? `adicione no CSS de entrada, DEPOIS de @import "tailwindcss": ${plano.importarNoEntryCss}` : null].filter(Boolean),
  };
  if (argv.includes("--json")) {
    console.log(JSON.stringify(saida, null, 1));
  } else if (plano.criar.length) {
    console.log(`scaffold: criados ${saida.criados.join(", ")} (fontes: ${saida.sourceRoots.join(", ")})`);
    for (const passo of saida.passosManuais) console.log(`  PASSO MANUAL: ${passo}`);
  } else {
    console.log(`scaffold: nada a fazer — o alvo já declara tokenFile ${saida.tokenFile}`);
  }
  process.exit(0);
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(MODULE_PATH)) {
  main();
}
