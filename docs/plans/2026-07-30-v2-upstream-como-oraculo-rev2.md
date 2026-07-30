# Plano v2 — rev 2

> Supersede a rev 1 (`2026-07-30-v2-upstream-como-oraculo.md`), que recebeu
> `PLAN-ADVERSARIAL-VERIFICATION: REPLANEJAR` com 7 gaps ALTA. A premissa central
> **reproduziu** — o replan é direcionado, não rediscovery.
> Rodada 1/2 do Planning Adversarial Loop concluída.

## 0. A correção que reorganiza o plano inteiro

A rev 1 afirmava que o canonicalizador entrega as 16 edições do v1 "de graça" com
a política conservadora. **Falso.** Medido:

```
mt-2 mb-2  com logicalToPhysical=false  →  ["mt-2","mb-2"]   INALTERADO
my-2  compila para  margin-block     ← LÓGICA
mx-2  compila para  margin-inline    ← LÓGICA
px-2  compila para  padding-inline   ← LÓGICA
```

**Todo colapso de par-de-eixo é físico→lógico no Tailwind 4.** Logo o ganho se
parte em dois níveis de risco, e não em um:

| nível | opção | o que colapsa | riskClass |
|---|---|---|---|
| **A** | `l2p: false` | 4 lados (`mt mr mb ml`→`m-1`, `border-t/r/b/l`→`border`), `gap-x+gap-y`→`gap`, `w+h`→`size`, `rounded-tl+tr`→`rounded-t`, **dedupe**, normalização de valor arbitrário | `none` |
| **B** | `l2p: true` | **todo par de eixo**: `my`, `mx`, `px`, `py`, `inset-x`, `inset-y`, `border-y` | `physical-to-logical` |

As 16 edições feitas à mão no v1 e as ~13 de `inset-x-0` estão **inteiras no
nível B**. Elas não fluem por `safe-auto-apply` — fluem pelo caminho de política.

**Origem do erro, declarada:** herdei o exemplo `mt-2 mb-2 → my-2` com
`l2p:false` do documento de referência (`gpt-ui-tokenizer.md` §Artefato) sem
verificar. A rev 1 declarava 7 divergências contra aquele doc e não pegou esta.
É o mesmo modo de falha que o plano combate — evidência adjacente aceita como
prova.

### 0.1 E a política não pode ser global

`margin-block` responde a **`writing-mode`**, não a `dir`/RTL. A rev 1 derivou
`l2p: true` medindo só `dir` — fato incompleto. Medido agora na cobaia:

```
app/(pages)/opportunities-hub/_components/OpportunitiesKanban.tsx:2039
app/(pages)/hiring-pipeline/_components/CandidatesKanban.tsx:195
    writingMode: 'vertical-rl',
```

**A cobaia usa `vertical-rl` em 2 arquivos.** Em `vertical-rl`, `margin-block`
mapeia para esquerda/direita, não topo/base. Então `mt+mb → my` é **incorreto**
nesses subárvores e correto no resto.

**Consequência de design:** `logicalToPhysical` deixa de ser booleano do repo e
vira **política por subárvore**, derivada de dois fatos medidos por escopo:

```
inlineAxisSafe = nenhum dir=/RTL no escopo        → habilita mx, px, inset-x
blockAxisSafe  = nenhum writing-mode no escopo    → habilita my, py, inset-y
```

Um arquivo com `vertical-rl` tem `blockAxisSafe: false` e recusa colapso de eixo
bloco, mantendo o de eixo inline. A rev 1 teria aplicado colapso errado em 2
componentes de Kanban.

## 1. Ambiente (corrigido)

| artefato | estado |
|---|---|
`ui-tokenizer-v2` branch `v2` | **10 imports pendurados corrigidos** — ver §1.1 |
`fixtures/makershub-main` | `949ba9ae`, tag `fixture-baseline`, **congelada** |
`fixtures/makershub-pr193` | `4afa7899`, tag `fixture-baseline`, **congelada** |

Toolchain da cobaia, lida do lockfile: `tailwindcss@4.3.1` +
`@tailwindcss/node@4.3.0`, gerenciador **npm** (`package-lock.json`).

**`canonicalizeCandidates` existe na versão pinada da cobaia** — verificado pela
review rodando contra `4.3.0/4.3.1` com os mesmos 7 probes. A rev 1 dizia "ou a
um upgrade de distância": **nenhuma mutação da cobaia é necessária.** Isso mata a
justificativa que faria o F1 tocar num fixture congelado.

### 1.1 Defeito corrigido no repo publicado

`ui-tokenizer@1dcaf16` shipou **10 imports relativos pendurados** em 4 arquivos:
`affected-routes.mjs` e `gen-visual-routes.mjs` importavam
`./lib/route-impact.mjs`, `./lib/read-only-fixtures.mjs` e
`../tests/visual/visual-registry.mjs`; `evidence.spec.ts` importava
`../../scripts/lib/evidence-matrix.mjs`, `./network-fixtures.mjs`,
`./theme-map.config`; `auth.setup.ts` importava `./_helpers/login`.

Causa: minha allowlist copiou scripts-folha sem as dependências.

Correção aplicada: **espelhar o layout do fonte** (`scripts/` + `scripts/lib/` +
`tests/visual/` + `playwright.visual.config.ts` na raiz) em vez de reescrever os
imports. Assim as cópias seguem **byte-idênticas** ao fonte — verificado com
`cmp` em 3 amostras — e resolvem sem edição. Zero pendurado após a correção.

## 2. Grafo (2 correções de fiação)

### 2.1 A prova de equivalência passa a rodar DEPOIS do roteamento

Na rev 1, `PR` (prova de fingerprint) rodava antes de `R` (roteamento por risco).
Efeito: o caminho `subset-overlap → cascade-projection → IA2 → AUTO` — o código
**mais novo e mais arriscado**, o único que é nosso — **nunca passava pela prova
de equivalência compilada**. O gate `B2` só checa existência de classe.
Contradizia o critério de aceite 6 do próprio plano.

Corrigido: `R` roteia, cada caminho produz sua proposta, e **`PR` é o gate único
por onde toda proposta passa** antes de `AUTO`, venha do upstream ou do nosso
cascade-projection.

### 2.2 `IA1` deixa de ser IA

"A política cobre este caso?" é **pertinência a conjunto** — função
determinística sobre `(riskClass, inlineAxisSafe, blockAxisSafe, escopo)`. A rev 1
punha um modelo decidindo isso e depois **auto-aplicava** a edição de risco.

Corrigido: nó `D` de lookup, com escalada a `HUMANO` quando a política não cobre
o caso. Mudar política é decisão do dono, não julgamento de modelo.

### 2.3 Contagem honesta

A rev 1 dizia "17 D, 4 IA, 1 humano". Recontado no diagrama: **24 nós `D`** e
**5 de IA** (IA1–IA4 + o adversarial, que também é modelo). Com as correções
acima: **26 `D`, 3 IA, 2 HUMANO**. Os 3 pontos de IA que sobrevivem:

| nó | por que só IA resolve |
|---|---|
`IA-legibilidade` | escolher entre formas **já provadas equivalentes** no caso subset — estética, não fato |
`IA-naming` | propor nome pela lei quando a nota fica < 70; generativo por natureza |
`IA-pixel` | **e a rev 1 não justificava.** Para reescrita equivalence-preserving o diff esperado é zero e `V2` já prova isso. O que `IA-pixel` decide e `V2` não: se a página renderizou o **estado certo** — um fallback vazio pode ser pixel-idêntico a um baseline que também estava errado. Sem essa justificativa o nó seria IA carimbando o que o script provou |

## 3. Benchmark redesenhado (gap 2)

A rev 1 usava o diff do PR-193 como gabarito de **recall de colapso**. Medido no
próprio PR-193:

```
- gap-2                  + gap-related
- gap-3                  + gap-group
- text-xs font-semibold  + text-label-strong
- rounded-full           + rounded-pill
- rounded-xl             + rounded-surface
```

**Zero operações de colapso na amostra.** PR-193 é gabarito de **tokenização
semântica**, não de canonicalização. Medir recall de colapso contra ele é
**incomensurável** — o overlap tende a zero e a conclusão é lixo. E o inverso
também enviesa: se o denominador for "o que o v2 acha", o benchmark se autovalida.

**Desenho corrigido:**

1. **Denominador = união de 3 fontes independentes**, cada proposta validada por
   `candidatesToCss` antes/depois (prova agnóstica de motor):
   - v1 (grupo-colapso próprio)
   - v2 (upstream `canonicalizeCandidates`)
   - mudanças de `className` do diff do PR-193 **onde o conjunto de classes
     mudou** (não formatação)

   `recall(fonte)` = fração da união **validada** que a fonte acha.
   `precisão(fonte)` = fração das propostas da fonte que passa a prova.

2. **PR-193 vira métrica própria de concordância humana**, estratificada por tipo
   (token semântico × colapso × valor) — nunca gabarito de recall.

3. **Métricas de desempenho FINAL**, que é o que foi pedido: % de ocorrências
   tokenizadas, distribuição da nota de naming (corte 70), resíduo de hardcode,
   regressões visuais, tempo de parede.

4. **Justiça garantida por asserção:** o v1 degrada fail-closed para
   `compiler-unavailable` (tudo opaco) se não resolver `@tailwindcss/node` do
   alvo. Sem `npm ci` na cobaia, o benchmark compararia v2 são contra v1
   lobotomizado. O harness **asserta `normalizer.available === true` para os dois
   motores** antes de medir; senão aborta.

**Número retratado:** a rev 1 dizia "19 ocorrências de `inset-x-0`". A review
achou **13** pares `left-0 right-0` adjacentes. O 19 fica **NÃO-PROVADO** até o
censo contar pares não-adjacentes e `top-0 bottom-0` separadamente.

## 4. Fases (corrigidas)

### F0 — Spike de runabilidade (NOVO, bloqueia F8)

A prova visual pressupõe o makershub **rodando**. A cobaia tem `backend/` Python
e `docker-compose`. Se ela não renderiza sem backend semeado, o contrato visual
desmorona na última fase.

`npm ci` + `next build` + render de **1 rota**. Se falhar, o escopo visual do v2
sobre esta cobaia é declarado bloqueado **antes** de qualquer outra fase.

### F1 — Preflight, sem mutar fixture (corrigido)

- **`npm ci`**, não `yarn install`. As cobaias são npm-locked; yarn ignoraria o
  lock, criaria `yarn.lock` e resolveria `^4.3.1`→`4.3.3` — mutação de fixture
  congelada **e** drift de versão. `npm ci` é determinístico e não toca o lock.
- **Pinar no repo v2, não nas cobaias.** O `ui-tokenizer-v2` **não tem
  `package.json`** — criar um é pré-requisito, e é lá que `tailwindcss` e
  `@tailwindcss/node` são declarados como deps diretas e pinadas.
- **Capability matrix roda contra a versão pinada da cobaia** (`4.3.0/4.3.1`),
  não contra `4.3.3`.
- Medir por escopo: `inlineAxisSafe` (`dir`/RTL) **e** `blockAxisSafe`
  (`writing-mode`).

### F2 — Capability matrix (eixos novos)

Além das 21 famílias, a matriz precisa dos eixos que a review descobriu — todos
são **reescritas silenciosas fora de colapso**:

| eixo | comportamento medido |
|---|---|
important legado | `!mt-1 !mb-1` → `mt-1! mb-1!` **mesmo sem colapso** |
variant arbitrário | `[&>*]:mt-1` → `*:mt-1` **mesmo sem colapso** |
`rem` standalone | `mt-[7px]` → `mt-1.75` **mesmo sem colapso** |
variant não-agrupável | `md:hover:mt-1` + `hover:md:mb-1` → inalterado (limite de recall) |
classe desconhecida | `foo-bar mt-1 mb-1` → `foo-bar my-1` — **não torna o grupo opaco** |
`@utility` custom | passa intacta, não bloqueia colapso vizinho |
composição `twMerge` | override posterior/anterior sobre a forma canônica |

`mt-[7px]` → `mt-1.75` merece atenção: o **gabarito humano vai na direção
oposta** (`gap-2` → `gap-related`, semântico). O plano precisa declarar a ordem
de composição: **canonicalizar primeiro, tokenizar depois** — canonicalização
reduz o espaço de formas, tokenização substitui a forma canônica pelo nome
semântico. Inverter faria a canonicalização desfazer a tokenização.

### F3 — Benchmark (§3)

### F4 — Upstream como propositor, com fingerprint ANTES do nó C

O nó `C` (canonicalizar) **dedupa e reordena** a lista. Logo o
`canonicalMultisetFingerprint` — que existe para distinguir `p-2 p-2` de `p-2` —
tem de ser computado **antes** de `C`, não depois. E o dry-run `CM2` ("diff só
nos alvos") precisa **tolerar reordenação**, senão todo colapso parece tocar
linha fora do alvo.

A rev 1 atribuía essa armadilha só ao sorter do prettier (F7). Ela acontece um
estágio antes, no próprio oráculo.

### F5 — Conflito e a lacuna nossa · F6 — Codemod `ts-morph` · F7 — Prevenção

Inalterados da rev 1, com uma correção: a justificativa contra Lightning CSS
("exige Rust/Parcel") é **falsa** — o npm distribui binário pré-compilado. A
decisão "medir antes de escolher" continua, com a justificativa certa: é uma
dependência nativa a mais, contra `postcss-merge-longhand` que é JS puro. A
escolha sai da medição.

### F8 — ORQUESTRADOR (NOVO — era o pedido central e faltava)

A rev 1 desenhou o grafo e **nenhuma fase o implementava**. O pedido verbatim é
"libs orquestradas em grafos com loops de verificação com IA in the loop".

Esta fase constrói o runtime: quem invoca cada nó, com que skill/prompt nos nós
de IA, como o loop retorna de `V2` para `CM`, e onde vive o estado.

Base: `tokenization-runner.mjs` (783 linhas, journal append-only, escrita
atômica, recuperação) + `phase-executors.mjs` do v1. **Mas** os executores
referenciam `scripts/affected-routes.mjs` **do alvo** — que não existe na cobaia
(`frontend/scripts/` tem só `audit-spacing.ts`). Portanto o executor precisa
resolver o script do **repo v2**, não do alvo. Correção de contrato, não de
prosa.

### F9 — Prova visual (era F8)

Depende de F0. Precisa do resolvedor app router e do eixo `writing-mode` na
matriz — este último agora **obrigatório**, não opcional: a cobaia tem
`vertical-rl` em produção.

## 5. Critérios de conclusão (alterados)

Os 10 da rev 1, mais:

11. Toda proposta passa pela prova de fingerprint compilado — **inclusive** a do
    nosso cascade-projection.
12. `logicalToPhysical` é resolvido por escopo, com `inlineAxisSafe` e
    `blockAxisSafe` medidos separadamente.
13. Nenhum fixture congelado é mutado; `npm ci` apenas.
14. O benchmark publica recall e precisão contra a **união validada**, e
    concordância humana com o PR-193 como métrica separada.
15. O orquestrador roda o grafo de ponta a ponta com os loops fechando, e o
    estado sobrevive a interrupção.

## 6. O que a review confirmou como correto

Reproduzido por ela, independente: as 11 linhas da tabela de canonicalização nas
duas versões, incluindo `p-4 px-2` não colapsar em nenhum modo; `space-*` e
`divide-*` não colapsam (relacionais, sem shorthand); `border border-b-0` e
`border border-b-2` preservados como receita intencional; variants não cruzam
(`mt-1 hover:mb-1` inalterado); `!` respeitado; negativo ok; `className` main =
**12.744** e pr193 = **12.900** exatos.

E um achado que baixa a novidade do plano, aceito: o v1 **já** carrega o design
system do alvo, **já** chama `canonicalizeCandidates` per-candidate com
feature-detect fail-closed, e **já** integra `twMerge`. O que ele não faz é a
chamada **em grupo** com `{collapse, logicalToPhysical, rem}`. "O fato que muda
tudo" é, com precisão, **uma opção de chamada que o v1 ainda não passa** — e a
métrica "linhas nossas eliminadas" fica enviesada se tratar as 1.050 linhas como
regex artesanal: a maior parte é fingerprint, proveniência, opaque-handling e
parse fail-closed, que o §7 diz manter.
