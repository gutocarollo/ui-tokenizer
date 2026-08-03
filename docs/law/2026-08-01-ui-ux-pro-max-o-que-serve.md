# ui-ux-pro-max: o que serve, o que não serve, e por quê

> **Evento, 2026-08-01.** O dono perguntou: *"não existe nada que possamos
> utilizar daqui? Ela tem 112 mil estrelas no GitHub. É um padrão de mercado."*
> LEI ZERO manda pesquisar antes de construir, então o repo foi clonado e
> dissecado por 4 agentes (gerador, base CSV, stacks/templates, engenharia).
> Este documento é o resultado, para ninguém precisar refazer a pergunta.

## O que ela é, medido

`nextlevelbuilder/ui-ux-pro-max`, **112.173 estrelas · 11.969 forks · MIT ·
criada 2025-11-30 · último push 2026-07-31**. Não é hype morto: está viva.

Arquitetura: **base de conhecimento em CSV (1,7 MB) + scripts Python stdlib-only
+ templates por stack**. `design_system.py` tem 1.479 linhas; `core.py` traz um
BM25 próprio; `data/` tem 13 tabelas de decisão (`ui-reasoning`, `colors`,
`typography`, `charts`, `motion`, `ux-guidelines`…) mais 22 CSVs por stack.

Nosso `design_system_template.json` declara `"$methodology": "Based on
ui-ux-pro-max-skill Gold Standard"` — ele **descende dela**.

## O veredito em uma linha

**Ela resolve VALOR; nós resolvemos NOME.** São eixos diferentes, e o eixo dela
não responde a nossa pergunta.

| | ui-ux-pro-max | ui-tokenizer |
|---|---|---|
| pergunta | *que cor/fonte/padrão eu escolho para um SaaS de saúde?* | *esta situação renderizada, como se chama?* |
| entrada | tipo de produto, estilo, vertical de negócio | a situação visual medida no código |
| saída | recomendação de valores + guidelines | `entity[.variant][.anatomy][.property][.state]` |
| tier | papel global sem dono (`--color-primary`, `--color-on-primary`) | componente com dono obrigatório |

**A consequência dura:** os tokens que ela emite **não têm dono**. `--color-primary`
pontua **35/100** no nosso oráculo, reprovado por `NO OWNER` — o mesmo critério
que baniu `content-primary`. Ela não pode ser citada como precedente para a
ordem do nome, porque no tier dela não existe slot de propriedade nem de
variante para ordenar: o `on-` de `on-primary` funde propriedade e relação numa
preposição.

## O que serve

**1. Espinha de cobertura — o item de maior valor.** As 24 seções do template
que ela gera (`01_LAYOUT` … `17_MODALS_POPUPS`, `13_FORMS`, `16_TABLES`,
`15_CHARTS`) já são a matriz *componente × types × sizes × states*. Adotada como
índice de completude do cookbook, "faltou algum componente?" vira mecânica em
vez de memória.

**2. Checklist de estados de interação.** `Focus/Hover/Active/Disabled/Loading`
como mínimo obrigatório por componente interativo — vira critério de cobertura
por entidade no cookbook: todo `button`/`field`/`nav-item` deve ter os cinco ou
declarar por que não.

**3. O contrato de zero-match, anti-alucinação.** Quando a busca não bate com
nada, a skill devolve texto instrutivo explícito em vez de inventar. É o padrão
que um cookbook de 643 exemplos precisa: perguntar "como se chama X" e receber
"não há linha para isso, e aqui está como propor uma" é infinitamente melhor que
receber um nome plausível e falso.

**4. O par container/rótulo como checklist.** O `X` + `On X` dela (linhagem
Material) é o mesmo contrato dos pares coloridos que o app-b já tem — serve
de confirmação upstream, não de nome a copiar.

**5. Ponte "nome antigo → nome novo".** Os CSVs de stack (`shadcn.csv`,
`react.csv`) enumeram as sub-partes esperadas por componente Radix/shadcn — útil
exatamente na coluna *nome antigo* do cookbook.

## O que NÃO serve — e por que rejeitar é o achado

**1. O vocabulário dela é o nosso anti-vocabulário.** `surface`, `on-surface`,
`semantic tokens`, `danger`, `accent`, `cta`, `tertiary` aparecem como
recomendação POSITIVA (`html-tailwind.csv` linhas 23 e 52;
`quick-reference.md` linha 161: *"Define semantic color tokens (primary,
secondary, error, surface, on-surface)"*; `app-interface.csv` linha 30: *"Use
semantic tokens"*). Importar a terminologia reintroduziria exatamente o que foi
banido. **Uma fonte de 112k estrelas recomendando o vocabulário que nós
proibimos é dado, não autoridade** — e é a prova de que a proibição precisa de
guard executável, porque a pressão cultural para usar essas palavras é enorme.

**2. `accent` e `tertiary` não existem na nossa lei.** Ela usa os dois como
papéis de primeira classe (todas as 192 linhas de `colors.csv`). Adotar exigiria
emenda ao §4.4 — decisão do dono, não importação silenciosa.

**3. A busca BM25 aplicada ingenuamente é perigosa.** Ela ranqueia por
similaridade textual **sem checar se a linha retornada obedece a lei**. Num
cookbook isso devolveria um nome parecido em vez do certo. Se portarmos, o
ranqueamento tem que passar pelo oráculo antes de responder.

**4. `validate_data.py` não é equivalente ao nosso guard.** Ele valida schema de
CSV; não tem noção de lei de nome. Não deve ser apresentado como equivalente ao
`ds-naming-law.py`.

**5. O eixo de organização é vertical de negócio** (SaaS, E-commerce,
Healthcare), não entidade física. Estrutura incompatível com a nossa.

## Licença

MIT. Porte exige atribuição — se algum trecho de código for portado (o candidato
real é o BM25 de `core.py`), entra com cabeçalho de crédito e menção no `NOTICE`.
Nada foi portado até esta data.

## Decisão

**COMPLEMENTAR, com porte parcial.** Adotamos a espinha de cobertura e os
checklists (itens 1, 2, 4, 5) — que são estrutura, não vocabulário. O contrato
de zero-match (item 3) é o único candidato a porte de código, e só faz sentido
depois que o cookbook tiver busca. O vocabulário dela fica **explicitamente
rejeitado** e serve, daqui em diante, como corpus de anti-exemplos.
