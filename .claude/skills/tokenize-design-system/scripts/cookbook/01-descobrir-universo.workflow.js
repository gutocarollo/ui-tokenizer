export const meta = {
  name: 'cookbook-discovery',
  description: 'Descobre universo de componentes/situacoes + ofensores + sitios de proibicao + slots da lei para o cookbook de tokens',
  phases: [
    { title: 'Discover', detail: '7 agentes paralelos: 3 inventarios de componentes, ofensores, sitios de proibicao, slots da lei, material reusavel' },
  ],
}

const COMPONENT_SCHEMA = {
  type: 'object',
  required: ['repo', 'families'],
  properties: {
    repo: { type: 'string' },
    stackNote: { type: 'string', description: 'stack de estilo: tailwind classes, inline style com useTheme, CSS modules etc' },
    families: {
      type: 'array',
      items: {
        type: 'object',
        required: ['family', 'ownerCandidate', 'situations'],
        properties: {
          family: { type: 'string', description: 'nome do componente/familia real no repo, ex: DropdownMenu, CourseCard, PeriodSelector' },
          path: { type: 'string', description: 'path representativo' },
          ownerCandidate: { type: 'string', description: 'owner FISICO sugerido na gramatica (button, menu, card, modal, field, nav-item, data-table, page, sidebar, prompt, toggle, progress, citation, code-block, chat-message, list-row, empty-state, thread-item, workspace-item...). Se nenhum servir, escreva NOVO:<sugestao> e justifique' },
          situations: {
            type: 'array',
            description: 'cada situacao visual DISTINTA que esse componente pinta',
            items: {
              type: 'object',
              required: ['situation', 'cssProperty', 'evidence'],
              properties: {
                situation: { type: 'string', description: 'ex: fundo do botao primario em hover; cor do rotulo desabilitado; borda do campo invalido' },
                anatomy: { type: 'string', description: 'parte anatomica se houver: container, label, icon, placeholder, helper, caret, backdrop, divider, header, row, cell, track, thumb...' },
                cssProperty: { type: 'string', description: 'background-color | foreground-color | border-color | outline-color | box-shadow | fill | stroke' },
                variant: { type: 'string' },
                state: { type: 'string' },
                currentClassOrToken: { type: 'string', description: 'a classe/var que o codigo usa HOJE (pode conter palavra banida)' },
                evidence: { type: 'string', description: 'path:linha real' },
              },
            },
          },
        },
      },
    },
  },
}

const OFFENDER_SCHEMA = {
  type: 'object',
  required: ['offenders', 'summary'],
  properties: {
    summary: { type: 'string' },
    offenders: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'line', 'snippet', 'kind', 'teaches'],
        properties: {
          path: { type: 'string', description: 'path ABSOLUTO' },
          line: { type: 'number' },
          snippet: { type: 'string', description: 'a linha, no maximo 160 chars' },
          kind: { type: 'string', enum: ['instrucao-agente', 'doc-normativo', 'exemplo-bom', 'template-harness', 'skill', 'guard-list', 'prompt', 'outro'] },
          teaches: { type: 'string', description: 'qual das 3 palavras é ensinada como VALIDA e como (alvo de migracao, nome de familia, exemplo bom, variante de componente)' },
          verdict: { type: 'string', enum: ['DESTRUIR', 'RETRATAR', 'PATCH-LISTA', 'RUIDO-LEGITIMO'], description: 'DESTRUIR=exemplo bom a apagar; RETRATAR=doc historico que precisa banner; PATCH-LISTA=lista de proibicao a completar; RUIDO-LEGITIMO=outro dominio (semantic HTML, CSS content, vendored)' },
        },
      },
    },
  },
}

const LAW_SCHEMA = {
  type: 'object',
  required: ['owners', 'anatomies', 'properties', 'variants', 'states', 'impliedProperty', 'prefixProperty', 'forbidden'],
  properties: {
    owners: { type: 'array', items: { type: 'string' } },
    anatomies: { type: 'array', items: { type: 'string' } },
    properties: { type: 'array', items: { type: 'string' } },
    variants: { type: 'array', items: { type: 'string' } },
    states: { type: 'array', items: { type: 'string' } },
    impliedProperty: { type: 'object', additionalProperties: true, description: 'anatomia -> propriedade implicita' },
    prefixProperty: { type: 'object', additionalProperties: true, description: 'prefixo utility -> propriedade' },
    forbidden: { type: 'array', items: { type: 'string' } },
    scoringRules: { type: 'array', items: { type: 'string' }, description: 'criterios do score-naming com pontos e o que reprovam' },
    hardRules: { type: 'array', items: { type: 'string' }, description: 'regras duras: state exige par base, .default proibido, propriedade omitida em anatomia unica, owner vem do contexto renderizado etc' },
    sources: { type: 'array', items: { type: 'string' }, description: 'path:linha de cada lista' },
  },
}

const REUSE_SCHEMA = {
  type: 'object',
  required: ['assets'],
  properties: {
    assets: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'whatItHas', 'reusableFor'],
        properties: {
          path: { type: 'string' },
          whatItHas: { type: 'string' },
          reusableFor: { type: 'string', description: 'o que do cookbook ja esta pronto aqui e nao deve ser reinventado' },
          exampleCount: { type: 'number' },
        },
      },
    },
    gaps: { type: 'array', items: { type: 'string' }, description: 'o que o cookbook precisa e NAO existe em lugar nenhum' },
  },
}

const LEI = `A LEI CANONICA esta em /home/augusto/code/ui-tokenizer-v2/docs/law/GRAMMAR.md.
Gramatica: entity[.variant][.anatomy][.property][.state]. As palavras \`content\`, \`surface\` e \`semantic\` sao BANIDAS
(whitelabels da entidade fisica) — no nome do token E como nome de familia/artefato/secao/conceito.
Elas so podem aparecer como "nome antigo a eliminar".`

phase('Discover')

const [learnhouse, makershub, makersAiHub, offenders, prohibitionSites, law, reuse] = await parallel([
  () => agent(`${LEI}

Inventarie o UNIVERSO DE COMPONENTES E SITUACOES VISUAIS do repo /home/augusto/code/learnhouse (frontend em apps/web).
Leia: apps/web/components/ui/ (primitivos shadcn), apps/web/components/Objects/, Dashboard/, Pages/, e apps/web/styles/globals.css.
Para cada familia de componente, liste as SITUACOES VISUAIS distintas que ela pinta (fundo, texto, borda, sombra, icone), com a classe/var atual e path:linha.
Seja EXAUSTIVO: quero cobrir o maximo de componentes e situacoes possiveis, incluindo estados (hover/focus/disabled/selected/invalid/loading) e variantes.
Nao invente: cada situacao precisa de evidencia path:linha real.`,
    { label: 'inv:learnhouse', phase: 'Discover', model: 'sonnet', schema: COMPONENT_SCHEMA }),

  () => agent(`${LEI}

Inventarie o UNIVERSO DE COMPONENTES E SITUACOES VISUAIS do repo /home/augusto/code/makershub (Next.js + Tailwind v4 + tema runtime via useTheme + inline styles).
Leia: app/_components/, app/(pages)/*/\_components/, app/styles/ (colors.ts, globals.css, spacing.ts).
ATENCAO ao stack: esse repo usa MUITO inline style com useTheme() em vez de classe Tailwind — registre isso em stackNote e capture as situacoes mesmo quando a cor vem de objeto JS.
Para cada familia, liste as SITUACOES VISUAIS distintas com evidencia path:linha. Seja EXAUSTIVO (estados e variantes inclusos).`,
    { label: 'inv:makershub', phase: 'Discover', model: 'sonnet', schema: COMPONENT_SCHEMA }),

  () => agent(`${LEI}

Inventarie o UNIVERSO DE COMPONENTES E SITUACOES VISUAIS do repo /home/augusto/code/makers-ai-hub (frontend/, React + Tailwind).
Leia frontend/src/components/ e frontend/src/pages/, e frontend/src/index.css.
Este repo e o ALVO ja tokenizado parcialmente: muitas classes usam vocabulario BANIDO (content-*, surface-*). Capture-as no campo currentClassOrToken — sao a coluna "nome antigo" do cookbook.
Priorize os componentes com mais call sites. Seja EXAUSTIVO em situacoes e estados.`,
    { label: 'inv:makers-ai-hub', phase: 'Discover', model: 'sonnet', schema: COMPONENT_SCHEMA }),

  () => agent(`${LEI}

VARREDURA DE OFENSORES em /home/augusto/code (TODA a pasta, todos os repos).
Ache TODO lugar que ENSINA \`content\`, \`surface\` ou \`semantic\` como vocabulario VALIDO de design token: exemplo bom, alvo de migracao, nome de familia/tier, variante de componente, instrucao a agente.
Territorio prioritario: *.md (docs, planos, relatorios, wikis), .claude/ e .agents/ (skills, CLAUDE.md, AGENTS.md), templates/ do harness, prompts, *.jinja.
EXCLUA de vez: node_modules, .git, dist, build, e o que for claramente outro dominio (semantic HTML/ARIA, CSS \`content:\` property, \`display:contents\`, tailwind \`content.files\`, semantic search/versioning, tema Dracula vendored, spec W3C espelhada).
Use rg com -n e paths absolutos. Classifique cada achado com o campo verdict.
Seja EXAUSTIVO — este inventario vai virar lista de execucao de destruicao/retratacao.`,
    { label: 'sweep:ofensores', phase: 'Discover', model: 'sonnet', schema: OFFENDER_SCHEMA }),

  () => agent(`${LEI}

VARREDURA DE SITIOS DE PROIBICAO em /home/augusto/code (todos os repos).
Ache TODA lista, constante, regex, docstring, tabela ou frase normativa que proibe \`surface\` e/ou \`semantic\` — e verifique se \`content\` esta la tambem.
Exemplos do que procurar: FORBIDDEN = [...], NO_SLOT, listas de "palavras proibidas", "banned words", frases "surface e semantic sao proibidos", tabelas de vocabulario, guards .py/.mjs, testes que asseguram a proibicao, docs normativos.
Para CADA sitio reporte: path absoluto, linha, o snippet, e no campo teaches escreva "TEM content" ou "FALTA content".
EXCLUA node_modules/.git/dist. Use rg -n.
Este inventario vira lista de patch: todo sitio com FALTA content precisa receber content.`,
    { label: 'sweep:proibicoes', phase: 'Discover', model: 'sonnet', schema: OFFENDER_SCHEMA }),

  () => agent(`Extraia o CONTRATO MAQUINA-LEGIVEL da lei de naming de tokens, para gerar um cookbook deterministico.

Fontes (leia todas):
- /home/augusto/code/ui-tokenizer-v2/docs/law/GRAMMAR.md — secoes 4.1 owners, 4.2 anatomies, 4.3 properties, 4.4 variants, 4.5 states, 5 decision rules, 7 scoring, 8 guard
- /home/augusto/code/ui-tokenizer-v2/.claude/skills/tokenize-design-system/reference/anatomy-property.md — matriz anatomia x propriedade
- /home/augusto/code/ui-tokenizer-v2/.claude/skills/tokenize-design-system/scripts/score-naming.mjs — IMPLIED_PROPERTY, NO_SLOT, criterios e pontos
- /home/augusto/code/ui-tokenizer-v2/.claude/skills/tokenize-design-system/scripts/lib/utility-families.mjs — PREFIX_PROPERTY
- /home/augusto/code/ui-tokenizer-v2/tools/gates/ds-naming-law.py — FORBIDDEN e as checagens

Devolva as listas EXATAS (nao resuma, nao invente item), cada uma com path:linha em sources.
Em hardRules capture as regras duras que um gerador de exemplos precisa obedecer: quando a propriedade e OMITIDA, quando um estado exige o par base, o que e proibido escrever, como o owner e escolhido, o que reprova cada criterio do score.`,
    { label: 'extract:lei', phase: 'Discover', model: 'sonnet', schema: LAW_SCHEMA }),

  () => agent(`${LEI}

LEI ZERO — antes de escrever um cookbook do zero, ache TUDO que ja existe e pode ser reusado.
Procure em /home/augusto/code/ui-tokenizer-v2 e /home/augusto/code/makers-ai-hub por material que ja seja cookbook-like:
- exemplos bons/ruins ja escritos (reference/examples.md, anatomy-property.md, GRAMMAR §exemplos)
- mapas de rename ja derivados (docs/reports/*tokenizacao-rodada*.md — o "Mapa de rename, por token antigo")
- artefatos .tokenize/*.json (owners derivados, ocorrencias, clusters)
- testes que ja validam nomes (scripts/test/*.test.mjs)
- qualquer tabela "antigo -> novo" ja existente
Para cada asset diga exatamente o que ele ja tem, quantos exemplos, e o que do cookbook NAO precisa ser reinventado.
Em gaps liste o que o cookbook precisa e nao existe em lugar nenhum.`,
    { label: 'reuso:existente', phase: 'Discover', model: 'sonnet', schema: REUSE_SCHEMA }),
])

log(`descoberta: learnhouse ${learnhouse?.families?.length ?? 0} familias · makershub ${makershub?.families?.length ?? 0} · makers-ai-hub ${makersAiHub?.families?.length ?? 0} · ofensores ${offenders?.offenders?.length ?? 0} · sitios ${prohibitionSites?.offenders?.length ?? 0}`)

return { learnhouse, makershub, makersAiHub, offenders, prohibitionSites, law, reuse }
