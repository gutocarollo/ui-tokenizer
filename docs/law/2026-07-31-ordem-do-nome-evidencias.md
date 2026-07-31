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
| `md` | **namespace do sistema** — Material Design |
| `filled-button` | **DONO** |
| `label-text` | **ANATOMIA** (a parte) |
| `color` | **PROPRIEDADE** |

Dono primeiro. Propriedade por último. É literalmente `button.label-text.color`.

### O que `md` significa — e o que ele NÃO significa

`md` **não é tamanho** (não é "medium" entre small e big). É o namespace do
sistema:

> "All token names in a design system start with the system name (such as **`md`
> for Material Design**)."
>
> — [material-foundation/material-tokens · tokens.md](https://github.com/material-foundation/material-tokens/blob/main/tokens.md)

Os outros três segmentos que aparecem no M3 são os **tiers**, e mapeiam
exatamente na estrutura de 3 níveis:

| segmento | tier | o que guarda | citação |
|---|---|---|---|
| `md.ref.*` | primitivo | "Reference tokens hold concrete values, such as a hex color, pixel size, or font family name." | mesma fonte |
| `md.sys.*` | semântico | "System tokens define decisions and roles that give the design system its character" | mesma fonte |
| `md.comp.*` | componente | "the elements required to compose a component, such as containers, label text, icons, states" | mesma fonte |

Ou seja, o nome completo `md.comp.filled-button.label-text.color` se lê:
Material Design · camada de componente · botão preenchido · texto do rótulo ·
cor.

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

## 5.1 Traduzindo as referências para a NOSSA convenção

Os nomes acima são **evidência da ordem**, não o alvo literal. Duas coisas mudam
ao trazer para cá, e as duas já estão decididas:

1. **Palavra por extenso.** Primer abrevia (`fgColor`, `bgColor`); nós não.
2. **Sem namespace de sistema.** `md` existe porque o Material publica tokens
   para consumo externo e precisa evitar colisão. Um design system de produto
   único não tem esse problema — o prefixo seria ruído em 100% dos nomes.

| referência (como ELES escrevem) | nossa convenção (por extenso) |
|---|---|
| `--md-filled-button-label-text-color` | `button.label.foreground-color` |
| `--md-filled-button-container-color` | `button.container.background-color` |
| `--md-filled-button-hover-label-text-color` | `button.label.foreground-color.hover` |
| `--button-primary-bgColor-rest` (Primer) | `button.container.background-color.primary` |
| `--button-danger-fgColor-active` (Primer) | `button.label.foreground-color.danger.active` |
| `--primary-foreground` (shadcn) | `button.label.foreground-color.primary` |
| `--card-foreground` (shadcn) | `card.foreground-color` |
| `--sidebar-foreground` (shadcn) | `sidebar.foreground-color` |

Note o que **não** muda: a ordem. Dono, parte, propriedade, variante, estado —
nessa sequência, nas três referências e na nossa.

E note o ganho de `foreground-color` sobre `color`: `card.color` não diz se é a
cor do texto ou do fundo do card; `card.foreground-color` diz. É a mesma razão
que fez o Primer inventar `fgColor` — nós só escrevemos por extenso.

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
✗  content.primary                     posto como cabeça do nome, sem dono
✗  foreground.primary                  mesmo defeito, palavra melhor
✓  button.label.foreground-color       M3: --md-filled-button-label-text-color
✓  page.foreground-color               shadcn: --foreground (texto do corpo)
✓  data-table.header.foreground-color  M3: dono → anatomia → propriedade
✓  field.placeholder.foreground-color  anatomia `placeholder` já existe em §4.2
```

E a classe Tailwind que sai daí lê na ordem certa:
`text-button-label-foreground-color` — "o primeiro plano do label do botão". Não
`text-button-color`, que não diz que parte do botão, nem `text-content-primary`,
que não diz de quem.

Sim, é longo. A decisão de verbosidade foi tomada com dado (+19% de velocidade
de compreensão, ICPC 2018) e o critério declarado pelo dono é o que a IA entende
melhor, não o que é curto de digitar.

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
