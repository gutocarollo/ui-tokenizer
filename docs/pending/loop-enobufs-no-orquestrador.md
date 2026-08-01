---
title: tokenize.mjs estoura o buffer e culpa o filho — o loop para na 3ª de 7 fases
status: aberto
quem_resolve: agente
severidade: bloqueante
bloqueia: o loop inteiro — CLUSTER, CONVERGE, REPORT e DECIDE nunca rodam por `tokenize.mjs`
fonte: .claude/skills/tokenize-design-system/scripts/tokenize.mjs:79
citacao: 'stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],'
updated: 2026-08-01
---

Medido em 2026-08-01 contra `/home/augusto/code/makers-ai-hub/frontend`:

```
node tokenize.mjs --root /home/augusto/code/makers-ai-hub/frontend
  PREFLIGHT  ok
  MINE       ok — 729/730 arquivos (99,9%), 5639 ocorrências
  EXTRACT + CLUSTER
  PAROU em CLUSTER: context-clusters falhou
    como resolver: spawnSync ... ENOBUFS
```

**A mensagem mente.** `context-clusters.mjs` não falhou: rodado à mão ele sai com
exit 0 e emite **3,64 MB de JSON válido** (2.076 clusters, `total: 3395`). Quem
quebrou foi o pai — `run()` usa `spawnSync` com `stdio: pipe` e **nunca define
`maxBuffer`**, então vale o default de 1 MB.

`grep -n maxBuffer tokenize.mjs` não retorna nada.

Atinge **duas** fases, não uma: `converged.json` tem 3,37 MB, também acima do
default. Consertar só o CLUSTER faz o loop morrer na fase seguinte.

Esta é a mesma classe do defeito de truncamento do `--json` corrigido no mesmo
dia (`scripts/test/cookbook.test.mjs`, teste "o modo --json emite JSON COMPLETO"):
**o erro é de quem lê e a mensagem acusa o dado**. Lá o consumidor via
`JSONDecodeError` e culpava o conteúdo; aqui o operador lê "context-clusters
falhou" e vai depurar o script errado.

## O conserto

Não é elevar `maxBuffer` — 3,6 MB hoje é o alvo de hoje, e o número cresce com o
app. As duas fases já escrevem o stdout capturado direto em arquivo
(`writeFileSync(clustersFile, c.out)`), então o pipe é um intermediário que só
existe para ser estourado: passar um descritor de arquivo como `stdio[1]` remove
o limite e a cópia dupla em memória.

E o `run()` deve distinguir **filho que falhou** (`status !== 0`) de **pai que
não conseguiu ler** (`r.error.code === "ENOBUFS"`), com mensagens diferentes.

## Como saber que fechou

`node tokenize.mjs --root <alvo>` percorre PREFLIGHT→DECIDE e imprime a linha do
APPLY. Trava por teste: o repo não tem nenhum que exercite `tokenize.mjs` — ver
[[loop-sem-teste-de-ponta-a-ponta]].
