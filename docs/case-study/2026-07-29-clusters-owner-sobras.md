# Mapeamento dos usos sem owner — clusters, padrões de tom e o owner mais próximo

> ⛔ **ORDEM SUPERADA EM 2026-08-01.** Os nomes deste documento foram derivados
> com a gramática antiga (`entity.anatomy.property.variant`). A ordem canônica
> passou a ser **`entity[.variant][.anatomy][.property][.state]`** — a variante
> fica colada à entidade que ela qualifica (levantamento de 7 sistemas: nenhum
> com dono E propriedade no nome escreve a variante na cauda; ver §6 de
> `docs/law/GRAMMAR.md`). Leia os nomes daqui como MEDIÇÃO da época, nunca como
> alvo: `button.container.background-color.secondary` de então é hoje
> `button.secondary.container.background-color`.

Responde ao mandato: *"mapear para o owner mais próximo… analise individualmente…
vale a pena criar tokens para clusterizar… verifique se mesmo nesses genéricos, os
genéricos entre si trazem semelhanças nos tokens ou na forma de existir e também
nos tons e sobretons. Tente achar e identificar padrões."*

Ferramenta: [frontend/tokens/cluster-leftovers.mjs](../../.claude/skills/tokenize-design-system/scripts/cluster-leftovers.mjs).
Tudo abaixo é medição desta sessão, não estimativa.

---

## 1. O universo

```
usos cujo NOME não declara owner .................. 3.698
  já resolvidos por find-owner (contexto renderizado) 2.267   (61,3%)
  SOBRA a clusterizar ............................. 1.431   em 254 arquivos
```

Os 2.267 já viraram **198 tokens específicos** derivados
(`derive-tokens.mjs --dtcg`), cada um herdando o valor atual — migração
pixel-idêntica por construção.

## 2. Três eixos de clusterização, e por que dois deles erram

Medi os três. Não é preferência: cada um erra de um lado.

| eixo | clusters | o maior | erro medido |
|---|---:|---|---|
| token + sinal estrutural | 150 (11 com ≥3) | 41 arquivos | **sobre-divide** |
| token só | 105 (16 com ≥3) | **85 arquivos** | **achata** |
| **token + tag** (adotado) | — | ver §3 | acerta a anatomia |

**Sobre-divisão, com prova:** as 4 maiores famílias de `*Options`
(41 + 23 + 5 + 4 = 73 arquivos, 256 usos) são a **mesma entidade** — formulário de
credencial de provedor. O que as separava era acidente: umas têm botão "Show
advanced", outras não. `campo` vs `linha,campo` vs `linha,campo,botao` vs
`campo,botao`.

**Achatamento, com prova:** agrupar só pelo token joga `ChatBubble` no mesmo balde
que 84 `*Options`, porque os dois consomem `content-primary`. 85 arquivos, 281
usos, zero informação.

**Conclusão operacional:** sinal estrutural é discriminador **secundário**. O
primário é o par `(token, tag)`.

## 3. A ponte mecânica: a tag dá a anatomia

Dos 1.431 usos que sobraram, 184 pares `(tag, token)` distintos; os 30 maiores
cobrem **77,1%**. Agrupados por classe de tag:

| classe de tag | usos | % | o que já está decidido |
|---|---:|---:|---|
| **`<label>`** | **312** | 28,3% | owner **e** anatomia → **`field.label.color`** |
| tag de texto (`<p>` `<span>` `<h1>` `<h3>`) | 371 | 33,6% | anatomia = `label`; **falta o owner** |
| `<div>` | 362 | 32,8% | **nem anatomia nem owner** — leitura individual |
| componente de ícone (`<X>` `<AlertTriangle>` `<CheckCircle>`) | 58 | 5,3% | anatomia = `icon`; falta o owner |

Os 5 pares mais frequentes:

| par | usos |
|---|---:|
| `<label>` `text-content-primary` | 312 |
| `<p>` `text-content-primary` | 143 |
| `<div>` `text-content-primary` | 94 |
| `<span>` `text-content-primary` | 49 |
| `<div>` `bg-app-bg` | 42 |

### 3.1 Os 312 de `<label>` — decidido, com o código na mão

```
src/components/LLMSelection/OpenAiOptions/index.jsx:11
  <label className="text-content-primary text-sm font-semibold block mb-3">
src/components/EmbeddingSelection/VoyageAiOptions/index.jsx:9
  <label className="text-content-primary text-sm font-semibold block mb-3">
```

**50 componentes com assinatura idêntica** (`CohereOptions`, `GeminiOptions`,
`OpenAiOptions`, `VoyageAiOptions`, `LocalAiOptions`, `OllamaOptions`…). Um
`<label>` é sempre o rótulo de um campo → owner `field`, anatomia `label`.

**Um contrato com 50 instâncias, não 50 contratos.** Cluster legítimo: os 50 devem
mudar juntos porque *são* a mesma coisa.

---

## 4. Os padrões de TOM — e três deles são defeito de nome

Medido com **CIEDE2000** sobre os valores resolvidos do `color.tokens.json`. ΔE
< 2,3 = imperceptível; ΔE > 5 = claramente diferente.

| token | light | dark | L\* (light) | C\* (light) |
|---|---|---|---:|---:|
| `content.primary` | `#000000` | `#F7F7F7` | 0,0 | 0,0 |
| `content.secondary` | `#4A4A4A` | `#CBCBCB` | 31,5 | 0,0 |
| `content.tertiary` | `#5C5C5C` | `#949494` | 39,1 | 0,0 |
| `content.inverse` | `#000000` | `#FFFFFF` | 0,0 | 0,0 |
| `content.info` | `#215DDC` | `#60A5FA` | 43,2 | 75,7 |
| `content.success` | `#1C7444` | `#27C685` | 43,0 | 42,0 |
| `content.warning` | `#B05108` | `#FBBF24` | 45,8 | 64,0 |
| `content.danger` | `#C22929` | `#F87171` | 43,1 | 70,5 |
| `surface.hover` | `#EDECE8` | `#2E3238` | 93,4 | 2,1 |
| `surface.panel` | `#FCFCFB` | `#21252B` | 98,9 | 0,5 |
| `static.white` | `#FFFFFF` | `#FFFFFF` | 100,0 | 0,0 |
| `border.subtle` | `#DEDEDE` | `#424750` | 88,5 | 0,0 |
| `border.default` | `#BEBEBE` | `#606060` | 77,0 | 0,0 |
| `border.inverse` | `#BEBEBE` | `#FFFFFF` | 77,0 | 0,0 |

### PADRÃO 1 — `content.inverse` **é** `content.primary`. Nos dois temas.

| par | ΔE light | ΔE dark |
|---|---:|---:|
| `content.primary` × `content.inverse` | **0,00** | **1,60** |

Idênticos no claro; imperceptíveis no escuro. Um token chamado **`inverse`** que
promete "o oposto de primary" **é** primary.

É o mesmo defeito de `surface-selected`, que pintava borda: **o nome mente**. Não é
coincidência de valor — é contrato inexistente.

**Atinge, só nas sobras:** `<p> text-content-inverse` 31 · `<div>
text-content-inverse` 18 · `<div> border-content-inverse` 27 = **76 usos**.

E `border-content-inverse` acumula um segundo defeito: token de **content**
pintando **borda** (regra de decisão §2 — propriedade incompatível é owner errado,
não sinônimo).

### PADRÃO 2 — `border.default` ≡ `border.inverse`, mas só no claro

| par | ΔE light | ΔE dark |
|---|---:|---:|
| `border.default` × `border.inverse` | **0,00** | 45,65 |

Ambos `#BEBEBE` no claro. O contrato "inverse" **existe em um tema só**. É
exatamente o modo de falha mais difícil de enxergar: a tela em que você testa
continua certa.

### PADRÃO 3 — `static-white` como superfície quebra no ESCURO

| par | ΔE light | ΔE dark |
|---|---:|---:|
| `surface.panel` × `static.white` | **0,81** | 78,34 |

No claro são indistinguíveis; no escuro, `#FFFFFF` contra `#21252B`. Quem escreveu
`bg-static-white` viu a tela certa no claro.

**Atinge:** `<div> bg-static-white` 19 · `<div> border-static-white` 19 = **38
usos** → é `surface.panel` escrito com nome de pigmento, e erra no escuro.

### PADRÃO 4 — a rampa neutra é DESIGUAL, e a desigualdade INVERTE entre temas

| degrau | ΔE light | ΔE dark |
|---|---:|---:|
| `primary` → `secondary` | **31,5** | 15,5 |
| `secondary` → `tertiary` | **7,6** | 20,4 |

No claro o salto grande é primary→secondary e o pequeno é secondary→tertiary. **No
escuro a ordem se inverte.** Um componente que depende de "tertiary é visivelmente
mais fraco que secondary" funciona no escuro e quase desaparece no claro (ΔE 7,6).

Não é bug de nome — é bug de **valor**, e é a única coisa desta lista que exige
decisão de design, não renomeação.

### PADRÃO 5 — a família de status é ISOLUMINANTE, e está BEM construída

| token | L\* | C\* | matiz |
|---|---:|---:|---:|
| `content.info` | 43,2 | 75,7 | 292° |
| `content.success` | 43,0 | 42,0 | 153° |
| `content.warning` | 45,8 | 64,0 | 57° |
| `content.danger` | 43,1 | 70,5 | 33° |

**Amplitude de L\* entre os quatro: 2,8 pontos.** Mesma luminância, matizes
espalhados — distinguíveis por **cor**, com contraste consistente contra qualquer
fundo. Isso é deliberado e correto.

**Achado que corrige o viés da auditoria:** eu vinha tratando "genérico" como
sinônimo de "defeituoso". Errado. O eixo neutro/superfície é onde estão os
defeitos; **a família de status é o único subsistema íntegro do conjunto** e deve
ser preservada como família, não quebrada em N owners.

---

## 5. O mapeamento

### 5.1 Decidido mecanicamente — 312 usos (21,8% das sobras)

| de | para | usos | evidência |
|---|---|---:|---|
| `<label>` + `text-content-primary` | **`field.label.color`** | 312 | tag `<label>` + 50 comps de assinatura idêntica |

### 5.2 Anatomia decidida, owner pendente — 429 usos (30,0%)

| classe | anatomia | usos | falta |
|---|---|---:|---|
| tag de texto | `label` | 371 | o owner do container que a envolve |
| componente de ícone | `icon` | 58 | idem |

O owner sai da leitura do container. Não é chutável a partir da tag: um `<p>`
dentro de `modal`, de `card` e de `empty-state` são **três** contratos — o texto do
empty-state é intencionalmente mais fraco.

### 5.3 Renomeação direta por defeito de tom — 114 usos

| de | para | usos | por quê |
|---|---|---:|---|
| `text-content-inverse` | `<owner>.label.color` (o mesmo primitivo de primary) | 49 | PADRÃO 1 — `inverse` ≡ `primary` |
| `border-content-inverse` | `<owner>.border-color` | 27 | PADRÃO 1 + propriedade incompatível |
| `bg-static-white` | `<owner>.background-color` → `surface.panel` | 19 | PADRÃO 3 — erra no escuro |
| `border-static-white` | `<owner>.border-color` | 19 | idem |

### 5.4 Leitura individual — 362 usos (25,3%)

`<div>` não diz nem anatomia nem owner. São 133 famílias de diretório, **top 22 =
68,7%** — cauda longa, sem família dominante. Ninguém escapa de abrir o arquivo.

Maiores: `Admin/Agents` 166 · `Modals/ManageWorkspace` 158 ·
`WorkspaceChat/ChatContainer` 94 · `GeneralSettings/ModelRouters` 81.

> ⚠ `DesignSystem` (47) + `DesignSystem/parts` (21) = **68 usos são da galeria que
> eu criei nesta sessão**, não superfície de produto. Fora do denominador de
> migração.

---

## 6. Decisões que dependem de você

| D | decisão | por que não decido |
|---|---|---|
| D4 | `content.inverse` — deletar e apontar os 76 usos para o primitivo de `primary`, ou dar-lhe um valor de verdade invertido? | O nome promete um contrato que o valor não cumpre. Deletar é o que a medição sugere; criar o contrato é decisão de design |
| D5 | `border.inverse` — vale um contrato que só existe no escuro? | idem |
| D6 | Rampa neutra (PADRÃO 4): reequilibrar os degraus para ΔE comparável nos dois temas? | Muda pixel em 1.647 usos de `content-*`. É mudança visual deliberada, não migração |
| D7 | Os 371 `<p>`/`<span>` — um `<owner>.label.color` por owner (fiel a "um token por caso"), ou um `text.label.color` de fallback para os owners de instância única? | Custo/benefício de granularidade; a lei permite os dois |
