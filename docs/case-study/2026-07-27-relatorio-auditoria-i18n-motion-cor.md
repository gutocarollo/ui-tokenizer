# Relatório antes/depois — execução da auditoria i18n · motion · cor

> Base `b740e347` → `HEAD`. 268 arquivos, +17.238 / −2.426 linhas, 4 commits.

> Gerado do `git diff`, não de memória.


## 1. O que motivou

O `ds-gate` marcava **TOTAL 0** e o dono continuava achando problema olhando a tela. 
A auditoria (16 agentes, 547 achados brutos → 397 confirmados, 24 refutados) mostrou por quê: 
a ERE do gate **não cobre** escala default do Tailwind (`duration-300`), forma translúcida 
(`white/10`, excluída de propósito), nem string em inglês cravada no JSX.


## 2. Resultado por dimensão

| Dimensão | Antes | Depois |
|---|---|---|
| Motion não tokenizado | 263 usos da escala Tailwind + 122 `transition-*` sem duração | **0** |
| Translúcido `white/N` `black/N` | 202 crus | **0** |
| Strings EN cravadas | 452 | **NÃO era 0 — ver a errata abaixo.** Esta linha estava errada quando foi publicada. |
| `ds-gate` | 0 | **0** (mantido) |

> ## ERRATA — publicada em 2026-07-27, após revisão adversarial
>
> **A linha "Strings EN cravadas: 452 → 0" deste relatório era falsa quando foi escrita.**
>
> O que aconteceu: a auditoria que originou este relatório tinha **cap de 60 achados por
> scanner**. Ela AMOSTROU o código, e eu tratei a saída como universo completo. Cobertura
> real: **87 de 452 arquivos `.jsx` — 19%**. O dono abriu `/settings/default-system-prompt`
> e achou a página inteira em inglês.
>
> Pior: o detector que usei para *medir o residual* também falhava. Ele procurava `>texto<`
> na mesma linha, e não enxergava **nó JSX multilinha** — uma string quebrada em várias
> linhas pelo prettier. Corrigido o detector, o residual saltou de 219 para **653
> ocorrências em 163 arquivos**.
>
> **Rodada 2** (commit `c3cc3fd2`): 12 lotes disjuntos + 3 revisores adversariais em fatias
> distintas + 1 de consolidação. 158 arquivos, **1014 chaves novas**. Dicionário
> **1632 → 2654**, paridade perfeita. Prosa EN residual: **653 → 29**, e desses 29 a maioria
> é falso positivo do detector (linha de continuação de comentário `/* */`, alias de import
> tipo `Mail as Envelope`); os 6 reais foram fechados.
>
> A rodada 2 também achou dois defeitos **piores que "sobrou inglês"**, ambos introduzidos
> pelas próprias migrações: `t()` com **chave inexistente** (o i18next renderiza a chave crua
> na tela — o usuário via literalmente `chat_window.agents`), e um agente que traduziu o
> **segundo parâmetro do `showToast`**, que é o *tipo* do toast, não mensagem.
>
> **Por que esta errata existe no documento, e não só na mensagem do commit:** a revisão
> adversarial apontou, com razão, que a correção estava enterrada no `c3cc3fd2` enquanto o
> relatório canônico seguia publicando o número falso. Quem lê o doc não lê a mensagem de
> commit.


## 3. Substituições, por categoria


### Motion — 15 pares, 259 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `duration-300` | `duration-surface` | 168 |
| `duration-200` | `duration-control` | 46 |
| `duration-500` | `duration-slow` | 16 |
| `duration-300` | `duration-surface, ease-standard` | 4 |
| `ease-in-out` | `duration-surface, ease-standard` | 4 |
| `duration-300` | `border-static-white/5, duration-surface` | 4 |
| `duration-200` | `bg-static-black/70, duration-control` | 4 |
| `ease-in-out` | `ease-standard` | 3 |
| `duration-200` | `duration-control, hover:bg-static-white/10` | 3 |
| `duration-300` | `duration-surface, hover:border-static-white/60` | 2 |
| `duration-500` | `(removido)` | 1 |
| `duration-300` | `duration-surface, hover:bg-static-white/80` | 1 |
| `duration-500` | `duration-slow, max-h-s40` | 1 |
| `duration-200` | `(removido)` | 1 |
| `duration-150` | `duration-fast` | 1 |

### Translucido — 71 pares, 188 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `text-white/80` | `text-static-white/80` | 13 |
| `border-white/20` | `border-static-white/20` | 11 |
| `light:text-black/80` | `light:text-static-black/80` | 11 |
| `bg-white/10` | `bg-static-white/10` | 9 |
| `text-white/50` | `text-static-white/50` | 6 |
| `hover:bg-white/5` | `duration-fast, hover:bg-static-white/5` | 6 |
| `border-white/5` | `border-static-white/5` | 5 |
| `border-white/40` | `border-static-white/40` | 5 |
| `hover:bg-white/5` | `hover:bg-static-white/5` | 5 |
| `border-white/5` | `border-static-white/5, placeholder:text-static-white/20` | 5 |
| `placeholder:text-white/20` | `border-static-white/5, placeholder:text-static-white/20` | 5 |
| `border-white/5` | `border-static-white/5, duration-surface` | 4 |
| `bg-black/70` | `bg-static-black/70, duration-control` | 4 |
| `hover:bg-black/60` | `bg-static-black/70, duration-control` | 4 |
| `bg-black/30` | `bg-static-black/30, duration-fast` | 4 |
| `hover:bg-white/10` | `duration-fast, hover:bg-static-white/10` | 4 |
| `bg-white/10` | `bg-static-white/10, light:bg-static-black/10` | 3 |
| `light:bg-black/10` | `bg-static-white/10, light:bg-static-black/10` | 3 |
| `bg-white/10` | `bg-static-white/10, duration-fast` | 3 |
| `hover:bg-white/20` | `bg-static-white/10, duration-fast` | 3 |
| `hover:text-white/70` | `bg-static-white/10, duration-fast` | 3 |
| `light:bg-black/10` | `light:bg-static-black/10` | 3 |
| `text-white/40` | `text-static-white/40` | 3 |
| `text-white/70` | `text-static-white/70` | 3 |
| `hover:bg-white/10` | `duration-control, hover:bg-static-white/10` | 3 |
| _… e mais 46 pares_ | | |

### Outros — 17 pares, 27 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `text-sm` | `(removido)` | 5 |
| `text-content-danger` | `(removido)` | 4 |
| `text-content-primary` | `(removido)` | 2 |
| `border-none` | `(removido)` | 2 |
| `light:bg-theme-bg-sidebar` | `duration-surface, hover:bg-theme-bg-primary` | 2 |
| `text-theme-text-primary` | `(removido)` | 1 |
| `bg-static-white` | `(removido)` | 1 |
| `bg-theme-bg-sidebar` | `(removido)` | 1 |
| `border-2` | `(removido)` | 1 |
| `border-theme-sidebar-border` | `(removido)` | 1 |
| `light:border-none` | `(removido)` | 1 |
| `bg-[var(--theme-sidebar-thread-selected)]` | `bg-pink-lighter/16, border-pink-lighter` | 1 |
| `text-theme-text-primary` | `text-content-on-selected` | 1 |
| `light:hover:bg-surface-hover` | `gap-x-s12, px-s8` | 1 |
| `text-xs` | `mb-1` | 1 |
| `light:bg-theme-bg-sidebar` | `duration-surface, hover:bg-static-white/5` | 1 |
| `bg-theme-settings-input-bg` | `(removido)` | 1 |

### Escala/geometria — 11 pares, 12 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `rounded-lg` | `(removido)` | 2 |
| `rounded-hairline` | `(removido)` | 1 |
| `m-content` | `(removido)` | 1 |
| `p-s8` | `(removido)` | 1 |
| `rounded-overlay` | `(removido)` | 1 |
| `hover:bg-theme-sidebar-subitem-hover` | `gap-x-s12, px-s8` | 1 |
| `max-h-[24px]` | `duration-slow, max-h-s40` | 1 |
| `gap-x-1` | `(removido)` | 1 |
| `p-2` | `(removido)` | 1 |
| `m-2` | `bg-static-white/40, rounded-full` | 1 |
| `p-2.5` | `(removido)` | 1 |

### Azul->marca (selecao) — 4 pares, 6 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `light:text-content-info` | `text-content-secondary` | 3 |
| `light:bg-info/15` | `bg-pink-lighter/16, border-pink-lighter` | 1 |
| `light:text-content-info` | `text-content-on-selected` | 1 |
| `light:bg-info/15` | `gap-x-s12, px-s8` | 1 |
## 4. Os 4 itens visuais que o dono apontou olhando a tela

| Item | Causa real medida | Correção | Prova |
|---|---|---|---|
| "não tem a animação canônica em lugar algum" | `{isExpanded && hasChildren && <div>}` — **montagem condicional**. Não era animação lenta: não existia. | `grid 0fr→1fr` + `overflow-hidden`, 300ms `ease-standard` | 5 grids com `gridTemplateRows: 0px`, `transitionDuration: 0.3s` |
| "ícones desproporcionais ao texto" | lucide emite `stroke-width="2"` fixo, calibrado para ícone de 24px; aqui é ícone 20 com texto 14 | regra CSS em **1 ponto** (`stroke-width` é atributo de apresentação, CSS vence) — nenhum dos 25 ícones tocado | computed `stroke-width: 1.5px` |
| "imagem da faz capital pequena em largura" | **não era altura**: o gargalo era `max-w-[55%]` no container. Meu primeiro fix (24→40px) não mudou nada. | container 55% → 80%; e os 6 pontos de logo tinham 3 tratamentos distintos → padronizados | 156×25 → **197×32** |
| "não tem scroll bar momentâneo" | `.show-scrollbar` tinha track **opaco** + `opacity:1 !important; transition:none !important`; e as listas nem usavam a classe | `.scrollbar-subtle` com track transparente e thumb que escurece no hover, usando os tokens `--color-scrollbar-*` que já existiam e nunca foram consumidos | regra no CSS final |

## 5. Defeitos meus, corrigidos no caminho

| # | O que fiz de errado | Como apareceu |
|---|---|---|
| 1 | Migrei `duration-[200ms]` → `duration-control` sem `transitionDuration` na config. | **Classe morta**: não gerava regra nenhuma. Mesmo bug do `border-hairline`. Só apareceu ao grepar o CSS final. |
| 2 | Estado ativo com **rosa sólido**, inferido da descrição de um token. | A referência usa tint **16% + borda + texto rosa**, e para item de topo usa superfície **neutra**. Eu nunca abri `navConfig.ts`. |
| 3 | `data-sidebar` com `count=1` no regex. | Pegou só a branch **mobile**; a desktop ficou sem, então a regra do ícone não aplicava. Build verde. Só apareceu medindo `getComputedStyle`. |
| 4 | Primeiro fix do logo mexeu na altura. | Não adiantou nada — o gargalo era largura. Só apareceu medindo `getBoundingClientRect`. |
| 5 | Mantive filhos montados para animar. | Montado-e-invisível continua **focável e lido por screen-reader**. Fechado com `inert` + `aria-hidden` (5/5). |
| 6 | No workflow: cortei o JSON da síntese em 120k. | i18n comeu o orçamento; motion e cor **nunca chegaram** ao sintetizador. Reconstruí do journal. |

## 6. Achado que o merge de i18n barrou

`common.error_with_message` veio de dois agentes com interpolações diferentes — `{{message}}` num lote, `{{error}}` noutro. 
4 chamadas passavam `error` e 3 passavam `message`. Se tivesse mergeado assim, **4 telas exibiriam literalmente `Error: {{message}}`**. 
O merge trata colisão como erro (exit 1), não como aviso — por isso parou. Padronizado em `{{message}}`.


## 7. Verificação

| Prova | Resultado |
|---|---|
| `ds-gate` | **TOTAL 0**, exit 0 |
| `ds-pairs-check` | 12/12, exit 0 |
| `ds-dead-classes` | 0 mortas · 0 alphas sem canal · 0 pares órfãos |
| `parity.test.mjs` | 10 pass / 0 fail |
| `parity-with-source` | exit 0 |
| `keyframe-parity` | 12/12 idênticos |
| `yarn build` | exit 0 |
| `baseline.spec` | 8/8 (regravadas: a sidebar mudou de propósito) |
| i18n | en **2654** · pt_BR **2654** · 0 faltando · os 25 locales com paridade estrutural (`verifyTranslations.mjs` exit 0) |
| residual motion (escala Tailwind) | **0** |
| residual translúcido cru | **0** |
| `ui-evidence` | 34 PNGs, 17 rotas × 2 temas (`.claude/evidence/f4-final`) |

## 8. Pendências declaradas, não escondidas

- **16 usos de token de status como estado** (toggle ligado usando `success`, botão informativo usando `info-tint`). São defensáveis como semântica de status; errei 3× hoje inferindo semântica, então não inferi de novo.

- **50 strings puladas pelos agentes**, com motivo declarado: constantes de módulo sem componente ao redor, placeholders de URL, labels de `optgroup` vindos de dado.

- **Cobertura de evidência**: 17 rotas. Telas fora dessa matriz mudaram e não têm captura.
