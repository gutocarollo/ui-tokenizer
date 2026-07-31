# Manifesto do motor — todo arquivo envolvido, e por que mora onde mora

Esta skill **não é auto-contida como a `tokenize-design-system`**, e isso é uma
decisão, não um descuido. Este arquivo é o manifesto completo: **22 arquivos,
7.601 linhas**, nenhum escondido. Contagem conferida com
`wc -l` neste repositório.

> **Paths.** Neste repositório o motor mora em `scripts/`, `scripts/lib/`,
> `tests/visual/`, `tools/hooks/` e na raiz. No alvo onde ele foi medido
> (`makers-ai-hub`) esses mesmos arquivos moram sob `frontend/`. Versões
> anteriores deste manifesto listavam os paths com prefixo `frontend/` e o hook
> em `.harness/hooks/`; nenhum dos dois existe aqui.

## O critério

O mesmo já aplicado ao `classname-miner-v2.mjs` na skill irmã:

> **Copiar** para dentro da skill se o arquivo não tem dependência externa nem
> fiação no runtime do repo. **Referenciar** se ele precisa de `node_modules` ou
> está ligado a um mecanismo do projeto (descoberta de teste, script de
> `package.json`, hook, dados do app).

A `tokenize-design-system` pôde ser auto-contida porque seus oráculos são Node
puro sem fiação: leem arquivo, escrevem stdout. **Aqui 58% do motor falha nos dois
testes** — precisa de `@playwright/test`, de um app no ar, de sessão autenticada,
e está amarrado ao `testDir` do Playwright, ao `npm run evidence` e a um Stop
hook. Uma cópia parcial dentro da skill não ficaria portável — ficaria
divergindo, que é o defeito que a consolidação de 2026-07-29 eliminou nos
oráculos de token.

## Os 22 arquivos

### Acoplados ao runtime do repo — REFERENCIADOS (4.389 linhas, 58%)

| arquivo | linhas | papel | o que o prende ao repo |
|---|---:|---|---|
| `scripts/lib/visual-contract.mjs` | 1.531 | contrato dos artefatos: manifest, cobertura, métricas de pixel, política e **dispensa de bind** (`applyBindingWaivers`, `Linha 994`) | consome o layout de `.claude/evidence/` e o schema que o hook valida |
| `tests/visual/evidence.spec.ts` | 602 | **o motor de captura** — PNG full-page, erros de console/página/rede, Axe, meta por captura | é um teste Playwright, descoberto pelo `testDir` do config; falha fechada sem `UI_EVIDENCE_SELECTION_FILE`/`UI_EVIDENCE_OUTPUT_DIR` (`Linha 61`) |
| `tests/visual/visual-registry.mjs` | 585 | materializa contextos e cenários; emite o `fixtureRegistryFingerprint` **do registry** (`Linha 559`) | importa `network-fixtures.json` do projeto no topo do módulo |
| `tools/hooks/ui-evidence-gate.sh` | 409 | Stop hook: bloqueia fim de turno com UI alterada sem manifest posterior | hook do repo; ver a ressalva de fiação abaixo |
| `scripts/gen-visual-routes.mjs` | 242 | materializa rota `:param` com ID/slug **real**; escreve `contexts.json`, `scenarios.json`, `routes.json`, `routes.skipped.json` | consulta a API/seed do app; é domínio, não ferramenta |
| `scripts/lib/read-only-fixtures.mjs` | 228 | descobre fixtures somente-leitura no alvo | inspeciona dados locais do app |
| `scripts/ui-evidence.sh` | 207 | runner por estágios | é o `npm run evidence` do `package.json` (`Linha 9`) |
| `tests/visual/routes.json.example` | 190 | formato esperado de `routes.json` | dado deste projeto; o `routes.json` real é **gerado** e não está versionado |
| `tests/visual/network-fixtures.mjs` | 187 | valida o registro de fixtures de rede e emite `NETWORK_FIXTURE_REGISTRY_FINGERPRINT` | lê `./network-fixtures.json` no `import` (`Linha 7`) |
| `playwright.visual.config.ts` | 94 | projetos, viewports e as **flags de determinismo de render** (`Linha 39`–`Linha 51`) | precisa de `@playwright/test` |
| `tests/visual/_helpers/login.mjs` | 93 | sessão autenticada por cenário | fala com o endpoint de login do alvo |
| `tests/visual/theme-map.config.ts` | 21 | como aplicar cada tema (`seedLocalStorage`, `documentAttrs`) | dado deste projeto |

### Node puro, mas acoplados ao FORMATO do projeto — REFERENCIADOS (3.212 linhas, 42%)

| arquivo | linhas | papel | por que não viajam |
|---|---:|---|---|
| `scripts/lib/route-impact.mjs` | 900 | descoberta de rota + BFS de import reverso | parseia a forma do roteador do alvo |
| `scripts/lib/visual-contract.test.mjs` | 601 | teste do contrato | roda junto com o que testa |
| `scripts/lib/evidence-matrix.mjs` | 489 | seleção da matriz e **cálculo dos binds** (`buildEvidenceBindings`, `Linha 338`) | fingerprinta caminhos fixos do alvo (`src`, `tokens`, `index.html`, `yarn.lock`) |
| `scripts/verify-contract-source-delta.mjs` | 320 | prova AST que sustenta a dispensa de bind | lê `tests/visual/network-fixtures.json` do projeto (`Linha 217`) |
| `scripts/evidence-report.mjs` | 268 | pareia dois labels → relatório markdown, copia PNGs para `docs/reports/assets/` | escreve em `docs/reports/`, caminho deste repo |
| `scripts/lib/evidence-composer.mjs` | 188 | compõe manifests de execuções parciais numa matriz única | consome o formato de manifest acima |
| `scripts/affected-routes.mjs` | 150 | adaptador CLI de diff → rotas afetadas | depende do parser de rota acima |
| `scripts/prepare-evidence-run.mjs` | 125 | valida `runId`/`phase`/`batchId` e escreve `selection.json` + `manifest-config.json` | **o `ui-evidence.sh` o invoca por path** (`Linha 167`) |
| `scripts/compare-evidence.mjs` | 99 | comparação de pixel e de política | consome o manifest do formato acima |
| `scripts/evidence-manifest.mjs` | 72 | constrói o manifest exato | **o Stop hook e o runner o invocam por path** (`ui-evidence.sh` `Linha 198`) |

`route-impact.mjs` é o caso mais claro de por que "copiar" não daria
portabilidade: ele parseia `createBrowserRouter` com `path:` + `lazy: async () =>
import(...)`. Num projeto Next.js, ou com rotas em arquivo, o parser inteiro é
outro. O que é reutilizável ali é a **ideia** (BFS de import reverso), não o
código.

**Fora do escopo deste manifesto, de propósito:** `tests/visual/baseline.spec.ts`
e `tests/visual/overflow.spec.ts` (regressão versionada, não evidência de lote) e
`scripts/codemod-entities.mjs` / `scripts/reverse-entities.mjs` (mutação de
tokenização — pertencem à `tokenize-design-system`, e só aparecem aqui como
produtores dos lados `after`/`before` do par).

## Três fatos de fiação que o manifesto antigo errava

1. **O hook não está registrado.** `.claude/settings.json` registra apenas
   `marathon-stop-gate.sh` e `tools/hooks/clarification-gate.py`. O
   `ui-evidence-gate.sh` existe em `tools/hooks/` e **não** está no `settings.json`
   deste repo.
2. **E, mesmo registrado, ele ficaria inativo aqui.** O gate só se considera
   ligado se o `package.json` do app declarar um script chamado **`ui:evidence`**
   (`tools/hooks/ui-evidence-gate.sh` `Linha 144`–`Linha 163`); o `package.json`
   deste repo declara `evidence` (`Linha 9`). Nome diferente ⇒ `ENGINE_WIRED=0` ⇒
   `exit 0` com aviso em stderr — **fail-open silencioso**. Ver `pitfalls.md`
   no. 18.
3. **`dependencies: ['setup']` não existe.** O `playwright.visual.config.ts`
   atual não tem projeto `setup` nem `dependencies`; a autenticação é injetada
   por cenário pelo `evidence.spec.ts` (comentário em `Linha 61`, helper em
   `tests/visual/_helpers/login.mjs`). A constante `STORAGE` na `Linha 6` do
   config está declarada e não é usada por nenhum projeto.

## Este repositório é a FONTE do motor, não uma instância executável

Os entrypoints calculam a raiz assumindo que moram em `<repo>/frontend/scripts/`:
`prepare-evidence-run.mjs` `Linha 15`–`Linha 19` e
`verify-contract-source-delta.mjs` `Linha 53`–`Linha 57` fazem
`REPO_ROOT = resolve(FRONTEND_ROOT, "..")`. Aqui isso resolve para o **diretório
pai do repositório**, e `buildEvidenceBindings` passa a fingerprintar
`<repo>/src`, `<repo>/tokens` e `<repo>/index.html`, que não existem.

Além disso, quatro entradas obrigatórias do pipeline **não estão versionadas**:

| entrada | origem | estado aqui |
|---|---|---|
| `tests/visual/network-fixtures.json` | escrita à mão; lida no `import` de `network-fixtures.mjs` (`Linha 7`) | presente na worktree, **não rastreada pelo git** |
| `tests/visual/contexts.json` | gerada por `gen-visual-routes.mjs` | ausente |
| `tests/visual/scenarios.json` | gerada por `gen-visual-routes.mjs` | ausente |
| `tests/visual/evidence-matrix.json` | dado da matriz do projeto | ausente |

Sem elas o runner não passa da primeira etapa:

```
$ node scripts/prepare-evidence-run.mjs --run-id tokenize-probe --phase before \
    --batch-id B0001 --selection-out /tmp/sel.json --manifest-config-out /tmp/cfg.json
{"status":"fail","error":"Invalid JSON file: .../tests/visual/scenarios.json", ...}
exit=1
```

Isso não é um defeito a contornar: é o significado de "referenciado". O motor roda
**no alvo**, contra um app no ar, com os registros materializados por
`gen-visual-routes.mjs`. Este repositório guarda o código canônico e as medições.

## O que ISSO significa na prática

**Para levar esta skill a outro repo:** o protocolo do `visual-evidence.md` viaja
e continua correto — rota vem do diff, `Read` do PNG, review adversarial em
subagent, 5 loops de volta — porque é independente de stack. Os 22 arquivos
**não** viajam sozinhos: no repo novo, o equivalente tem que existir, ser
fiado ao `package.json`/hook e receber os JSONs de registro. O protocolo é o
contrato; este manifesto é a lista do que precisa existir para honrá-lo.

**As flags de determinismo viajam junto ou a esteira mente.** Sem elas o piso de
ruído é maior que zero e uma política `preserve` fica insatisfazível até por um
no-op. A medição está versionada no comentário de
`playwright.visual.config.ts` `Linha 27`–`Linha 38` e detalhada em
`visual-evidence.md` §4.1; a nota de execução em
`.claude/runs/tokenizer-cobertura/RUN.md` `Linha 279` não é versionada.

**Onde a auto-contenção real está:** na `tokenize-design-system`. Aquela roda
contra qualquer repo com `--root <raiz>`, porque decide **nome de token**, que é
um problema de texto. Esta decide **se o pixel ficou certo**, que exige o app
rodando — e app rodando não cabe dentro de uma skill.

## Verificação

Rode a partir da raiz que contém `scripts/` e `tests/visual/` (aqui, a raiz do
repo; no alvo, `frontend/` — ajuste `HOOK` conforme o repo).

```bash
HOOK=tools/hooks/ui-evidence-gate.sh   # no alvo pode ser .harness/hooks/...
total=0
for f in scripts/{ui-evidence.sh,prepare-evidence-run.mjs,affected-routes.mjs,evidence-report.mjs,evidence-manifest.mjs,compare-evidence.mjs,gen-visual-routes.mjs,verify-contract-source-delta.mjs} \
         scripts/lib/{visual-contract.mjs,visual-contract.test.mjs,evidence-matrix.mjs,evidence-composer.mjs,route-impact.mjs,read-only-fixtures.mjs} \
         tests/visual/{evidence.spec.ts,visual-registry.mjs,network-fixtures.mjs,theme-map.config.ts,routes.json.example} \
         tests/visual/_helpers/login.mjs playwright.visual.config.ts "$HOOK"; do
  if [ -e "$f" ]; then
    n=$(wc -l < "$f"); total=$((total + n)); printf "OK %6s %s\n" "$n" "$f"
  else
    printf "AUSENTE %s\n" "$f"
  fi
done
printf "TOTAL %d linhas\n" "$total"   # esperado: 7601 em 22 arquivos
```

Se algum sair `AUSENTE`, o protocolo do `visual-evidence.md` não é executável até
que ele exista — e isso é um bloqueio a declarar, não a contornar. O mesmo vale
para as flags de determinismo: confira que as nove estão em
`playwright.visual.config.ts` antes de aceitar qualquer lote `preserve`.

```bash
grep -c -- '--disable-gpu\|--disable-partial-raster\|--disable-skia-runtime-opts\|--disable-lcd-text\|--disable-font-subpixel-positioning\|--force-color-profile=srgb' playwright.visual.config.ts   # esperado: 6
```
