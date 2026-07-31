# O `ui-tokenizer` reproduz o próprio processo? Inventário

**Antes deste commit: não.** O repositório canônico do processo estava incompleto
e desatualizado em relação ao alvo onde o trabalho aconteceu.

> **RESOLVIDO — verificado em 2026-07-31.** Os 9 ausentes e os 5 divergentes
> abaixo são **história**, não pendência. Reconferido arquivo a arquivo nesta
> data: os 14 existem, `applyBindingWaivers` está em
> `scripts/lib/visual-contract.mjs` **Linha 994** (e é chamado na **Linha 1271**),
> e `package.json` declara os 7 pacotes. Uma única linha do inventário original
> continua **não resolvida** e está marcada onde aparece. O texto abaixo fica
> como registro do defeito; o veredito de hoje está na §"Estado depois deste
> commit".

## O que foi medido

Comparação arquivo a arquivo entre o que o processo executa no alvo
(`makers-ai-hub/frontend`) e o que existia aqui:

| estado | arquivos |
|---|---:|
| idênticos | 5 |
| **divergentes** | **5** |
| **ausentes** | **9** |

### Ausentes — o pipeline quebrava no meio

| arquivo | consequência da ausência |
|---|---|
| `scripts/prepare-evidence-run.mjs` | **`ui-evidence.sh` o invoca.** O script de captura deste repo falhava em runtime. |
| `scripts/lib/evidence-composer.mjs` | composição de manifests indisponível |
| `scripts/verify-contract-source-delta.mjs` | prova AST da dispensa de bind |
| `scripts/codemod-entities.mjs` | **produz o lado `after` do par** |
| `scripts/reverse-entities.mjs` | **produz o lado `before` do par** |
| `scripts/ds-contrast-pairs.py` | guard de contraste WCAG + espelho hex×rgb |
| `tests/visual/network-fixtures.json` | fixtures e `contractSources` — **único item deste inventário ainda ausente em 2026-07-31** |

A tabela nomeia **7** dos 9 ausentes. Os 2 não listados eram módulos de
`scripts/lib/` arrastados junto pela cópia dos entrypoints; a medição original
contou-os no total e não abriu linha para eles.

Sem os dois codemods, **nenhuma prova de pixel deste processo era reproduzível
a partir deste repositório** — dá para ler o resultado, não para regerar o par.

### Divergentes — o repo canônico estava atrás do alvo

| arquivo | linhas divergentes | o que faltava aqui |
|---|---:|---|
| `scripts/lib/visual-contract.mjs` | 129 | `applyBindingWaivers` — a dispensa de bind provada |
| `scripts/lib/evidence-matrix.mjs` | 66 | fingerprints de bind atualizados |
| `tests/visual/visual-registry.mjs` | 103 | materialização de contextos |
| `tests/visual/evidence.spec.ts` | 63 | captura por cenário |
| `playwright.visual.config.ts` | 19 | **flags de determinismo de render** |

A última é a mais cara: sem as flags, o piso de ruído da esteira é maior que
zero e uma política `preserve` fica insatisfazível até por um no-op.

## Terceira falha: nenhuma dependência declarada

O repo não tinha `package.json`. O código importa sete pacotes externos:

```
@babel/parser  @playwright/test  ajv  axe-core  pixelmatch  pngjs  typescript
```

Sem declaração, `node --test` falha em `ERR_MODULE_NOT_FOUND` já no primeiro
teste. O processo canônico não rodava sozinho — só dentro do alvo, por herança
de `node_modules`.

**Achado adjacente:** `@babel/parser` também não estava declarado **no alvo** —
subia por hoist, exatamente como `@tailwindcss/node`. É a mesma classe de defeito
que já foi corrigida uma vez nesta sequência, e `verify-contract-source-delta.mjs`
depende dele. Declarado nos dois repos como `^7.24.8`, que é o range que o
`yarn.lock` do alvo já cobre (`--frozen-lockfile` exit 0, lock intacto).

## Estado depois deste commit

- 9 ausentes copiados, 5 divergentes atualizados
- `ui-evidence.sh` resolve todos os scripts que invoca
- imports de `./lib/*` resolvem nos quatro entrypoints
- `package.json` declara os sete pacotes e expõe `test`, `ui:evidence` e
  `guard:contrast`

### Reconferência de 2026-07-31 — o que o comando diz hoje

Comparação byte a byte de todo `scripts/**`, `tests/visual/**` e
`playwright.visual.config.ts` contra o alvo:

```bash
A=/home/augusto/code/makers-ai-hub/frontend
for f in $(git ls-files 'scripts/*' 'tests/visual/*' 'playwright.visual.config.ts'); do
  [ -f "$A/$f" ] || { echo "SO-AQUI $f"; continue; }
  cmp -s "$f" "$A/$f" && echo "IDENT $f" || echo "DIVERG $f"
done
```

| resultado | arquivos |
|---|---:|
| **idênticos** | **26** |
| divergentes | **1** — `tests/visual/routes.json.example` |
| só aqui | 0 |

A única divergência é o arquivo de **exemplo** de rotas: 190 linhas aqui contra
18 no alvo. Divergência de conteúdo de exemplo, não de motor — o exemplo daqui é
o mais completo dos dois.

`applyBindingWaivers` está em `scripts/lib/visual-contract.mjs` **Linha 994**,
invocado na **Linha 1271**. Os 5 divergentes de 2026-07-30 estão sincronizados;
os 9 ausentes, presentes, **com uma exceção**.

### O que ainda NÃO está aqui (medido hoje, não resolvido)

O alvo tem **8 arquivos** que este repo não tem, e 6 deles são **os testes dos
módulos que vieram** — trouxemos o motor sem trazer a prova dele:

| arquivo (existe no alvo, ausente aqui) | o que perdemos |
|---|---|
| `tests/visual/network-fixtures.json` | o item pendente do inventário original: fixtures e `contractSources` |
| `tests/visual/network-fixtures.test.mjs` | teste do módulo `network-fixtures.mjs`, que **está** aqui |
| `scripts/gen-visual-routes.test.mjs` | teste de `gen-visual-routes.mjs`, que **está** aqui |
| `scripts/lib/binding-waiver.test.mjs` | teste da dispensa de bind |
| `scripts/lib/evidence-composer.test.mjs` | teste do compositor de manifests |
| `scripts/lib/evidence-matrix.test.mjs` | teste da matriz de evidência |
| `scripts/lib/read-only-fixtures.test.mjs` | teste das fixtures read-only |
| `scripts/lib/route-impact.test.mjs` | teste do impacto de rota |

É a mesma classe de defeito do inventário original, um nível acima: o código
reproduz, a **suíte que o valida** não.

E o script `test` do `package.json` tem um buraco medido do mesmo tipo. Ele casa
três globs:

| glob | arquivos que casa aqui |
|---|---:|
| `scripts/lib/*.test.mjs` | **1** (`visual-contract.test.mjs`) |
| `tests/visual/*.test.mjs` | **0** — o único candidato é um dos 8 ausentes acima |
| `.claude/…/scripts/test/*.test.mjs` | **16** |

Ficam **2 arquivos de teste versionados fora de qualquer glob** e que `npm test`
nunca executa: `.claude/…/scripts/tokenization-runner.test.mjs` e
`.claude/…/scripts/lib/artifact-contract.test.mjs`.

**Continua fora, e de propósito:** `.githooks/pre-commit` do alvo — a política de
commit de um repo específico. Os guards em si **entraram**: `tools/gates/`
tem hoje 13 arquivos, incluindo `ds-cohesion.py` e `ds-naming-law.py`, porque
`ds-naming-law.py` deixou de ser denylist e passou a ser o executor da lei que
este repo publica (`violations_grammar`, Linha 235). A frase anterior desta
seção — *"continua fora: `ds-cohesion.py` e `ds-naming-law.py`"* — **deixou de
valer em 2026-07-31**; fica registrada aqui porque decisão revertida sem registro
volta a ser tomada.
