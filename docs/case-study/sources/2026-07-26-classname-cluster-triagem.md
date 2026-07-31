# Triagem dos clusters de className — makers-ai-hub

Gerado por `yarn classname:mine` → `.harness/lib/classname-miner-v2.mjs`, o miner que **o próprio orions-belt já shipava**. Não há cópia do script neste repo: a primeira versão desta triagem rodou sobre um porte manual do miner do learnhouse em `frontend/scripts/`, que era duplicata — o do harness é o mesmo minerador já generalizado (raiz, saída e tags interativas por flag; aliases lidos do `frontend/jsconfig.json` (no repo alvo) via TS Compiler API). O porte foi apagado e o único patch necessário virou genérico e ficou upstream no belt: `--ext` (ver `.harness/README-FORK.md` (no repo alvo)).

## Números

| Métrica | Valor |
|---|---|
| Arquivos varridos | 580 |
| Ocorrências de `className` | 5.956 |
| N-grams candidatos | 5.807 |
| Entidades JSX/interativas | 5.337 |
| Clusters semânticos | 128 |

Reproduzido com o pipeline do harness em 2026-07-26. Os números da primeira rodada (587/5.957) vinham do porte apagado, que varria `frontend/` inteiro em vez de `frontend/src` — 7 arquivos fora de `src` (scripts de build/tokens, sem JSX de produto). Contagem de clusters idêntica (128) e veredito inalterado.

## Contrato aplicado (skill `classname-token-workflow`)

> Nunca promover repetição **textual** direto para token. `flex items-center`, `gap-*`, `text-sm` são **idioma Tailwind** até prova semântica contrária. A unidade de análise é a entidade JSX, não a string.

## Veredito dos maiores clusters

### 1. Input de settings — `component_contract` (não token)

Os **12 maiores clusters por economia são a mesma entidade**: o `<input>` de formulário de settings, repetido em até **117 arquivos** (188-246 ocorrências dependendo do n-gram). Reverificado no dataset regerado: 12/12 dos maiores n-grams contêm `settings-input`, maior economia 35.796 chars.

```
border-none bg-theme-settings-input-bg text-content-primary
placeholder:text-theme-settings-input-placeholder text-sm rounded-lg
focus:outline-primary-button active:outline-primary-button outline-none
```

**Por que `component_contract` e não `style_token`:** é a *mesma entidade de produto* (campo de texto de configuração) com o mesmo comportamento de foco/placeholder. Um `style_token` juntaria entidades diferentes que só parecem iguais — não é o caso. O certo é um `<SettingsInput>` que encapsule o contrato.

**Economia estimada:** ~35.800 chars no maior n-gram.

**Risco de fazer errado:** promover a string para um token CSS (`.input-settings`) manteria os 117 call-sites e só trocaria a duplicação de lugar. O ganho real vem do componente, que carrega também `type`, `aria`, estados e validação.

### 2. Idioma Tailwind — `no_abstraction`

N-grams de layout puro (`flex items-center gap-2`, `w-full h-full`) aparecem no topo por frequência, **não** por semântica. Ficam como estão, por contrato.

## Estado

Este documento é **triagem**, não execução. Nenhum componente foi criado nesta rodada: extrair `<SettingsInput>` toca 117 arquivos e exige a disciplina de 1 arquivo = 1 commit com evidência visual — trabalho próprio, a ser priorizado pelo dono.

O dataset completo (12 MB de NDJSON: `occ`/`ent`/`ngram`/`cluster`/`run`) **não é versionado** — vai para `.cache/classname-mining/` (gitignored) e é reproduzível com `yarn classname:mine`. O próprio miner documenta que a fonte doadora removeu o dump monolítico do repo em 2026-07-07 pelo mesmo motivo. Versionados ficam só o relatório legível `classname-token-mining-v2.md` (14 KB) e esta triagem; o `run.ndjson` carrega o `gitHead` e o `sourceFingerprint` que dizem contra qual árvore o dataset foi gerado.

`yarn classname:mine` encadeia dois alvos porque `--emit-full` é exclusivo (não regrava o relatório canônico): `classname:mine:report` escreve o `.md` em `docs/`, `classname:mine:dataset` escreve o NDJSON em `.cache/`.

> Armadilha do ferramental, para quem for rodar: `--self-test` grava no diretório de saída **default**, não num sandbox — rodá-lo sem `--out` sobrescreve o relatório canônico com um vazio (aconteceu aqui; o relatório foi regerado). Sempre passar `--out` num diretório descartável ao usar `--self-test`.
