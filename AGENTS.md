# ui-tokenizer v2 — instruções para agentes

Repo do PROCESSO de tokenização (a skill `tokenize-design-system`, a lei de
naming e o motor de evidência). O repo de teste/alvo é o `makers-ai-hub`
(cópia vendorizada da skill lá, sync via `skill-sync.json` + guard
`tools/gates/skill-drift.py`).

## ⭐ Mapa de canon — decisões de NAMING se decidem AQUI, não se perguntam

Antes de tratar qualquer questão de nome de token como aberta, grep NESTA
ordem. Se a lei decide, a decisão está tomada — cite path + Linha e siga.

1. **[docs/law/GRAMMAR.md](docs/law/GRAMMAR.md)** — A LEI. Gramática
   `owner.anatomy.property[.variant][.state]` (Linha 31); propriedade é slot
   obrigatório; exemplo canônico `page.background-color` (Linha 75);
   derivabilidade §7.2 (Linhas 289-307): anatomia de propriedade única OMITE
   a propriedade (`field.placeholder`, `menu.divider`, `modal.backdrop`).
2. **`.claude/skills/tokenize-design-system/reference/law.md`** — espelho que
   os MOTORES leem (`paths.mjs` o prefere). Divergência espelho×lei é bug:
   invariante em `scripts/test/lei-x-familias.test.mjs`.
3. **`.claude/skills/tokenize-design-system/reference/anatomy-property.md`** —
   matriz anatomia×propriedade; fonte do `IMPLIED_PROPERTY`
   (`scripts/score-naming.mjs` Linhas 105-112).
4. **[docs/law/2026-07-31-ordem-do-nome-evidencias.md](docs/law/2026-07-31-ordem-do-nome-evidencias.md)**
   — dossiê de evidências externas (DTCG/M3/Primer/shadcn) da ordem
   owner-primeiro e do namespace `--color-*`.

Decisões JÁ CANONIZADAS (não reabrir sem ordem expressa do dono): palavras
por extenso (`background`/`foreground`, nunca `bg`/`fg`); `content`/
`surface`/`semantic` BANIDAS; ordem owner→anatomia→propriedade; propriedade
no nome exceto anatomia de propriedade única. Pendências reais do dono estão
marcadas ⚠ nos próprios docs (ex.: `divider` como owner,
`anatomy-property.md` Linha ~112).

## Guardas e comandos

- Naming: `python3 tools/gates/ds-naming-law.py` (baseline por app; trava uso
  NOVO). Prefixo×propriedade: `violations_prefix_property()`.
- Suíte canônica: **`npm test` na raiz** (nunca invocação parcial com
  cwd/env — mascara crash de import; medido 2026-07-31).
- Docs: `python3 tools/gates/docs_wiki_lint.py` + `ref_integrity.py --since
  HEAD`. Naming de docs: kebab-case, `docs/SCHEMA`-like (ver `docs/log.md`).
- Stop hook `tools/hooks/clarification-gate.py`: pergunta seca/handoff de
  decisão sem bloco D[n] (com linha `Canon:`) bloqueia o turno.

## Estado

- Plano vigente de implementação: `docs/plans/` (README aponta o mestre).
- Run ativo (maratona): `.claude/runs/tokenizer-cobertura/RUN.md`.
