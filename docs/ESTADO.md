# Estado da empreitada — 2026-07-30

Documento de situação. Separa **validado com evidência** de **assumido** e de
**pendente**. Toda linha marcada ✅ tem comando que a produziu; o que não tem, está
marcado como tal.

---

## 1. O objetivo

**Tokenizar o design system de um frontend artesanal.** Não normalizar classe, não
publicar biblioteca: fazer com que cada cor e cada espaçamento da interface tenha
um contrato nomeado, e provar no pixel que a migração não regrediu.

O pedido ancorado em `.harness/requests/CURRENT-TASK.md` do app de referência:

> EXECUTE TUDO QUE FALTA ATÉ TERMOS SUCESSO INTEGRALMENTE. RODE EM LOOP E CORRIJA
> SEMPRE QUE O VERIFICADOR ADVERSARIAL DO LOOP ANCORAR EM DADOS REAIS.

E o contrato daquele pedido é explícito sobre o que **não** conta como sucesso:

> Full success means the actual frontend satisfies the absolute completion
> predicates; **a green ratchet or a completed control plane alone is
> insufficient.**

Três especificações numeradas do pedido original, que governam:

1. **normalizar ORDEM** — `gap-2 px-2 mb-3` ≡ `px-2 gap-2 mb-3`
2. **normalizar EQUIVALÊNCIA e SOBREPOSIÇÃO** — `pl-2 pr-2` ≡ `px-2`; `p-2 px-1` ≡ `py-2 px-1`
3. **enriquecer com HTML semântico** para ajudar a atribuição de owner

Mais dois requisitos declarados depois: **libs determinísticas intercaladas com IA
em grafo com loops de verificação**, e **comparar v1 × v2** para decidir a migração
por medição.

---

## 2. Como estamos tentando alcançar

Duas trilhas, com autoridades diferentes — a distinção mais importante do desenho:

| trilha | pergunta | autoridade |
|---|---|---|
**canonicalização** | estas utilities produzem CSS equivalente? | canonicalizador oficial do Tailwind |
**ciência de cor** | qual é a cor, em qual espaço, tema, alpha, gamut? | resolver DTCG + lib de cor + navegador |
**tokenização semântica** | de quem é esta cor, que parte pinta, em que estado? | evidência estrutural + contexto renderizado + IA tipada + validadores |

A IA entra **só** onde nenhuma função prova, e sempre com a evidência do script na
mão. O grafo atual: **24 nós determinísticos, 4 de IA, 2 humanos**.

Três repositórios, com papéis distintos:

| repo | papel |
|---|---|
`ui-tokenizer` branch `v2` | onde o motor evolui. O `main` (`1dcaf16`) é o v1 congelado para comparação |
`makers-ai-hub` | app de referência, **onde o v1 já rodou**. Não é tocado pelo v2 |
`fixtures/makershub-{main,pr193}` | cobaias congeladas. `pr193` é a tentativa **humana** do mesmo trabalho, logo é gabarito |

---

## 3. Onde estamos

**Fase: loop único rodando end-to-end, `APPLY` não implementado.** O app de
referência **já está ~99% tokenizado** — a medição é 10.190 de 10.693 consumos
(95,3%) conformes, 9 hex cravados, 0 valores arbitrários. O trabalho que resta
não é tokenizar, é **renomear**: as 504 ocorrências que violam a lei de naming.

Uma corrida completa hoje, medida: 504 ocorrências → 311 clusters de contexto →
**41 contratos** em 4 iterações, 211 fusões automáticas, **9 ocorrências (2,2%)**
para decisão humana. Nada aplicado no código.

**O v2 já é superior ao v1?** Num eixo, sim e medido (§4.4): recall de reescrita de
utility, 3,3×, superconjunto estrito. Em todos os outros eixos, **não sabemos** — o
benchmark F3 não rodou, e o repo v2 hoje é o v1 mais um plano e 2 correções de bug,
sem motor novo. E o ganho medido vem de **como o oráculo é chamado**, o que sugere
testar primeiro a correção da chamada no v1.

| artefato | estado |
|---|---|
`ui-tokenizer-v2` | branch `v2`, **6 commits**, 172 arquivos, árvore limpa, **não pushado** |
plano | rev 2, 467 linhas, 2 rodadas adversariais concluídas, status **PENDENTE** |
cobaia `main` | `949ba9ae`, `node_modules` instalado (1,6G), **não mutada** |
cobaia `pr193` | `4afa7899`, `node_modules` **ausente** |
maratona no app de referência | **6 de 12** itens do checklist |

---

## 4. O que está VALIDADO, com a evidência

### 4.1 O oráculo oficial existe e resolve a maior parte do problema 1

✅ `tailwindcss@4.3.3` expõe
`canonicalizeCandidates(candidates, {rem, collapse, logicalToPhysical})`.
Verificado lendo `dist/lib.d.mts` **e executando**.

✅ Funciona na versão **pinada da cobaia** (`4.3.1` / `@tailwindcss/node@4.3.0`),
resultado idêntico ao `4.3.3` em 8 casos. **Nenhum upgrade é necessário** — o que
elimina qualquer motivo de mutar fixture congelada.

✅ Ele produz **exatamente** as 16 edições que o v1 fez à mão, mais as de
`inset-x-0`, mais colapsos não cogitados (`w-4 h-4 → size-4`).

✅ **`p-4 px-2` (sobreposição subset) o upstream NÃO colapsa** em nenhum modo. Essa
é a única lacuna real, e continua sendo nossa.

### 4.2 A partição de risco, medida e não estimada

✅ Todo colapso de **par de eixo** é físico→lógico: `my-2`→`margin-block`,
`mx-2`→`margin-inline`, `px-2`→`padding-inline`. Logo `mt-2 mb-2` com
`logicalToPhysical:false` fica **inalterado**.

✅ O predicado de segurança é **`writing-mode`, não `dir`**. O oráculo só colapsa
pares de **valor igual**, e valor simétrico é invariante a direção; o que troca o
mapeamento de eixo é `writing-mode`, e ele troca **os dois eixos**.

✅ Colapso cujo resultado atribui o **mesmo valor aos 4 lados** é seguro
incondicionalmente (nível **B0**): `mx-N my-N → m-N`, `px-N py-N → p-N`.

✅ A cobaia `main` tem **1** uso de `writingMode: 'vertical-rl'`
(`OpportunitiesKanban.tsx:2039`), num `<span>` que envolve só texto — risco
composicional **vazio**. O `pr193` tem 2.

✅ O app de referência tem **zero** `writing-mode`, logo as 16 edições já aplicadas
lá estão seguras — **mas foram justificadas pelo fato errado** ("é LTR-only"). A
conclusão sobreviveu; a justificativa não.

### 4.3 O tamanho real da oportunidade na cobaia

✅ Medido em `app/` + `components/` da cobaia `main`, com o DS dela:

| | |
|---|---:|
`className` total | **12.152** |
estático avaliável | **11.075** (91,1%) |
dinâmico = **opaco declarado** | **1.077** (8,9%) |

| categoria | grupos | % do avaliável |
|---|---:|---:|
inalterado | 9.426 | 85,1% |
**colapso N→1** | **897** | 8,1% |
**alias deprecado** (`flex-shrink-0`→`shrink-0`) | **325** | 2,9% |
**reordenação somente** (conjunto igual) | **228** | 2,1% |
misto | 192 | 1,7% |
remoção redundante | 7 | 0,1% |
| **MUDAM** | **1.649** | **14,9% do avaliável · 13,6% do universo** |

✅ **O nível B — o debate que consumiu duas rodadas adversariais — vale 122
grupos**, 1,1% do total e 7% do ganho. A fatia grande (1.516) é incondicionalmente
segura.

✅ Duas categorias que **ninguém** desta empreitada tinha identificado: alias
deprecado (325) e reordenação-somente (228). A segunda reprovaria o gate de
dry-run "diff só nos alvos" se ele não tolerar reordenação.

### 4.4 Primeiro dado real de v1 × v2 — um eixo só

✅ Mesma cobaia, 11.075 grupos estáticos, mesmo design system, medido em
2026-07-30:

| | grupos que mudam | % |
|---|---:|---:|
**v1** — `canonicalizeCandidates([raw])`, 1 candidato, sem opções | **519** | 4,7% |
**v2** — grupo, `{collapse, logicalToPhysical, rem:16}` | **1.821** | 16,4% |
**v2** — grupo, sem `rem` | **1.649** | 14,9% |

Recall **3,5×** com `rem`, **3,2×** sem. Interseção: ambos **519**, **só v1 = 0** —
superconjunto estrito.

⚠ **Retratação:** reportei antes `v2 = 1.694`. Esse número **não reproduz** e não é
nenhum dos dois acima. Ele saiu de um laço único sem validação cruzada. Os valores
atuais foram obtidos por **três caminhos independentes que concordam**: pela API
nova (`compilerCanonicalGroup`), pela chamada direta no mesmo laço (0 divergências
de saída entre as duas), e por um script isolado que nem importa o normalizador.
Não sei explicar o 1.694, e não vou inventar causa — descartei as hipóteses de
design system divergente (0 divergências medidas), de ordem de chamada (oráculo
provado sem estado em 5 casos) e de contaminação por import (o isolado reproduz
1.821 exato).

✅ O conjunto do v2 é **superconjunto estrito**. Recall **3,3×**, zero regressão.
O que o v1 acha sozinho é alias-deprecado (`flex-shrink-0`→`shrink-0`), que
funciona por candidato; ele perde **todos** os colapsos, porque colapso exige ≥2
candidatos na mesma chamada (`lib/tailwind-normalizer.mjs` linhas 884 e 921 —
`canonicalizeCandidates([raw])`, sem argumento de opções).

⚠ **O que este número NÃO estabelece**, e é a parte que importa:

1. **Recall ≠ correção.** 122 dos 1.175 extras são `axis-mapping-sensitive`, e a
   cobaia **tem** um escopo `vertical-rl`. Parte precisa de gate, e o gate não
   está implementado.
2. **Mede a CHAMADA, não o processo.** Os dois números saem da mesma função
   oficial. A hipótese mais barata para capturar o ganho é **corrigir a chamada no
   v1** — uma mudança pequena — e medir de novo. Isso ainda não foi testado, e
   deveria vir antes de justificar motor novo.
3. **Não toca o objetivo.** Nenhum dos dois números move uma cor.
4. **Propriedades do v1 não verificadas no v2:** degradação fail-closed para
   `compiler-unavailable`, proveniência, fingerprint de multiset, opaque handling.

Nota de método: a diferença entre 1.694 aqui e 1.649 na §4.3 é o `rem: 16`, ausente
na medição anterior — 45 grupos de normalização de valor (classe `V`,
`value-anchor-change`, que a §0.2 do plano tira do nível seguro).

### 4.5 Correções aplicadas e verificadas

✅ **16 edições de espaçamento** no app de referência (7 pares simétricos + 9
formas divergentes), cada uma com contagem de ocorrência assertada. Divergência de
forma: **1 → 0** de 158 grupos de efeito.

✅ **2 defeitos reais** no mapa prefixo→propriedade (`outline` classificado como
`border-color`, afetando **601** usos; `stroke` dobrado em `fill`). Pós-correção:
**571 `outline-color`** no inventário, `stroke`(7)/`fill`(4) separados, **0
discordâncias** entre os dois scripts, 12/12 valores dentro do vocabulário fechado.

✅ **10 imports pendurados** no repo publicado, corrigidos espelhando o layout do
fonte — cópias seguem **byte-idênticas** (`cmp`), zero pendurado.

⚠️ **Ponte fase→executor** (`lib/phase-executors.mjs`): 17 fases, 10
determinísticas, 2 model, 3 human, **0 problemas** na auditoria contra o contrato
— mas a auditoria mediu a coisa errada. O mapa estava íntegro e **ninguém o
invocava**: `rg -l "phase-executors"` retornava só o próprio arquivo. O
`tokenization-runner.mjs` tinha 5 comandos (`init`, `transition`, `validate`,
`resume`, `status`) e nenhum executava nada — só rastreava estado.

Resolvido em 2026-07-30 por `scripts/tokenize.mjs`, o entrypoint único. Auditar
um registro contra seu contrato não prova que ele está ligado; a pergunta que
faltava era **quem chama**.

✅ **45/45 testes fail-closed** dos módulos de extração, normalização, eixos e
contrato visual, com `TOKENIZE_TEST_ROOT` no app de referência.

### 4.6 O que a pesquisa de biblioteca provou

✅ Inventário no monorepo: de ~60 candidatas, **6 já existem** —
`@playwright/test`, `pixelmatch`, `pngjs`, `sharp`, `ajv`, `typescript`. O lado
visual já se apoia em lib real; **normalização, cor e grafo de import tinham zero**.

✅ Downloads/semana verificados por mim: `tailwind-merge` 77,7M · `axe-core` 62,5M
· `cssnano`/`postcss-merge-longhand` 18,6M · `colorjs.io` **7,2M** · `culori` 1,6M
· `jscodeshift` 6,9M · `style-dictionary` **1,95M (v5.5.0, já publicado)** ·
`@terrazzo/cli` **51,7k**.

✅ `prettier-plugin-tailwindcss@0.8.1` expõe `createSorter()` em `/sorter`, com
`stylesheetPath` para v4. **Armadilha:** `sortClassLists` **dedupa por default** —
exige `preserveDuplicates: true` ou nosso fingerprint de multiset morre.

---

## 5. O que está ERRADO no que eu afirmei antes (retratações)

Registro porque erro escondido reaparece.

| afirmei | realidade | como descobri |
|---|---|---|
"colapso de cascata é lacuna do ecossistema" | resolvido **oficialmente**, na dependência que já tínhamos | documento externo apontou; verifiquei rodando |
"`mt-2 mb-2 → my-2` com política conservadora" | **impossível** — `my-2` é `margin-block`, lógica | review adversarial |
"política é `dir`/RTL" | é **`writing-mode`**, e gateia os dois eixos | review adversarial |
"5 erros no mapa do `score-naming`" | **0** — 3 deles eu li de doc desatualizado, não do código | review adversarial |
"ds-gate OK" | passa por **não ter baseline**; são 5 hex vivos | rodei os outros gates |
"19 ocorrências de `inset-x`" | **NÃO-PROVADO** (13 pares adjacentes achados) | review adversarial |
"opacos: 0" na medição | eram **invisíveis** ao regex, não classificados | pergunta do dono |
"7 de 12 no checklist" | **6 de 12** | contei agora |
"26 D, 3 IA" no grafo | **24 D, 4 IA, 2 H** | contei no próprio diagrama |
"Lightning CSS exige Rust" | **falso**, npm distribui binário | review adversarial |
"o design **não** está tokenizado" | está **~99%** — 10.190/10.693 conformes; o que falta é **renomear** | o dono insistiu; medi |
"ponte fase→executor validada, 0 problemas" | íntegra e **invocada por ninguém**; o runner não executava nada | o dono perguntou por que eu misturava as bolas |

Padrão dominante: **diagnosticar código lendo documentação**, e **aceitar exemplo
de terceiro sem verificar**. Os dois são a mesma falha — evidência adjacente
tratada como prova.

---

## 6. O que FALTA

### 6.1 Bloqueios de execução

| item | estado |
|---|---|
**F0 metade 2** — `next build` + render de 1 rota na cobaia | não testado. A cobaia tem `backend/` Python e `docker-compose`; é o maior risco de descobrir tarde |
`node_modules` da cobaia `pr193` | ausente (necessário para validar o "depois" da fonte 3 do benchmark) |
`frontend/package.json` no repo v2 | ausente — é por isso que a suíte de contrato falha lá (provado pré-existente com `git stash`) |
credencial de evidência visual | `UI_EVIDENCE_SESSION` / `UI_EVIDENCE_USER`+`PASS` ausentes. O motor **falha fechado** e recusa capturar |

### 6.2 Trabalho de plano, não re-revisado

O loop adversarial fechou em **2/2 rodadas com status PENDENTE**. As correções da
rodada 2 foram aplicadas e **não passaram por 3ª review** (excederia o limite).
Gaps aceitos como pendência: partição A/B completada mas não re-verificada por
terceiro; granularidade de escopo por subárvore JSX **especificada e não
implementada**.

### 6.3 A trilha que o plano ainda não tem

**Cor como P0.** O rev 2 tem 9 fases e **nenhuma** é de cor — naming aparece como
um nó no meio do pipeline de canonicalização. Mas tudo que está aberto é cor:

| pendência de cor | tamanho |
|---|---:|
`consumed-class` no app de referência | **503** |
tokens com veredito de naming | 139 (40 OK / 82 inadequado / 17 pendente) |
nomes abaixo do corte 70 | **78** |
usos sem owner | **1.431** |
hex cravado (`ds-gate`, report-only) | 5 |
tokens emitindo ZERO CSS (`/N` sem canal) | 5 |
eixos de `ds-variety` **piorados** | 2 (`radius-scales` 19→20, `shared-coverage` 141→140) |

Cinco incorporações decididas do segundo documento externo, **ainda não escritas no
plano**:

1. cor como trilha P0 com fases próprias
2. separação de autoridade em três problemas
3. **contrato tipado da decisão de IA** — enum `CREATE|REUSE|SPLIT|KEEP_LOCAL|INVALID_SOURCE|OPAQUE|REQUIRES_HUMAN`, com `evidenceIds`, `riskCodes`, `requiresHuman`. Hoje os nós de IA não têm contrato de saída nenhum
4. **validadores pós-IA com código de erro**, e a regra de que limite de tentativas nunca converte decisão inválida em aprovação
5. exceção de `duplicate-values` **por tier** — valor físico duplicado é permitido nos tiers semântico/componente quando os contratos diferem

### 6.4 Normalização estrutural além de padding/margin

Medido, com falso positivo conhecido no detector: **25 pares simétricos** e **72
sobreposições** restantes em `inset`, `gap`, `border-width`, `rounded`, `space`,
`divide`, `scroll-*`. O maior item é `left-0 right-0 → inset-x-0`.

### 6.5 Peças sem substituto que continuam nossas

`extract-design-occurrences` (19 scanners, proveniência, expansão de ramo) ·
`cascade-projection` do subcaso subset · lei de naming com nota determinística ·
axis discovery · impacto de rota (**e o resolvedor de app router não existe** — a
cobaia é Next) · contrato de evidência visual · prova de conclusão.

Três têm ausência **provada** por busca negativa: naming com gramática de slot (a
spec DTCG declara naming fora de escopo), decisão de qual semântico um `div` deve
virar (toda ferramenta é detection-only), e relatório markdown com
manifest+hash+matriz+console no mesmo artefato.

---

## 7. Risco declarado

- **Dependência crítica não declarada:** `@tailwindcss/node` é transitiva de
  `@tailwindcss/vite` no app de referência. Se o plugin trocar, o compilador
  desaparece e o normalizador degrada **em silêncio**. E a API se chama
  `__unstable__`.
- **72 commits não pushados** no app de referência, e o `origin` dele aponta para um
  repo **público** de terceiro (upstream do fork). Um push errado publicaria o
  rebrand.
- **v2 não pushado.** Os 6 commits só existem nesta máquina.
- **Token GitHub vazado** em transcripts locais, pendente de revogação pelo dono.

---

## 8. A próxima ação, uma só

**Rev 3 do plano, com cor como trilha P0 e as 5 incorporações da §6.3** — porque é
o único caminho que ataca o objetivo declarado. As 1.649 mudanças de utility na
cobaia são reais e baratas, mas nenhuma delas tokeniza uma cor.

Protocolo em vigor, por ordem do dono: **2 loops de verificação antes e 2 depois de
cada alteração**, para que a alteração se sustente em fato real e não em
alucinação. Este documento existe porque o protocolo já pagou: ele impediu a
substituição de 1.050 linhas por uma "correção" que teria zerado todo uso de
`ring`, `shadow`, `caret` e `accent`.
