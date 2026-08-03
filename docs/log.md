# Log — ui-tokenizer

Índice cronológico append-only, orientado a tempo. Para catálogo por conteúdo,
ver [`index.md`](index.md).

Formato: `## [YYYY-MM-DD] tipo · categoria`.

---

## [2026-08-01] lei · decisao do dono

- **D1 — a grafia emitida FECHOU.** O bloco da §1 que dizia *"Two spellings in
  this block are an OPEN architecture decision"* deixou de estar aberto: classe
  CURTA (`bg-button-primary`) sob o namespace `--color-*`. O dado que decidiu:
  o alvo de referencia roda Tailwind **4.3.3** (medido, gravado no `run-config`
  em `toolchain.versions`) e `--color-*` e o namespace que o `@theme` consome
  para gerar utility — sob `--mh-*` a ponte seria manual para cada token. Custo
  aceito e declarado na lei: a classe sozinha nao mostra mais a propriedade; a
  relacao sobrevive no nome DTCG, que e o que o oraculo julga.
- **D2 — §5.7 nova: cor identica + contrato identico bastam para fundir.**
  Quando `cor` marca 1 (ΔE imperceptivel) E `contrato` marca 1, o par funde e os
  demais sinais nao vetam. A razao: `componente` (Dice do nome do arquivo) e
  `funcao` (tag+role) medem ONDE O CODIGO MORA, nao o que o token e — deixar dois
  sinais de localizacao derrubarem uma identidade que cor e contrato ja
  afirmaram inverte a hierarquia de evidencia do metodo.
- Efeito medido no mesmo comando, antes e depois: fila humana **129 -> 92**;
  fusoes 993 -> 1016; **fusoes por outlier 194 -> 0** (a justificativa mais fraca
  que uma fusao pode ter foi a zero); contratos finais 267 -> 244; nomes com mais
  de um cluster 25 -> 14; iteracoes 4 -> 3.
- Verificado exaustivo: **zero** pares com `cor=1` e `contrato=1` sobraram na
  fila, e **zero** nomes duplicados com o mesmo primitivo — os 14 que restam tem
  cor DIFERENTE e sao a divergencia legitima da §9, que a lei manda expor.

## [2026-08-01] auditoria · planos

- **Documento do PROCESSO morando no repo do ALVO.** O dono pediu para varrer os
  planos recentes de todos os repos suspeitando de extravio. O caso que ele ja
  tinha apontado se confirmou e e o pior possivel: `validacao-pesos.md` — o
  questionario de 40 pares do **F-D0, que bloqueia o APPLY** — vive em
  `<app-alvo>/docs/reports/`. Os pesos que ele valida
  (`cor 40 · contrato 25 · componente 15 · owner 10 · funcao 10`) estao cravados
  em `converge-tokens.mjs` Linhas 199-210, deste repo. Decisao do dono, bloqueante,
  parada em repositorio alheio. Agora rastreada em
  [`pending/f-d0-pesos-da-convergencia-esperam-o-dono.md`](pending/f-d0-pesos-da-convergencia-esperam-o-dono.md).
- **E ela estava invisivel por um ponto cego de lint, medido.** A wiki do alvo
  cobre `docs/`, e `frontend/docs/` esta fora. O `_stray_covered()` ainda da os 13
  documentos daquela pasta por cobertos porque `reports` e `docs` sao genericos e
  ele sobe ate `frontend/`, que alguma pagina cita — **uma mencao a `frontend/`
  silencia a pasta inteira**.
- **O gerador de relatorio quebra a wiki do alvo a cada run.**
  `tokenization-report.mjs` escreve em `ROOT/../docs/reports/` e nao indexa nada;
  rodar o loop uma vez hoje bastou para deixar o lint do app-c vermelho
  com um orfao. As rodadas de 07-30 e 07-31 so nao aparecem assim porque alguem
  as indexou a mao. A instancia de hoje foi indexada com ressalva; a causa esta em
  [`pending/relatorio-de-rodada-nasce-orfao-no-alvo.md`](pending/relatorio-de-rodada-nasce-orfao-no-alvo.md).
- Os tres relatorios `2026-07-2{6,7,8}` existem nos DOIS repos com o mesmo nome,
  divergindo so no banner de retratacao. Classificacao (duplicata x dois papeis)
  em apuracao por workflow.

## [2026-08-01] infra · wiki

- **`docs/pending/` — o backlog virou artefato.** O dono perguntou "o que falta
  para o graph loop rodar end-to-end?" e a resposta so podia ser produzida
  re-derivando tudo na mao. Ao perguntar em seguida *"nao existe uma pasta de
  pending? o wiki nao esta indexando as docs e criando esses checklists?"*, ele
  nomeou o defeito: o `status` do §3 classifica o DOCUMENTO e nunca o ITEM, e o
  `docs_wiki_lint.py` so VALIDA — nada colhia. As pendencias viviam em prosa
  espalhada pelos planos e num `ESTADO.md` escrito a mao, que nascia velho.
- Contrato em [`SCHEMA.md`](SCHEMA.md) §3.1 e [`pending/README.md`](pending/README.md):
  **uma pendencia = um arquivo**, resolver e APAGAR (git e o arquivo, §5), e todo
  item declara `fonte: <path>:<linha>` + `citacao:`.
- Guard novo `tools/gates/pending_index.py`: regenera `pending/index.md` e, com
  `--check`, reprova indice velho, frontmatter invalido e **ponteiro podre** — a
  citacao sumiu da fonte, entao o item pode ja estar resolvido e vira
  re-auditoria. Essa e a checagem que justifica o script: backlog cheio de item
  fechado e pior que backlog nenhum, porque faz o agente perguntar ao dono o que
  a lei ja respondeu (aconteceu em 2026-07-31 com a D1 de propriedade-no-nome).
  Os tres detectores foram vistos falhando antes de entrar.
- Portado para o orions-belt na MESMA mudanca — `engine/lint/`, `.harness/lib/` e
  `templates/.harness/lib/`, mais o §3.1 no `templates/docs/SCHEMA.md.jinja`. A
  licao de 2026-07-31 (guard corrigido nos consumidores e esquecido na fonte) diz
  que a ordem inversa deixa o proximo instalado sem o guard.
- Colateral, do mesmo tipo que a pasta existe para matar: tres ponteiros de canon
  estavam stale. `AGENTS.md` afirmava TRES palavras banidas (sao cinco desde
  2026-08-01) e mandava procurar pendencia do dono em ⚠ no corpo dos docs, citando
  uma decisao (`divider` como owner) resolvida no mesmo dia; `index.md` repetia as
  tres palavras e dava `foreground-color` como nome vigente; `SCHEMA.md` mandava
  rodar `.harness/lib/…`, caminho que este repo nao tem.

## [2026-08-01] artefato · lei

- [`law/design_system_template.json`](law/design_system_template.json) — **versionado por decisão
  do dono**. Estava no `.gitignore` desde que nasceu como rascunho gerado; deixou de ser rascunho
  quando ganhou `$law`, `$forbidden` e `$validation` — virou o índice de completude do cookbook, e
  dois docs versionados já o citavam. Ignorado, ele não sobrevivia a um clone e nenhum guard o
  validava.
- Auditado na entrada: **153 dos 370 nomes vinham do vocabulário velho** (26 com a anatomia
  `.label`, 75 com a propriedade `.foreground-color`), porque ele foi escrito antes da decisão de
  hoje. Convertidos pela mesma regra do cookbook — quando a parte É o texto a propriedade some,
  quando a tinta é de outra parte ela vira `color`. Resultado: **370 nomes, 370 com nota 100**, e
  os 75 tokens com estado têm todos o par base (§5.4), zero órfãos.

## [2026-08-01] pesquisa · lei

- [`law/2026-08-01-ui-ux-pro-max-o-que-serve.md`](law/2026-08-01-ui-ux-pro-max-o-que-serve.md)
  — LEI ZERO sobre `nextlevelbuilder/ui-ux-pro-max` (112.173 ⭐, MIT, push de 2026-07-31), a skill
  de onde descende nosso `design_system_template.json`. Dissecada por 4 agentes. Veredito:
  **COMPLEMENTAR** — ela resolve VALOR (que cor escolher), nós resolvemos NOME. Os tokens dela não
  têm dono e pontuam **35/100** no nosso oráculo (`NO OWNER`), logo ela não arbitra a ordem do
  nome. Serve a espinha de cobertura (24 seções), o checklist de estados e o contrato de
  zero-match anti-alucinação. O vocabulário dela — `surface`, `on-surface`, `semantic tokens`,
  `danger`, `accent`, `tertiary`, recomendados POSITIVAMENTE em `quick-reference.md:161` e
  `app-interface.csv:30` — é o nosso anti-vocabulário, e vira corpus de anti-exemplos.

## [2026-08-01] cookbook · lei

**O cookbook completo: 643 exemplos, 643 com nota 100.** 9 capítulos gerados por 10 agentes a
partir de 598 situações medidas nos três produtos (app-b, app-a, app-c) e da
extração Figma do app-a (`DESIGN_TOKENS/10-buttons.json`, 27 variantes com node id). Cada
nome foi submetido ao oráculo antes de entrar; 85 linhas que não passaram estão na seção
**Exceções** com o motivo escrito, e as lacunas de lei e decisões do dono ficam em blocos
recolhíveis por capítulo.

Dois defeitos que o validador pegou na montagem, ambos reais: o capítulo de entidades ausentes
misturou nomes anotados com pendência entre os tokens limpos (foram para Exceções), e o cookbook
ensinava `menu.row.background-color.hover`/`.focus` e `prompt.row.background-color.selected`
**sem o par base** — tabela com estado e sem repouso é tabela incompleta (§5.4).

Achado que a §5.5 previu: **91 situações não casaram com nenhuma das 42 entidades**. A triagem
mapeou a maioria para entidade existente e isolou 3 pedidos de entidade nova com evidência —
`audio-player`, `podium` e `scrollbar`.


- [`law/cookbook.md`](law/cookbook.md) — nasce o cookbook: a terceira peça que faltava entre a
  LEI (a regra) e `examples.md` (a regra por contra-exemplo). Capítulo 0 traz os casos canônicos,
  um por regra, e cada um é submetido ao mesmo oráculo que julga token de produção
  (`validate-cookbook.mjs`). **10 exemplos, 10 com nota 100.**
- [`scripts/test/cookbook.test.mjs`](../.claude/skills/tokenize-design-system/scripts/test/cookbook.test.mjs)
  — a bateria que o dono pediu o path e não tinha: era heredoc inline, descartado ao terminar.
  Agora são 9 testes em 3 camadas (gramática caso a caso · auto-teste do validador com cookbook
  falso · o cookbook real), e roda **sem app-alvo**.
- Efeito colateral medido: `score-naming.mjs` resolvia o app-alvo no IMPORT, e o efeito quebrava
  todo importador que só queria a lei. Agora é preguiçoso — `PROJECT` só é resolvido por
  `collectUses` e pelo CLI, que de fato varrem código. Sem env de alvo a suíte foi de
  **166 testes / 132 pass / 31 fail** para **287 / 255 / 29**: os 2 que crashavam no próprio
  import (`lei-x-familias`, `utility-families`) voltaram a rodar, 114/114. É a Fase A4 do plano
  de lacunas, fechada por necessidade do cookbook.

## [2026-07-31] correção · lei

- Retratações pós-varredura: `case-study/2026-07-26-tokenization.md` (tier 2 sem
  `--color-content-*`; "use text-content-primary" superado),
  `case-study/2026-07-27-relatorio-auditoria-i18n-motion-cor.md` (alvos
  `duration-surface`/`text-content-on-selected` superados; lacuna dos guards em
  tokens não-cor registrada) e `plans/2026-07-30-plano-reconciliado.md` (⚠ na
  linha que tratava `surface` como parte anatômica válida). A entrada deste log
  em [2026-07-31] que citava "text-content-tertiary … já estão migrados" fica
  RETIFICADA por esta: casar com contrato de nome banido não é estar migrado —
  é dívida com owner por derivar.

## [2026-07-31] plano · processo

- [`plans/2026-07-31-plano-fechar-lacunas-implementacao.md`](plans/2026-07-31-plano-fechar-lacunas-implementacao.md)
  — auditoria da lista de 8 lacunas do dono (6 confirmadas, 1 já corrigida em
  `b7a0405`, 1 refinada) + plano A0–C2 para fechar o control plane. Rodada
  adversarial única devolveu REPLANEJAR (3 críticos, incorporados); baseline
  real da suíte: `npm test` = 132 pass / **31 fail** — o "277/0" anterior era
  artefato de cwd/env.

## [2026-07-31] medição · processo

**Os números do alvo derivam, e derivaram hoje.** As entradas anteriores deste
log e as tabelas do `README`/`ESTADO`/`como-funciona` medem o `app-c`,
que está **sendo migrado enquanto medimos** (18 arquivos modificados na árvore de
trabalho do alvo em 2026-07-31). Nenhum número abaixo é retratação de erro: é
deriva de alvo móvel, e a única defesa é o comando ao lado.

Re-medido hoje, `node .claude/skills/tokenize-design-system/scripts/tokenize.mjs
--root <app-alvo>`:

| grandeza | valor no log anterior | medido 2026-07-31 |
|---|---:|---:|
| ocorrências que violam a lei | 504 | **480** |
| arquivos atingidos | 201 | **187** |
| clusters de contexto | 311 | **293** |
| clusters com nome derivado | 252 | **232** (386 ocorrências, 80,4%) |
| fusões | 211 (200 + 11) | **192** (179 confiança + 13 outlier) |
| contratos finais | 41 | **40** |
| iterações até convergir | 4 | **4** |
| pares / ocorrências para o dono | 8 / 9 | **8 / 9** (idêntico, mesmas 8 chaves) |
| clusters sem slot em §4.3 (LAW GAP) | — | **3**, 8 ocorrências |

`score-naming.mjs --root .` no alvo: **97 tokens**, média **68,9**, **56 ok · 41
em revisão** (o log anterior dizia média 58,4 e 78 em revisão). `NOT EVALUABLE`
= **3.902** usos.

`measure-coverage.mjs --root .`: denominador **29.253** usos de classe;
`B` tokenizável fora de entidade **8.878**, dos quais `B1` já em contrato
**2.889** e `B2` utility cru **5.989**; migrável `A + B2` = **19.437 (66,4%)** —
não os 68,9% da entrada de 2026-07-30. `4.886` usos (81,6% de B2) caem em
famílias **sem slot em §4.3**.

`npm test` neste repo: **125 testes, 118 pass, 4 fail, 3 skip**. Com
`TOKENIZE_TEST_ROOT=<app-alvo>`: **125, 122 pass,
2 fail, 1 skip**. As 2 falhas restantes são de ambiente — `utility-families` e
`visual-contract` exigem um alvo com `sourceRoots`, e falham fechadas com
*"No source root found under …"*. O número **45/45** que circulava no `README` e
no `ESTADO` **não reproduz em nenhuma configuração** e foi substituído nos dois.

## [2026-07-31] release · processo

**`v2.0.0` publicada.** A tag aponta para `cabf1df`, e `origin/main`,
`origin/v2` e `v2.0.0` são **o mesmo commit** — `1dcaf16` (o v1 congelado) é
ancestral dele, logo o avanço de `main` foi **fast-forward real**, sem merge
commit. 49 commits desde o v1, 229 arquivos versionados.

```bash
git rev-parse v2.0.0 origin/main origin/v2      # três vezes cabf1df
git merge-base --is-ancestor 1dcaf16 origin/main && echo fast-forward
git rev-list --count 1dcaf16..origin/main       # 49
```

Isso encerra o risco *"v2 não pushado, os commits só existem nesta máquina"*
declarado na §7 do `ESTADO.md`. O ref **local** `main` continua em `1dcaf16` por
não ter sido atualizado nesta cópia de trabalho; é defasagem de ref local, não
estado do repositório.

## [2026-07-31] lei · lei

**Terceira palavra banida: `content`.** `FORBIDDEN` em
`tools/gates/ds-naming-law.py` Linha 121 passa a ser
`("surface", "semantic", "content")`, e a §3.1 do `GRAMMAR.md` dá o motivo
medido: `content-*` mistura dois eixos (papel de texto e intenção semântica) sem
dizer qual, e `content-primary` sozinho tinha **1.647 usos em 26 arquivos**.

**`color` → `foreground-color` na §4.3.** Nome de token `card.color` não diz se
é o texto ou o preenchimento do card. Material 3 desambigua pela anatomia,
Primer cunhando a propriedade, shadcn/ui anexando o papel; adotamos a mesma
decisão, escrita por extenso. Abreviar para `fg` foi medido e rejeitado
(§8 do doc de evidências).

**O guard deixou de ser só denylist.** `ds-naming-law.py` ganhou duas checagens
que antes não existiam:

- `violations_grammar()` (Linha 235) — validação **positiva**: em vez de listar o
  proibido, exige que o nome case a gramática do §4.1/§4.3. `ink`, `copy` e
  `blergh` reprovam por não estarem no vocabulário, não por estarem numa lista
  negra;
- `violations_prefix_property()` (Linha 312) — o prefixo do utility tem que
  **concordar** com a propriedade declarada no nome. `text-` pede
  `foreground-color`; `bg-text-…` é violação.

Rodado contra o alvo: `python3 tools/gates/ds-naming-law.py` → *"LEI DE NAMING
OK — nenhuma violacao nova"*, exit 0.

- [`law/2026-07-31-ordem-do-nome-evidencias.md`](law/2026-07-31-ordem-do-nome-evidencias.md)
- [`law/GRAMMAR.md`](law/GRAMMAR.md) §3.1 e §4.3

## [2026-07-31] autocontenção · processo

**O repo do processo passou a reproduzir o próprio processo.** 9 scripts estavam
**ausentes** e 5 **divergentes** em relação ao alvo onde o trabalho aconteceu —
entre os ausentes, os dois codemods que produzem os lados `before` e `after` do
par de pixel, sem os quais nenhuma prova visual era regerável a partir daqui.
Sincronizado e verificado: os 14 arquivos existem e `applyBindingWaivers` está
em `scripts/lib/visual-contract.mjs` Linha 994.

Terceira falha do mesmo inventário: **nenhuma dependência declarada**. `package.json`
passa a existir na raiz e declara **7 pacotes** — `@babel/parser`,
`@playwright/test`, `ajv`, `axe-core`, `pixelmatch`, `pngjs`, `typescript` — e
expõe `test`, `ui:evidence` e `guard:contrast`.

- [`AUTOCONTENCAO.md`](AUTOCONTENCAO.md) — o inventário e o estado depois

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
**7.907 → 7.978**, exceção cai na mesma medida. Os 71 usos vêm da cadeia de
variante genérica — a allowlist fixa não enxergava `placeholder:` (339 usos),
`peer-checked/public:`, `group-disabled:`, `enabled:`, `after:`, `[&_p]:`.
Mesmo defeito do `p`/`px`.

> **Retificação (mesma data).** A redação original dizia que esses 71 usos
> saíram de "exceção aprovável" para **trabalho BLOQUEANTE**. Falso para 53
> deles: `placeholder:text-theme-settings-input-placeholder` (17),
> `light:placeholder:text-content-tertiary` (11),
> `placeholder:text-content-tertiary` (10),
> `group-disabled:text-content-tertiary` (4) e afins **já citam token nomeado
> do DS** — casam `EM_CONTRATO`, logo já estão migrados. Trabalho novo de
> verdade: **18 usos**, não 71.
>
> A causa é maior que a frase: o balde inteiro era rotulado BLOQUEANTE porque
> `emContrato` nunca era subtraído de balde nenhum. Medido, **2.295 de 7.978
> (28,8%)** do balde já passam por contrato. Corrigido em
> `lib/bundle-census.mjs::partition` (quatro baldes, soma verificada) e travado
> por `scripts/test/bundle-partition.test.mjs` (8/8). O `migrável` do plano cai
> de **75,5% para 68,9%**.
>
> Reproduz o split 71 = 53 + 18:
>
> ```bash
> cd <app-alvo>
> S=/home/augusto/code/ui-tokenizer-v2/.claude/skills/tokenize-design-system/scripts
> node --input-type=module -e '
> const S=process.env.S;
> const {census,isEntity,EM_CONTRATO}=await import(S+"/lib/bundle-census.mjs");
> const {TOKENIZABLE_UTILITY_RX:NOVO}=await import(S+"/lib/utility-families.mjs");
> const HEAD=/^(?:hover:|focus:|active:|group-hover:|dark:|light:|disabled:|focus-visible:|sm:|md:|lg:|xl:|2xl:)*-?(?:bg|text|border|ring|shadow|fill|stroke|outline|divide|accent|caret|placeholder|p[xytrbles]?|m[xytrbles]?|gap|space|rounded|font|leading|tracking)(?:-|$)/;
> const {bundles}=census(process.cwd());
> let cru=0,contrato=0;
> for(const[,v]of bundles){ if(isEntity(v,2,4))continue;
>   for(const c of v.classes) if(!HEAD.test(c)&&NOVO.test(c))
>     EM_CONTRATO.test(c)?contrato+=v.n:cru+=v.n; }
> console.log("delta",contrato+cru,"| ja em contrato",contrato,"| trabalho novo",cru);'
> # delta 71 | ja em contrato 53 | trabalho novo 18
> ```

**Segundo achado, quantificado só agora:** dos 5.683 usos que sobram como
trabalho bloqueante real, **3.572 (62,9%)** caem nas propriedades sem slot em
§4.3 — são trabalho **bloqueado pela lei**, não trabalho executável. O oráculo
passa a imprimir o veredito por propriedade e a **falhar fechada (exit 3)** se
não conseguir ler §4.3.

Convergência **não quebra**: no alvo real tudo idêntico (504 ocorrências, 211
fusões, 41 contratos); em fixture que exercita as famílias novas, clusters
22 → 48 e fusões/contratos/iterações **inalterados** (9 / 10 / 3), porque o
cluster sem slot falha fechado antes de derivar nome.

> **Deriva de alvo, mesma data.** Os números desta entrada que medem o
> `app-c` (504/211/41, 7.907 → 7.978, 5.683, 2.295/7.978, 75,5% → 68,9%)
> **não reproduzem mais** — o alvo continuou sendo migrado depois desta medição.
> Valores de hoje e comandos na entrada *medição · processo* do topo. A
> conclusão da entrada (§4.3 não tem slot para 41 dos 53 prefixos; convergência
> não quebra) sobrevive; as contagens não.

- [`law/2026-07-31-achado-4-3-sem-slot-nao-pintura.md`](law/2026-07-31-achado-4-3-sem-slot-nao-pintura.md)

## [2026-07-31] arquitetura · fork da skill

**Causa raiz medida.** O alvo executa uma cópia divergente da skill — inclusive
no gate de conclusão. Origem: eu versionei 47 arquivos de código executável para
calar um guard de **link markdown**. O risco foi declarado em prosa no commit, e
prosa não é enforcement.

Duas explicações minhas foram **refutadas pela medição**: o alvo não está
uniformemente atrás, e não são linhagens rivais — 9 dos arquivos "à frente" são
**trabalho não commitado**, a um `git checkout` de sumir.

- [`architecture/2026-07-31-fork-da-skill-causa-raiz.md`](architecture/2026-07-31-fork-da-skill-causa-raiz.md)

## [2026-07-30] plano · planos

**Reconciliação.** O plano vigente descrevia "compilador do Tailwind como
oráculo"; o código construído era um pipeline de naming de cor. Medido: **0 hits**
no plano para cluster de contexto, convergência, lei de naming, ΔE, fila humana.
Documento e código descreviam projetos diferentes.

Números que passam a ser contrato: universo **32.662** usos de classe (+158
`style={{}}`, +index.css), hoje **1,5%** tratado, meta **bloqueante 68,9%**, teto
**81,4%**, e **18,6%** declarado fora de escopo por não haver padrão.

> **Deriva de alvo (2026-07-31).** `measure-coverage.mjs --root .` no alvo hoje
> dá denominador **29.253** usos de classe e migrável **66,4%**, não 32.662 e
> 68,9%. Ver a entrada *medição · processo* do topo.

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
