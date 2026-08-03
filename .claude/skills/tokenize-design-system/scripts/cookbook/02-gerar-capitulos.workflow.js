export const meta = {
  name: 'cookbook-v2',
  description: 'Gera os capitulos do cookbook a partir de dados JA FATIADOS por capitulo, cada nome validado no oraculo',
  phases: [
    { title: 'Capitulos', detail: '8 capitulos de entidade + 1 de entidades ausentes da lei' },
    { title: 'Auditar', detail: 'auditor roda o oraculo no conjunto e caca o que ele nao pega' },
  ],
}

const UITK = '/home/augusto/code/ui-tokenizer-v2'
const SCRIPTS = `${UITK}/.claude/skills/tokenize-design-system/scripts`
const FATIA = process.env.FATIA_DIR ?? '/tmp/cookbook-cap'

const LEI = `LEI (a gramatica mudou HOJE — leia ${UITK}/docs/law/cookbook.md, que ja tem o Capitulo 0 pronto
como modelo de forma, e ${UITK}/docs/law/GRAMMAR.md §4.1-§4.5 para os vocabularios exatos):

  entity[.variant][.anatomy][.property][.state]

  entity   §4.1, 42 entradas incl. as GLOBAIS \`divider\` e \`focus-ring\`
  variant  §4.4: primary secondary ghost destructive success warning info — LOGO APOS a entidade.
           NAO existe danger (e destructive), NAO existe tertiary/outline/link/soft.
  anatomy  §4.2: container label icon track thumb indicator header row cell backdrop divider
           caret placeholder helper prefix suffix handle — so se a entidade tem >1 parte.
  property §4.3: background-color foreground-color border-color outline-color box-shadow fill
           stroke — OMITIDA quando a anatomia so admite uma (button.label, field.placeholder).
  state    §4.5: default hover active focus disabled selected checked invalid on off loading —
           omitido = default; escrever .default e PROIBIDO. O "Press" do Figma = \`active\`.

  BANIDAS content/surface/semantic: so na coluna "nome antigo", NUNCA no destino.
  §5.1: a entidade vem do CONTEXTO RENDERIZADO, nunca do valor.

  PAR BASE: se voce listar um estado (\`.hover\`), liste TAMBEM o token base sem estado — o
  validador reprova estado orfao, e com razao: a tabela ficaria sem o caso default.`

const VALIDAR = `VALIDE ANTES DE ENTREGAR (obrigatorio, sem alvo — o oraculo so precisa da lei):

cd ${SCRIPTS} && node -e "
import('./score-naming.mjs').then(m=>{const v=m.readVocabulary();
const nomes=['button-primary-background-color','SEU-NOME-AQUI'];
const u=new Set(nomes);
for(const n of nomes){const r=m.scoreName(n,v,u);
console.log(r.score,n,r.criteria.filter(c=>!c.ok).map(c=>c.c).join(','));}})"

Ponha TODOS os seus nomes no array (em hifen). Passe o proprio array como universo — assim o
criterio state-with-base enxerga os pares base que voce listou. Esperado: 100 em todos.`

const CAP_SCHEMA = {
  type: 'object',
  required: ['capitulo', 'linhas'],
  properties: {
    capitulo: { type: 'string' },
    linhas: {
      type: 'array',
      items: {
        type: 'object',
        required: ['situacao', 'tokenPelaLei', 'score'],
        properties: {
          situacao: { type: 'string', description: 'especifica, em pt: "fundo do botao destrutivo em hover"' },
          produto: { type: 'string' },
          nomeAntigo: { type: 'string' },
          tokenPelaLei: { type: 'string', description: 'em PONTOS: button.destructive.background-color.hover' },
          score: { type: 'number' },
          evidencia: { type: 'string', description: 'path:linha' },
        },
      },
    },
    lawGap: { type: 'array', items: { type: 'string' } },
    humano: { type: 'array', items: { type: 'string' } },
  },
}

const CAPS = [
  ['botao', 'Botão, badge e pill', '`button` · `badge` · `pill`',
   'A extração Figma real do app-a esta em <app-alvo>/DESIGN_TOKENS/10-buttons.json (bloco `colors`: background/border/textColor/iconColor por Type x State, 27 variantes). Traduza-a: background→button.<variante>.background-color[.estado], textColor→button.<variante>.label, iconColor→button.<variante>.icon, border→button.<variante>.border-color. La esta escrito "secundary" (grafia errada; a lei diz secondary) e "Press" (a lei diz active). Size (sm/md/lg) NAO entra em nome de token de cor.'],
  ['campo', 'Campo, select e controles', '`field` · `select` · `checkbox` · `radio` · `toggle` · `slider` · `search`',
   'placeholder/helper/caret sao anatomias de propriedade UNICA — propriedade omitida. Estados invalid/disabled/focus/checked/on/off. track e thumb do toggle e do slider. O anel de foco NAO e por componente: e a entidade global focus-ring.'],
  ['overlay', 'Modal, drawer, popover, menu e tooltip', '`modal` · `drawer` · `popover` · `menu` · `tooltip` · `overlay`',
   'backdrop e anatomia de propriedade unica. Item de menu em hover/selected/disabled. A hairline interna vira a entidade global divider, nao menu.divider duplicado.'],
  ['dados', 'Cartão, tabela, linha e dados', '`card` · `data-table` · `list-row` · `stat` · `chart` · `progress`',
   'header/row/cell da tabela, zebra e hover de linha, track e indicator do progress, fill/stroke da serie do chart.'],
  ['shell', 'Shell, navegação e página', '`page` · `sidebar` · `nav-item` · `toolbar` · `logo` · `thread-item` · `workspace-item`',
   'Este capitulo tem os exemplos canonicos da lei: page.background-color e page.foreground-color. nav-item em default/hover/selected/disabled com label e icone.'],
  ['texto', 'Texto autoral e mídia', '`chat-message` · `prompt` · `code-block` · `markdown` · `attachment` · `citation`',
   'Bolha do usuario x do assistente sao situacoes DISTINTAS (§5.1). O <strong> do markdown tem defeito real de contraste no app-c.'],
  ['feedback', 'Identidade e feedback', '`avatar` · `banner` · `toast` · `skeleton` · `empty-state`',
   'Banner por variante info/success/warning/destructive — nunca "danger". Avatar: fallback, borda, indicador de status.'],
  ['global', 'Entidades globais', '`divider` · `focus-ring`',
   'O capitulo que a lei destravou hoje. Mostre a CONSOLIDACAO com contagem real medida por grep: quantas copias da hairline existem hoje (menu/table/modal) e quantas copias do anel de foco, e como viram um token so.'],
]

phase('Capitulos')

const capitulos = await parallel([
  ...CAPS.map(([slug, nome, entidades, foco]) => () =>
    agent(`${LEI}

CAPITULO: **${nome}**   ENTIDADES: ${entidades}
FOCO: ${foco}

SEUS DADOS JA ESTAO FATIADOS — leia ${FATIA}/${slug}.json (arquivo pequeno, so o SEU capitulo).
Cada item traz: produto, familia, entidade, situation, anatomy, cssProperty, variant, state,
currentClassOrToken e evidencia path:linha. NAO precisa varrer os repos; use grep pontual so se
faltar algo especifico.

${VALIDAR}

ENTREGA: uma linha por SITUACAO DISTINTA. O dono pediu o maximo de exemplos — nao economize.
Situacao sem evidencia path:linha nao entra. O que a lei nao expressa vai em lawGap com o motivo;
o que exige o dono vai em humano. Nao invente entidade nem variante.`,
      { label: `cap:${slug}`, phase: 'Capitulos', model: 'sonnet', schema: CAP_SCHEMA })),

  () => agent(`${LEI}

CAPITULO ESPECIAL: **Entidades que os produtos têm e a lei não tem**

Leia ${FATIA}/sobras.json — 91 situacoes cujos componentes NAO casaram com nenhuma das 42
entidades do §4.1. Os maiores: audio-player (9), board-block (8), tab (7), onboarding-panel (7),
flyout (6), attachment-chip (6), alert (5), notification-bell (4), filter-chip (4), podium (4),
status-label (4), carousel-control, dnd-overlay, agent-status-card.

Sua tarefa e TRIAR cada um em exatamente um dos tres baldes:
 (a) MAPEIA para entidade existente — ex.: \`flyout\` provavelmente e \`popover\`; \`filter-chip\`
     provavelmente e \`pill\`; \`alert\` pode ser \`banner\` ou \`toast\`. Se mapear, escreva as
     linhas normais em "linhas", usando a entidade EXISTENTE, e diga em cada situacao qual era o
     nome do componente no produto.
 (b) PEDE ENTIDADE NOVA — o componente e real, generalizavel e nenhuma entidade do §4.1 e ele
     (ex.: audio-player). Vai em "humano" no formato:
     "PEDE ENTIDADE NOVA: <nome-em-kebab> — <N> situacoes em <produto>, evidencia <path:linha>;
      nao e <entidade-parecida> porque <razao fisica>".
     A §5.5 exige evidencia junto com o pedido — traga-a.
 (c) NAO E ENTIDADE — e uma composicao/estado de outra (ex.: \`dnd-overlay\` pode ser um estado).
     Explique em lawGap.

Seja rigoroso: entidade nova infla o vocabulario fechado e e decisao do dono. Prefira mapear.`,
    { label: 'cap:ausentes', phase: 'Capitulos', model: 'sonnet', effort: 'high', schema: CAP_SCHEMA }),
])

phase('Auditar')

const ok = capitulos.filter(Boolean)
const nomes = ok.flatMap((c) => (c.linhas || []).map((l) => l.tokenPelaLei))
log(`capitulos ${ok.length}/9 · linhas ${nomes.length}`)

const audit = await agent(`Audite os nomes do cookbook. Rode o oraculo em TODOS (converta ponto->hifen, e passe o
conjunto inteiro como universo para o criterio state-with-base enxergar os pares base).

Comando base em ${SCRIPTS}, com node -e importando ./score-naming.mjs (nao precisa de app-alvo).

NOMES (${nomes.length}):
${JSON.stringify(nomes).slice(0, 40000)}

Reporte: (1) todo nome com nota < 100 e o criterio; (2) palavra banida em qualquer destino;
(3) variante escrita depois da propriedade; (4) \`danger\` em vez de \`destructive\`; (5) \`.default\`
escrito; (6) propriedade escrita onde a anatomia so admite uma; (7) entidade fora do §4.1;
(8) duplicata semantica (dois nomes para a mesma situacao fisica).
Diga quantos nomes unicos ha e quantos batem 100.`,
  { label: 'audit', phase: 'Auditar', model: 'sonnet', effort: 'high' })

return { capitulos: ok, audit }
