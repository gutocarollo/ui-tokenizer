---
title: o relatório de rodada escreve na wiki do ALVO e a deixa vermelha — todo run cria um órfão
status: aberto
quem_resolve: agente
severidade: media
bloqueia: nada; mas quebra o lint do alvo a cada execução do loop
fonte: .claude/skills/tokenize-design-system/scripts/tokenization-report.mjs:38
citacao: 'const out = path.resolve(ROOT, "..", arg("--out"'
updated: 2026-08-01
---

`tokenization-report.mjs` resolve a saída para **fora** do `--root` (`ROOT/..`)
e escreve em `docs/reports/<data>-tokenizacao-rodada.md` — isto é, dentro da
wiki do app-alvo. E **não indexa nada**: `grep -n "index.md\|log.md\|README"`
no script não retorna uma linha.

A wiki do alvo (orions-belt, `docs/SCHEMA.md` §4) exige que todo `.md` não
estrutural seja citado no `index.md` da categoria **e** no `log.md`. Logo cada
execução do loop deixa um órfão e derruba o lint de lá:

```
python3 .harness/lib/docs_wiki_lint.py     # no makers-ai-hub
  docs-wiki-lint: FAIL
  - orphan (no mention in index/log): reports/2026-08-01-tokenizacao-rodada.md
```

Reproduzido hoje: rodar o loop uma vez para responder "o que falta para ele
rodar end-to-end?" bastou para quebrar a wiki de outro repositório. As rodadas
de 07-30 e 07-31 não aparecem como órfãs porque **alguém as indexou à mão** —
`docs/log.md:19` e `:23`, `docs/reports/README.md:8` e `:9` do alvo. Trabalho
manual que ninguém prometeu repetir.

A instância de hoje foi indexada com a ressalva do cap.3 (ver o `log.md` do
alvo). O que continua aberto é a **causa**.

## As saídas

1. **O gerador passa a indexar.** Escrever a entrada no `log.md` e no
   `README.md` da coleção junto com o relatório. É o que o humano faz hoje, e o
   script tem os números para escrever uma linha melhor que a manual.
2. **O gerador escreve fora da wiki** (ex.: `.tokenize/reports/`) e só copia
   para `docs/` por pedido explícito. Mais simples e não invade repo alheio; em
   troca, o relatório deixa de ter registro temporal onde ele importa.
3. **O alvo declara `reports/` como coleção indexada** — o lint aceita coleção
   explícita com `README.md` interno (§4). Custo quase zero, mas empurra a
   correção para cada alvo em vez de resolver na origem.

Eu escolheria a (1): o problema é do gerador, e as outras duas fazem cada
consumidor pagar por um defeito que é nosso. Mas ela tem uma ressalva honesta —
**escrever no `log.md` de outro repositório é mutação de artefato alheio**, e
isso precisa ser opt-in (`--index` ou config do alvo), nunca silencioso.
