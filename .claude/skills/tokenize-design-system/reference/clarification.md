# Clarificação — como perguntar, e quando não perguntar

Regra canônica deste processo. **Pergunta seca ao dono é proibida.**

Origem: a regra existia em prosa (`CLAUDE.md` §6, e uma skill `clarification-plan`
que foi deletada) e mesmo assim o agente terminou turno atrás de turno com
*"Sigo por qual?"*, *"Quer que eu…?"*, *"Sigo criando os 32 tokens?"*. **Regra em
prosa que ninguém verifica não é regra — é sugestão.** Por isso agora há um Stop
hook determinístico: `tools/hooks/clarification-gate.py`, registrado em
`.claude/settings.json` sob `hooks.Stop`.

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
**incerteza > 30%** — `scripts/converge-tokens.mjs`, Linha 48
(`const MAX_UNCERTAINTY = Number(arg("--max-uncertainty", "30"))`), repassado por
`scripts/tokenize.mjs`, Linha 218. Abaixo do corte o processo decide sozinho;
acima, o par sobe para o capítulo 3 do relatório e para a fase `DECIDE`. O corte
é movível pela linha de comando (`--max-uncertainty <n>`), não é constante da lei.

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
> - **Exemplo aplicado bom:** se o v1 patchado alcançar os 1.821, não há caso para motor novo — e foi o que aconteceu (medição registrada em `docs/ESTADO.md`, Linhas 163 e 177).
> - **Exemplo aplicado ruim:** se o patch exigisse mudar o modelo 1:1, o custo apareceria antes de comprometer semanas.
> - **Quando escolher:** quando a diferença medida pode vir da chamada, não da arquitetura.

## 3. O que conta como exemplo aplicado

Entidade, fluxo, tabela, coluna, comando, **arquivo:linha**, token, rota, tela ou
cenário **real do contexto analisado**. Analogia genérica **não vale**.

> ⛔ **VOCABULARIO SUPERADO.** `content`/`surface`/`semantic` sao palavras BANIDAS desde 2026-07-31. Os nomes abaixo sao MEDICAO da epoca, nunca alvo.

| ✅ vale | ❌ não vale |
|---|---|
| "em `src/components/Modals/ManageWorkspace/Documents/Directory/index.jsx:289`, o `hover:bg-surface-hover` vira `button-background-color-hover`" | "o token ficaria mais semântico" |
| "`ΔE 0,79` entre `#FCFCFB` e `#F9F9F7` — imperceptível" | "as cores são parecidas" |
| "os N usos de `outline-primary-button` recebem contexto errado, com N vindo de `grep -rc`" | "afeta vários lugares" |

⚠ **O exemplo precisa ser medido na hora, não copiado daqui.** Estas três linhas
mostram o FORMATO. Path, linha e contagem envelhecem: o `Directory/index.jsx:288`
da versão anterior deste documento já apontava para a linha errada, e a contagem
de `outline-primary-button` que ele citava não é a de hoje. Rode o comando antes
de escrever o número no bloco `D[n]`.

## 4. O gate, e como ele decide

`tools/hooks/clarification-gate.py`, registrado como **Stop hook** em
`.claude/settings.json`.

Mede **três** coisas no texto final do turno:

1. **há pergunta de escolha?** — um dos **13** padrões de `CHOICE_PATTERNS` (8 em pt, 4 em en)
   (Linhas 42-58): verbo de 1ª pessoa do presente (`sigo`, `crio`, `implemento`,
   `executo`, `rodo`, `aplico`, `migro`, `comeco`, `avanco`, `prossigo`, `gero`,
   `escrevo`, `renomeio`, `removo`, `adiciono`, `instalo`, `commito`, `pusho`),
   `quer que eu`, `prefere`, `qual (voce|vc|deles|delas|opcao|caminho|dos)`,
   `(posso|devo|faco)`, `autoriza`, `confirma`, `A ou B` — **e** um `?` fora de
   bloco de código
2. **se há, o bloco `### D[n]` está presente e completo?** — `D_BLOCK`
   (`^#{2,4}\s*D[-\d]`) mais os **seis** `REQUIRED_ELEMENTS`: a linha `**Canon:**`,
   os quatro itens por opção **e** a `**Minha recomendação**` (o padrão aceita
   `Recomendação`/`Recomendacao`, e os rótulos valem em pt E en)
3. **o turno devolve a bola ao dono SEM interrogação?** — `HANDOFF_PATTERNS`
   (*"aguardando sua decisão"*, *"decisões que continuam suas"*, *"cabe a você"*)
   cruzado com `DECISION_SIGNALS` (`D1`, `D-a`, `opção A`, `decisão`, `escolha`).
   Só bloqueia quando os DOIS aparecem — parada legítima sem decisão aberta não
   vira ruído. Esta via nasceu do incidente de 2026-07-31: um turno terminou com
   *"Decisões que continuam suas: [4 bullets]... Aguardando sua avaliação"* e
   nenhum gate disparou, porque não havia pergunta.

✅ **CORRIGIDO no hook v3 (`72f1639`) — o defeito abaixo fica como história.**
O corpo passa por `fold()` (normalização NFD + remoção de combining marks) ANTES
do match, então *"Começo pelo A?"* hoje **bloqueia** e o ramo `opcao` casa
`opção`. O defeito era real e viveu porque os padrões eram ASCII, `re.IGNORECASE`
não normaliza diacrítico, e ninguém testou com acento — a cobertura vinha só dos
ramos sem cedilha (`sigo`, `crio`, `posso`, `devo`, `prefere`). Registrado aqui
para que ninguém conclua que "o gate não bloqueou, logo a pergunta era legítima".

Bloqueia com `exit 2` e devolve o formato; bloco incompleto tem mensagem própria,
listando os elementos que faltam. Não dispara em: pergunta retórica dentro de
explicação, pergunta em bloco de código ou citação (`strip_code_and_quotes`),
frase afirmativa com verbo de 1ª pessoa sem interrogação, e turno em que
`stop_hook_active` já é `true` (evita laço).

O padrão do verbo é intencionalmente largo no objeto direto: a primeira versão
exigia `sigo por/com/para` e deixou passar `"Sigo criando os 32 tokens?"`. O
objeto direto varia; o verbo não.

> **Lacuna de implementação declarada.** Este gate **não tem suíte de regressão**
> no repositório — não existe teste que o exercite, nem em `tools/`, nem no
> `scripts/test/` da skill. As afirmações acima foram verificadas lendo o código,
> não rodando casos. Enquanto não houver teste, qualquer alteração em
> `CHOICE_PATTERNS` ou em `REQUIRED_ELEMENTS` é uma mudança sem rede.

## 5. Onde isto se encaixa no grafo

O `end-to-end-workflow.md` §9 já fechava com a regra de quando o humano entra:

> *the LLM explains the options; the human is asked only when two or more
> contracts remain materially defensible.*

Este documento é o **como** dessa frase, e o hook é o **enforcement**. Os três
pontos do grafo em que a pergunta é legítima — com o estado real de cada um, que
não é o mesmo:

| ponto | estado no código |
|---|---|
| fila de convergência, quando a incerteza de fusão passa de 30% | **implementado.** `converge-tokens.mjs` Linha 48 empurra o par para `humano[]`; `tokenize.mjs` Linhas 243-251 é a fase `DECIDE`, a única fase humana do loop |
| nó `HUMANO` de owner novo, quando a nota fica abaixo do corte e nenhum owner do vocabulário serve | **parcial.** O corte existe e é executável (`score-naming.mjs`, `CUTOFF = 70`), e a fila de revisão sai em `--review`; o *nó* que leva essa fila ao dono não existe — nenhuma fase do `tokenize.mjs` a consome |
| nó `HUMANO` de política de escopo, quando `axisMappingSafe` não cobre o caso | **não implementado.** `axisMappingSafe` só existe em `docs/plans/2026-07-30-v2-upstream-como-oraculo-rev2.md`; não há símbolo com esse nome em `scripts/` |

Fora desses três, se você está perguntando, provavelmente devia estar medindo.
