# Como funciona, em português

Este documento existe porque os números do relatório — *"504 ocorrências → 311
clusters → 41 contratos, 211 fusões, 9 para o humano"* — não se explicam
sozinhos. Cada termo é definido aqui com um caso real do
[`makers-ai-hub`](https://github.com/gutocarollo), arquivo e linha.

---

## 1. A pergunta que dispara tudo

Um frontend artesanal acumula nomes de cor que **não dizem de quem são**.
O exemplo real, e é o coração do problema:

```
src/components/Modals/ManageWorkspace/Documents/Directory/index.jsx  Linha 224

  <button
    className="... rounded-lg hover:bg-surface-hover z-it..."
```

`surface-hover` significa *"superfície, no hover"*. Superfície de **quê**? Um
botão? Uma linha de tabela? Um item de menu? O nome não diz. Quem for mudar a cor
de hover dos botões amanhã não tem como saber se mexer nesse token quebra outra
coisa — e mexe, porque o mesmo nome é usado em toda parte.

---

## 2. O vocabulário — o que é cada entidade

### Ocorrência = um lugar no código

**Uma ocorrência é um ponto de uso**, não um token. O trecho acima é **uma**
ocorrência: arquivo, linha, prefixo (`bg`), token (`surface-hover`).

> **504 ocorrências** = 504 lugares no código, espalhados por **201 arquivos**.

### Token = o nome declarado

Um token é o nome que existe no design system. E aqui está o dado que muda a
leitura de tudo:

> As 504 ocorrências usam **apenas 12 tokens distintos**.

| usos | token |
|---:|---|
| **336** | `surface-hover` |
| 51 | `surface-elevated` |
| 44 | `surface-panel` |
| 26 | `surface-destructive-tint` |
| 15 | `surface-canvas` |
| 14 | `surface-selected` |
| 8 | `surface-selected-foreground` |
| 4 | `surface-inset-inverse` |
| 1 cada | `surface-info-tint`, `surface-warning-tint`, `surface-sunken`, `surface-success-tint` |

Então o problema não é "504 tokens bagunçados". É **12 nomes vagos fazendo o
trabalho de dezenas de contratos diferentes** — e um deles, `surface-hover`,
sozinho carrega 336 usos que não têm nada a ver uns com os outros.

### Contexto = o que cerca a ocorrência

Para cada ocorrência o processo mede o que a cerca, sem adivinhar:

| eixo | no exemplo acima |
|---|---|
| tag nativa | `<button>` |
| papel (`role`) implícito ou explícito | botão |
| componente | `Directory` |
| propriedade CSS (do prefixo `bg`) | `background-color` |
| estado (do prefixo `hover:`) | `hover` |
| owner inferido | `button` |

### Cluster de contexto = ocorrências que compartilham o mesmo contexto

**A unidade de decisão não é o token — é o cluster.** Isso é o ponto que este
processo existe para acertar. Perguntar *"qual o novo nome de `surface-hover`?"*
é a pergunta errada, porque força **uma** resposta para 336 usos diferentes.
A pergunta certa é feita por contexto.

> 504 ocorrências → **311 clusters**.

### Contrato = o nome derivado da lei

Do contexto sai um nome mecânico, pela lei
`owner . anatomia . propriedade . variante . estado`:

```
owner=button + propriedade=background-color + estado=hover
                    ↓
        button-background-color-hover
```

Nada de gosto pessoal: o nome cai dos eixos medidos. **252 dos 311 clusters
(82,7% das ocorrências) receberam nome derivado assim.** Os 59 restantes não
tinham owner detectável no contexto e viraram fila.

### O resultado prático — 1 nome vago vira 11 contratos

`surface-hover`, os 336 usos, separados pelo que de fato são:

| clusters | contrato derivado | exemplo real |
|---:|---|---|
| 119 | `button-background-color-hover` | `Directory/index.jsx:224` — `<button>` |
| 9 | `menu-background-color-hover` | `Export/index.jsx:56` — `<div>` |
| 6 | `card-background-color-hover` | `agentFlow.jsx:11` — `<Link>` |
| 6 | `modal-background-color-hover` | `NewEmbedModal/index.jsx:200` — `<label>` |
| 4 | `nav-item-background-color-hover` | `DesignSystem/index.tsx:475` — `<a>` |
| 3 | `prompt-background-color-hover` | `systemPrompt.jsx:12` — `<Link>` |
| 3 | `data-table-background-color-hover` | `FileRow/index.jsx:15` — `<tr>` |
| 3 | `code-block-background-color-hover` | `NewEmbedModal/index.jsx:109` — `<code>` |

Agora dá para mudar o hover dos botões sem tocar no hover das linhas de tabela.
Antes, era o mesmo token.

---

## 3. Os passos, em ordem

```
PREFLIGHT  →  EXTRACT  →  CLUSTER  →  CONVERGE  →  REPORT  →  DECIDE
```

### PREFLIGHT — os sinais estão ligados?

Confere que o compilador do Tailwind e a biblioteca de cor resolvem **a partir do
alvo**. Se algum falta, o loop **para**.

Isso não é zelo decorativo. Numa corrida real a biblioteca de cor não resolveu, o
sinal de cor (40% do peso) zerou, e o resultado foi *"0 fusões, 400 na fila"* —
um número que **parece resultado** e não é. Por isso toda fase falha fechada.

### EXTRACT — o censo

Varre os 201 arquivos e registra as 504 ocorrências com arquivo, linha, prefixo e
token. Não muta nada.

### CLUSTER — agrupar por contexto e derivar o nome

Agrupa pelos eixos da §2 e aplica a lei. Saída: 311 clusters, 252 com nome.

### CONVERGE — fundir o que é a mesma coisa

Dois clusters que derivaram o **mesmo** contrato ainda podem ser coisas
diferentes. Cada par candidato recebe uma nota de 0 a 100, somando cinco sinais
**medidos**:

| sinal | peso | o que mede |
|---|---:|---|
| cor | 40 | ΔE2000 entre os valores. ≤ 2,3 = diferença imperceptível ao olho |
| contrato | 25 | mesmo owner + propriedade + variante + estado |
| componente | 15 | semelhança dos nomes dos componentes |
| sinal-owner | 10 | força com que o owner foi detectado |
| função | 10 | mesma tag nativa e mesmo papel |

Uma fusão real, com a nota aberta:

```
button-background-color-hover                          confiança 88%
  cor          40/40   ΔE 0.00 ≤ 2.3 (imperceptível)
  contrato     25/25   mesmo owner+propriedade+variante+estado
  componente   10/15   similaridade de nome 67%
  sinal-owner   3/10   força mínima 0.3
  função       10/10   mesma tag <button> e mesmo role
```

**Por que "convergir" e não só "rodar uma vez":** fundir dois clusters muda o
cluster resultante, que pode então casar com um terceiro. Então o processo repete
até **duas iterações consecutivas não mudarem nada** — o critério de parada de
Newton–Raphson. Aqui: **4 iterações**.

> **211 fusões**: 200 por confiança + 11 absorvidas por outlier.

**Outlier** é o caso em que um lado é ocorrência isolada com cor
imperceptivelmente diferente do lado dominante. Critério **relativo**, não número
mágico: ≤ 2 usos **e** ≤ 25% do lado dominante **e** ΔE ≤ 2,3.

```
card-background-color-hover:  2 usos absorvidos, 14% do dominante
menu-background-color-hover:  1 uso  absorvido,  10% do dominante
```

O critério é relativo de propósito. Um limiar absoluto de "≤ 2 usos" engoliria
`sidebar-background-color`, que é **1 contra 1** — sem lado dominante, fundir
seria arbitrário. Por isso ele sobrou para você (é o D6/D7 da §4).

### REPORT — três capítulos, de propósito

1. o que o processo decidiu **sozinho**, com o sinal que sustentou cada decisão;
2. o que ele **expôs e não decidiu** — 49 divergências de estado: token que
   declara `hover` no nome sendo consumido **sem** o prefixo `hover:`, ou seja
   fundo estático usando token de interação. Renomear em silêncio apagaria a
   evidência;
3. o que precisa de você.

Um relatório só com o capítulo 1 vende progresso. Só com o 3, transfere
ambiguidade crua. Os três juntos deixam decidir.

### DECIDE — só o que passou do corte

---

## 4. O que sobrou para você: 8 pares, 9 ocorrências de 417 (2,2%)

Em todos, **a cor diz que é a mesma coisa (ΔE 0,00) e a função diz que não**.
O processo não decide porque a evidência aponta para os dois lados.

| | contrato | A | B | incerteza |
|---|---|---:|---:|---:|
D1 | `code-block-background-color` | 7 usos | 2 usos | 32% |
D2 | `modal-background-color-hover` | 2 | 1 | 32% |
D3 | `modal-background-color-hover` | 2 | 1 | 32% |
D4 | `card-background-color` | 3 | 1 | 32% |
D5 | `card-background-color` | 3 | 1 | 32% |
D6 | `sidebar-background-color` | 1 | 1 | 32% |
D7 | `sidebar-background-color` | 1 | 1 | 32% |
D8 | `modal-background-color-hover` | 2 | 1 | 31% |

A pergunta em cada um é a mesma: **um contrato ou dois?**

---

## 5. Os números, agora legíveis

| número | o que é | o que **não** é |
|---:|---|---|
| **504** | pontos de uso no código, em 201 arquivos | não é 504 tokens |
| **12** | tokens distintos envolvidos | — |
| **311** | grupos de ocorrências com o mesmo contexto | não é 311 nomes novos |
| **252** | clusters que ganharam nome derivado (82,7% das ocorrências) | — |
| **211** | pares fundidos por evidência medida | não é 211 renomeações aplicadas |
| **41** | contratos finais | não estão escritos no `color.tokens.json` ainda |
| **9** | ocorrências presas em 8 decisões suas (2,2%) | — |

---

## 6. O que este processo **ainda não faz**

Honestidade sobre o limite, porque o diagrama do README descreve o processo
pretendido e o código cobre a primeira metade:

| etapa | estado |
|---|---|
| escrever os 41 contratos no `color.tokens.json` | **não implementado** |
| rodar os emissores e provar que a classe existe no **CSS buildado** | **não implementado** |
| codemod nos 504 call sites | **não implementado** |
| capturar pixel antes/depois por estado | protocolo escrito, **não executado** |

`tokenize.mjs` entrega **proposta e prova**, nunca mutação. Nenhuma linha do
`makers-ai-hub` foi alterada por ele.

Detalhe que importa antes de escrever qualquer contrato: **32 dos 63 tokens
existentes usam a anatomia `container`**. Criar `card-background-color` ao lado
do `card-container-background-color` existente faria o repo ter **duas convenções
vivas** — exatamente o defeito que este esforço existe para eliminar. Essa
decisão vem antes.
