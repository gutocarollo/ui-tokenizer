# Log — ui-tokenizer

Índice cronológico append-only, orientado a tempo. Para catálogo por conteúdo,
ver [`index.md`](index.md).

Formato: `## [YYYY-MM-DD] tipo · categoria`.

---

## [2026-07-31] achado · lei

**F-E ampliou o oráculo de propriedades e bateu no teto da própria lei.**
`PREFIX_PROPERTY` saiu de 12 prefixos, todos de cor, para **53 em quatro
famílias** (pintura, radius, spacing, tipografia) — e a tabela passou a viver em
`scripts/lib/utility-families.mjs`, importada tanto pelo oráculo de naming
quanto pelo oráculo do denominador, que até então mantinham **duas cópias
escritas à mão** da mesma regra.

O achado: **§4.3 da lei tem sete propriedades e as sete são pintura.** 41 dos 53
prefixos não têm slot. Nada foi forçado — as famílias sem slot falham fechadas
num balde `LAW GAP` declarado, e a emenda está proposta, não aplicada.

Medido no alvo (`measure-coverage.mjs`): tokenizável fora de entidade
**7.877 → 7.948** (24,1% → 24,3%), exceção **7.987 → 7.916** (24,5% → 24,2%).
Os 71 usos vêm da cadeia de variante genérica — a allowlist fixa não enxergava
`placeholder:` (339 usos), `peer-checked/public:`, `group-disabled:`,
`enabled:`, `after:`, `[&_p]:`. Mesmo defeito do `p`/`px`.

Convergência **não quebra**: no alvo real tudo idêntico (504 ocorrências, 211
fusões, 41 contratos); em fixture que exercita as famílias novas, clusters
22 → 48 e fusões/contratos/iterações **inalterados** (9 / 10 / 3), porque o
cluster sem slot falha fechado antes de derivar nome.

- [`law/2026-07-31-achado-4-3-sem-slot-nao-pintura.md`](law/2026-07-31-achado-4-3-sem-slot-nao-pintura.md)

## [2026-07-30] plano · planos

**Reconciliação.** O plano vigente descrevia "compilador do Tailwind como
oráculo"; o código construído era um pipeline de naming de cor. Medido: **0 hits**
no plano para cluster de contexto, convergência, lei de naming, ΔE, fila humana.
Documento e código descreviam projetos diferentes.

Números que passam a ser contrato: universo **32.662** usos de classe (+158
`style={{}}`, +index.css), hoje **1,5%** tratado, meta **bloqueante 68,9%**, teto
**81,4%**, e **18,6%** declarado fora de escopo por não haver padrão.

- [`plans/2026-07-30-plano-reconciliado.md`](plans/2026-07-30-plano-reconciliado.md)

## [2026-07-30] didático · entendimento

**O vocabulário explicado.** Os números do relatório não se explicavam sozinhos:
"504 ocorrências → 311 clusters → 41 contratos" não diz o que é cada entidade.
Descoberta que muda a leitura: as 504 ocorrências usam **12 tokens distintos**, e
`surface-hover` sozinho responde por 336 deles.

- [`como-funciona.md`](como-funciona.md) — cada termo com arquivo:linha real

## [2026-07-30] consolidação · processo

**Um entrypoint, uma skill.** O processo tinha 17 entrypoints, um runner com 5
comandos que não executavam nada, um registro fase→executor que ninguém
invocava, 4 scripts órfãos e 2 skills irmãs. `scripts/tokenize.mjs` passa a ser
o único comando: PREFLIGHT → EXTRACT → CLUSTER → CONVERGE → REPORT → DECIDE.

A skill `refactor-ui-with-evidence` foi absorvida — virou
`reference/visual-evidence.md` + `reference/visual-evidence-engine.md` dentro de
`tokenize-design-system`. Eram o mesmo loop: o retorno B→A atravessava uma
fronteira que não devia existir.

Autocontenção: `tools/hooks/clarification-gate.py` e `tools/gates/ref_integrity.py`
vieram do app consumidor para o repo; o path pessoal hardcoded saiu do doc do
motor. Esta wiki ganhou `index.md` e `log.md`, que o `SCHEMA.md` exigia e não
existiam — 73 órfãos.

- [`ESTADO.md`](ESTADO.md) — estado da empreitada, atualizado
- `plans/` — coleção de planos

## [2026-07-30] plano · planos

Upstream como oráculo: usar o compilador do Tailwind para decidir equivalência
por assinatura de CSS compilado, em vez de comparar nome de classe. Rev2
incorpora a auditoria.

- `plans/` — coleção

## [2026-07-29] evidência · estudo de caso

Tokens rotulados sobre a tela: cada ocorrência contornada, cor fixa por token,
legenda embutida. A retratação importante está no relatório — das 531
ocorrências de casamento de valor, só 2 eram consumo direto provado.

- `case-study/assets/2026-07-29-tokens-rotulados/` — coleção de 34 PNGs
- [`case-study/2026-07-29-veredito-naming-tokens.md`](case-study/2026-07-29-veredito-naming-tokens.md)
- [`case-study/2026-07-29-fila-revisao-naming.md`](case-study/2026-07-29-fila-revisao-naming.md)
- [`case-study/2026-07-29-clusters-owner-sobras.md`](case-study/2026-07-29-clusters-owner-sobras.md)

## [2026-07-28] evidência · estudo de caso

Superfícies componente a componente, 17 rotas × 2 temas, autenticado.

- `case-study/assets/2026-07-28-superficies/` — coleção de 34 PNGs
- [`case-study/2026-07-28-relatorio-superficies-componente-a-componente.md`](case-study/2026-07-28-relatorio-superficies-componente-a-componente.md)
- [`case-study/2026-07-28-inventario-surface-tokens.md`](case-study/2026-07-28-inventario-surface-tokens.md)

## [2026-07-27] auditoria · estudo de caso

- [`case-study/2026-07-27-relatorio-auditoria-i18n-motion-cor.md`](case-study/2026-07-27-relatorio-auditoria-i18n-motion-cor.md)

## [2026-07-26] mineração · estudo de caso

Origem do processo: minerar className repetido, clusterizar, e descobrir que
comparação por string não acusa equivalência.

- `case-study/sources/` — coleção das fontes de mineração
- [`case-study/2026-07-26-tokenization.md`](case-study/2026-07-26-tokenization.md)
- [`case-study/2026-07-26-relatorio-antes-depois-tokenizacao.md`](case-study/2026-07-26-relatorio-antes-depois-tokenizacao.md)
