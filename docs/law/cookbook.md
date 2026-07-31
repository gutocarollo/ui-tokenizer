# Cookbook — a situação real e o nome que a lei dá a ela

> **O que este documento é.** A lei ([`GRAMMAR.md`](GRAMMAR.md)) diz a REGRA;
> [`examples.md`](../../.claude/skills/tokenize-design-system/reference/examples.md)
> ensina a regra por contra-exemplo. Este cookbook faz a terceira coisa, que
> faltava: para **cada situação visual concreta** dos produtos reais, diz o nome.
> A pergunta que ele responde não é "qual é a gramática?", é *"estou pintando o
> fundo do botão secundário em hover — como isso se chama?"*.
>
> **Como ler.** Cada capítulo é uma família de entidade. A coluna **nome antigo**
> é a ponte da migração: é o que o código escreve hoje, e pode conter as palavras
> banidas — é o único lugar onde elas aparecem. A coluna **token pela lei** é o
> destino. Palavra banida NUNCA é destino.
>
> **Como ele se mantém honesto.** Todo nome da coluna "token pela lei" é
> submetido ao mesmo oráculo que julga token de produção
> (`validate-cookbook.mjs` → `scoreName`, vocabulário lido da própria lei).
> Nota esperada: 100. Exceção só vale se estiver justificada na seção
> **Exceções** no fim — exceção sem justificativa escrita é falha do validador.
>
> ```bash
> node .claude/skills/tokenize-design-system/scripts/validate-cookbook.mjs
> ```

## A gramática, em uma linha

```
entity[.variant][.anatomy][.property][.state]
```

| slot | pergunta que responde | quando escrever |
|---|---|---|
| `entity` | **DE QUEM** é esta decisão visual? | **sempre** — §4.1, inclui entidades globais sem pai |
| `variant` | **QUAL VERSÃO** da entidade? | só quando a entidade tem variantes reais — §4.4 |
| `anatomy` | **QUAL PARTE** da entidade? | só quando a entidade tem mais de uma parte endereçável — §4.2 |
| `property` | **O QUE** ela pinta? | só quando a anatomia admite mais de uma — §4.3, §7.2 |
| `state` | **QUANDO**? | só quando não é o `default` — §4.5 |

Três armadilhas que este cookbook existe para matar, todas medidas em código real:

1. **A variante gruda na entidade, não na propriedade.** `button.secondary.border-color`,
   nunca `button.border-color.secondary`. O botão é secundário; a borda não.
2. **Anatomia de propriedade única omite a propriedade.** `button.label`, não
   `button.label.foreground-color` — um rótulo é texto, não tem fundo próprio.
3. **A entidade vem do contexto renderizado, nunca do valor.** Dois lugares com o
   mesmo hex hoje continuam sendo dois contratos se são entidades diferentes.

## 0. Os casos canônicos da lei

Esta é a bateria que `scripts/test/cookbook.test.mjs` roda a cada suíte. Ela não
descreve um produto: descreve a própria gramática, um caso por regra.

| situação | nome antigo | token pela lei | regra que ele demonstra |
|---|---|---|---|
| fundo da página | — | `page.background-color` | entidade + propriedade, o caso mínimo (§1) |
| cor do texto da página | `text-content-primary` | `page.foreground-color` | propriedade por extenso, nunca `color` (§4.3) |
| fundo do botão primário, repouso | — | `button.primary.background-color` | estado omitido É o `default`; escrever `.default` é proibido (§4.5) |
| fundo do botão primário em hover | — | `button.primary.background-color.hover` | variante colada à entidade, estado no fim (§4.4, §4.5) |
| a borda do botão secundário | — | `button.secondary.border-color` | a variante qualifica o BOTÃO, não a borda |
| o rótulo do botão destrutivo | — | `button.destructive.label` | anatomia de propriedade única: propriedade omitida (§7.2) |
| o placeholder de um campo | `text-content-tertiary` | `field.placeholder` | idem — placeholder é texto por definição |
| fundo do cabeçalho da tabela | — | `data-table.header.background-color` | entidade composta + anatomia (§4.1) |
| a hairline global | `border-theme-modal-border` | `divider.border-color` | entidade GLOBAL, sem pai (§5.5) |
| o anel de foco global | `ring-ring` | `focus-ring.outline-color` | idem — uma decisão, um token, N consumidores |

## Exceções

Nenhuma até aqui. Toda linha acima pontua 100 no oráculo.

Uma linha só pode divergir de 100 se estiver marcada com ⚠ **e** justificada
nesta seção, com o motivo e o caminho de saída. Categorias previstas:

- **LAW GAP** — a situação é real e a lei não tem slot para ela (ex.: variantes
  `outline`/`link`/`soft` que o §4.4 não lista; propriedades não-cor como
  `duration-*` e `rounded-*`). O nome fica pendente até a lei ser emendada.
- **DECISÃO DO DONO** — a situação pede entidade nova no §4.1, ou colide com
  paridade entre produtos.

Exceção sem justificativa escrita aqui é **falha**, não licença.
