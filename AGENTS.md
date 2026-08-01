# ui-tokenizer v2 — instruções para agentes

Repo do PROCESSO de tokenização (a skill `tokenize-design-system`, a lei de
naming e o motor de evidência). O repo de teste/alvo é o `makers-ai-hub`
(cópia vendorizada da skill lá, sync via `skill-sync.json` + guard
`tools/gates/skill-drift.py`).

## ⭐ Mapa de canon — decisões de NAMING se decidem AQUI, não se perguntam

Antes de tratar qualquer questão de nome de token como aberta, grep NESTA
ordem. Se a lei decide, a decisão está tomada — cite path + Linha e siga.

1. **[docs/law/GRAMMAR.md](docs/law/GRAMMAR.md)** — A LEI. Gramática
   `entity[.variant][.anatomy][.property][.state]` (Linha 42) — a variante vem
   colada à ENTIDADE, antes da anatomia e da propriedade (corrigido 2026-08-01);
   propriedade é slot obrigatório salvo quando a anatomia a implica (§7.2); exemplo canônico `page.background-color` (Linha 50);
   derivabilidade §7.2 (Linha 406): anatomia de propriedade única OMITE
   a propriedade (`field.placeholder`, `menu.divider`, `modal.backdrop`).
2. **`.claude/skills/tokenize-design-system/reference/law.md`** — espelho que
   os MOTORES leem (`paths.mjs` o prefere). Divergência espelho×lei é bug:
   invariante em `scripts/test/lei-x-familias.test.mjs`.
3. **`.claude/skills/tokenize-design-system/reference/anatomy-property.md`** —
   matriz anatomia×propriedade; fonte do `IMPLIED_PROPERTY` (`scripts/score-naming.mjs` Linha 169).
   ATENÇÃO: derivabilidade (ruído) e coerência (impossibilidade) são regras
   SEPARADAS desde 2026-08-01 — a segunda vive em `PARES_IMPOSSIVEIS` (Linha 183).
4. **[docs/law/2026-07-31-ordem-do-nome-evidencias.md](docs/law/2026-07-31-ordem-do-nome-evidencias.md)**
   — dossiê de evidências externas (DTCG/M3/Primer/shadcn) da ordem
   owner-primeiro e do namespace `--color-*`.

Decisões JÁ CANONIZADAS (não reabrir sem ordem expressa do dono): palavras
por extenso (nunca `bg`/`fg`); **CINCO palavras BANIDAS** — `surface`,
`semantic`, `content`, `label`, `foreground` (`tools/gates/ds-naming-law.py`
Linha 124 é a lista executável); ordem entidade→variante→anatomia→propriedade;
propriedade no nome exceto anatomia de propriedade única; a anatomia é `text`
(não `label`) e a tinta de uma parte é `color` (não `foreground-color`) —
ambas trocadas em 2026-08-01, §5.6 da lei.

**Pendências do dono NÃO se procuram lendo os docs.** Elas são arquivos em
[`docs/pending/`](docs/pending/), indexadas em
[`docs/pending/index.md`](docs/pending/index.md) e conferidas por
`python3 tools/gates/pending_index.py --check`. Antes de tratar algo como
aberto, leia esse índice: item que não está lá **não é pendência**, e ⚠/⏳ no
corpo de um doc é narrativa, não backlog.

## Guardas e comandos

- Naming: `python3 tools/gates/ds-naming-law.py` (baseline por app; trava uso
  NOVO). Prefixo×propriedade: `violations_prefix_property()`.
- Suíte canônica: **`TOKENIZE_TEST_ROOT=<app-alvo> npm test` na raiz** (nunca
  invocação parcial com cwd — mascara crash de import; medido 2026-07-31).
  **A variável não é opcional:** sem ela o default é `<repo>/frontend`, que não
  existe aqui, e 29 testes ficam vermelhos por não achar o `package.json` do
  alvo — não por regressão. Hoje: `TOKENIZE_TEST_ROOT=/home/augusto/code/makers-ai-hub/frontend`
  → 294 testes, 293 passam, 0 falham. Ver [[suite-vermelha-por-default]].
- Docs: `python3 tools/gates/docs_wiki_lint.py` + `ref_integrity.py --since
  HEAD`. Naming de docs: kebab-case, `docs/SCHEMA`-like (ver `docs/log.md`).
- Backlog: `python3 tools/gates/pending_index.py --check` (índice em dia +
  ponteiro de cada pendência ainda vivo). Sem `--check` ele REGENERA
  `docs/pending/index.md`. Contrato em `docs/SCHEMA.md` §3.1.
- Stop hook `tools/hooks/clarification-gate.py`: pergunta seca/handoff de
  decisão sem bloco D[n] (com linha `Canon:`) bloqueia o turno.

## Estado

- Plano vigente de implementação: `docs/plans/` (README aponta o mestre).
- Run ativo (maratona): `.claude/runs/tokenizer-cobertura/RUN.md`.
