# Inventário caso a caso dos 17 `semantic.*.surface.*`

> Classe `event` (`docs/SCHEMA.md` §2). Origem: pergunta do dono em 2026-07-28 —
> *"mas o que é surface.sunken e surface.panel?? utilizar surface não quer dizer
> absolutamente nada. pq isso está sendo utilizado??"*
>
> Este documento é **evidência, não proposta**. Não escolhe nomes novos nem
> decide papéis: mede o que existe, quem depende de quê, e o que colapsa.
> Nomear os papéis reais de superfície é decisão de design do dono.

Reprodutível: **`cd frontend && node tokens/inventory-surface.mjs`** — ferramenta
versionada no repo, que conta as **três vias** (classe Tailwind, `var()` em CSS e
props JS, alias no JSON) e trata `$root` como token.

> A v1 deste doc citava um script em `/tmp` que (a) morre no reboot e (b) ficou
> com o ponto cego do `$root` — rodá-lo **reproduzia os números errados**,
> contradizendo a correção do próprio documento que ele dizia sustentar.

**Medido em:** árvore de trabalho de 2026-07-28, após os 3 lotes de saneamento
(remoção de `hover-soft` e `app`, desacoplamento dos 85 component tokens).

## 1. A tabela

| token | light | dark | classe | `var()` | component | owners | propriedades |
|---|---|---|---:|---:|---:|---:|---|
| `hover` | `#EDECE8` | `#2E3238` | 337 | 0 | **0** | 141 | `bg` 337 |
| `panel` | `#FCFCFB` | `#21252B` | 44 | 13 | **0** | 21 | `bg` 44 |
| `elevated` | `#FCFCFB` | `#21252B` | 51 | 4 | **0** | 31 | `bg` 51 |
| `destructive-tint` | `#F6DFDF` | `#3A2226` | 26 | 4 | **0** | 20 | `bg` 26 |
| `canvas` | `#F9F9F7` | `#17191C` | 15 | 8 | **0** | 3 | `bg` 15 |
| **`sunken`** | `#F7F7F7` | `#2A2C32` | 0 | 22 | **0** | 0 | — |
| `selected` | `#E5E4E0` | `#3A3E44` | 14 | 0 | **0** | 8 | `bg` 8, `border` 6 |
| `selected-foreground` | `#F7F7F7` | `#21252B` | 8 | 0 | **0** | 2 | `text` 8 |
| `success-tint` | `#DDEBE4` | `#1C2F26` | 1 | 4 | **0** | 1 | `bg` 1 |
| `inset-inverse` | `#F7F7F7` | `#FFFFFF` | 4 | 0 | **0** | 4 | `bg` 4 |
| `deep` | `#F7F7F7` | `#0C0F14` | 0 | 3 | **0** | 0 | — |
| `warning-tint` | `#FEF0DA` | `#3A3226` | 1 | 2 | **0** | 1 | `bg` 1 |
| `raised` | `#FFFFFF` | `#282C32` | 0 | 2 | **0** | 0 | — |
| `emphasis` | `#E4E4E4` | `#27272A` | 0 | 2 | **0** | 0 | — |
| `info-tint` | `#DEE8FC` | `#1F2A3D` | 1 | 0 | **0** | 1 | `bg` 1 |

## 2. CORREÇÃO — a primeira versão desta seção estava errada

A v1 deste documento afirmou **"quatro tokens completamente mortos"**
(`raised`, `deep`, `emphasis`, `hover-soft`). **Falso.** A medição contava
consumo por **classe Tailwind** e por **alias no JSON**, e ignorava consumo por
`var(--color-*)` em CSS e em `style={{}}`.

Pego ao tentar deletá-los: a varredura pré-remoção encontrou consumidores vivos.

| token | classe | `var()` | component | vivo? |
|---|---:|---:|---:|---|
| `raised` | 0 | **2** | 0 | **sim** — `index.css:598`, `ReasoningEffort/index.jsx:165` |
| `deep` | 0 | **3** | 0 | **sim** — `index.css:368,369,474` |
| `emphasis` | 0 | **2** | 0 | **sim** — `HistoricalMessage/index.jsx:272`, `tailwind.config.js:43` |
| `hover-soft` | 0 | 0 | 0 | **MORTO** |
| `sunken` | 0 | **22** | 49 | sim (a v1 dizia 0 `var()`) |

**Morto de verdade: 1**, não 4.

`hover-soft` é o caso puro: **valor idêntico** a `hover` nos dois temas,
**descrição literalmente igual**, e zero consumidores de qualquer tipo.

> Este é o **terceiro** ponto cego da mesma família nesta sessão: a ferramenta de
> migração não via os alias do `tailwind.config.js` (`primary-button`, 682 usos),
> não via `var()` em props JSX, e o inventário não via `var()` em CSS. O padrão é
> sempre o mesmo — medir o consumo por UMA via e concluir sobre TODAS.
> Contagem de consumo agora exige as três vias: classe, `var()`, alias.

## 3. Três pares com valor exatamente igual

| par | light | dark |
|---|---|---|
| `canvas` == `app` | `#F9F9F7` | `#17191C` |
| `panel` == `elevated` | `#FCFCFB` | `#21252B` |
| `hover` == `hover-soft` | `#EDECE8` | `#2E3238` |

E as descrições confirmam a redundância:

- `canvas` = "Fundo do app" · `app` = "Fundo unico do produto: pagina, sidebar e
  area de conversa"
- `panel` = "Superficie elevada (painel, modal, popover, menu)" ·
  `elevated` = "Superficie elevada sobre o fundo do app: caixa do prompt,
  popover, painel" · `raised` = "Superfície temporária acima do conteúdo: menus,
  popovers" — **três nomes para a mesma frase**, um deles morto.

## 4. Valores distintos VIVOS: 10 (+4 tints)

> **Correção (auditoria r1):** a v1 desta seção dizia **7**, excluindo `raised`,
> `deep` e `emphasis` — que o §2 do MESMO documento provou vivos. Contradição
> interna, mesma família de erro da v1 do §2.

```
#F9F9F7 / #17191C   canvas   (app removido — era duplicata)
#FCFCFB / #21252B   panel, elevated
#F7F7F7 / #2A2C32   sunken
#EDECE8 / #2E3238   hover    (hover-soft removido — era duplicata)
#E5E4E0 / #3A3E44   selected
#F7F7F7 / #21252B   selected-foreground
#F7F7F7 / #FFFFFF   inset-inverse
#FFFFFF / #282C32   raised     (vivo via var())
#F7F7F7 / #0C0F14   deep       (vivo via var())
#E4E4E4 / #27272A   emphasis   (vivo via var())
+ 4 tints (destructive, info, success, warning)
```

> **Correção (auditoria r1):** a coluna `component` desta tabela foi medida com
> uma ferramenta que pulava nós `$root` (`k.startsWith("$")` trata `$root` como
> metadado, mas ele é um TOKEN — o valor base de um grupo que também tem
> variantes, DTCG 2025.10). Os números reais somam **85**, não 70: `sunken` 62
> (49 + 13 em `$root`), `elevated` 8 (6 + 2). **Quarta** instância da família
> "medir por uma via" neste mesmo trabalho. Todos os 85 foram desatados.

## 5. `sunken` era o eixo invisível — DESATADO em 2026-07-28

> Números corrigidos: eram **62** component tokens (49 visíveis + 13 em `$root`,
> que a ferramenta v1 pulava), não 49. Hoje: **0** — ver a coluna `component` da
> tabela do §1, toda zerada.

**Zero usos como classe. 62 component tokens dependiam dele**, cobrindo **17
owners que não compartilham papel nenhum**:

```
code-block · chat-message · button · progress · toggle · field · menu
list-row · search · card · checkbox · banner · avatar · toolbar
nav-item · badge · pill
```

É o H-021 do review do PR #193, literal: *"esses owners não compartilham papel
nenhum; compartilham, por enquanto e por acidente, um valor hex. No dia em que o
header do modal precisar de um escuro diferente do fundo da tabela, ALGUÉM vai
descobrir da pior forma que os dois estavam amarrados pelo mesmo token."*

Eram 17 donos amarrados a um fio, e o fio não aparecia em nenhuma busca por
classe — só quem abrisse o JSON o encontrava.

Os eixos, **antes** do desacoplamento (todos hoje em 0):

| token | component tokens | owners amarrados |
|---|---:|---|
| `sunken` | **62** (49 + 13 em `$root`) | os 17 acima |
| `elevated` | **8** (6 + 2 em `$root`) | sidebar, prompt, popover, checkbox |
| `hover` | 6 | code-block, avatar, toolbar, nav-item, badge, pill |
| `app` | 6 | app, sidebar, chatarea |
| `canvas` | 2 | button |
| `panel` | 1 | checkbox |

**Total desatado: 85.** Cada component token passou a referenciar o primitivo
direto, então mudar um owner não arrasta os outros 16.

## 6. `surface-hover`: 337 usos, 141 owners

O acoplamento mais largo do repo. Amostra dos donos:

```
ChangeWarning · AgentFlows · SlashCommands · SystemPrompts · PublishEntityModal
UnauthenticatedHubModal · ContextualSaveBar · DefaultChat · EmbedderItem
LMStudioOptions · ErrorBoundaryFallback · Footer · ImageLightbox · LLMItem
ConnectorOption … +117
```

## 7. Dois tokens cujo nome contradiz a propriedade

1. **`surface.selected-foreground`** — está no grupo `surface`, mas os 8 usos são
   `text`. É um papel de **conteúdo**, não de superfície. Valor `#F7F7F7` no
   light e `#21252B` no dark: inverte junto com a seleção.
2. **`surface.selected`** — o único consumido em **duas propriedades**: `bg` (8)
   e `border` (6). É a mesma promiscuidade de propriedade que o review do PR #193
   apontou no app-a, em escala menor.

## 8. O que este inventário não faz

Não propõe nomes. `canvas`, `panel`, `sunken`, `raised`, `deep`, `elevated`
descrevem **posição num eixo z**, não papel — dizem onde a cor está empilhada,
não para que serve. Trocá-los por outro conjunto de adjetivos sem decidir os
papéis reais repetiria o erro do PR #193 com outra assinatura.

Os números acima existem para que essa decisão seja tomada com o mapa na mão:

- **1 token** pode sair sem tocar em nada (`hover-soft`, morto nas 3 vias);
- **3 pares** colapsam sem mudar um pixel (valor idêntico);
- **`sunken`** era o nó (49 dependentes visíveis + 13 em `$root` = 62) — **desatado**;
- **`selected-foreground`** está no grupo errado (é texto);
- restam **10 valores vivos** (+4 tints) para os papéis reais de superfície.

## 9. Procedência

O grupo `surface.*` nasceu nos commits `6261447a`, `79610ac0` e `bb3d6ffa` —
todos meus, todos anunciados como correção de causa raiz. Importei para cá o
mesmo anti-padrão que o review do PR #193 condenou no app-a: renomeação de
valor apresentada como classificação semântica.
