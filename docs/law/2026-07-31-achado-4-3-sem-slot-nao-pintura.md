# Achado F-E — §4.3 da lei não tem slot para radius, spacing e tipografia

> ✅ **APLICADO EM 2026-08-01 — ESTE ACHADO ESTÁ FECHADO.** O dono decidiu:
> *"espaçamento/tipografia ESTÃO ABSOLUTAMENTE DENTRO DO ESCOPO."* A §4.3 passou
> de 7 para **16 propriedades em três domínios** (paint · geometry · type), e o
> LAW GAP do alvo foi de **3.546 usos (12,1%) para ZERO**, medido com
> `measure-coverage.mjs`. Isto é a fase **F-E** do plano mestre.
>
> Leia tudo o que segue como o **REGISTRO do achado**, nunca como o estado atual
> da lei — inclusive a citação da §4.3 com sete propriedades e a grafia `color`,
> que a lei aboliu horas depois deste texto ser escrito.
>
> Por que este banner existe: enquanto o doc dizia *"achado aberto, nada foi
> emendado"*, ele morava em `docs/law/` — lido como LEI. Um agente o seguiria
> jogando `padding`, `border-radius` e `font-weight` no balde LAW GAP, ou seja,
> desfazendo exatamente a emenda que o destravou.

Status original (superado, ver banner): *achado aberto, nada emendado*. A lei permanece como está até
decisão do dono.

> Contexto: F-E pedia *"ampliar `PREFIX_PROPERTY` para cobrir radius, spacing e
> tipografia"*, com a ressalva explícita — *"a projeção é para o VOCABULÁRIO
> FECHADO de propriedades da lei, não para o nome literal do CSS. Se a lei NÃO
> tem slot, isso é um ACHADO e você deve dizer, não forçar."* Tem exatamente
> esse formato. Este documento é o "dizer".

---

## 1. O achado, medido

`reference/law.md` §4.3 lista **sete** propriedades, e as sete são pintura:

```
background-color · color · border-color · outline-color · box-shadow · fill · stroke
```

Reproduz com:

```bash
cd /home/augusto/code/makers-ai-hub/frontend
node -e 'import("/home/augusto/code/ui-tokenizer-v2/.claude/skills/tokenize-design-system/scripts/score-naming.mjs")
  .then(m => console.log(m.readVocabulary().properties))'
# [ 'background-color','color','border-color','outline-color','box-shadow','fill','stroke' ]
```

`border-radius`, `padding`, `margin`, `gap`, `column-gap`, `row-gap`,
`font-weight`, `line-height` e `letter-spacing` **não estão lá**. Depois da
ampliação da tabela, **41 dos 53 prefixos não têm slot** — número impresso pelo
próprio oráculo:

```
node "$S/score-naming.mjs" --root .
LAW GAP      0 uses      the class family has no §4.3 property slot
  41 of 53 prefixes have no slot: border-radius · padding · margin · gap ·
  column-gap · row-gap · font-weight · line-height · letter-spacing
```

## 2. Por que forçar seria pior que declarar

A projeção não é decorativa. `scoreApplication` compara o valor da tabela **por
igualdade estrita** contra o slot de propriedade que `parseName` extraiu do NOME
do token, e `parseName` só consegue preencher aquele slot com um termo de §4.3.
`derive-tokens.mjs` põe o mesmo valor **direto no id DTCG gerado**.

Logo, escrever `p: "padding"` e deixar correr tem só ramos ruins:

| se o oráculo fizesse | consequência |
|---|---|
| dar os 60 pontos assim mesmo | **todo** uso de spacing passa sem verificação de propriedade — o teste H-021 vira decoração para 41 dos 53 prefixos |
| tirar os 60 pontos | **todo** uso de spacing reporta H-021 contra um slot que nunca esteve disponível — falso vermelho em massa |
| derivar o nome mesmo assim | emite `card-border-radius`; `parseName` não reconhece `border-radius`, o segmento vira `REMAINDER`, e o critério *no-remainder* tira 10 pontos do nome **por um defeito que o próprio gerador criou** |

Os três são número que parece resultado. O código implementado **falha
fechada**: `lawSlotFor()` devolve `null`, `scoreApplication` devolve
`evaluable:false, lawGap:true` com o motivo escrito, `deriveProperty` devolve
`undefined` e a ocorrência vai para `unresolved`, e `context-clusters` manda o
cluster para a fila de decisão com `reason` =
``familia `rounded-` (border-radius) nao tem slot em §4.3 da lei``.

## 3. Prova de que a falha fechada funciona (fixture)

O alvo real tem **zero** token de radius/spacing/tipografia, então o caminho não
é exercitado por ele. Foi exercitado num fixture com classes
`rounded-surface-panel`, `p-surface-panel`, `font-surface-panel`,
`mx-surface-hover`, `leading-surface-hover`:

```
FIXTURE · ANTES (12 prefixos)      FIXTURE · DEPOIS (53 prefixos)
22 ocorrências                      48 ocorrências
22 clusters                         48 clusters
19 com nome DERIVADO                19 com nome DERIVADO   <- inalterado
 3 sem owner                         3 sem owner           <- inalterado
 —                                  26 sem slot em §4.3 -> LAW GAP
convergiu em 3 iterações            convergiu em 3 iterações
 9 fusões / 10 contratos             9 fusões / 10 contratos  <- inalterado
```

O owner das 26 é resolvido normalmente (`card`, `button`, `list-row`). O
bloqueio não é de atribuição — é da lei.

## 4. A emenda proposta, e o que ela custa

**Aplicada em 2026-08-01** (ver banner). Três razões, nesta ordem:

1. É decisão sobre a **lei**, não correção de script. §4.3 é vocabulário
   fechado por design; abri-lo muda o contrato de todo token futuro.
2. `reference/law.md` declara no cabeçalho ser **espelho byte-idêntico** de
   `<alvo>/tokens/GRAMMAR.md` (md5 conferido: `5689d030…` nos dois). Emendar um
   lado sozinho quebra o espelho, e mutação no alvo está proibida nesta fase.
3. Uma das famílias **não é uma propriedade só**, e isso precisa de decisão
   humana antes de virar vocabulário — ver §5.

Esboço da emenda, para quando for decidida:

```diff
 ### 4.3 Properties

 `background-color` · `color` · `border-color` · `outline-color` · `box-shadow` ·
-`fill` · `stroke`
+`fill` · `stroke` · `border-radius` · `padding` · `margin` · `gap` ·
+`font-size` · `font-weight` · `font-family` · `line-height` · `letter-spacing`
```

Impacto a conferir junto com a emenda, porque `readVocabulary()` alimenta
`parseName` e a ordem dos slots é greedy da esquerda para a direita:

- `parseName` passa a consumir `padding`/`margin` no slot de propriedade — hoje
  esses segmentos cairiam em `remainder`;
- `IMPLIED_PROPERTY` (§7.2) hoje mapeia anatomias para `color`/`background-color`
  /`border-color`. `track`, `thumb` e `divider` ganham propriedade possível nova,
  e a tabela de derivabilidade precisa ser reavaliada;
- o critério *coherent-pair* (10 pontos) passa a poder reprovar pares novos
  (`label` + `padding`), o que é desejado, mas muda notas existentes.

## 5. A decisão que a emenda não resolve sozinha: `font-` e `text-` são dois

Um prefixo, duas propriedades, decidido **pelo valor**:

| classe | propriedade real |
|---|---|
| `font-bold`, `font-semibold` | `font-weight` |
| `font-mono`, `font-sans` | `font-family` |
| `text-sm`, `text-lg` | `font-size` |
| `text-content-primary` | `color` |

`text-` já está na tabela desde sempre como `color`, e isso é inofensivo hoje
**só porque** o universo de tokens do alvo é 100% cor (253 nomes, medido) e o
filtro `universe.has(token)` descarta `sm`. No dia em que existir um token de
tipografia, `text-` passa a ser ambíguo de verdade.

A tabela declara a ambiguidade em vez de escondê-la
(`valueDependent` em `lib/utility-families.mjs`), mas resolvê-la exige o
compilador — é o **eixo B** do plano (`@tailwindcss/node`, já resolvido no
alvo). Ou seja: a emenda de §4.3 depende do eixo B para as duas linhas de
tipografia, e não depende dele para radius, spacing e gap.

## 6. Achados vizinhos, não corrigidos

| achado | evidência | por que não mexi |
|---|---|---|
| **motion é família de design e está fora de toda tabela** | `transition-` 324 usos · `duration-` 326 · `animate-` 61 no balde de exceção; o alvo tem `src/styles/generated/motion-tokens.css`, ou seja o DS **já** trata motion como token | §2.4 do plano fixa as famílias bloqueantes em cor·spacing·radius·tipografia. Incluir motion move um número de nível de plano sem autorização. O teste `utility-families.test.mjs` **trava** essa entrada: `transition-all`/`duration-300`/`animate-spin` estão na lista must-NOT-match, então adicioná-las quebra o teste e força a decisão a ser tomada no claro |
| **o censo conta operador JS como classe** | no balde de exceção: `?` 194 · `:` 194 · `}` 134 · `===` 51 · `""` 49 · `"bg` 77 · `"text` 47 · `"border` 30 — resíduo de `className={cond ? "a" : "b"}` dentro de template literal | inflaria/desinflaria o denominador 32.662, que é número de nível de plano |
| **`reference/law.md` afirma um teste que não existe** | cabeçalho: *"The target contract test blocks divergence"*. `validate-contract.mjs` lê **só** arquivos da skill; `grep -rn "GRAMMAR.md"` não acha nenhuma comparação de conteúdo | é correção de doc ou de script, fora do escopo de F-E |
| **`tokenization-runner.test.mjs` falha 7/7 e `absolute-completion.test.mjs` 1/4** | idêntico no worktree de `HEAD` e depois das mudanças de F-E — pré-existente | não é regressão minha; declarado para não ser confundido com uma |
