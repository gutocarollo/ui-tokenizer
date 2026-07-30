# Clarificação — como perguntar, e quando não perguntar

Regra canônica deste processo. **Pergunta seca ao dono é proibida.**

Origem: a regra existia em prosa (`CLAUDE.md` §6, e uma skill `clarification-plan`
que foi deletada) e mesmo assim o agente terminou turno atrás de turno com
*"Sigo por qual?"*, *"Quer que eu…?"*, *"Sigo criando os 32 tokens?"*. **Regra em
prosa que ninguém verifica não é regra — é sugestão.** Por isso agora há um Stop
hook determinístico: `.harness/hooks/clarification-gate.py`.

---

## 1. Antes de perguntar: você pode decidir?

Este processo é **99,999% orientado por IA**. O humano entra no limite, não na
rotina. Antes de montar um bloco de decisão, aplique o teste:

| a resposta depende de… | então |
|---|---|
| evidência que você consegue medir (código, valor, ΔE, contagem) | **decida e execute.** Relate a escolha, não pergunte |
| fato que você ainda não buscou | **busque.** Falta de investigação não é ambiguidade |
| preferência, prioridade de negócio, limite de custo, contrato humano | **pergunte, com o bloco** |
| ação destrutiva, credencial, deploy, prod | **pergunte, sempre** |

O gate diz isso na mensagem de bloqueio: *"se a decisão NÃO precisa do dono — e
você consegue decidir com evidência — então decida, execute, e relate a escolha em
vez de perguntar."*

E há um critério quantitativo quando a decisão é de fusão de contrato:
**incerteza > 30%** (ver `converge-tokens.mjs`). Abaixo disso o processo decide
sozinho; acima, sobe para o capítulo humano do relatório.

## 2. O formato obrigatório

```md
### D1 — [pergunta concreta da decisão]

**Opção A — [nome curto]**

- **Comportamento:** o que o sistema/processo passa a fazer.
- **Exemplo aplicado bom:** no caso REAL [arquivo:linha / token / rota / comando], acontece X.
- **Exemplo aplicado ruim:** no caso REAL [...], acontece Y.
- **Quando escolher:** se a prioridade for Z.

**Opção B — [nome curto]**

- (os mesmos quatro itens)

**Minha recomendação:** [qual, por quê, com o dado que sustenta].
```

**Não há limite de decisões.** Se a auditoria tem D1–D12, escreva D1–D12.

### Terceira via, quando A e B isoladas não bastam

Proponha **Opção C** — híbrido, spike, fallback — e diga por que A e B sozinhas
são insuficientes. Exemplo real deste projeto:

> **Opção C — patch pequeno + re-medição antes de decidir motor novo**
> - **Comportamento:** implementa `compilerCanonicalGroup` como projeção paralela e mede de novo.
> - **Exemplo aplicado bom:** se o v1 patchado alcançar os 1.821, não há caso para motor novo — e foi o que aconteceu.
> - **Exemplo aplicado ruim:** se o patch exigisse mudar o modelo 1:1, o custo apareceria antes de comprometer semanas.
> - **Quando escolher:** quando a diferença medida pode vir da chamada, não da arquitetura.

## 3. O que conta como exemplo aplicado

Entidade, fluxo, tabela, coluna, comando, **arquivo:linha**, token, rota, tela ou
cenário **real do contexto analisado**. Analogia genérica **não vale**.

| ✅ vale | ❌ não vale |
|---|---|
| "em `Directory/index.jsx:288` vira `button-background-color-hover`" | "o token ficaria mais semântico" |
| "`ΔE 0,79` entre `#FCFCFB` e `#F9F9F7` — imperceptível" | "as cores são parecidas" |
| "os 601 usos de `outline-primary-button` recebem contexto errado" | "afeta vários lugares" |

## 4. O gate, e como ele decide

`.harness/hooks/clarification-gate.py`, registrado como **Stop hook**.

Mede duas coisas no texto final do turno:

1. **há pergunta de escolha?** — verbo de 1ª pessoa (`sigo`, `crio`, `aplico`,
   `instalo`, `migro`, …) ou `quer que eu` / `prefere` / `posso` / `devo` /
   `autoriza`, **e** um `?` fora de bloco de código
2. **se há, o bloco `### D[n]` está presente e completo?** — os quatro itens por
   opção **mais** a `**Minha recomendação**`

Bloqueia com `exit 2` e devolve o formato. Não dispara em: pergunta retórica
dentro de explicação, pergunta em bloco de código ou citação, e frase afirmativa
com verbo de 1ª pessoa sem interrogação.

**Tabela de regressão: 11/11**, construída com as perguntas secas reais que o
agente fez nesta sessão — inclusive `"Sigo criando os 32 tokens?"`, que escapou da
primeira versão do padrão porque ela exigia `sigo por/com/para`. O objeto direto
varia; o verbo não.

## 5. Onde isto se encaixa no grafo

O `end-to-end-workflow.md` §9 já fechava com a regra de quando o humano entra:

> *the LLM explains the options; the human is asked only when two or more
> contracts remain materially defensible.*

Este documento é o **como** dessa frase, e o hook é o **enforcement**. Os três
pontos do grafo em que a pergunta é legítima:

- nó `HUMANO` de política de escopo, quando `axisMappingSafe` não cobre o caso
- nó `HUMANO` de owner novo, quando a nota fica abaixo do corte e nenhum owner do
  vocabulário serve
- fila de convergência, quando a incerteza de fusão passa de 30%

Fora desses três, se você está perguntando, provavelmente devia estar medindo.
