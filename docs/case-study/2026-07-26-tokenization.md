# Design system tokenizado — arquitetura e contrato

> ⚠ **CORRIGIDO em 2026-07-31:** `content` foi banido pela lei (3ª palavra de
> `FORBIDDEN`, junto de `surface`/`semantic`) — `--color-content-*` saiu do tier 2
> e qualquer instrução abaixo que o use como destino está superada; é dívida a
> migrar (mapa: relatório da rodada 2026-07-31 §4, repo do app-alvo).

> **A wiki vence o source.** Se um componente contradiz esta página, o componente está errado.

## Fonte de verdade

`app-a@4afa7899` (`origin/FBI-2708`, PR #193) — pinado em `frontend/tokens/SOURCE-PIN.json`.

**A branch NÃO está mergeada na main** (`rev-list --left-right --count origin/main...origin/FBI-2708` = `0 77`; `ls-tree origin/main frontend/tokens/` = vazio). Toda extração usa `git show <commit>:<path>`, **nunca** o nome da branch — um rebase mudaria valores em silêncio.

`DESIGN_TOKENS/` (18 JSONs) foi **rejeitado** como fonte: último toque em 2026-07-13 num commit "wip: snapshot", com seções literalmente `TODO:`. Só a §22 `Z_INDEX_SCALE` foi aproveitada.

## Arquitetura (3 tiers)

```
tokens/*.tokens.json        (fonte única de VALOR, shape DTCG)
      ↓  yarn tokens:build
src/styles/generated/*.css  (artefato — NUNCA editar à mão)
      ↓  @import no index.css + ponte no tailwind.config
classes utilitárias         (bg-surface-panel, text-content-primary, p-content…)
```

- **tier 1 primitivo** — `--color-pink-medium`, rungs cruas.
- **tier 2 papéis** — `--color-border-*`, `--color-pair-*`. É a API pública.
- **tier 3 alias** — `--theme-*` (compatibilidade com os 2.4k call-sites) e os pares (`--primary`, `--primary-foreground`).

> ⚠ **CORRIGIDO em 2026-07-29.** A versão anterior desta lista incluía
> `--color-surface-*` no tier 2 e o chamava de "API pública". **Isso contradiz a
> lei de naming** (`frontend/tokens/GRAMMAR.md` §2), que proíbe `surface` como
> nome: ele descreve a LOCALIZAÇÃO da cor no eixo z, que é contexto, não papel.
> Medido: das 11 famílias `surface-*` consumidas, em 9 a palavra é **redundante**
> (só usadas como `bg-`, e `bg-` já diz que é fundo) e em 2 é **mentira**
> (`surface-selected` pinta borda, `surface-selected-foreground` pinta texto).
> Como este doc abre com "A wiki vence o source", a linha errada era fonte ativa
> de erro para quem a lesse primeiro. `surface-*` continua existindo no código —
> é **dívida a migrar**, não API. Veredito por token em
> `2026-07-29-veredito-naming-tokens.md`.

## Regras não-negociáveis

1. **Toda cor com canal usa `rgb(var(--x-rgb) / <alpha-value>)`.** Medido no Tailwind 3.4.6: a forma `var(--x)` com `/N` emite **zero regra CSS** — o fundo some sem erro nem aviso.
2. **Rótulo de container colorido é branco invariante** (exceção única: `warning`, rótulo escuro). O tema escolhe o *tom* do container; o container é obrigado a carregar branco (≥4,5:1).
3. **`text-white` sobre superfície neutra é proibido** — passa no dark e reprova no light (medido: 1,0:1, branco sobre branco). Use o token de texto do owner da situação (lei: `<owner>.foreground-color`); o antigo `text-content-primary` inverte por tema mas é vocabulário banido — fonte de migração, nunca destino.
4. **Artefato gerado não é dívida** — `--exclude-dir=generated` no ratchet. Mas também **não** entra na `.ds-allowlist`: allowlistar dívida transforma o ratchet em teatro.
5. **Migração: 1 item = 1 arquivo/grupo = 1 commit.** Replace-all global é proibido — teria apagado o rótulo de 77 botões cujo `text-white` é legítimo.
6. **Evidência renderizada, não diff.** Trabalho visual só fecha com PNG + manifest.

## Guards (7, todos executáveis)

| Guard | O que pega |
|---|---|
| `yarn tokens:build` + `git diff --exit-code` | artefato fora de fase com o JSON |
| `node --test tokens/parity.test.mjs` | cascata quebrada (light herdando dark), `[object Object]`, sintaxe v4 |
| `tokens/parity-with-source.mjs` | divergência de **cor** vs. a fonte pinada |
| `tokens/keyframe-parity.mjs` | divergência de **animação** vs. a fonte |
| `ds-gate.sh` | hardcode novo (ratchet; `--require-decrease` recusa empate) |
| `ds-pairs-check.py` | par que reprova WCAG AA nos 2 temas |
| `tokens/score-naming.mjs` | **nota determinística de qualidade semântica** do nome e de cada aplicação (lei: `tokens/GRAMMAR.md` §7; corte 70/100; fila em `2026-07-29-fila-revisao-naming.md`) |
| `ds-dead-classes.py` | (a) classe morta, (b) alpha sem canal, (c) par órfão guard↔runtime |

O vetor (c) existe porque sem ele apontar a utility direto para a paleta deixaria o `ds-pairs-check` **verde** validando um token que a tela não usa. Foi exatamente o que ele pegou: `success` apontava para `#1e7e34` hardcoded.

## Reconciliação quando o PR #193 mergear (ou for rebasado)

1. `git -C <app-alvo> fetch origin`
2. `node frontend/tokens/parity-with-source.mjs` → lista as divergências contra o pin atual.
3. Se o merge trouxe mudanças desejadas: atualizar `commit` em `SOURCE-PIN.json`, rodar `yarn tokens:build`, revisar o diff do artefato, capturar evidência e commitar.
4. Divergência que se **quer** manter vira linha em `tokens/EXCEPTIONS.json` com motivo — nunca silêncio.

## Naming: medido, não julgado

Nome de token **não se decide por opinião**. `node tokens/score-naming.mjs` dá
duas notas — do NOME e de cada APLICAÇÃO — pelo método determinístico do
`tokens/GRAMMAR.md` §7, cujo princípio é: *uma palavra tem valor semântico se, e
somente se, removê-la perde informação.*

Corte **70/100**. Abaixo → revisão obrigatória.

## Pendências

Ver `frontend/tokens/MIGRATION-LEDGER.md`.
