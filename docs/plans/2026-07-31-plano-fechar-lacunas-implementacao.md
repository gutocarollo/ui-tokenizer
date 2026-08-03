# Plano — fechar as lacunas de IMPLEMENTAÇÃO do ui-tokenizer v2

> Evento: 2026-07-31. Fonte: lista de lacunas do dono (8 itens) verificada item a
> item contra o repo em `b7a0405`, mais as lacunas que a lista não continha.
> Escopo: repo do processo (`ui-tokenizer-v2`). O repo de teste (`app-c`)
> só entra onde o processo o toca (sync da skill vendorizada, paths de steps).
> Status: AGUARDANDO avaliação do dono após 1 rodada adversarial.

> ⚠ **O TERRENO MUDOU EM 2026-08-01, depois que este plano foi escrito.** Três
> correções estruturais entraram na lei (variante colada à entidade; entidade
> global como cabeça legítima; banimento cobrindo enquadramento), a suíte com
> alvo passou de 278 para **287 testes**, e a Fase A4 fechou pela metade — ver a
> atualização na própria fase. O corpo abaixo permanece como foi revisado, para
> a avaliação não perseguir um alvo móvel; as divergências estão marcadas onde
> ocorrem.

## 0. Auditoria da lista do dono (pré-requisito §14.1)

| # | Claim | Veredicto | Evidência |
|---|-------|-----------|-----------|
| 1 | APPLY não implementado, bloqueia Fases 9–17 | **CONFIRMADO** | `scripts/tokenize.mjs:21` `[nao implementado]`, `:253` imprime "fase declarada, NAO implementada" |
| 2 | Runner durável construído e não ligado | **CONFIRMADO** | `grep -rn "phase-executors"` em `*.mjs`: zero importadores; `tokenize.mjs` não importa `tokenization-runner.mjs` |
| 3 | Camada artifact-contract não exercitável neste repo | **CONFIRMADO na essência** | Hoje: `node --test tokenization-runner.test.mjs lib/artifact-contract.test.mjs` → **28 tests, 1 pass, 27 fail**, todos `Target package.json not found: <repo>/frontend/package.json`. O fix de `b7a0405` adicionou `TOKENIZE_TEST_ROOT`, mas o fallback ainda crava `<repo>/frontend` e **não há fixture-alvo in-repo** — sem alvo externo, a camada segue inexercitável |
| 4 | clarification-gate.py sem teste + falso-negativo por acento | **CONFIRMADO** | `tools/hooks/clarification-gate.py:114` usa `re.IGNORECASE` sem normalização unicode; nenhum teste encontrado em `tools/` nem `scripts/test/` |
| 5 | validate-contract.mjs não fecha lei × PREFIX_PROPERTY | **CONFIRMADO — e PIOR que o claim** | zero refs a `PREFIX_PROPERTY` em `validate-contract.mjs`. Correção da rodada adversarial: o invariante hoje não roda em **lugar nenhum** — `lei-x-familias.test.mjs` importa `score-naming.mjs`, cujas Linhas 48-49 executam `resolveProjectLayout(resolveRoot())` no top-level do módulo e crasham fora de um alvo (`project-layout.mjs:36` "No source root found") |
| 6 | axisMappingSafe só em docs | **CONFIRMADO** | símbolo só em `docs/plans/2026-07-30-v2-upstream-como-oraculo-rev2.md`; `reference/clarification.md:146` já declara honestamente "não implementado" |
| 7 | SKILL.md omite ~12 scripts; README com 504→311→41 | **JÁ CORRIGIDO em `b7a0405`** | `measure-disposition`/`measure-coverage` citados 8×; README diz 480→293→40/192 (`README.md:43-44`); `docs/ESTADO.md:97` tem a retratação. Resíduo: `lib/*.mjs` (14 módulos internos) sem seção própria |
| 8 | Drift na cópia vendorizada do alvo | **CONFIRMADO** | `app-c/.claude/skills/tokenize-design-system/skill-sync.json` + guard `app-c/.harness/lib/skill-drift.py` existem; edits no canônico acusam drift até sync |

**Refinamento** (claim de sessão anterior, re-medido): "5 stale gate paths" no
`phase-executors.mjs` **NÃO confirmado** — os 13 `steps[].script` existem
(13/13 OK). O gap real é outro: **steps sem as flags obrigatórias** —
`bash scripts/ui-evidence.sh` sem o `<label>` posicional que o próprio script
exige (`ui-evidence.sh:5-9`) e sem `--run-id/--batch-id/--phase` que o contrato
de evidência exige para o bind; idem `compare-evidence.mjs`.

**Lacunas FORA da lista do dono** (a lista não é exaustiva):

- **A suíte canônica está vermelha HOJE além dos 27** — `npm test` na raiz:
  **166 tests, 132 pass, 31 fail, 3 skipped**. Os 31 = 27 (runner/artifact,
  item 3) + **4 não listados**: `lei-x-familias.test.mjs` e
  `utility-families.test.mjs` crasham no import (side effect de módulo do
  `score-naming.mjs:48-49`) e 2 asserts de `absolute-completion.test.mjs`
  falham por defeito ainda não diagnosticado. Retratação: o claim anterior
  desta sessão de "277 pass / 0 fail" era dependente de cwd/env
  (`TOKENIZE_TEST_ROOT` setado mascarava o crash) — o comando canônico é
  `npm test` na raiz, e ele reprova.
- **Waiver de binding não é end-to-end** — `lib/artifact-contract.mjs` não tem
  `applyBindingWaivers`/`waivedBindings` (grep: zero); um lote dispensado no
  comparador reprova no motor de invariantes.
- `inventory-usage.mjs:6` anuncia `[--json]` na usage e a flag nunca é lida.
- `divider` como owner: ambiguidade **já documentada** com ⚠ em
  `reference/anatomy-property.md:112-114` ("not yet legal") — é D[n] do dono,
  não bug silencioso.
- `b7a0405` local, não pushado; release `v2.0.0` pré-data as correções.
- Publicação: refs `cliente-x`/`app-a` em `docs/case-study/` alcançáveis
  pela tag — bloqueia release público (repo privado contém).
- No alvo (fora deste plano): lote 3 (focus ring dos 91 `<select>`), F-D0
  (40 pares, 0/120 respondidos — só o dono destrava).

## 1. Plano existente — o que reusar

`docs/plans/2026-07-30-v2-upstream-como-oraculo-rev2.md` já planeja F0–F9
(inclui F8 ORQUESTRADOR e o predicado `axisMappingSafe`);
`2026-07-30-plano-reconciliado.md` define o contrato de metas. Este plano não
refaz esse discovery: ele fecha a **fiação** que aqueles planos assumem
construída. Onde houver conflito, os planos de 2026-07-30 são a fonte da
intenção; este, da execução.

## 2. Fases (sequenciais, 1 por vez, teste antes de avançar — §11)

### Fase A — Control plane exercitável

- **A0. Diagnóstico dos 2 fails do avaliador absoluto — CONCLUÍDO 2026-07-31.**
  Causa-raiz única, provada com refutação: `buildFixture()` cria o app-alvo em
  `mkdtempSync(os.tmpdir(), ...)` (`absolute-completion.test.mjs:119`) e, desde
  `a2f357e` ("conserta a portabilidade"), `createArtifactValidator` resolve o
  Ajv **do alvo** (`artifact-contract.mjs:266`, `createRequire` subindo
  diretórios) — de `/tmp` não há `node_modules` acima → "Artifact validator is
  unavailable" em `contractViolations` → records invalidados → inventário
  "vacuous" → 8 predicados fail → exit 1 (o 2º teste morre na pré-condição
  `exitCode === 0`). Refutação executada: trocando SÓ o mkdtemp para dentro do
  repo, **7/7 pass**. Consequência: **os 29 fails da suíte têm UMA causa-raiz**
  (a mesma do item 3 da lista do dono) e A0 se funde em A1 — não há defeito no
  avaliador em si.
- **A1. Fixture-alvo mínimo in-repo** em `scripts/test/fixtures/target-app/`,
  com o conjunto COMPLETO que os consumidores exigem (medido na rodada
  adversarial): (a) `package.json` — `ajv/dist/2020` resolve subindo até o
  `node_modules` do repo (`ajv@8.20.0` já instalado), nada a instalar;
  (b) `tokenization.config.json` com `sourceRoots` (senão
  `project-layout.mjs:36` lança); (c) ≥1 arquivo-fonte elegível;
  (d) script `tokens:build` no-op — o step PREFLIGHTED o invoca.
  Fallback do `tokenization-runner.test.mjs` passa a apontar para a fixture.
  **+ (do A0):** `absolute-completion.test.mjs:119` troca `os.tmpdir()` por
  tempdir dentro do repo (ex.: `import.meta.dirname`), com cleanup no
  teardown — refutação já provou 7/7 com só essa mudança.
  Meta: os **29** fails viram pass **sem** env externa.
  - Alternativa rejeitada: `skip` condicional quando `TOKENIZE_TEST_ROOT`
    ausente — esconderia a camada inteira do CI do repo canônico (28 skips
    ≈ 0 cobertura). Fixture custa ~4 arquivos e dá cobertura permanente.
- **A2. Ligar o runner ao CLI** — `tokenize.mjs` ganha subcomando `run`
  (importa `tokenization-runner.mjs` + `phase-executors.mjs`): executa fases
  `deterministic` em sequência, PARA em `model`/`human` imprimindo o `blocker`.
  `APPLY` deixa de ser stub: vira o conjunto de fases 9–17 orquestrado pelo
  runner. O texto "fase declarada, NAO implementada" sai de `tokenize.mjs:253`.
  Trabalho escondido que a rodada adversarial mediu e este plano assume:
  - Os 5 steps de `CLASSIFIED` (`inventory-surface`, `inventory-usage`,
    `score-naming`, `find-owner`, `cluster-leftovers`) **não emitem artefato
    no formato do contrato** (zero `artifactType`), e `commandTransition`
    valida `REQUIRED_TRANSITION_ARTIFACTS.CLASSIFIED =
    ["inventory-report","cluster-packet"]` (`artifact-contract.mjs:177`) —
    escrever os emissores/adaptadores é parte de A2, sequencial, 1 step por
    vez (contraste: `extract-design-occurrences.mjs:2061`,
    `lib/axis-discovery.mjs:606` e `normalize-occurrences.mjs:220` já emitem).
  - `PREFLIGHTED` emite `"token-build"`, que não está nos 19 `ARTIFACT_TYPES`
    — registrar o tipo ou corrigir o `emits`.
  Critério (corrigido — "parar no primeiro human" era vácuo, o run INICIA em
  `ANCHORED` que é `human`): `tokenize run --root <fixture>` atinge **DECIDED**
  com `INVENTORIED`/`NORMALIZED`/`CLASSIFIED` validados pelo
  `validateArtifactSet`, e o journal registra cada transição.
- **A3. Flags obrigatórias nos steps** — `phase-executors.mjs`:
  `ui-evidence.sh` recebe `<label>` + `--run-id/--batch-id/--phase`
  (interpolados do estado do run), `compare-evidence.mjs` idem;
  `inventory-usage.mjs` ou lê `--json` de verdade ou a usage para de anunciar.
  Critério: teste novo que valida CADA step contra a usage real do script
  invocado (mesma classe do `lei-x-familias`: registro × contrato).
> **ATUALIZAÇÃO 2026-08-01 — a metade cara da A4 já caiu, por necessidade do
> cookbook.** O `validate-cookbook.mjs` precisa só da LEI, não de um app-alvo, e
> ao escrevê-lo o efeito de módulo estourou na cara. `PROJECT` virou preguiçoso
> em `score-naming.mjs` (só `collectUses` e o CLI o resolvem). Medido, sem env de
> alvo: a suíte foi de **166 testes / 132 pass / 31 fail** para **287 / 255 / 29**,
> e os dois testes que crashavam no próprio import voltaram a rodar — 114/114.
> O invariante lei × família, que não rodava em lugar nenhum, agora roda.
>
> **O que RESTA da A4:** fechar o gate. `validate-contract.mjs` ainda tem zero
> referências a `PREFIX_PROPERTY`/`utility-families` (medido: `grep -c` = 0), ou
> seja, continua PASSando enquanto a lei e o motor divergem. A extração da função
> compartilhada para `lib/` e o import pelos dois lados é o que sobra — barato
> agora que o side effect saiu do caminho.

- **A4. Gate fecha lei × PREFIX_PROPERTY — e destrava o invariante** — a
  causa de o invariante não rodar em lugar nenhum é o side effect de módulo de
  `score-naming.mjs:48-49` (resolve o alvo no import). Fix: mover leitura da
  lei/vocabulário para função pura em `lib/` (fonte única); o teste, o
  `score-naming.mjs` E o `validate-contract.mjs` importam dela. Isso derruba
  também os 2 crashes de import (`lei-x-familias`, `utility-families`).
  Critério: mutação (renomear uma propriedade da §4.3) derruba o GATE, não só
  a suíte. **Ponto de parada declarado:** se, destravado, o invariante acusar
  divergência real entre §4.3 e `PREFIX_PROPERTY`, a resolução é vocabulário
  da lei — decisão do dono, não auto-corrigível.
- **A5. Waiver end-to-end** — a segunda checagem de fingerprint em
  `lib/artifact-contract.mjs` consulta os mesmos `WAIVABLE_BINDINGS` +
  prova do verificador que `visual-contract.mjs` já honra. Critério: teste
  com lote dispensado passando nos DOIS motores; sem waiver, reprova nos dois.
- **A6. clarification-gate.py** — normalizar via
  `unicodedata.normalize("NFD", …)` + strip de combining marks antes do match;
  teste com par mínimo ("Sigo criando…?" com e sem acento no padrão) + mutação.

### Fase B — Resíduos de doc/honestidade

- **B1.** SKILL.md ganha seção "bibliotecas internas (`lib/`)" — 1 linha por
  módulo (17 módulos não-teste; **12** hoje ausentes, contagem da rodada
  adversarial). Sem isso, a regra "o doc lista o que existe" fica com exceção
  não declarada.
- **B2.** `axisMappingSafe`: implementar o predicado determinístico (grep de
  `writing-mode` ≠ `horizontal-tb` no CSS buildado do escopo — é o que o plano
  rev2 §0.1 especifica) OU manter o "não implementado" declarado. Default
  proposto: implementar — é ~30 linhas sobre `tailwind-built-css.mjs` já
  existente e destrava o gate D do grafo. Reversível.

### Fase C — Sync e entrega

- **C1.** Sync da skill vendorizada no alvo (`skill-sync.json`) + rodar
  `skill-drift.py` até zero. Só DEPOIS das fases A/B, um sync único.
- **C2.** Push de `b7a0405` + fases A/B e release `v2.1.0` — **aguarda ordem
  do dono** (push/tag é ação externa; a autorização anterior cobriu `v2.0.0`
  em `cabf1df`, não este delta).

## 3. D[n] que o plano NÃO decide (dono)

- **D-a** `divider` vira owner legal em §4.1? (anatomy-property.md:112 ⚠)
- **D-b** rename `content-*`→vocabulário novo × paridade app-a
  (`tokens:parity` pinado em `4afa7899`) — A: renomear os dois; B: fork com
  exceções declaradas; C (feito): só consolidação segura.
- **D-c** propriedade no nome (`bg-page-background-color` estilo M3/Primer) ×
  omissão (`bg-page` estilo shadcn).
- **D-d** anonimização de `docs/case-study/` antes de qualquer release público.

## 4. Verificação de conclusão (por fase)

Cada fase fecha com: comando + exit code + contagem de testes na tabela do
`prova-de-conclusao`. O comando canônico é **`npm test` na raiz do repo**
(cobre os 4 globs do `package.json:8`, inclusive `scripts/lib/*.test.mjs` da
raiz) — nunca uma invocação parcial com cwd/env que mascare crash de import
(foi exatamente assim que o "277 pass / 0 fail" falso desta sessão nasceu).
Baseline de partida: 166 tests / 132 pass / 31 fail / 3 skipped. Meta ao fim
da Fase A: **0 fail**. Fases seguintes: nunca regredir. Guards:
`ds-naming-law.py` exit 0 nos dois repos, `ref_integrity.py`,
`docs_wiki_lint.py`.

## 5. Resultado do loop adversarial

Rodada única (cap definido pelo dono). Reviewer subagent devolveu
`REPLANEJAR` com 3 gaps críticos (G1 suíte vermelha além dos 27; G2 evidência
do item 5 errada + escopo de A4; G3 critério vácuo de A2 + emissores
faltantes) e 2 médios/baixos (G4 fixture subespecificada; G5 contagens/comando
de suíte) — **todos incorporados nesta revisão**. G6 do reviewer confirmou a
favor: C1 (sync) não destrutivo (`bc6dbb60` é ancestral, alvo não editou a
cópia), ordem A1→A2→A3 correta, A5 real, steps shell existem no alvo.
Sem re-verificação por segunda rodada — o dono avalia esta versão.

PLAN-ADVERSARIAL-LOOP: 1/1 rodadas, status: PENDENTE
REVISORES: [rodada 1: subagent novo (app-b-adversarial-reviewer, model fable)]
