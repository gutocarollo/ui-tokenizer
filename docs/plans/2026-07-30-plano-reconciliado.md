# Plano reconciliado — o projeto real

> **Por que este documento existe.** O plano vigente
> (`2026-07-30-v2-upstream-como-oraculo-rev2.md`) descreve *"o compilador do
> Tailwind como oráculo de equivalência de utility"*, fases F0–F9. O código
> construído desde então é um *pipeline de naming de token de cor*. Medido:
> **0 hits** no plano para `cluster de contexto`, `convergência`, `lei de
> naming`, `ΔE`, `fila humana`. Documento e código descreviam projetos
> diferentes, e eu reportava execução contra o que tinha na cabeça.
>
> A causa é rastreável: o dono redirecionou o escopo cinco vezes e eu nunca
> reescrevi o plano — falha do §14.5 (*"padrão decidido na execução é
> incorporado ao doc de planejamento"*). Este documento fecha isso.

Status: **vigente**. Supersede o rev2 como plano-mestre; o rev2 permanece válido
como **especificação do eixo B** (§3.2).

---

## 1. O objetivo, e o critério que reprova o estado atual

Tokenizar o design system de um frontend artesanal: **cada decisão visual com um
contrato nomeado**, provada no pixel.

O contrato do pedido ancorado é explícito sobre o que **não** conta:

> *Full success means the actual frontend satisfies the absolute completion
> predicates; **a green ratchet or a completed control plane alone is
> insufficient.***

Control plane completo é exatamente o que existe hoje. Por esse critério,
**estamos reprovados** — e o plano abaixo existe para sair disso.

---

## 2. O universo medido

Alvo: `/home/augusto/code/makers-ai-hub/frontend`. Todos os números são de
medição desta sessão, não estimativa.

### 2.1 Vetores de estilo — todos, não só `className`

| vetor | volume | observação |
|---|---:|---|
| `className` | 6.412 atributos → **32.662 usos de classe** | 98,9% da superfície |
| `style={{ }}` inline | **158** | `calc()`, `maxHeight`, `objectFit`, alturas condicionais |
| `src/index.css` à mão | **1.695 linhas** | 283 `var(--token)` · **28 cores cravadas** · **172 px** (31 distintos) |
| CSS gerado de token | 1.348 linhas | saída, não entrada |
| `styled-components`·`cva`·`clsx`·`twMerge`·`sx`·CSS modules | **0** | não usados |

**`className` domina, mas volume não é o critério.** Um `style={{ color:'#fff' }}`
não é 1/32.662 do problema — é um ponto que **contorna o sistema inteiro** e não
aparece em gate nenhum. Normalizar os outros vetores muda pouco o percentual e
fecha vazamento.

### 2.2 Onde estamos

| | |
|---:|---|
| já passa por contrato nomeado | **5.852** (17,9%) |
| utility cru | **26.810** (82,1%) |
| **o loop trata hoje** | **504** (**1,5%**) |

Top utilities crus: `flex` 2286 · `text-sm` 1440 · `w-full` 1310 · `flex-col`
1086 · `items-center` 1017 · `rounded-lg` 855 · `block` 770 · `border-none` 635.

### 2.3 O teto, com memorial

Dois caminhos de cobertura, que **somam**:

**A) Entidade canônica** — bundle de classes que se repete vira componente
nomeado; aí *todas* as suas classes, inclusive `flex` e `w-full`, passam a viver
dentro de um contrato.

| bundle repete | entidades | cobre |
|---|---:|---:|
| ≥ 2× | 739 | **22.507 usos · 68,9%** |
| ≥ 5× | 250 | 16.276 · 49,8% |
| ≥ 20× | 41 | 9.108 · 27,9% |

**B) Token em bundle único** — sobram 10.155 usos (31,1%) em bundles que
aparecem uma vez. Destes, **4.091 (12,5%)** são família tokenizável (cor,
spacing, radius, tipografia).

```
A 68,9%  +  B 12,5%  =  TETO 81,4%
```

**O que fica de fora, por design: 6.064 usos (18,6%)** — `flex`, `absolute`,
`w-full`, `z-10` em bundles que aparecem **uma única vez**. Tokenizar `flex` é
anti-padrão (composição, não decisão de design) e sem repetição não há evidência
de padrão. Forçar esses 18,6% para bater 90% seria **inventar contrato onde não
há padrão** — o defeito oposto ao que corrigimos.

### 2.4 Contrato de metas

| | valor | natureza |
|---|---:|---|
| meta **bloqueante** | **68,9%** | medido (entidades ≥2×). Não atingir = falha |
| **teto** declarado | **81,4%** | alvo, não promessa |
| fora de escopo declarado | 18,6% | utility de composição sem padrão |

> **>90% não é atingível sob definição honesta.** O caminho existiria — refatorar
> o app para reduzir bundles únicos — mas isso é mudar o código-fonte além de
> nomear, escopo diferente e muito maior, fora deste plano.

---

## 3. Os dois eixos

O projeto tem dois eixos que nunca foram integrados. Este é o defeito central que
o plano corrige.

### 3.1 Eixo A — naming por contexto (construído, não aplicado)

Decide **de quem é** cada decisão visual. `surface-hover` (336 usos) vira 11
contratos porque o contexto difere: `<button>` em `Directory` ≠ `<tr>` em
`FileRow`.

Implementado: censo → cluster de contexto → convergência → relatório → fila
humana. **Não implementado:** escrever o token, provar no CSS buildado, aplicar.

### 3.2 Eixo B — normalização de utility (especificado, não construído)

Decide **o que é a mesma coisa**. `gap-2 px-2 mb-3` ≡ `px-2 gap-2 mb-3`;
`pl-2 pr-2` ≡ `px-2`; `p-2 px-1` ≡ `py-2 px-1` por sobreposição de cascata.

Especificação normativa: **`2026-07-30-v2-upstream-como-oraculo-rev2.md`**, cujo
achado central se mantém — o colapso de cascata **já vem oficialmente** em
`@tailwindcss/node` via `canonicalizeCandidates`; a alegação de "lacuna do
ecossistema" foi retratada.

**Por que B vem antes de A na entidade canônica:** sem normalizar ordem e
equivalência, `flex items-center gap-2` e `items-center gap-2 flex` contam como
bundles **diferentes**, e a contagem de 739 entidades está subestimada. O
número 68,9% é portanto um **piso**.

---

## 4. O loop reconciliado

```
NORMALIZE → MINE → EXTRACT → CLUSTER → CONVERGE → REPORT → DECIDE → APPLY → EVIDENCE
   novo      novo    ✔         ✔          ✔         ✔        ✔      novo      novo
```

| fase | decide | entrega |
|---|---|---|
| `NORMALIZE` | determinístico | todo vetor de estilo na mesma forma; falha fechada em vetor desconhecido |
| `MINE` | determinístico | bundles repetidos → candidatos a entidade canônica |
| `EXTRACT`·`CLUSTER` | determinístico | ocorrências agrupadas por contexto, nome derivado |
| `CONVERGE` | determinístico | itera até ponto fixo |
| `REPORT` | determinístico | 3 capítulos: decidido / exposto / precisa do dono |
| `DECIDE` | **humano** | só acima do corte de incerteza |
| `APPLY` | determinístico | escreve token, `tokens:build`, **grep no CSS buildado**, codemod |
| `EVIDENCE` | modelo + humano | pixel antes/depois por estado, review adversarial |

### 4.1 `NORMALIZE` — duas fontes que se conferem

| vetor | forma canônica |
|---|---|
| `style={{ color, background, borderRadius, padding }}` | → `className` com token |
| `style={{ maxHeight: 'calc(...)' }}` | **fica** — layout dinâmico, exceção legítima declarada |
| hex/rgba em `index.css` | → `var(--token)`, casado por ΔE |
| px em `index.css` | → escala de spacing (oráculo do eixo B) |
| `className` | normalização de ordem/equivalência/sobreposição |

**Verificação cruzada obrigatória.** Hoje lemos `className` por regex e **1.077
`className={...}` dinâmicos são invisíveis**. `NORMALIZE` tem duas fontes —
estática (AST) e renderizada (computed style via Playwright, que já temos na fase
de evidência). Se a contagem por fonte divergir da contagem por DOM, **há
vazamento e o loop para**.

### 4.2 `MINE` — e o bug que ela existe para impedir

O miner existe desde sempre e **nunca esteve no loop**. Rodado agora:

```
--ext padrão (ts,tsx)  →  12 arquivos,  123 ocorrências   "sucesso"
--ext js,jsx,ts,tsx    →  606 arquivos, 6.013 ocorrências
```

O alvo tem 456 `.jsx` + 132 `.js` e **3** `.tsx`. Com o padrão ele varreu **2% do
app e reportou sucesso**. Requisitos da fase:

1. `--ext` **derivado do alvo**, nunca default;
2. **guard de cobertura**: varrer < 80% dos arquivos elegíveis = **erro**, não aviso;
3. saída alimenta `CLUSTER` como candidato a entidade.

---

## 5. Fases de execução

| # | fase | entrega | prova |
|---|---|---|---|
| **F-A** | validar libs (LEI ZERO) | veredito REUSA/PARCIAL/NÃO por candidata | path+linha do código clonado |
| **F-B** | `NORMALIZE` | 158 `style={{}}` + 28 cores + 172 px normalizados | contagem antes/depois + cruzamento DOM |
| **F-C** | `MINE` no loop | miner com `--ext` derivado + guard | o bug de 2% vira erro num teste |
| **F-D** | entidade canônica | bundles ≥2× viram contrato de componente | cobertura medida ≥ 68,9% |
| **F-E** | ampliar oráculo | radius/spacing/tipografia além de cor | famílias novas no `PREFIX_PROPERTY` |
| **F-F** | `APPLY` | tokens escritos + `tokens:build` | **grep no CSS BUILDADO** |
| **F-G** | codemod | call sites migrados via `ts-morph` | build + typecheck verdes |
| **F-H** | `EVIDENCE` | pixel antes/depois por estado | PNG + manifest + review adversarial |

**Sequencial, uma por vez, verificada antes de seguir** (LEI ZERO §6).

---

## 6. Riscos declarados

| risco | mitigação |
|---|---|
| **pesos 40/25/15/10/10 nunca validados** — se errados, as 211 fusões estão erradas | validar contra conjunto rotulado pelo dono antes de `APPLY` |
| corte de 30% escolhido por sensação | já mordeu (outlier absoluto engolia 1-contra-1); revalidar com o mesmo conjunto |
| `--ext` e defaults silenciosos | guard de cobertura em toda fase que varre |
| `className` dinâmico invisível ao regex | cruzamento com computed style |
| duas convenções vivas (`container`) | 32 dos 63 tokens usam `container`; decidir **antes** de escrever contrato novo |
| classe desconhecida emite zero CSS sem erro | `APPLY` prova no artefato buildado, nunca na definição |

---

## 7. O que este plano herda, e de onde

| origem | o quê |
|---|---|
| rev2 (F4–F7) | oráculo de equivalência, conflito, codemod `ts-morph`, prevenção |
| rev2 (F9) | prova visual |
| redireções do dono nesta sessão | contexto por token, iteração até ponto fixo, sinais ponderados, corte de incerteza |
| pergunta do dono sobre `rounded-lg` | entidade canônica (**maior alavanca: 68,9%**) |
| pergunta do dono sobre vetores | `NORMALIZE` como passo inicial |

As três últimas linhas **não existiam em plano nenhum** — vieram da conversa e
agora estão escritas.
