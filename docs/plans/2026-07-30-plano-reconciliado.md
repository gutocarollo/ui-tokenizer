# Plano reconciliado — o projeto real

> **Por que este documento existe.** O plano vigente
> (`2026-07-30-v2-upstream-como-oraculo-rev2.md`) descreve *"o compilador do
> Tailwind como oráculo de equivalência de utility"*, fases F0–F9. O código
> construído desde então é um *pipeline de naming de token de cor*. Medido:
> **0 hits** no plano para `cluster de contexto`, `convergência`, `lei de
> naming`, `ΔE`, `fila humana`. Documento e código descreviam projetos
> diferentes, e eu reportava execução contra o que tinha na cabeça.
>
> A causa é rastreável: o dono redirecionou o escopo cinco vezes e eu nunca
> reescrevi o plano — falha do §14.5 (*"padrão decidido na execução é
> incorporado ao doc de planejamento"*). Este documento fecha isso.

Status: **vigente**. Supersede o rev2 como plano-mestre; o rev2 permanece válido
como **especificação do eixo B** (§3.2).

---

## 1. O objetivo, e o critério que reprova o estado atual

Tokenizar o design system de um frontend artesanal: **cada decisão visual com um
contrato nomeado**, provada no pixel.

O contrato do pedido ancorado é explícito sobre o que **não** conta:

> *Full success means the actual frontend satisfies the absolute completion
> predicates; **a green ratchet or a completed control plane alone is
> insufficient.***

Control plane completo é exatamente o que existe hoje. Por esse critério,
**estamos reprovados** — e o plano abaixo existe para sair disso.

---

## 2. O universo medido

Alvo: `/home/augusto/code/makers-ai-hub/frontend`. Todos os números são de
medição desta sessão, não estimativa.

### 2.1 Vetores de estilo — todos, não só `className`

| vetor | volume | observação |
|---|---:|---|
| `className` | **6.370** atributos (+269 dinâmicos) → **32.662 usos de classe** | 98,9% da superfície |
| `style={{ }}` inline | **158 atributos → 322 declarações** | **224 cravadas** (alvo) · 95 dinâmicas (`calc()`, ternário → exceção) · 3 já com `var(--token)` |
| `src/index.css` à mão | **1.695 linhas** | 333 `var(--token)` · **11 cores cravadas** (9 hex + 2 `white`, L661/L688) · **172 px** |
| `chat/themes/github*.css` | 252 linhas | **36 cores** — paleta de realce do GitHub, **exceção** de terceiro |
| `public/embed/*.min.css` | minificado | **43 cores** — build de terceiro, **fora de escopo** |
| CSS gerado de token | 1.348 linhas | saída, não entrada |
| `styled-components`·`cva`·`tailwind-variants`·`sx`·CSS modules | **0** | não usados. `clsx` existe mas é **transitivo**, não declarado |

**`className` domina, mas volume não é o critério.** Um `style={{ color:'#fff' }}`
não é 1/32.662 do problema — é um ponto que **contorna o sistema inteiro** e não
aparece em gate nenhum. Normalizar os outros vetores muda pouco o percentual e
fecha vazamento.

### 2.2 Onde estamos

| | |
|---:|---|
| já passa por contrato nomeado | **5.847** (17,9%) |
| utility cru | **26.810** (82,1%) |
| **o loop trata hoje** | **504** (**1,5%**) |

Top utilities crus: `flex` 2286 · `text-sm` 1440 · `w-full` 1310 · `flex-col`
1086 · `items-center` 1017 · `rounded-lg` 855 · `block` 770 · `border-none` 635.

### 2.3 O teto — MEMORIAL HISTÓRICO, regra revogada

> **Esta seção descreve o critério da versão 1, que o §2.4 revogou.** Fica como
> registro do que mudou e por quê. **Um executor deve seguir o §2.4, não esta
> seção.** O critério de entidade aqui conta só repetição; o vigente exige
> repetição **e** tamanho. Os percentuais abaixo (68,9% / 81,4% / 18,6%) estão
> **superados**.


Dois caminhos de cobertura, que **somam**:

**A) Entidade canônica** — bundle de classes que se repete vira componente
nomeado; aí *todas* as suas classes, inclusive `flex` e `w-full`, passam a viver
dentro de um contrato.

| bundle repete | entidades | cobre |
|---|---:|---:|
| ≥ 2× | 739 | **22.507 usos · 68,9%** |
| ≥ 5× | 250 | 16.276 · 49,8% |
| ≥ 20× | 41 | 9.108 · 27,9% |

**B) Token em bundle único** — sobram 10.155 usos (31,1%) em bundles que
aparecem uma vez. Destes, **4.091 (12,5%)** são família tokenizável (cor,
spacing, radius, tipografia).

```
A 68,9%  +  B 12,5%  =  TETO 81,4%
```

**[REVOGADO — virou fila de exceção no §2.4]** ~~O que fica de fora, por design: 6.064 usos (18,6%)~~ — `flex`, `absolute`,
`w-full`, `z-10` em bundles que aparecem **uma única vez**. Tokenizar `flex` é
anti-padrão (composição, não decisão de design) e sem repetição não há evidência
de padrão. Forçar esses 18,6% para bater 90% seria **inventar contrato onde não
há padrão** — o defeito oposto ao que corrigimos.

### 2.4 Contrato de metas — ancorado nos predicados, não num percentual meu

> **Corrigido na rodada 1 do Planning Adversarial Loop.** A versão anterior fixava
> *"meta bloqueante 68,9%"*. Três defeitos, todos confirmados por medição:
>
> 1. **Media o que o contrato diz que não conta.** O pedido arquivado fecha com
>    *"completion means the entire frontend design-system scope is tokenized,
>    **not merely repeated class strings**"* — e 68,9% era exatamente a porção
>    "repeated class strings".
> 2. **O portão ficava antes do `APPLY`.** Cobertura medida em F-D é cobertura de
>    contratos **definidos**, não aplicados — literalmente o *"completed control
>    plane alone is insufficient"* que o §1 jura corrigir.
> 3. **A banda 2× é majoritariamente ruído.** Sem ela: 58,6%. Dentro dela,
>    99 entidades de ≤3 classes (`flex items-start gap-3`, `cursor-pointer h-fit`)
>    são coocorrência incidental, não entidade de design.

**O critério bloqueante é o predicado, não o percentual:**

> **100% das ocorrências de design em disposição terminal** — migrada **ou**
> exceção aprovada, e toda exceção carrega `owner`, `reason`, `scope`, `evidence`,
> `review policy` (§14 de `reference/end-to-end-workflow.md`).

Sob esse critério, os **24,5%** de utility de composição não são "fora de escopo"
por decreto: são **fila de exceções**, cada uma com as cinco chaves. É o que os
torna auditáveis em vez de convenientes.

#### O que passa a ser bloqueante, e o que é alvo

| | escopo | natureza |
|---|---|---:|
| **BLOQUEANTE** | disposição terminal de **100%** das ocorrências | predicado |
| **BLOQUEANTE** | eixo B2 — famílias tokenizáveis (cor·spacing·radius·tipografia) fora de entidade **e ainda CRUAS**: **17,3%** | decisão de design incontestável |
| **já feito** | eixo B1 — as mesmas famílias, mas a classe já cita token nomeado: **7,0%** | nada a fazer |
| **alvo** | entidade canônica sob critério defensável: **51,6%** | ver abaixo |
| **fila de exceção** | utility de composição sem padrão | 5 chaves obrigatórias por item |

#### O critério de entidade muda: repetição **e** tamanho

Repetição sozinha não separa entidade de coincidência. Medido dentro da banda 2×:

| bundles de 2× com | entidades | cobre |
|---|---:|---:|
| ≤3 classes — `flex items-start gap-3`, `cursor-pointer h-fit` | 99 | 1,4% ← **ruído** |
| 4–6 classes | 139 | 3,9% |
| ≥7 classes — componentes reais | 77 | 4,9% |

**Critério adotado: repete ≥2× E tem ≥4 classes → 435 entidades, 51,6%.**
Os bundles curtos de baixa repetição vão para a fila de exceção, não para o
denominador.

> Eram 430 / 51,4% quando este parágrafo foi escrito. O que mudou não foi o
> critério: foi o censo passar a resolver `className={NOME}` para o `const` de
> contrato (F-D), o que trouxe 164 usos que antes eram invisíveis. O critério
> continua o mesmo e o número sai do mesmo script.

#### A distribuição medida, pelo script versionado

> **ERRATUM 2026-07-31 — os números deste bloco são HISTÓRICOS.** O
> `lib/bundle-census.mjs` mudou **depois** que esta saída foi colada: a extração
> de classe passou do regex (que dava `split` no texto cru e fabricava `?`, `:`,
> `}` como classe) para `lib/classname-extract.mjs`, que extrai os literais de
> string da expressão. Medido por `audit-extraction-delta.mjs`: **936 usos de
> ruído** saíram e **609 usos de classe legítima** (as duas pontas do ternário)
> entraram, com **zero** classe legítima perdida entre os 163 tokens
> descartados. Saída atual do mesmo comando: **32.114** de denominador,
> **447** entidades · **53,5%**, **B2 5.677 · 17,7%**, **C 6.968 · 21,7%**,
> **migrável A+B2 = 22.860 · 71,2%**.
>
> **Não reescrevi os números abaixo**: mover a linha de base do documento-mestre
> é decisão do dono — o mesmo motivo pelo qual a F-D se recusou a corrigir o
> denominador no meio da própria fase. A comparação balde a balde, a causa
> medida e a fila de decisão estão em
> `docs/reports/rodada-grafo.md` **do repo-alvo**, §1.

> **Por que não é link.** Um link relativo daqui para dentro do `makers-ai-hub`
> assume que os dois repos são irmãos no disco de quem lê — e quebra para
> qualquer clone. É a mesma classe de acoplamento cross-repo que produziu o fork
> da skill: caminho relativo entre repositórios é dependência não declarada.
> Relatório de rodada vive no alvo que ele mede; este plano cita, não linka.

`scripts/measure-coverage.mjs` produz **todos** os números deste plano. Quem
discordar discorda de uma linha de código que pode apontar, e o número muda junto
com a regra — nunca em silêncio. Saída **de 2026-07-31 06:19** (ver erratum acima):

```
USOS DE CLASSE               32826   <- o denominador
  ja em contrato nomeado      5882   17,9%

  A PARTICAO (A + B + C = 32826, verificada)
  A. entidade (435 bundles)   16927   51,6%   -> contrato de componente
  B. tokenizavel fora          7978   24,3%
     B1. JA em contrato        2295    7,0%   -> NADA A FAZER, ja migrado
     B2. utility CRU           5683   17,3%   <- TRABALHO BLOQUEANTE
         sem slot em §4.3      3572   10,9%   (62,9% de B2)
  C. sem disposicao -> EXCECAO 7921   24,1%
```

| disposição | usos | |
|---|---:|---:|
| **migrável** — entidade (A) + tokenizável **cru** (B2) | 22.610 | **68,9%** |
| **já migrado** — tokenizável que já cita token (B1) | 2.295 | 7,0% |
| **fila de exceção** — 5 chaves por item | 7.921 | **24,1%** |

> **Corrigido na rodada 2.** A primeira versão do oráculo trazia `p` e `m` crus
> no regex de família tokenizável — `p(?:-|$)` casa `p-2.5` mas **não** casa
> `px- py- pt- pb- pl- pr- mt- mb- ml- mx- my-`. Onze das quinze variantes ficavam
> de fora, e como spacing é família **bloqueante**, **1.294 usos de trabalho
> obrigatório eram classificados como exceção aprovável** — falso-verde dentro do
> próprio oráculo que este plano usa como fonte da verdade.

> **Corrigido depois da F-E — o mesmo defeito na direção oposta.** Este bloco
> dizia *"migrável — entidade + tokenizável = 24.675, 75,5%"*, somando o balde B
> **inteiro** como trabalho a fazer. Medido: **2.295 de 7.978 (28,8%)** daquele
> balde são `placeholder:text-content-tertiary`,
> `enabled:hover:bg-surface-hover`, `text-theme-settings-input-placeholder` —
> classes que casam a família tokenizável **e** casam `EM_CONTRATO`. Pela
> taxonomia do §2.2 deste plano elas **não são utility cru**: já estão migradas.
> O `emContrato` era impresso como estatística solta e nunca subtraído de balde
> nenhum, então os três baldes eram apresentados como partição de 100% sem ser.
> Se lá trabalho obrigatório virava exceção aprovável, aqui trabalho **já feito**
> virava trabalho obrigatório. `migrável` passa a ser **A + B2 = 68,9%**, a
> partição virou quatro baldes com a soma **verificada** em
> `lib/bundle-census.mjs::partition`, e a regra está travada por
> `scripts/test/bundle-partition.test.mjs` (8/8).
>
> Reproduz o tamanho do erro sem confiar neste texto:
>
> ```bash
> cd /home/augusto/code/makers-ai-hub/frontend
> S=/home/augusto/code/ui-tokenizer-v2/.claude/skills/tokenize-design-system/scripts
> node "$S/measure-coverage.mjs" --root . --json \
>   | node -pe 'const j=JSON.parse(require("fs").readFileSync(0));
>       `B=${j.usosTokenizaveisForaDeEntidade} B1=${j.tokenizavelForaJaEmContrato} B2=${j.tokenizavelForaCru} migravel=${j.migravel}`'
> # B=7978 B1=2295 B2=5683 migravel=22610
> ```

> **Segundo eixo do erro, agora quantificado.** Dos 5.683 usos de B2, **3.572
> (62,9%)** pertencem a propriedades que §4.3 da lei **não sabe nomear** —
> `padding` 1.085, `border-radius` 585, `font-weight` 576, `margin` 536,
> `column-gap` 294, `gap` 230, `row-gap` 183, `line-height` 65,
> `letter-spacing` 18. Elas continuam sendo trabalho, mas trabalho **bloqueado
> por decisão do dono sobre a lei**, não trabalho executável hoje; ver
> [`../law/2026-07-31-achado-4-3-sem-slot-nao-pintura.md`](../law/2026-07-31-achado-4-3-sem-slot-nao-pintura.md).
> O oráculo imprime o veredito por propriedade e **falha fechada (exit 3)** se
> não conseguir ler §4.3, em vez de imprimir a quebra sem veredito.

O bloqueante é que a soma dê **100%** com toda exceção justificada, não que a
primeira linha atinja um percentual escolhido por mim.

#### O caminho para 100% — os 7 instrumentos (achado de 2026-07-31)

O dono perguntou onde estava o gargalo para 100%. A resposta veio de **olhar a
estatística do resto** em vez de aceitar o rótulo "sem padrão":

- **Zipf brutal**: 11 classes cobrem 50% do resíduo; ~192 cobrem 95%. Mediana
  de usos por classe = 1, desvio 59,7. Isso não é caos — é **vocabulário
  fechado pequeno** com cauda longa.
- `flex`/`items-center`/`w-full` não são violação: são o uso **canônico** de
  utility-first. Tokenizá-las é anti-padrão, mas rotulá-las de "exceção" era
  fraco. A disposição certa é um **contrato de vocabulário** — allowlist
  versionada, auditada em bloco, enforceável por lint com ratchet.
- Parte do resíduo **já era contrato**: `.tooltip`, `.input-label`,
  `.popover-ring` estão definidas no CSS próprio. O censo contava o contrato
  existente como violação.
- Bundles únicos frequentemente **contêm uma entidade inteira** como
  subconjunto (drift aditivo) → composição `cn(NUCLEO, extras)` os resgata.
- Arbitrary values (`h-[34px]`) são decisão de design cravada → token de
  dimensão, cauda curta.

**O gargalo era um instrumento faltante, não os dados.** Partição completa,
medida por `scripts/measure-disposition.mjs` (fail-closed — a soma tem que
bater o universo exato ou o script sai com erro):

```
universo (ruido de ternario removido): 31.726 usos

  1 entidade exata (435)          16.842   53,1%   const exportado
  2 entidade por composicao        1.297    4,1%   cn(NUCLEO, extras)
  3 tokenizavel por familia        7.063   22,3%   token cor/spacing/radius/tipo
  4 contrato custom EXISTENTE        181    0,6%   .tooltip, .input-label...
  5 arbitrary -> token dimensao      293    0,9%   h-[34px], w-[300px]...
  6 vocabulario layout (192)       5.749   18,1%   allowlist 1 doc, ratchet
  7 EXCECAO item-a-item              301    0,9%   listavel um a um
  ────────────────────────────────────────────────
  SOMA                            31.726  100,0%
```

Três notas de honestidade: (a) o universo caiu de 32.662 para 31.726 porque
**936 usos eram ruído do meu parser** — fragmentos de ternário (`?`, `:`, `}`)
contados como classe; correção pendente também no `bundle-census`; (b) o
estrato 6 ainda está **superestimado**: `duration-fast` (79×) e
`duration-surface` (66×) são utilities geradas de motion tokens via `@theme` —
já são consumo de token, e meu detector de contrato existente só vê seletores
`.classe`, não utilities geradas; refinamento = grep no CSS buildado; (c) os
instrumentos 4–6 **reconhecem e governam**, não migram — o trabalho de migração
real continua nos instrumentos 1–3.

#### Onde o portão é medido

**Depois** do codemod, **no frontend real** — nunca na definição do contrato.
Um contrato escrito e não aplicado conta **zero**.

> **>90% continua não sendo atingível** sob definição honesta, e agora nem é a
> métrica: a métrica é disposição terminal de 100%, com a distribuição entre
> migrado e exceção sendo o resultado, não a meta.

---

## 3. Os dois eixos

O projeto tem dois eixos que nunca foram integrados. Este é o defeito central que
o plano corrige.

### 3.1 Eixo A — naming por contexto (construído, não aplicado)

Decide **de quem é** cada decisão visual. `surface-hover` (336 usos) vira 11
contratos porque o contexto difere: `<button>` em `Directory` ≠ `<tr>` em
`FileRow`.

Implementado: censo → cluster de contexto → convergência → relatório → fila
humana. **Não implementado:** escrever o token, provar no CSS buildado, aplicar.

### 3.2 Eixo B — normalização de utility (especificado, não construído)

Decide **o que é a mesma coisa**. `gap-2 px-2 mb-3` ≡ `px-2 gap-2 mb-3`;
`pl-2 pr-2` ≡ `px-2`; `p-2 px-1` ≡ `py-2 px-1` por sobreposição de cascata.

Especificação normativa: **`2026-07-30-v2-upstream-como-oraculo-rev2.md`**, cujo
achado central se mantém — o colapso de cascata **já vem oficialmente** em
`@tailwindcss/node` via `canonicalizeCandidates`; a alegação de "lacuna do
ecossistema" foi retratada.

**Por que B vem antes de A na entidade canônica:** sem normalizar ordem e
equivalência, `flex items-center gap-2` e `items-center gap-2 flex` contam como
bundles **diferentes**, e a contagem de 739 entidades está subestimada. O critério vigente (§2.4) exige repetição **e** tamanho; sob ele são 430
entidades e 51,4%, e esse número é igualmente um **piso**.

---

## 4. O loop reconciliado

```
NORMALIZE → MINE → EXTRACT → CLUSTER → CONVERGE → REPORT → DECIDE → APPLY → EVIDENCE
   novo      novo    ✔         ✔          ✔         ✔        ✔      novo      novo
```

| fase | decide | entrega |
|---|---|---|
| `NORMALIZE` | determinístico | todo vetor de estilo na mesma forma; falha fechada em vetor desconhecido |
| `MINE` | determinístico | bundles repetidos → candidatos a entidade canônica |
| `EXTRACT`·`CLUSTER` | determinístico | ocorrências agrupadas por contexto, nome derivado |
| `CONVERGE` | determinístico | itera até ponto fixo |
| `REPORT` | determinístico | 3 capítulos: decidido / exposto / precisa do dono |
| `DECIDE` | **humano** | só acima do corte de incerteza |
| `APPLY` | determinístico | escreve token, `tokens:build`, **grep no CSS buildado**, codemod |
| `EVIDENCE` | modelo + humano | pixel antes/depois por estado, review adversarial |

### 4.0 O que o censo de F-B revelou: inline tem a MESMA estrutura do `className`

Eu tratava os `style={{}}` como 224 decisões espalhadas. Medido, eles são **55
bundles distintos**, e os **3 maiores cobrem 86 dos 156 atributos**:

| | bundle | disposição |
|---:|---|---|
| **49×** | `height: isMobile ? "100%" : "calc(…)"` | **dinâmico → exceção** |
| **29×** | `maxWidth:"250px" · whiteSpace:"normal" · wordWrap:"break-word"` | **entidade** — bloco de dica |
| **8×** | `maxHeight:"calc(100vh - 200px)"` | dinâmico → exceção |
| **4×** | `maxWidth:"350px" · …` | mesma entidade, variante de largura |
| **4×** | `minHeight:"150px" · overflowY:"scroll" · resize:"vertical"` | **entidade** — textarea |
| 40 bundles | 1× cada | cauda → exceção |

**Consequência para a fase:** a conversão não são 224 itens, são **2 entidades**
(~37 atributos) mais uma cauda de exceções declaradas. E o bundle mais frequente
de todos — 49 usos — é **dinâmico**, logo exceção legítima, não trabalho.

Isso confirma o critério do §2.4 num vetor independente: **repetição e tamanho**
separam entidade de coincidência aqui exatamente como no `className`.

### 4.1 `NORMALIZE` — duas fontes que se conferem

| vetor | forma canônica |
|---|---|
| `style={{ color, background, borderRadius, padding }}` | → `className` com token |
| `style={{ maxHeight: 'calc(...)' }}` | **fica** — layout dinâmico, exceção legítima declarada |
| hex/rgba em `index.css` | → `var(--token)`, casado por ΔE |
| px em `index.css` | → escala de spacing (oráculo do eixo B) |
| `className` | normalização de ordem/equivalência/sobreposição |

**Verificação cruzada, com direção definida.** Lemos `className` por regex e
**269 atributos `className={...}` dinâmicos** ficam parcialmente invisíveis.
`NORMALIZE` tem duas fontes: estática (AST) e renderizada (computed style via
Playwright).

A versão anterior dizia *"se a contagem divergir, o loop para"* — o que
**travaria sempre**: o censo estático inclui branches nunca renderizados
(condicionais, rotas de erro, estados de modal) e o DOM só vê o que foi visitado.
**Divergência é o estado normal, e por isso a regra não pode ser sobre magnitude
— tem que ser sobre direção:**

| direção | significado | ação |
|---|---|---|
| classe **no DOM** e ausente do censo estático | **vazamento real** — o scanner não enxerga o que o app renderiza | **PARA** |
| classe **no censo** e ausente do DOM | apenas não exercitada por aquele conjunto de rotas | registra, **não para** |

O conjunto de rotas e estados é **o mesmo declarado em F-H** (`EVIDENCE`) — não um
conjunto próprio, senão as duas fases medem universos diferentes e nenhuma das
duas prova nada.

### 4.2 `MINE` — e o bug que ela existe para impedir

O miner existe desde sempre e **nunca esteve no loop**. Rodado agora:

```
--ext padrão (ts,tsx)  →  12 arquivos,  123 ocorrências   "sucesso"
--ext js,jsx,ts,tsx    →  606 arquivos, 6.013 ocorrências
```

O alvo tem 456 `.jsx` + 132 `.js` e **3** `.tsx`. Com o padrão ele varreu **2% do
app e reportou sucesso**. Requisitos da fase:

1. `--ext` **derivado do alvo**, nunca default;
2. **guard de cobertura**: varrer < 80% dos arquivos elegíveis = **erro**, não aviso;
3. saída alimenta `CLUSTER` como candidato a entidade.

---

## 5. Fases de execução

| # | fase | entrega | prova |
|---|---|---|---|
| **F-A** | validar libs (LEI ZERO) | **✔ concluída — §5.1** | 3 subagents, código clonado e executado |
| **F-A2** | LEI ZERO do **veículo de entidade** | **✔ concluída — §5.3** | miner rodado contra 10 fixtures |
| **F-B** | `NORMALIZE` | **224** decl. inline cravadas + **11** cores + 172 px | `measure-vectors.mjs` — medidor próprio, classifica app/tema/vendor |
| **F-B2** | HTML semântico (spec nº 3 do dono) | `<div onClick>` → `<button>`, landmarks | os 59 clusters sem owner recontados — §7.1 |
| **F-C** | `MINE` no loop | **✔ concluída** — ext derivada + guard | regressão 3/3, 722/723 arquivos |
| **F-D0** | **validar os pesos** | conjunto rotulado, amostra e limiar | ver §5.2 — **bloqueia F-F** |
| **F-D** | entidade canônica, **estagiada por banda** | ≥20× (41 ent.) → ≥5× (249) → ≥2×∧≥4cls (430) | cobertura por lote, medida pós-codemod |
| **F-E** | ampliar oráculo | radius·spacing·tipografia além de cor | famílias novas no `PREFIX_PROPERTY` |
| **F-F** | `APPLY` | tokens escritos + `tokens:build` | **grep no CSS BUILDADO** |
| **F-G** | codemod | call sites migrados via `ts-morph` | build + typecheck verdes |
| **F-H** | `EVIDENCE` | pixel antes/depois **por estado e por viewport** | PNG + manifest + review adversarial |
| **F-I** | **disposição terminal** | toda ocorrência migrada ou exceção com as 5 chaves | `evaluate-absolute-completion.mjs` |

**O portão de cobertura fica em F-I, não em F-D.** Contrato definido e não
aplicado conta zero.

**Sequencial, uma por vez, verificada antes de seguir** (LEI ZERO §6).

### 5.2 F-D0 — validar os pesos, com amostra e limiar

Os pesos `cor 40 · contrato 25 · componente 15 · owner 10 · função 10` são meus,
nunca foram medidos, e sustentam **211 fusões**. A versão anterior deste plano
prometia *"validar antes de `APPLY`"* sem fase, sem amostra e sem gatilho — que é
intenção, não mitigação.

| | |
|---|---|
| **amostra** | 40 pares estratificados: 10 de confiança ≥85, 10 de 70–85, 10 na faixa de corte 60–70, 10 da fila humana |
| **rótulo** | o dono responde apenas *"mesmo contrato?"* sim/não, sem ver a nota |
| **limiar de aceite** | concordância ≥ 85% (34/40) **E piso de 7/10 na faixa 60–70** |
| **regra da fila humana** | o par conta como acerto **só se o rótulo do dono confirmar que a dúvida era real** (ele responde "não é o mesmo contrato", ou responde "é" e marca como difícil). Se ele responder "é o mesmo contrato" sem hesitar, o processo **errou ao não fundir** e isso conta como falha |
| **se reprovar** | as 211 fusões são invalidadas, os pesos são reajustados por regressão sobre os 40 rótulos, e a convergência roda de novo. **Não** se aplica nada com pesos reprovados |
| **bloqueia** | F-F (`APPLY`) |

> **Duas armadilhas de calibração, apontadas pela rodada 2.** A regra original
> dizia *"o par da fila humana conta como acerto se o processo não fundiu"* — e
> **todo** par da fila humana é, por definição, um par que o processo não fundiu.
> Eram **10 acertos automáticos**, e a barra efetiva caía de 34/40 para 24/30.
> Pior: sem piso por estrato, `10 + 10 + 7 + 7 = 34` **passa com 30% de erro na
> faixa 60–70**, que é exatamente onde o erro mora — a faixa de corte. As duas
> linhas acima corrigem isso.

O custo para o dono é 40 respostas binárias. É o menor preço para não aplicar 211
decisões sustentadas por números que inventei.

### 5.1 F-A concluída — as três candidatas caíram, e uma delas por sorte

Protocolo LEI ZERO rodado: três subagents clonaram, **leram o código** e
**executaram** contra o alvo real.

#### `SCSS-To-Tailwind-Codemod` — **NÃO-SERVE**

O fork da Swisscom é **byte-idêntico** a `shiyangzhaoa/css-modules-to-tailwind`
(`ahead_by 0, behind_by 0`).

| defeito | evidência |
|---|---|
| entrada é **JSX com import de CSS module**, não CSS | `src/get-tailwind-map.ts` L25-30 + `src/utils/validate.ts` L13 |
| nosso alvo tem **zero** `.module.css` | `find src -name "*.module.*css"` → vazio |
| tabela é snapshot fixo de **Tailwind v3.4** raspado por Puppeteer | `scripts/update.ts` L37-42; alvo é **v4.3.3** |
| em v4 `shadow-sm`·`rounded-sm`·`blur-sm` **foram renomeadas e a escala deslocou** | emitiria sombra diferente da original, **em silêncio** |
| `background: var(--card)` → `bg-[left_var_top_--card]` | CSS **corrompido** |
| `color: var(--brand, #ff0000)` → `text-[rgb(255,0,0)]` | **token descartado**, sobra o fallback |
| **apaga `--custom-prop` declaradas** | `lodash.kebabCase` remove os `--` em `cjs/index.cjs` L24, o filtro em `tailwind-class.ts` L184-185 não casa, e a decl é removida em L246-248 |

O último item sozinho decide: o alvo tem **187 `--custom-prop` declaradas** — seria
destruição de dados garantida. E o objetivo sairia invertido: nossas 28 cores
cravadas virariam `bg-[#cdcdcd40]` (arbitrary value), não token. Hardcode
continua hardcode, agora dentro do JSX onde é mais difícil auditar.

#### `extract-design-system` — **NÃO-SERVE**

| defeito | evidência |
|---|---|
| extração é **URL-only** (headless via `dembrandt`) | `src/cli.ts` L18, `src/commands/extract.ts` L45 |
| o `audit` lê disco mas é **regex linha-a-linha, sem AST** | `src/scanners/pattern-scanner.ts` L62 |
| **zero conhecimento de `className`/Tailwind** | 0 utilities entre **6.408** `className` em 433 arquivos |
| **86,9% dos findings** são os arquivos que **definem** os tokens | 1.263 de 1.454 |
| cor casada por **euclidiana em RGB**, não perceptual | `src/matchers/color-matcher.ts` L42-46 |
| falso positivo real capturado | `#ffeef0` (rosa, sat 100%) → `#f7f7f7` (cinza, sat 0%), distância 13,9 < 15 |
| **token usado nunca é contado** | `pattern-scanner.ts` L27 descarta a linha inteira se contiver `var(--` |

Saída não é DTCG. Não faz atribuição de owner.

#### Similaridade de string — **MANTER a nossa**, e eu estava errado

Eu havia me acusado de reinventar roda com os bigramas de Dice. **A medição
refuta.** Poder discriminativo, `min(parecidos) − max(diferentes)`:

| impl | gap |
|---|---:|
| **esta função** | **+0,783** |
| `dice-coefficient` | +0,750 |
| `string-similarity` | +0,750 — **DEPRECATED no npm, repo arquivado** |
| `fastest-levenshtein` | +0,292 — separa **2,7× pior** |

`fastest-levenshtein` cai por **correção**, não velocidade: dá **0,333** para
`("Directory","FileRow")`, dois componentes sem relação — distância de edição mede
*typo*, não parentesco de nome. E `dice-coefficient` retorna **`NaN`** para
`("","")`, que é exatamente o caminho `?? ""` do chamador; o `NaN` entraria no
`reduce` da nota e zerava a confiança do par em silêncio.

**Mas o subagent achou um bug meu que eu não conhecia:** a implementação usava
`Set`, colapsando bigrama repetido e inflando nomes com repetição —
`("TabTabTab","Tab")` dava **0,800** em vez de 0,400. Corrigido para multiset
(`Map` de contagem, 3 linhas, zero dependência), com o guard de string vazia que
a lib não tem. Regressão **8/8**; no loop completo os 41 contratos e as 211 fusões
se mantêm, com 2 pares migrando de "confiança" para "outlier".

#### Conclusão da F-A

**Nenhuma das três entra.** As duas primeiras não fazem o que o README sugere, e
descobrir isso exigiu clonar, ler e executar — o README de ambas passaria numa
leitura superficial. O caminho para o CSS é um **script postcss próprio (~150
linhas)** que lê `src/styles/generated/*-tokens.css`, monta o mapa valor→token e
**reporta antes de aplicar**, com a tabela sob nosso controle.

> Isso **não** invalida a LEI ZERO — a valida. O protocolo não é "adotar a
> primeira lib que aparece", é **provar** que não há nada reaproveitável antes de
> escrever. Aqui a prova foi feita com path+linha e execução, não com opinião.

### 5.3 F-A2 — o veículo da entidade, decidido por experimento

A pergunta era: qual o padrão maduro para *"contrato nomeado sobre um bundle de
classes Tailwind"*? Em vez de opinar, o subagent rodou **o nosso próprio miner**
contra 10 fixtures, uma por candidata.

| fixture | o miner vê? |
|---|---|
| `className="..."` cru | ✅ 1 ocorrência |
| **const exportado, importado cross-file** | ✅ **2** — `identifier:INPUT_BASE`, `tokens:11`, `surfaceRole:input` |
| `cva` forma string (shadcn) | ❌ **invisível** |
| `cva` forma array (a que a doc oficial promove) | ❌ **invisível** |
| `tailwind-variants` | ❌ **invisível** |
| `@apply` | ❌ **invisível** |
| componente React | ⚠️ só a definição; **call sites perdidos** |

Causa no nosso código: `classname-miner-v2.mjs` tem dois entry points (L1026 e
L1035) e o segundo aceita só `StringLiteral`/`NoSubstitutionTemplateLiteral` via
`literalValue()`. `cva(...)` é `CallExpression` → `undefined` → as classes somem
do censo.

**E consertar o scanner não resolve.** Com o patch aplicado, `tailwind-variants`
passa a ser visto, mas `cva` na **forma array continua invisível** porque
`isClassLike()` exige `tokens.length > 1` por string e `cva(["border-none",...])`
são strings de 1 token. Mesmo patchado, o censo colapsa de **453 → 1** ocorrência
e o `surfaceRole` degrada de `input` para `structural`.

> Este era o risco que eu levantei — *"solução que esconde as classes num objeto
> JS pode ser pior que o problema"* — e ele é **pior do que eu supus**: a
> invisibilidade é silenciosa e **depende do estilo de escrita**.

**Decisão: `const` exportado + `tailwind-merge`.** Descartadas:

| | motivo |
|---|---|
| `cva` | invisível mesmo com patch, na forma que a própria doc promove; `latest` **0.7.1 de 2024-11-26** em modo manutenção, 1.0 preso em beta sob outro nome de pacote |
| `tailwind-variants` | mais vivo (3.3.0) e declara TW v4, mas invisível sem patch, colapsa o censo 453→1, arrasta 1MB de peer |
| `@apply` | **desrecomendado pelos mantenedores** e removido da seção "Managing duplication" da doc v4; tira as classes do JSX e zera a auditabilidade |
| componente React | é o que a doc oficial recomenda e o único que **força** o contrato, mas são 5 elementos distintos (`input` 198, `select` 104, `div` 48, `button` 15, `textarea` 4) e o diff não é reversível. **Fica como camada 2**, consumindo o `const` |

**LEI ZERO satisfeita sem invenção:** o padrão **já existe no repo** —
`src/pages/Admin/AgentBuilder/VariableInput/index.jsx` Linha 33 tem
`const FIELD_TEXT = "block w-full p-2.5 text-sm"` (hoje **não exportado** — daí
"promover", não "criar").

**As dependências precisam ser declaradas, e não estão.** `tailwind-merge`
**não existe** no `node_modules` do alvo; `clsx@1.2.1` está presente mas é
**transitivo** — zero ocorrências nas `dependencies` do `package.json`. Importar
dependência transitiva em código de aplicação é dependência não declarada, e
quebra quando o hoisting mudar. F-D começa com `npm i clsx tailwind-merge`
explícito.

> Ressalva medida sobre o `tailwind-merge`: ele deduplica o caso real
> `w-full … w-full` e respeita override, mas **não funde**
> `focus:outline-primary-button` com `focus:outline-none`, porque é utility
> custom fora do grupo conhecido — exige `extendTailwindMerge`. E são 1,01 MB
> unpacked, o maior custo do pacote.

#### Três premissas minhas que caíram

1. **Não são 260 cópias idênticas.** O bundle exato aparece **8 vezes em 4
   arquivos**. A *família* tem **453 call sites / 80 strings distintas / 135
   arquivos**, e o membro dominante é outro (186 ocorrências). Concentração:
   top1 41%, top3 67%, top10 79%, com cauda de 70 strings. **O contrato certo é
   `base` + extras aditivos**, não uma string congelada — o que também derruba o
   argumento de variantes da `cva`/`tv`, porque o drift é aditivo pontual
   (`mt-2`, `pr-10`), não um eixo de variante limpo.
2. **Call sites sem anel de foco** — defeito de acessibilidade real que a
   tokenização expõe e corrige de graça. **O número não reproduz sem critério
   declarado**: medi 91, a rodada 2 mediu 169 com um critério mais frouxo. Fica
   como achado direcional até F-B fixar o critério num script. Os **33 com classe
   duplicada** no mesmo bundle reproduzem exatos.
3. **Landmine no `tailwind.config.js`:** `content.files` cobre
   `src/{components,pages}/**/*.{js,jsx}`, `src/{hooks,models,utils}/**/*.js`,
   `src/*.jsx` — **`src/styles/**` não é varrido**. Contrato posto ali tem as
   classes **purgadas do CSS**, quebra visual silenciosa em produção. Destino
   correto: `src/utils/` ou `src/components/`.

---

## 6. Riscos declarados

| risco | mitigação |
|---|---|
| **pesos 40/25/15/10/10 nunca validados** — se errados, as 211 fusões estão erradas | validar contra conjunto rotulado pelo dono antes de `APPLY` |
| corte de 30% escolhido por sensação | já mordeu (outlier absoluto engolia 1-contra-1); revalidar com o mesmo conjunto |
| `--ext` e defaults silenciosos | guard de cobertura em toda fase que varre |
| `className` dinâmico invisível ao regex | cruzamento com computed style |
| duas convenções vivas (`container`) | **decidido, ver §6.1** — critério medido, não contagem de `container` |
| classe desconhecida emite zero CSS sem erro | `APPLY` prova no artefato buildado, nunca na definição |
| **módulo de contrato fora do `content.files`** | `src/styles/**` **não é varrido** — classes purgadas em silêncio. Destino é `src/utils/`; F-F valida com grep no CSS buildado |
| veículo que esconde classes do scanner | medido: `cva`/`tv`/`@apply` colapsam o censo 453→1. Veículo é `const` exportado — §5.3 |

### 6.1 D2-B decidida — a anatomia sai por número de partes, não por nome

O critério não é *"quantos tokens usam `container`"* (22 de 52) — é **quantas
partes distintas o owner tem**. Medido no tier `component`, 23 owners:

| | owners |
|---|---|
| **11 multi-parte** — anatomia distingue, **mantém** | `button`(container·icon) · `card`(border·container·surface) ⚠[2026-07-31: `surface` NÃO é parte anatômica válida (§4.2 não a contém; palavra banida) — a coluna 'mantém' está superada neste item] · `checkbox`(6 partes) · `chat` · `code` · `list` · `menu` · `popover` · `progress` · `prompt` · `sidebar` |
| **12 parte única** — anatomia não distingue nada, **cai** | `app` · `avatar` · `badge` · `banner` · `chatarea` · `field` · `nav` · `pill` · `search` · `thread` · `toggle` · `toolbar` |

Regra: **anatomia só existe quando há mais de uma parte endereçável.** Assim
`field-container-background-color` vira `field-background-color`, mas
`button-container-*` e `button-icon-*` permanecem distintos porque o botão de
fato tem duas partes.

> **Retratação.** Eu havia afirmado *"5 owners multi-parte: button, code-block,
> menu, progress, list-row"* e listado `card` e `chat` como parte única. Ambos são
> multi-parte — `card` tem `border`·`container`·`surface`, `chat` tem
> `border`·`message-container`. E o número "32 dos 63" era 22 de 52. Os três
> vieram de contar `container` no nome em vez de contar partes.

---

## 7. O que este plano herda, e de onde

| origem | o quê |
|---|---|
| rev2 (F4–F7) | oráculo de equivalência, conflito, codemod `ts-morph`, prevenção |
| rev2 (F9) | prova visual |
| redireções do dono nesta sessão | contexto por token, iteração até ponto fixo, sinais ponderados, corte de incerteza |
| pergunta do dono sobre `rounded-lg` | entidade canônica (**maior alavanca: 51,4%**) |
| pergunta do dono sobre vetores | `NORMALIZE` como passo inicial |
| **spec nº 3 do pedido original** | HTML semântico — ver §7.1 |

As três últimas linhas **não existiam em plano nenhum** — vieram da conversa e
agora estão escritas.

### 7.1 A spec nº 3 do dono, que eu havia deixado cair

O pedido original numera três especificações. A nº 3 é **"enriquecer com HTML
semântico para ajudar a atribuição de owner"** — e o `docs/ESTADO.md` §1 a lista
como governante. A primeira versão deste plano não a mencionava em fase alguma,
nem como exclusão justificada. Um plano que existe para reconciliar
documento × realidade não pode derrubar uma spec numerada em silêncio.

**Ela não é decorativa — é o insumo do eixo A.** `find-owner` deriva o owner da
tag nativa e do `role`; um app com `<div>` genérico onde deveria haver `<nav>`,
`<button>`, `<article>` degrada a atribuição, e é exatamente de onde vêm os **59
clusters sem owner (87 ocorrências)** hoje na fila de IA.

Entra como **F-B2**, dentro do `NORMALIZE`, com escopo contido e critério de
parada explícito:

| | |
|---|---|
| **escopo** | apenas os elementos que hoje falham a atribuição de owner — não uma varredura de acessibilidade do app |
| **entrada** | os 59 clusters sem owner do relatório da rodada |
| **regra** | `<div onClick>` → `<button>`; landmark implícito → `<nav>`/`<header>`/`<aside>`; nada de trocar tag por gosto |
| **prova** | os 59 clusters recontados após a mudança; queda no número é o resultado esperado |
| **limite** | mudança de tag altera semântica e foco de teclado. Toda troca passa por F-H (pixel **e** navegação por teclado) |
