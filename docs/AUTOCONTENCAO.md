# O `ui-tokenizer` reproduz o próprio processo? Inventário

**Antes deste commit: não.** O repositório canônico do processo estava incompleto
e desatualizado em relação ao alvo onde o trabalho aconteceu.

## O que foi medido

Comparação arquivo a arquivo entre o que o processo executa no alvo
(`makers-ai-hub/frontend`) e o que existia aqui:

| estado | arquivos |
|---|---:|
| idênticos | 5 |
| **divergentes** | **5** |
| **ausentes** | **9** |

### Ausentes — o pipeline quebrava no meio

| arquivo | consequência da ausência |
|---|---|
| `scripts/prepare-evidence-run.mjs` | **`ui-evidence.sh` o invoca.** O script de captura deste repo falhava em runtime. |
| `scripts/lib/evidence-composer.mjs` | composição de manifests indisponível |
| `scripts/verify-contract-source-delta.mjs` | prova AST da dispensa de bind |
| `scripts/codemod-entities.mjs` | **produz o lado `after` do par** |
| `scripts/reverse-entities.mjs` | **produz o lado `before` do par** |
| `scripts/ds-contrast-pairs.py` | guard de contraste WCAG + espelho hex×rgb |
| `tests/visual/network-fixtures.json` | fixtures e `contractSources` |

Sem os dois codemods, **nenhuma prova de pixel deste processo era reproduzível
a partir deste repositório** — dá para ler o resultado, não para regerar o par.

### Divergentes — o repo canônico estava atrás do alvo

| arquivo | linhas divergentes | o que faltava aqui |
|---|---:|---|
| `scripts/lib/visual-contract.mjs` | 129 | `applyBindingWaivers` — a dispensa de bind provada |
| `scripts/lib/evidence-matrix.mjs` | 66 | fingerprints de bind atualizados |
| `tests/visual/visual-registry.mjs` | 103 | materialização de contextos |
| `tests/visual/evidence.spec.ts` | 63 | captura por cenário |
| `playwright.visual.config.ts` | 19 | **flags de determinismo de render** |

A última é a mais cara: sem as flags, o piso de ruído da esteira é maior que
zero e uma política `preserve` fica insatisfazível até por um no-op.

## Terceira falha: nenhuma dependência declarada

O repo não tinha `package.json`. O código importa sete pacotes externos:

```
@babel/parser  @playwright/test  ajv  axe-core  pixelmatch  pngjs  typescript
```

Sem declaração, `node --test` falha em `ERR_MODULE_NOT_FOUND` já no primeiro
teste. O processo canônico não rodava sozinho — só dentro do alvo, por herança
de `node_modules`.

**Achado adjacente:** `@babel/parser` também não estava declarado **no alvo** —
subia por hoist, exatamente como `@tailwindcss/node`. É a mesma classe de defeito
que já foi corrigida uma vez nesta sequência, e `verify-contract-source-delta.mjs`
depende dele. Declarado nos dois repos como `^7.24.8`, que é o range que o
`yarn.lock` do alvo já cobre (`--frozen-lockfile` exit 0, lock intacto).

## Estado depois deste commit

- 9 ausentes copiados, 5 divergentes atualizados
- `ui-evidence.sh` resolve todos os scripts que invoca
- imports de `./lib/*` resolvem nos quatro entrypoints
- `package.json` declara os sete pacotes e expõe `test`, `evidence` e
  `guard:contrast`

**Continua fora, e de propósito:** `ds-cohesion.py` e `ds-naming-law.py` são
guards de commit do alvo, chamados pelo `.githooks/pre-commit` dele. Trazê-los
para cá misturaria "processo de tokenização" com "política de commit de um repo
específico".
