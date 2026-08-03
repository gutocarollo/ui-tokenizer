# Relatório antes/depois — tokenização completa do design system

> ⛔ **VOCABULÁRIO SUPERADO EM 2026-07-31.** A coluna "Depois" deste relatório
> apresenta `content-*`, `surface-*` e `static-*` como DESTINO de migração —
> palavras hoje **BANIDAS** (`GRAMMAR.md` §2, §3.1) ou pigmento cru. Leia a tabela
> como MEDIÇÃO de 2026-07-26: esses nomes são a dívida que a lei mandou eliminar,
> nunca o alvo.

> Gerado do `git diff` (fonte completa, não de memória) em 2026-07-26.

> **Antes:** `a7606ec2` · **Depois:** working tree sobre `a7606ec2`.

> 327 arquivos, +4400 / −1459 linhas.


> ## ERRATA — publicada em 2026-07-27, após revisão adversarial
>
> Dois números deste relatório e do commit `372f827f` estão errados. Ficam registrados
> aqui porque mensagem de commit é história permanente e não dá para emendar.
>
> **1. O "antes" foi medido com a régua errada.** A manchete "943 → 0" usou a ERE **antiga**
> de `spacing-rhythm`, que não tinha guarda de fronteira e contava `after:top-[2px]` como se
> fosse `p-[2px]`. Medindo a mesma árvore `a7606ec2` com a régua **corrigida** — a mesma que
> mede o "depois" — o antes é **923**, não 943. Vinte daquelas linhas nunca foram dívida; o
> próprio commit as chama de "falso positivo inflando o ratchet" e mesmo assim manteve o 943
> na manchete. As outras 8 dimensões batem exatamente.
> **O número honesto da entrega é `923 → 0`.** Comparar antes e depois com réguas diferentes
> é a causa-raiz exata que esta auditoria existe para caçar, e eu caí nela.
>
> **2. "328 valores encaixados / 322 em ≤4px" não corresponde a artefato nenhum.** O
> `.claude/reports/antes-depois/ledger-f2f4.json`, commitado no MESMO commit, tem **279**
> entradas de spacing com desvio anotado: **273 em ≤4px** e **6 em 6px** (o `86px → 80px`).
> A distribuição da tabela do §4 bate 1:1 com o ledger; só a manchete não bate.
> **Os números corretos são 279 e 273.**
>
> **3. O cabeçalho omite uma exclusão.** "327 arquivos, +4.400/−1.459" só reproduz com
> `git diff a7606ec2..372f827f -- . ':(exclude)docs' ':(exclude).claude'`. O diff completo é
> 341 arquivos, +20.770/−1.459 — a diferença é doc e evidência. Os números são
> reproduzíveis, mas o texto dizia "git diff (fonte completa)" sem declarar o filtro.


## 1. Resultado do ratchet

| Dimensão | Antes | Depois | Δ |
|---|---:|---:|---:|
| `color-gray` | 4 | 0 | **−4** |
| `color-wb` | 266 | 0 | **−266** |
| `color-named` | 4 | 0 | **−4** |
| `color-hex` | 220 | 0 | **−220** |
| `typography-px` | 42 | 0 | **−42** |
| `spacing-rhythm` | 285 | 0 | **−285** |
| `radius-shadow` | 62 | 0 | **−62** |
| `zindex` | 59 | 0 | **−59** |
| `motion` | 1 | 0 | **−1** |
| **TOTAL** | **943** | **0** | **−943** |

**943 → 0.** O contador chegou a zero. Toda linha que sobrou está no `frontend/.ds-allowlist`, e cada entrada de lá declara por que aquele arquivo **não é nosso para editar**.


## 2. Todas as substituições, por categoria

289 pares distintos, 1112 ocorrências. Cada linha saiu do diff — o que sumiu de uma linha e o que entrou no lugar.


### Espaçamento — 70 pares, 244 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `gap-[36px]` | `gap-s36` | 70 |
| `md:ml-[2px]` | `md:ml-s2` | 43 |
| `p-[14px]` | `p-s12` | 9 |
| `mt-[18px]` | `mt-s16` | 9 |
| `md:pr-[50px]` | `md:pr-s48` | 6 |
| `p-[2px]` | `p-s2` | 5 |
| `p-[18px]` | `p-s16` | 5 |
| `md:ml-[2px]` | `light:bg-static-white, md:ml-s2` | 5 |
| `px-[10px]` | `px-s8` | 4 |
| `mr-[3px]` | `mr-s2` | 4 |
| `gap-[100px]` | `gap-s96, rounded-soft` | 4 |
| `pb-[60px]` | `pb-s56` | 3 |
| `md:ml-[2px]` | `md:ml-s2, z-element-active` | 3 |
| `md:ml-[2px]` | `md:ml-s2, md:rounded-balloon, p-s16` | 3 |
| `p-[18px]` | `md:ml-s2, md:rounded-balloon, p-s16` | 3 |
| `ml-[7px]` | `ml-s8` | 2 |
| `p-[18px]` | `p-s16, rounded-r-balloon` | 2 |
| `mt-[14px]` | `bg-[var(--color-border-hairline)], mt-s12` | 2 |
| `p-[10px]` | `border-2, p-s8` | 2 |
| `pt-[10px]` | `pt-s8` | 2 |
| `gap-[9px]` | `gap-s8` | 2 |
| `gap-[18px]` | `gap-s16, p-s16` | 2 |
| `p-[18px]` | `gap-s16, p-s16` | 2 |
| `ml-[28px]` | `ml-s28, mr-s24` | 2 |
| `mr-[26px]` | `ml-s28, mr-s24` | 2 |
| `pb-[18px]` | `pb-s16` | 2 |
| `px-[18px]` | `px-s16` | 2 |
| `mb-[55px]` | `mb-s56` | 2 |
| `mt-[29px]` | `mt-s28` | 1 |
| `mt-[10px]` | `mt-s8` | 1 |
| `px-[14px]` | `px-s12, py-s8` | 1 |
| `py-[7px]` | `px-s12, py-s8` | 1 |
| `mx-[20.5px]` | `mx-s20, my-s16` | 1 |
| `my-[18px]` | `mx-s20, my-s16` | 1 |
| `py-[2px]` | `hover:bg-[var(--color-static-white)]/10, light:hover:bg-[var(--color-static-black)]/10, py-s2` | 1 |
| `my-[18px]` | `my-s16` | 1 |
| `py-[5px]` | `bg-static-white, py-s4` | 1 |
| `gap-[5px]` | `gap-s4, px-s8` | 1 |
| `px-[10px]` | `gap-s4, px-s8` | 1 |
| `gap-[18px]` | `gap-s16` | 1 |
| `px-[14px]` | `light:bg-static-white, px-s12, py-s8` | 1 |
| `py-[10px]` | `light:bg-static-white, px-s12, py-s8` | 1 |
| `pb-[100px]` | `pb-s96` | 1 |
| `mt-[40px]` | `mt-s40, p-s2` | 1 |
| `p-[1px]` | `mt-s40, p-s2` | 1 |
| `mt-[72px]` | `mt-s72` | 1 |
| `md:pl-[57px]` | `md:pl-s56, mt-2` | 1 |
| `gap-[15px]` | `gap-2.5, p-s16` | 1 |
| `pt-[20px]` | `pt-s20` | 1 |
| `gap-[2px]` | `gap-s2` | 1 |
| `gap-[2px]` | `gap-s2, pl-s20, text-caption` | 1 |
| `pl-[22px]` | `gap-s2, pl-s20, text-caption` | 1 |
| `mt-[72px]` | `light:bg-static-white, mt-s72` | 1 |
| `py-[18px]` | `py-s16` | 1 |
| `pl-[30px]` | `pl-s28` | 1 |
| `gap-[2px]` | `mt-s2, text-label` | 1 |
| `gap-[2px]` | `text-body` | 1 |
| `gap-[2px]` | `mt-s2, text-body-lg` | 1 |
| `pb-[200px]` | `pb-s200` | 1 |
| `p-[35px]` | `p-s36` | 1 |
| _… e mais 10 pares_ | | |

### Branco / preto — 69 pares, 474 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `text-white/60` | `text-content-inverse/60` | 101 |
| `border-white/10` | `border-content-inverse/10` | 53 |
| `light:bg-white` | `light:bg-static-white` | 44 |
| `text-white` | `text-content-inverse` | 31 |
| `bg-white` | `bg-static-white, text-static-black` | 30 |
| `text-black` | `bg-static-white, text-static-black` | 30 |
| `bg-black` | `bg-static-black` | 26 |
| `hover:text-white` | `hover:text-content-inverse, shadow-md` | 14 |
| `border-white/10` | `md:pl-6, md:pr-s48, md:py-6` | 14 |
| `bg-white` | `bg-static-white` | 10 |
| `border-white` | `border-static-white` | 9 |
| `hover:bg-white` | `hover:bg-surface-destructive-tint` | 9 |
| `border-white` | `md:pl-6, md:pr-s48, md:py-6` | 7 |
| `bg-white` | `bg-static-white, rounded-hairline` | 5 |
| `bg-white` | `bg-static-white, light:bg-[var(--color-blue-lightest)], light:hover:bg-[var(--color-ui-link-on-tint)]` | 5 |
| `bg-white` | `bg-surface-info-tint` | 5 |
| `border-white` | `md:pl-6, md:pr-s80, md:py-6` | 5 |
| `light:bg-white` | `light:bg-static-white, md:ml-s2` | 5 |
| `border-white` | `border-border-inverse` | 4 |
| `stroke-white` | `stroke-static-white` | 3 |
| `bg-white` | `bg-surface-inset-inverse` | 3 |
| `text-white/60` | `mt-1, text-content-inverse/60` | 3 |
| `text-white/60` | `disabled:bg-[var(--color-grey-darker)], text-content-inverse/60` | 3 |
| `light:hover:text-black` | `light:hover:text-static-black` | 3 |
| `light:bg-white` | `bg-theme-modal-border, light:bg-[var(--color-blue-lightest)], light:text-[var(--color-ui-link-on-tint)]` | 2 |
| `text-white/20` | `bg-theme-modal-border, light:bg-[var(--color-blue-lightest)], light:text-[var(--color-ui-link-on-tint)]` | 2 |
| `light:text-black` | `light:text-static-black` | 2 |
| `hover:text-white` | `hover:text-content-inverse` | 2 |
| `border-white` | `border-static-white, light:border-static-black` | 2 |
| `light:border-black` | `border-static-white, light:border-static-black` | 2 |
| `hover:bg-white` | `hover:bg-static-white` | 2 |
| `text-white/60` | `text-content-inverse/60, text-label` | 1 |
| `light:text-black` | `(removido)` | 1 |
| `text-white` | `duration-control` | 1 |
| `text-black` | `text-content-tertiary-inverse` | 1 |
| `bg-white` | `bg-static-white, py-s4` | 1 |
| `border-white` | `border-static-white, light:bg-[var(--color-blue-lightest)], light:border-[var(--color-content-disabled)]` | 1 |
| `bg-white` | `bg-surface-inset-inverse, light:border-static-white` | 1 |
| `light:border-white` | `bg-surface-inset-inverse, light:border-static-white` | 1 |
| `text-black` | `text-static-black` | 1 |
| `light:border-white` | `light:border-static-white` | 1 |
| `light:bg-white` | `light:bg-static-white, px-s12, py-s8` | 1 |
| `text-white` | `light:bg-static-white, px-s12, py-s8` | 1 |
| `border-white/10` | `border-content-inverse/10, text-content-inverse` | 1 |
| `text-white` | `border-content-inverse/10, text-content-inverse` | 1 |
| `border-white` | `border-4, border-static-white, light:bg-ui-dnd-overlay/90` | 1 |
| `hover:bg-white` | `hover:bg-surface-panel` | 1 |
| `bg-white` | `bg-static-white, text-micro, text-static-black` | 1 |
| `text-black` | `bg-static-white, text-micro, text-static-black` | 1 |
| `light:bg-white` | `light:bg-static-white, rounded-bubble` | 1 |
| `light:bg-white` | `light:bg-static-white, mt-s72` | 1 |
| `after:bg-white` | `after:bg-static-white` | 1 |
| `text-white;` | `text-body, text-static-white;` | 1 |
| `light:text-white` | `light:text-static-white, text-static-black` | 1 |
| `text-black` | `light:text-static-white, text-static-black` | 1 |
| `enabled:hover:text-white` | `enabled:hover:text-content-inverse` | 1 |
| `hover:bg-white` | `hover:bg-surface-warning-tint` | 1 |
| `border-white/10` | `border-content-inverse/10, light:border-[var(--color-ui-link-on-tint)]/10` | 1 |
| `border-white` | `md:px-6, md:py-6, px-1` | 1 |
| `hover:bg-white` | `hover:bg-surface-success-tint` | 1 |
| _… e mais 9 pares_ | | |

### Hex cru — 20 pares, 44 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `light:bg-[#E0F2FE]` | `bg-static-white, light:bg-[var(--color-blue-lightest)], light:hover:bg-[var(--color-ui-link-on-tint)]` | 5 |
| `light:hover:bg-[#026AA2]` | `bg-static-white, light:bg-[var(--color-blue-lightest)], light:hover:bg-[var(--color-ui-link-on-tint)]` | 5 |
| `light:text-[#026AA2]` | `bg-static-white, light:bg-[var(--color-blue-lightest)], light:hover:bg-[var(--color-ui-link-on-tint)]` | 5 |
| `text-[#FFF]` | `text-[var(--color-static-white)]` | 4 |
| `text-[#FFFFFF]` | `text-[var(--color-checkbox-checkmark)]` | 3 |
| `disabled:bg-[#687280]` | `disabled:bg-[var(--color-grey-darker)], text-content-inverse/60` | 3 |
| `light:text-[#0ba5ec]` | `light:text-[var(--color-ui-accent-sky)]` | 2 |
| `light:hover:bg-[#E0F2FE]` | `bg-theme-modal-border, light:bg-[var(--color-blue-lightest)], light:text-[var(--color-ui-link-on-tint)]` | 2 |
| `light:text-[#535862]` | `bg-theme-modal-border, light:bg-[var(--color-blue-lightest)], light:text-[var(--color-ui-link-on-tint)]` | 2 |
| `bg-[#3D4147]` | `bg-[var(--color-border-hairline)], mt-s12` | 2 |
| `hover:bg-[#3D4147]` | `hover:bg-[var(--color-border-hairline)]` | 2 |
| `light:text-[#026AA2]` | `light:text-[var(--color-ui-link-on-tint)]` | 1 |
| `light:bg-[#E0F2FE]` | `light:bg-[var(--color-blue-lightest)]` | 1 |
| `hover:bg-[#FFF]/10` | `hover:bg-[var(--color-static-white)]/10, light:hover:bg-[var(--color-static-black)]/10, py-s2` | 1 |
| `light:hover:bg-[#000]/10` | `hover:bg-[var(--color-static-white)]/10, light:hover:bg-[var(--color-static-black)]/10, py-s2` | 1 |
| `light:bg-[#E0F2FE]` | `border-static-white, light:bg-[var(--color-blue-lightest)], light:border-[var(--color-content-disabled)]` | 1 |
| `light:bg-[#C2E7FE]/90` | `border-4, border-static-white, light:bg-ui-dnd-overlay/90` | 1 |
| `text-[#F4FFD0]` | `bg-[var(--color-ui-accent-lime)]/10, gap-x-1, light:bg-info/15` | 1 |
| `bg-[#6CE9A6]` | `border-[var(--color-ui-status-online-ring)]` | 1 |
| `bg-[#00ADEC]` | `bg-ui-brand-telegram` | 1 |

### Tipografia — 19 pares, 35 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `text-[10px]` | `text-caption` | 13 |
| `text-[14px]` | `text-body` | 4 |
| `text-[38px]` | `text-display-lg` | 2 |
| `text-[12px]` | `text-content-inverse/60, text-label` | 1 |
| `text-[16px]` | `text-display-sm` | 1 |
| `text-[8px]` | `bg-static-white, text-micro, text-static-black` | 1 |
| `text-[13px]` | `text-label-sm` | 1 |
| `text-[16px]` | `text-body-lg` | 1 |
| `text-[8px]` | `text-micro` | 1 |
| `text-[10px]` | `gap-s2, pl-s20, text-caption` | 1 |
| `text-[12px]` | `text-label` | 1 |
| `text-[18px]` | `text-title` | 1 |
| `text-[14px]` | `text-body, text-static-white;` | 1 |
| `text-[12px]` | `bg-[var(--color-ui-accent-lime)]/10, gap-x-1, light:bg-info/15` | 1 |
| `text-[11px]` | `text-caption-lg` | 1 |
| `text-[10px]` | `bg-premium/20, text-caption, text-content-primary` | 1 |
| `lg:text-[160px]` | `lg:text-hero-xl, md:text-hero, text-display-xl` | 1 |
| `md:text-[96px]` | `lg:text-hero-xl, md:text-hero, text-display-xl` | 1 |
| `text-[64px]` | `lg:text-hero-xl, md:text-hero, text-display-xl` | 1 |

### Raio / sombra / borda — 31 pares, 79 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `shadow-[0_4px_14px_rgba(0,0,0,0.25)]` | `hover:text-content-inverse, shadow-md` | 14 |
| `border-[#9CA3AF]` | `border-[var(--color-grey-dark)]` | 9 |
| `border-[1px]` | `border-static-white` | 5 |
| `rounded-[2px]` | `bg-static-white, rounded-hairline` | 5 |
| `border-[1.5px]` | `border-hairline, shadow-md, z-tooltip` | 4 |
| `shadow-[0_4px_14px_rgba(0,0,0,0.25)]` | `border-hairline, shadow-md, z-tooltip` | 4 |
| `rounded-[10px]` | `gap-s96, rounded-soft` | 4 |
| `md:rounded-[26px]` | `md:ml-s2, md:rounded-balloon, p-s16` | 3 |
| `rounded-r-[26px]` | `p-s16, rounded-r-balloon` | 2 |
| `border-[2px]` | `border-2, p-s8` | 2 |
| `rounded-b-[16px]` | `rounded-b-overlay` | 2 |
| `rounded-[20px]` | `rounded-bubble` | 2 |
| `rounded-[3px]` | `rounded-fine` | 2 |
| `shadow-[0_4px_14px_rgba(0,0,0,0.25)]` | `shadow-md` | 2 |
| `border-[1px]` | `(removido)` | 2 |
| `rounded-t-md` | `light:border-default, light:border-solid, rounded-lg` | 2 |
| `light:border-[1px]` | `md:ml-s2` | 1 |
| `border-[2px]` | `border-2, light:border-[var(--color-content-disabled)]` | 1 |
| `light:border-[#686C6F]` | `border-2, light:border-[var(--color-content-disabled)]` | 1 |
| `rounded-[6px]` | `rounded-fine` | 1 |
| `light:border-[1px]` | `(removido)` | 1 |
| `rounded-checkbox` | `duration-control` | 1 |
| `rounded-br-[26px]` | `rounded-br-balloon, z-tooltip` | 1 |
| `light:border-[#686C6F]` | `border-static-white, light:bg-[var(--color-blue-lightest)], light:border-[var(--color-content-disabled)]` | 1 |
| `border-[4px]` | `border-4, border-static-white, light:bg-ui-dnd-overlay/90` | 1 |
| `rounded-[20px]` | `light:bg-static-white, rounded-bubble` | 1 |
| `light:border-[#026AA2]/10` | `border-content-inverse/10, light:border-[var(--color-ui-link-on-tint)]/10` | 1 |
| `shadow-[0px_4px_12px_0px_rgba(0,0,0,0.35)]` | `light:bg-static-white, shadow-md` | 1 |
| `rounded-[100px]` | `rounded-pill, text-content-inverse` | 1 |
| `border-[1px]` | `border-static-white, light:border-static-black` | 1 |
| `rounded-[2px]` | `bg-static-white, light:bg-static-black, rounded-hairline` | 1 |

### Z-index — 10 pares, 54 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `z-99` | `z-tooltip` | 38 |
| `z-99` | `border-hairline, shadow-md, z-tooltip` | 4 |
| `z-[2]` | `md:ml-s2, z-element-active` | 3 |
| `z-[999]` | `z-preview` | 2 |
| `z-40` | `z-popover` | 2 |
| `z-29` | `z-item-control-low` | 1 |
| `z-999999` | `z-toast` | 1 |
| `z-[1]` | `border-b-2, border-border-info-inverse, border-l-2` | 1 |
| `z-[1]` | `border-border-info-inverse, border-l-2, z-element-active` | 1 |
| `z-99` | `rounded-br-balloon, z-tooltip` | 1 |

### Cinza nomeado — 2 pares, 4 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `bg-stone-800` | `light:border-default, light:border-solid, rounded-lg` | 2 |
| `text-slate-200` | `light:border-default, light:border-solid, rounded-lg` | 2 |

### Cor nomeada — 6 pares, 6 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `bg-fuchsia-500/20` | `bg-premium/20, text-caption, text-content-primary` | 1 |
| `light:bg-fuchsia-100` | `bg-premium/20, text-caption, text-content-primary` | 1 |
| `light:text-fuchsia-700` | `bg-premium/20, text-caption, text-content-primary` | 1 |
| `text-fuchsia-400` | `bg-premium/20, text-caption, text-content-primary` | 1 |
| `light:text-fuchsia-500` | `text-content-primary` | 1 |
| `text-fuchsia-400` | `text-content-primary` | 1 |

### Outros — 62 pares, 172 ocorrências

| Antes | Depois | Ocorrências |
|---|---|---:|
| `border-b-2` | `md:pl-6, md:pr-s48, md:py-6` | 21 |
| `pb-6` | `md:pl-6, md:pr-s48, md:py-6` | 20 |
| `gap-y-1` | `md:pl-6, md:pr-s48, md:py-6` | 19 |
| `hover:light:bg-destructive/15` | `hover:bg-surface-destructive-tint` | 9 |
| `border-opacity-10` | `md:pl-6, md:pr-s48, md:py-6` | 7 |
| `light:border-theme-sidebar-border` | `md:pl-6, md:pr-s48, md:py-6` | 7 |
| `border-b-2` | `md:pl-6, md:pr-s80, md:py-6` | 5 |
| `border-opacity-10` | `md:pl-6, md:pr-s80, md:py-6` | 5 |
| `gap-y-1` | `md:pl-6, md:pr-s80, md:py-6` | 5 |
| `light:border-theme-sidebar-border` | `md:pl-6, md:pr-s80, md:py-6` | 5 |
| `pb-6` | `md:pl-6, md:pr-s80, md:py-6` | 5 |
| `light:bg-info/15` | `bg-surface-info-tint` | 4 |
| `light:bg-surface-sunken` | `bg-surface-inset-inverse` | 3 |
| `mt-4` | `mt-1, text-content-inverse/60` | 3 |
| `hover:text-content-primary` | `bg-theme-modal-border, light:bg-[var(--color-blue-lightest)], light:text-[var(--color-ui-link-on-tint)]` | 2 |
| `light:border-border-default` | `md:pl-6, md:pr-s48, md:py-6` | 2 |
| `light:border-theme-sidebar-border` | `border-border-inverse` | 2 |
| `px-4` | `light:border-default, light:border-solid, rounded-lg` | 2 |
| `py-2` | `light:border-default, light:border-solid, rounded-lg` | 2 |
| `text-xs` | `light:border-default, light:border-solid, rounded-lg` | 2 |
| `text-xs` | `text-[var(--color-checkbox-checkmark)]` | 1 |
| `light:border-theme-modal-border` | `border-border-inverse` | 1 |
| `light:bg-info` | `bg-surface-info-tint` | 1 |
| `text-content-primary` | `(removido)` | 1 |
| `border-b` | `border-b-2, border-border-info-inverse, border-l-2` | 1 |
| `border-border-default` | `border-b-2, border-border-info-inverse, border-l-2` | 1 |
| `border-l` | `border-b-2, border-border-info-inverse, border-l-2` | 1 |
| `border-border-default` | `border-border-info-inverse, border-l-2, z-element-active` | 1 |
| `border-l` | `border-border-info-inverse, border-l-2, z-element-active` | 1 |
| `gap-x-2` | `duration-control` | 1 |
| `pl-element` | `duration-control` | 1 |
| `pr-control` | `duration-control` | 1 |
| `py-control` | `duration-control` | 1 |
| `light:text-content-tertiary` | `text-content-tertiary-inverse` | 1 |
| `light:bg-surface-sunken` | `bg-surface-inset-inverse, light:border-static-white` | 1 |
| `light:text-content-primary` | `hover:text-content-inverse` | 1 |
| `light:text-content-primary` | `light:bg-static-white, px-s12, py-s8` | 1 |
| `text-center` | `text-display-sm` | 1 |
| `light:bg-surface-panel` | `hover:bg-surface-panel` | 1 |
| `mx-auto` | `md:pl-s56, mt-2` | 1 |
| `light:text-content-info` | `bg-[var(--color-ui-accent-lime)]/10, gap-x-1, light:bg-info/15` | 1 |
| `hover:light:bg-warning/15` | `hover:bg-surface-warning-tint` | 1 |
| `border-b-2` | `md:px-6, md:py-6, px-1` | 1 |
| `border-opacity-10` | `md:px-6, md:py-6, px-1` | 1 |
| `gap-y-1` | `md:px-6, md:py-6, px-1` | 1 |
| `light:border-theme-sidebar-border` | `md:px-6, md:py-6, px-1` | 1 |
| `pb-6` | `md:px-6, md:py-6, px-1` | 1 |
| `pb-4` | `md:pl-6, md:pr-s48, md:py-6` | 1 |
| `hover:light:bg-success/15` | `hover:bg-surface-success-tint` | 1 |
| `gap-y-2` | `md:pl-6, md:pr-s48, md:py-6` | 1 |
| `light:text-content-primary` | `text-content-inverse` | 1 |
| `gap-x-4` | `md:pl-6, md:pr-s48, md:py-6` | 1 |
| `border-b-2` | `md:pl-6, md:pr-s48, md:pt-6` | 1 |
| `border-opacity-10` | `md:pl-6, md:pr-s48, md:pt-6` | 1 |
| `light:border-theme-sidebar-border` | `md:pl-6, md:pr-s48, md:pt-6` | 1 |
| `py-4` | `md:pl-6, md:pr-s48, md:pt-6` | 1 |
| `text-lg` | `md:pl-6, md:pr-s48, md:pt-6` | 1 |
| `text-theme-text-primary` | `md:pl-6, md:pr-s48, md:pt-6` | 1 |
| `text-sm` | `py-1, text-content-inverse/60, text-xs` | 1 |
| `light:border-theme-chat-input-border` | `border-border-inverse` | 1 |
| _… e mais 2 pares_ | | |
## 3. Tokens criados (108, todos declarados no `EXCEPTIONS.json`)

| Grupo | Tokens | Por que existe |
|---|---:|---|
| `static.*` | 7 | Torna a invariância **auditável**: um grep por `static-` lista todo lugar que ignora o tema de propósito. Antes era `bg-white` cru, indistinguível de esquecimento. |
| `ui.*` | 61 | Tier 3 (`index.css`), paleta legada do upstream e cores de marca de terceiro (Telegram). |
| `chart.*` | 22 | Escala **categórica** de dataviz (origem Tremor). Invariante por tema de propósito: trocar hue por tema quebra a leitura de séries entre modos. |
| `*-inverse` / `*-tint` | 18 | Colapsam o par `X-white light:X-Y` num token só que carrega os DOIS lados. |

Além desses, o tier `system` ganhou: **20 rungs** de espaçamento (grade de 4px), **10** papéis tipográficos, **7** de raio, **4** de z-index, o tier **`borderWidth`** (não existia) e o utilitário **`boxShadow`** (os tokens existiam mas nunca eram emitidos como classe).


## 4. Mudanças de design assumidas (não são equivalência exata)

O encaixe na grade de 4px é **mudança de design**, não refatoração neutra. Desvios medidos:

| Desvio | Ocorrências | % |
|---|---:|---:|
| 0px | 144 | 51.6% |
| 0.5px | 3 | 1.1% |
| 1px | 24 | 8.6% |
| 2px | 94 | 33.7% |
| 4px | 8 | 2.9% |
| 6px | 6 | 2.2% |

**279 encaixes** no total. O maior desvio é **6px** (`86px → 80px`, 6 ocorrências); todo o resto fica em ≤4px. A prova de que não quebrou nada é o pixel, não este número: ver §6.


**Outras trocas com efeito visual declarado:**

- `shadow-[0_4px_14px_rgba(0,0,0,0.25)]` (26×) → `shadow-md` (`0px 4px 12px rgba(0,0,0,0.28)`): blur 14→12px, alpha 0,25→0,28.

- 40 hex sem token de valor idêntico foram aproximados ao token mais próximo com **ΔE ≤ 12** (registro por ocorrência em `ledger-hex.json`). Alguns caíram em token de papel diferente (ex.: um fundo consumindo `border-hairline`) — visualmente correto, semanticamente impreciso, **pendência declarada**.


## 5. Bugs que EU introduzi durante a migração e corrigi

Registrados porque são o custo real de uma migração desta escala, e porque dois deles só apareceram por verificação — não por revisão de código.

| # | O que fiz de errado | Como apareceu | Correção |
|---|---|---|---|
| 1 | Migrei `text-white` → `text-static-white` (branco nos 2 temas). | O `index.css` tinha um **shim global** `[data-theme="light"] .text-white { color: var(--theme-text-primary) }` — a classe crua **já era theme-aware**. O oráculo mediu **1.00:1 no light** (branco sobre branco). | 49 ocorrências → `text-content-inverse`; depois o shim foi removido junto com os 184 usos de `/60` e `/10`. |
| 2 | Apaguei **64** classes `light:X-white` achando que eram par redundante. | O lookbehind `(?<![a-z-])` casa **dentro** de `light:bg-white` (o char anterior é `:`), então tratei a variante de tema como classe base. Zero eram redundantes de fato. | Restauradas as 64 na forma tokenizada, comparando linha a linha com o `HEAD`. |
| 3 | Ao restaurar, injetei a classe logo após `className={`, fora da string. | Build quebrou: `Expected "}" but found ":"`. | 6 inserções reposicionadas para dentro do template literal. |
| 4 | Mapeei `border-[1.5px]` → `border-hairline`, classe que **não existe** no Tailwind. | A borda sumiria sem erro de build (classe desconhecida é ignorada). | Criado o tier `borderWidth`; provado com a regra `.border-hairline{border-width:var(--border-width-hairline)}` no CSS final. |
| 5 | Substituí hex dentro do `PINK_FALLBACK` do AuthScene. | O fallback existe justamente para quando `var()` não resolve; virou `var()` dentro do fallback. | Restaurado para literais e o arquivo declarado no allowlist com a razão. |
| 6 | Usei `--color-static-white-rgb` sem o canal existir. | Regra emitiria cor inválida. | Grupo `static` adicionado ao `ALPHA_GROUPS`; 16 usos válidos no CSS final. |

## 6. Verificação

| Prova | Resultado |
|---|---|
| `ds-gate` | **TOTAL 0**, exit 0 |
| `ds-pairs-check` | 12/12 pares, exit 0 |
| `ds-dead-classes` | 0 mortas · 0 alphas sem canal · 0 pares órfãos |
| `parity.test.mjs` | 10 pass / 0 fail |
| `parity-with-source` | exit 0 (108 adições declaradas nominalmente) |
| `keyframe-parity` | 12/12 keyframes idênticos |
| `yarn build` | exit 0 |
| `baseline.spec` | 8/8 baselines commitadas |
| `ui-evidence` | 32 PNGs, 16 rotas × 2 temas (`.claude/evidence/depois-zerado`) |

As 8 baselines foram **regravadas de propósito**: o encaixe de espaçamento desloca o layout em poucos px, o que estoura o limite de 1% do comparador. Antes de regravar eu olhei o `actual` e o `diff`: o deslocamento é vertical e uniforme, sem quebra de cor, contraste ou layout.


## 7. O que ficou de fora, e por quê

Nada foi varrido para debaixo do tapete: as exclusões estão em `frontend/.ds-allowlist`, com razão por entrada.

| Arquivo | Razão |
|---|---|
| `public/embed/*` | Bundle **minificado** de terceiro, gerado por outro build. A correção certa é rebuildar o widget da fonte, não editar minificado. |
| `src/utils/chat/themes/github*.css` | Esquemas de cor do **highlight.js**, onde cada hex tem significado sintático (keyword/string/comentário). Tokenizar destruiria o tema e a paridade com o upstream. |
| `Login/Azure/SignInButton.jsx` | Logo da **Microsoft**. As 4 cores são marca registrada e as diretrizes proíbem alterá-las. |
| `OnboardingFlow/.../OnboardingLogoSVG.jsx` | Arte de marca (stops de gradiente do símbolo). |
| `Login/Azure/config.js` | Fallback SSR/jsdom da paleta que **já vem dos tokens em runtime**; removê-lo deixaria o canvas sem cor no teste. |

## 8. Pendência de qualidade (declarada, não escondida)

- **Aproximações ΔE ≤ 12**: 24 ocorrências ficaram em token de papel diferente do ideal. Vale uma passada semântica arquivo a arquivo.

- **Rungs `sN`**: os nomes de espaçamento são **numéricos** de propósito (`gap-s36`), não semânticos. Inventar papel para `gap-[86px]` seria semântica falsa; a promoção para nome por papel deve vir do design, não de mim.

- **Cobertura de evidência**: 16 rotas. Telas fora dessa matriz (chat com gráfico, onboarding, modais profundos) mudaram e **não têm captura**.
