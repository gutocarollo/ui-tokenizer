# Manifesto do motor — todo arquivo envolvido, e por que mora onde mora

Esta skill **não é auto-contida como a `tokenize-design-system`**, e isso é uma
decisão, não um descuido. Este arquivo é o manifesto completo: 13 arquivos,
**4.303 linhas**, nenhum escondido.

## O critério

O mesmo já aplicado ao `classname-miner-v2.mjs` na skill irmã:

> **Copiar** para dentro da skill se o arquivo não tem dependência externa nem
> fiação no runtime do repo. **Referenciar** se ele precisa de `node_modules` ou
> está ligado a um mecanismo do projeto (descoberta de teste, script de
> `package.json`, hook, dados do app).

A `tokenize-design-system` pôde ser auto-contida porque seus oráculos são Node
puro sem fiação: leem arquivo, escrevem stdout. **Aqui 74% do motor falha nos dois
testes** — precisa de `@playwright/test`, de um app no ar, de sessão autenticada,
e está amarrado ao `testDir` do Playwright, ao `yarn ui:evidence` e a um Stop
hook. Uma cópia parcial dentro da skill não ficaria portável — ficaria
divergindo, que é o defeito que a consolidação de 2026-07-29 eliminou nos
oráculos de token.

## Os 13 arquivos

### Acoplados ao runtime do repo — REFERENCIADOS (3.181 linhas, 74%)

| arquivo | linhas | papel | o que o prende ao repo |
|---|---:|---|---|
| `frontend/scripts/lib/visual-contract.mjs` | 1.406 | contrato dos artefatos de evidência: manifest, cobertura, métricas de pixel | consome o layout de `.claude/evidence/` e o schema que o hook valida |
| `frontend/tests/visual/evidence.spec.ts` | 563 | **o motor de captura** — PNG full-page, erros de console, meta por captura | é um teste Playwright, descoberto pelo `testDir` do config; fora dele não roda |
| `.harness/hooks/ui-evidence-gate.sh` | 409 | Stop hook: bloqueia fim de turno com UI alterada sem manifest posterior | registrado em `.claude/settings.json`; hook só existe no repo |
| `frontend/scripts/gen-visual-routes.mjs` | 242 | materializa rota `:param` com ID/slug **real** | consulta a API/seed do app; é domínio, não ferramenta |
| `frontend/scripts/ui-evidence.sh` | 207 | runner por estágios | é o `yarn ui:evidence` do `package.json` |
| `frontend/tests/visual/routes.json` | 190 | rotas materializadas | dado deste projeto |
| `frontend/playwright.visual.config.ts` | 75 | projetos, viewports, `dependencies: ['setup']` | precisa de `@playwright/test` |
| `frontend/tests/visual/theme-map.config.ts` | 21 | como aplicar cada tema (`seedLocalStorage`, `documentAttrs`) | dado deste projeto |

### Node puro, mas acoplados ao FORMATO do projeto — REFERENCIADOS (1.122 linhas, 26%)

| arquivo | linhas | papel | por que não viajam |
|---|---:|---|---|
| `frontend/scripts/lib/visual-contract.test.mjs` | 601 | teste do contrato | roda junto com o que testa |
| `frontend/scripts/evidence-report.mjs` | 268 | pareia dois labels → relatório markdown, copia PNGs para `docs/reports/assets/` | escreve em `docs/reports/`, caminho deste repo |
| `frontend/scripts/affected-routes.mjs` | 150 | **BFS de import reverso**: diff → rotas afetadas | lê a forma do roteador em `src/main.jsx` (react-router `createBrowserRouter` com `lazy`/`element`); outro projeto tem outro roteador |
| `frontend/scripts/compare-evidence.mjs` | 99 | comparação de pixel e de política | consome o manifest do formato acima |
| `frontend/scripts/evidence-manifest.mjs` | 72 | constrói o manifest exato | **o Stop hook o invoca por path** |

`affected-routes.mjs` é o caso mais claro de por que "copiar" não daria
portabilidade: ele parseia `createBrowserRouter` com `path:` + `lazy: async () =>
import(...)`. Num projeto Next.js, ou com rotas em arquivo, o parser inteiro é
outro. O que é reutilizável ali é a **ideia** (BFS de import reverso), não o
código.

## O que ISSO significa na prática

**Para usar esta skill neste repo:** tudo está no lugar. Os comandos do
`SKILL.md` funcionam.

**Para levar esta skill a outro repo:** o `SKILL.md` viaja e continua correto — o
protocolo (rota vem do diff, `Read` do PNG, review adversarial em subagent, 5
loops de volta) é independente de stack. Os 13 arquivos **não** viajam: no repo
novo, o equivalente tem que existir ou ser construído. O `SKILL.md` é o contrato;
este manifesto é a lista do que precisa existir para honrá-lo.

**Onde a auto-contenção real está:** na `tokenize-design-system`. Aquela roda
contra qualquer repo com `--root <raiz>`, porque decide **nome de token**, que é
um problema de texto. Esta decide **se o pixel ficou certo**, que exige o app
rodando — e app rodando não cabe dentro de uma skill.

## Verificação

```bash
cd /home/augusto/code/makers-ai-hub
for f in frontend/scripts/{ui-evidence.sh,affected-routes.mjs,evidence-report.mjs,evidence-manifest.mjs,compare-evidence.mjs,gen-visual-routes.mjs} \
         frontend/scripts/lib/visual-contract{,.test}.mjs \
         frontend/tests/visual/{evidence.spec.ts,theme-map.config.ts,routes.json} \
         frontend/playwright.visual.config.ts .harness/hooks/ui-evidence-gate.sh; do
  [ -e "$f" ] && printf "OK %6s %s\n" "$(wc -l < "$f")" "$f" || printf "AUSENTE %s\n" "$f"
done
```

Se algum sair `AUSENTE`, o protocolo do `SKILL.md` não é executável até que ele
exista — e isso é um bloqueio a declarar, não a contornar.
