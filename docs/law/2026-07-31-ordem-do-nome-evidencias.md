# A ordem do nome: `button.text.color`, não `text.button.color` — evidência auditável

Pergunta do dono: *"`text-button-color` está muito estranho. Por que não
`button-text-color`, ou seja, a cor do texto do botão? Essa ordem sempre me
incomodou."*

O instinto está certo. Abaixo, só fonte primária com citação literal e link.
Nenhuma inferência.

---

## 1. O DTCG **não** decide isso — e o README precisa ser corrigido

O README deste repositório afirma que o DTCG é "autoridade de estrutura de 3
tiers" e está "integrado em `docs/law/GRAMMAR.md`". A spec diz o contrário sobre
**nomes**:

> "Groups are arbitrary and tools _SHOULD NOT_ use them to infer the type or
> purpose of design tokens."
>
> — [Design Tokens Format Module, W3C DTCG](https://www.designtokens.org/TR/drafts/format/)

As únicas regras de nome na spec são **técnicas**, não semânticas:

> "token and group names _MUST NOT_ begin with the `$` character"
>
> "the following characters _MUST NOT_ be used anywhere in a token or group
> name: `{` (left curly bracket), `}` (right curly bracket), `.` (period)"

**Conclusão auditável:** o DTCG é autoridade de **formato** (`$type`, `$value`,
referências `{...}`, estrutura de arquivo). Ele é **deliberadamente agnóstico**
quanto a convenção de nome. Citar o DTCG para justificar uma ordem de segmentos é
citação indevida — ele explicitamente se recusa a opinar.

A ordem tem que vir de outro lugar. Vem — de três sistemas grandes, e os três
concordam.

---

## 2. Material Design 3 — a regra está escrita, e o exemplo é o nosso caso

A regra, verbatim:

> "The parts of a token name are separated by periods and proceed from the most
> general information ("md") to the most specific ("on-secondary"). More
> specifically, each token is named for how or where it's used (for example,
> `md.comp.fab.primary.container.color` sets the container color for a FAB)."
>
> — [Design tokens – Material Design 3](https://m3.material.io/foundations/design-tokens)

E o token **exato** para cor de texto de botão, lido do código-fonte do Google:

```
--md-filled-button-label-text-color
--md-filled-button-hover-label-text-color
--md-filled-button-focus-label-text-color
--md-filled-button-container-color
```

— [`material-web/tokens/_md-comp-filled-button.scss`](https://github.com/material-components/material-web/blob/main/tokens/_md-comp-filled-button.scss)

Decomposto:

| segmento | papel |
|---|---|
| `md` | sistema |
| `filled-button` | **DONO** |
| `label-text` | **ANATOMIA** (a parte) |
| `color` | **PROPRIEDADE** |

Dono primeiro. Propriedade por último. É literalmente `button.label-text.color`.

---

## 3. GitHub Primer — mesmo ordenamento, declarado como padrão

Padrão documentado para tokens de componente: `--[component]-[variant]-[property]-[state]`

Exemplos reais:

```
--button-danger-fgColor-active
--button-primary-bgColor-rest
--button-outline-fgColor-hover
```

— [Primer · Color primitives](https://primer.style/foundations/primitives/color)

Componente primeiro, propriedade depois, estado no fim. E note: os tokens
**globais** invertem (`--fgColor-accent`, `--fgColor-muted`) — porque ali não há
dono. A ordem não é estética, é hierárquica: o mais geral primeiro, e quando
existe dono, o dono É o mais geral.

---

## 4. shadcn/ui — a convenção da nossa própria stack, verbatim

> "We use semantic background and foreground pairs. The base token controls the
> surface color and the `-foreground` token controls the text and icon color that
> sits on that surface. The background suffix is omitted for the surface token.
> For example, `primary` pairs with `primary-foreground`."
>
> — [shadcn/ui · Theming](https://ui.shadcn.com/docs/theming)

Lista real de variáveis: `--card-foreground`, `--popover-foreground`,
`--sidebar-foreground`, `--sidebar-primary-foreground`, `--primary-foreground`.

Base primeiro, `-foreground` como sufixo. **Nunca `--foreground-card`.**

---

## 5. Os três concordam

| sistema | cor do texto de um botão | ordem |
|---|---|---|
| Material Design 3 | `md-filled-button-label-text-color` | dono → anatomia → propriedade |
| GitHub Primer | `button-primary-fgColor-rest` | dono → variante → propriedade → estado |
| shadcn/ui | `primary-foreground` | base → papel |

Nenhum deles escreve a propriedade antes do dono. `text-button-color` não tem
precedente em nenhuma das três referências.

---

## 6. O que isso revela sobre o estado real do alvo

Medido em `makers-ai-hub/frontend`:

**Fundos são canônicos.** A família `button` existe e obedece a gramática:

```
--color-button-container-background-color
--color-button-container-background-color-active
--color-button-container-background-color-ghost
--color-button-icon-background-color
```

`button` (dono) · `container`/`icon` (anatomia) · `background-color`
(propriedade). Isso é `owner.anatomy.property` correto.

**Textos não são.** Não existe **nenhum** token de cor de texto de botão:

```
grep --color-button-*(label|text)*  →  vazio
```

Texto de botão é pintado com a escala genérica sem dono:

| classe | usos |
|---|---:|
| `text-content-primary` | 1.537 |
| `text-content-secondary` | 527 |
| `text-content-tertiary` | 190 |
| `text-content-inverse` | 164 |

**Esta é a assimetria que explica tudo.** Fundo recebeu tratamento canônico;
primeiro plano não. Foi por isso que `content-*` pareceu adequado: **não havia
alternativa com dono para texto.** A gramática existia só metade.

E é por isso que trocar `content` por `foreground` não resolveria: manteria a
metade errada. `foreground-primary` continua sem dono e sem anatomia.

---

## 7. Consequência para o destino da migração

O alvo de `text-content-primary` não é `text-foreground-primary`. É o par
dono+anatomia que as três referências usam:

```
✗  content.primary                    posto como cabeça do nome, sem dono
✗  foreground.primary                 mesmo defeito, palavra melhor
✓  button.label.color                 M3: md-filled-button-label-text-color
✓  page.color                         shadcn: --foreground (texto do corpo)
✓  data-table.header.color            M3: dono → anatomia → propriedade
✓  field.placeholder.color            anatomia `placeholder` já existe em §4.2
```

E a classe Tailwind que sai daí lê na ordem certa: `text-button-label-color` —
"cor (`text-`) do label do botão". Não `text-button-color`, que não diz que parte
do botão, nem `text-content-primary`, que não diz de quem.

---

## 8. Uma discordância honesta entre as referências

As três concordam na ORDEM e discordam na ABREVIAÇÃO:

- Primer usa `fgColor` e `bgColor` — abreviado e camelCase.
- M3 e shadcn escrevem por extenso (`color`, `container-color`, `foreground`).

A decisão deste projeto é **palavra por extenso**, com base medida — não por
consenso das referências, que não existe. Registrado em
[naming: palavras por extenso](#) com a evidência do ICPC 2018 (+19% de
velocidade de compreensão) e do estudo sobre LLM. Primer é a exceção declarada,
não um contra-exemplo ignorado.
