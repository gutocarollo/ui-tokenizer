#!/usr/bin/env python3
"""
GUARD DA LEI DE NAMING.

LEI (ordem direta do owner, 28/07): `semantic` e `surface` sao CONTEXTO do token,
nao NOME. O identificador que o codigo consome e
`entidade[.variante][.anatomia][.propriedade][.estado]`. Tier, dominio e conceito ficam
em metadado, centralizados, e ninguem os digita.

Fonte: review adversarial do owner no PR #193 / FBI-2708.
  H-021 — `surface.*` servia owners e propriedades incompativeis: `surface.panel`
          pintando text E borda, `surface.canvas` como trilho de progresso E
          fundo de toggle. "Diz qual e a cor, nao diz onde ela vive nem por que."
  H-023 — `semantic` era o nome de uma CAMADA arquitetural e foi carimbado
          dentro do identificador que o componente consome.

POR QUE UM GUARD, E NAO SO UMA REGRA ESCRITA: a regra ja existia no template do
PR #193 e foi violada assim mesmo, porque nada a executava. Regra em prosa nao
para um codemod. Este script para.

MODO RATCHET: a baseline registra a divida existente e so encolhe. Nome novo
violando a lei falha; o legado passa ate ser migrado.

  python3 scripts/ds-naming-law.py            # compara com a baseline
  python3 scripts/ds-naming-law.py --record   # grava a baseline current
  python3 scripts/ds-naming-law.py --listar   # mostra cada violacao com local
"""
import json
import pathlib
import os
import re
import sys

# ROOT e a raiz do APP medido, nao a do repositorio do processo.
#
# Este guard vive no repo canonico (onde nao ha `src/`) e roda contra um app
# alvo. Cravar `parent.parent` fazia com que ele so funcionasse na copia
# vendorizada dentro do alvo — o repo canonico nao conseguia rodar o proprio
# guard nem para testa-lo. Mesma classe de defeito que ja apareceu nos testes
# desta esteira (resolvida la com TOKENIZE_TEST_ROOT).
ROOT = pathlib.Path(
    os.environ.get("TOKENIZE_APP_ROOT", pathlib.Path(__file__).resolve().parent.parent)
).resolve()


def _achar_gramatica():
    """
    A lei pode estar em `docs/law/GRAMMAR.md` (repo canonico) ou em
    `tokens/GRAMMAR.md` (vendorizada no alvo). Procura nas duas, e no repo do
    processo quando o alvo nao a carrega.
    """
    relativos = (
        pathlib.Path("docs") / "law" / "GRAMMAR.md",
        pathlib.Path("tokens") / "GRAMMAR.md",
    )
    # sobe a partir do ALVO e a partir do proprio script: os dois layouts
    # (frontend/scripts/... e tools/gates/...) nao compartilham profundidade,
    # entao contar `parent` e errado por construcao — procura-se subindo.
    bases = [ROOT, *ROOT.parents, *pathlib.Path(__file__).resolve().parents]
    vistos = []
    for base in bases:
        for rel in relativos:
            c = base / rel
            vistos.append(c)
            if c.exists():
                return c
    raise FileNotFoundError(
        "GRAMMAR.md nao encontrado; procurado em "
        + str(len(vistos))
        + " caminhos, a partir de "
        + str(ROOT)
    )
def _achar_baseline():
    """
    O baseline e estado DO APP MEDIDO, nao do guard.

    Duas tentativas erradas antes desta, e as duas quebraram de formas opostas:
    `ROOT/"scripts"` cravado estourava FileNotFoundError no repo canonico (que
    usa `tools/gates/`); e mover para o lado do guard fez o ALVO ser comparado
    contra o baseline do CANONICO — dois apps diferentes dividindo um numero so.

    Regra: procura um baseline existente sob o alvo; se nao houver, grava no
    layout que o alvo ja usa.
    """
    nome = "ds-naming-law-baseline.json"
    candidatos = [
        ROOT / "scripts" / nome,
        ROOT / "tools" / "gates" / nome,
        ROOT / "gates" / nome,
        pathlib.Path(__file__).resolve().parent / nome,
    ]
    for c in candidatos:
        if c.exists():
            return c
    # nenhum existe ainda: grava onde o alvo tem estrutura
    for c in candidatos:
        if c.parent.is_dir():
            return c
    return candidatos[-1]


BASELINE = _achar_baseline()

# As palavras proibidas NO NOME PUBLICO — e, desde a extensao 2026-07-31 (2)
# da lei (GRAMMAR.md, "the ban covers FRAMING"), tambem como NOME de familia,
# artefato, secao ou conceito: aparecem SOMENTE como nome antigo a eliminar.
# Como metadado tecnico interno (ex.: caminho DTCG legado sendo lido) seguem
# legiveis — ler a fonte nao e batiza-la.
#
# `content` entrou por decisao expressa do dono (2026-07-31): "ela nao expressa
# nada". A medicao concorda. `content-primary` mistura DOIS eixos no mesmo
# vocabulario sem dizer qual esta em uso:
#
#   primary / secondary / tertiary          eixo de POSTO   (quao importante)
#   danger / success / info / placeholder   eixo de PAPEL   (para que serve)
#
# `content-secondary` e `content-danger` parecem irmaos e nao sao: um responde
# "quao importante", o outro "que tipo de mensagem". E `content` em si nao diz
# nem que e cor, nem que e texto — poderia ser container, slot ou payload.
#
# Divida no momento do banimento, medida: 3.086 classes consumidas, 90 custom
# properties e 2 caminhos na fonte DTCG. O baseline registra esse numero para o
# catraca impedir uso NOVO enquanto a migracao acontece.
FORBIDDEN = ("surface", "semantic", "content", "label", "foreground")
#
# `label` e `foreground` entraram em 2026-08-01 por decisao expressa do dono.
# `label` descreve um CONTROLE; a anatomia canonica e `text`, que qualquer
# entidade pode ter — uma mensagem de chat nao tem rotulo, tem texto. E
# `foreground` era uma cunhagem nossa: a propriedade agora e `color`, a palavra
# que o proprio CSS usa. A ambiguidade que motivou a cunhagem (`card.color`:
# texto ou preenchimento?) some quando `text` existe como anatomia.


def violations_in_source():
    """Classes Tailwind consumidas no codigo que carregam palavra proibida."""
    found = []
    rx = re.compile(
        r"\b((?:[a-z-]+:)*)"
        r"((?:bg|text|border|ring|fill|stroke|shadow|placeholder|divide|outline|from|via|to)"
        rf"-(?:{'|'.join(FORBIDDEN)})-[a-z0-9-]+)"
    )
    # `.tsx` junto de `.jsx`: a galeria do design system e TypeScript, e um
    # ratchet cego para o codigo novo mede o passado, nao o repo.
    src = ROOT / "src"
    for f in sorted(src.rglob("*.jsx")) + sorted(src.rglob("*.tsx")):
        for i, line in enumerate(f.read_text().split("\n"), 1):
            for m in rx.finditer(line):
                found.append({
                    "kind": "consumed-class",
                    "local": f"{f.relative_to(ROOT)}:{i}",
                    "name": m.group(2),
                })
    return found


def violations_in_css():
    """Custom properties emitidas cujo nome carrega palavra proibida."""
    found = []
    css = ROOT / "src" / "styles" / "generated" / "color-tokens.css"
    if not css.exists():
        return found
    seen = set()
    for i, line in enumerate(css.read_text().split("\n"), 1):
        m = re.match(rf"\s*--([a-z-]*(?:{'|'.join(FORBIDDEN)})[a-z0-9-]*)\s*:", line)
        if m and m.group(1) not in seen:
            seen.add(m.group(1))
            found.append({
                "kind": "custom-property",
                "local": f"src/styles/generated/color-tokens.css:{i}",
                "name": f"--{m.group(1)}",
            })
    return found


def violations_in_token_source():
    """Caminhos na fonte DTCG que virariam nome publico com palavra proibida.

    O emissor monta o nome a partir do CAMINHO (`build-tokens.mjs` Linha 154:
    `path.map(dash).join("-")`), pulando a key do tier. Entao um group chamado
    `surface` vira `--color-surface-*` — a violacao nasce aqui, nao no consumo.
    """
    found = []
    src = ROOT / "tokens" / "color.tokens.json"
    if not src.exists():
        return found
    data = json.loads(src.read_text())
    tiers = {k: v for k, v in data.items() if not k.startswith("$")}
    for tier, themes in tiers.items():
        if tier == "primitive":
            continue  # tier de fundacao: nao e consumido direto, nao vira nome publico
        if not isinstance(themes, dict):
            continue
        for theme, groups in themes.items():
            if theme.startswith("$") or not isinstance(groups, dict):
                continue
            for group in groups:
                if group.startswith("$"):
                    continue
                if any(p in group for p in FORBIDDEN):
                    found.append({
                        "kind": "group-in-source",
                        "local": f"tokens/color.tokens.json :: {tier}.{theme}.{group}",
                        "name": group,
                    })
            break  # um theme basta: a estrutura e a mesma nos demais
    return found


def sem_comentarios(texto):
    """
    Remove comentario de linha e de bloco antes de procurar nome de classe.

    POR QUE: a primeira versao de `violations_prefix_property` acusou DOIS casos
    que eram prosa — "// `border-color` cai junto..." e
    "* ...emite SO `outline-color`...". Um guard que reprova comentario
    ensina a ignorar guard. O grep manual dava zero e estava certo; a checagem e
    que casava documentacao.

    Substitui por espaco em vez de apagar, para o numero da linha nao andar.
    """
    texto = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), texto, flags=re.S)
    texto = re.sub(r"(^|[^:])//[^\n]*", lambda m: m.group(1) + " " * (len(m.group(0)) - len(m.group(1))), texto)
    return texto


def vocabulario_do_doc():
    """
    Le o vocabulario FECHADO direto do GRAMMAR.md.

    Por que ler o doc em vez de repetir a lista aqui: doc e guard que guardam a
    mesma lista em dois lugares divergem — e quando divergem, o guard vence em
    silencio e o doc vira mentira. A fonte e uma so.
    """
    doc = _achar_gramatica().read_text(encoding="utf8")

    def secao(inicio, fim):
        i = doc.index(inicio)
        j = doc.index(fim, i)
        return doc[i:j]

    owners = set(re.findall(r"`([a-z][a-z0-9-]*)`", secao("### 4.1 Owners", "### 4.2")))
    return owners


def violations_grammar():
    """
    Nome consumido cujo PRIMEIRO segmento nao e um owner do vocabulario fechado.

    POR QUE ISTO EXISTE — e o achado que o criou. Ate 2026-07-31 este guard era
    apenas uma DENYLIST de tres palavras. Medido: `text-blergh-quux` passava com
    exit 0, e `text-ink-primary` e `text-copy-strong` tambem. Ou seja, o guard
    imprimia "o identificador consumido e owner.anatomia.propriedade" na mensagem
    de erro e NAO verificava nada disso.

    Foi por isso que `content-*` sobreviveu tanto tempo e que eu consolidei 812
    usos para dentro dele: o guard passava, e os unicos exemplos ruins do
    GRAMMAR.md eram justamente as duas palavras ja banidas. Uma denylist so pega
    o que alguem ja pensou em proibir; a proxima palavra que comete o mesmo
    pecado entra limpa.

    Esta checagem inverte a logica: em vez de listar o proibido, exige o
    permitido. `page`, `button`, `data-table` passam por estarem no vocabulario;
    `ink`, `copy`, `content`, `blergh` reprovam por nao estarem — sem precisar
    que ninguem os preveja.
    """
    owners = vocabulario_do_doc()
    # do mais longo para o mais curto: `nav-item` tem que ser tentado antes de `nav`
    owners_por_tamanho = sorted(owners, key=len, reverse=True)
    prefixos = ("bg", "text", "border", "ring", "fill", "stroke", "shadow",
                "placeholder", "divide", "outline")
    rx = re.compile(
        r"\b(?:[a-z-]+:)*(?:" + "|".join(prefixos) + r")-([a-z][a-z0-9-]*)"
    )
    found = []
    for path in sorted((ROOT / "src").rglob("*")):
        if path.suffix not in {".js", ".jsx", ".ts", ".tsx"}:
            continue
        try:
            texto = path.read_text(encoding="utf8")
        except (OSError, UnicodeDecodeError):
            continue
        for n, linha in enumerate(sem_comentarios(texto).splitlines(), 1):
            for nome in rx.findall(linha):
                # CASA O TERMO MAIS LONGO PRIMEIRO, nao o primeiro segmento.
                #
                # `nome.split("-")[0]` reprovava 8 dos 40 owners do proprio
                # vocabulario fechado — `chat-message` virava `chat`,
                # `data-table` virava `data`, e nenhum dos dois esta na lista.
                # 20% da lei rejeitada pela lei.
                #
                # E o efeito e pior do que parece: a divida velha ja esta
                # absorvida pelo baseline, entao o que este bug bloqueava era
                # exatamente o token NOVO e CORRETO. Um guard que so barra quem
                # acerta e pior que guard nenhum.
                #
                # `parseName()` do oraculo (score-naming.mjs) sempre casou o
                # termo mais longo; era o guard que estava fora de sincronia.
                dono = next(
                    (o for o in owners_por_tamanho if nome == o or nome.startswith(o + "-")),
                    nome.split("-")[0],
                )
                if dono in owners:
                    continue
                if re.fullmatch(r"[a-z]+", dono) and dono in _IGNORAR_DONO:
                    continue
                found.append({
                    "kind": "grammar-owner",
                    "path": str(path.relative_to(ROOT)),
                    "line": n,
                    "name": nome,
                })
    return found


# Palavras que ocupam a posicao de owner mas sao vocabulario do proprio Tailwind
# ou primitivo de cor, nao nome de token do design system. Reprova-las seria
# ruido, nao sinal.
_IGNORAR_DONO = {
    "transparent", "current", "inherit", "white", "black", "auto", "none",
    "red", "green", "blue", "gray", "grey", "slate", "zinc", "neutral", "stone",
    "amber", "yellow", "orange", "lime", "emerald", "teal", "cyan", "sky",
    "indigo", "violet", "purple", "fuchsia", "pink", "rose",
}


# O prefixo do Tailwind DECLARA a propriedade CSS. `text-` e `color`, `bg-` e
# `background-color`, `border-` e `border-color`. Quando o nome do token tambem
# carrega a propriedade, os dois tem que concordar.
_PREFIXO_PROPRIEDADE = {
    "text": "color",
    "bg": "background-color",
    "border": "border-color",
    "outline": "outline-color",
    "fill": "fill",
    "stroke": "stroke",
}


def violations_prefix_property():
    """
    Prefixo do utility que CONTRADIZ a propriedade escrita no nome do token.

    O QUE ISTO PEGA, com o exemplo que o originou: `text-page-background-color`
    define `color` (cor do TEXTO) a partir de um token cujo nome diz
    `background-color`. Emite CSS valido, o navegador nao reclama, e o resultado
    e o texto pintado com a cor de fundo da pagina. Foi um exemplo que EU escrevi
    num teste do guard, e o dono perguntou o obvio: texto tem cor, nao tem cor de
    fundo.

    Medido no momento em que a checagem entrou: ZERO ocorrencias no codigo real,
    nos quatro sentidos (text x background, bg x border, border x background,
    text x border). A disciplina ja existia na pratica — o que faltava era ela
    ser executavel.

    Baseline ZERO e o que torna esta catraca forte: nao ha divida para tolerar,
    entao a primeira contradicao que alguem escrever reprova na hora.
    """
    rx = re.compile(
        r"\b(?:[a-z-]+:)*(text|bg|border|outline|fill|stroke)-([a-z][a-z0-9-]*)"
    )
    propriedades = ("background-color", "border-color", "outline-color", "color")
    found = []
    for path in sorted((ROOT / "src").rglob("*")):
        if path.suffix not in {".js", ".jsx", ".ts", ".tsx"}:
            continue
        try:
            texto = path.read_text(encoding="utf8")
        except (OSError, UnicodeDecodeError):
            continue
        for n, linha in enumerate(sem_comentarios(texto).splitlines(), 1):
            for prefixo, nome in rx.findall(linha):
                esperada = _PREFIXO_PROPRIEDADE.get(prefixo)
                if not esperada:
                    continue
                # qual propriedade o NOME declara, se declarar alguma
                declarada = next(
                    (p for p in propriedades if nome.endswith(p) or f"-{p}-" in nome),
                    None,
                )
                if declarada is None or declarada == esperada:
                    continue
                # `color` e sufixo de `background-color`; so acusa se for o nome inteiro
                if esperada == "color" and declarada == "color":
                    continue
                found.append({
                    "kind": "prefix-property",
                    "path": str(path.relative_to(ROOT)),
                    "line": n,
                    "name": f"{prefixo}-{nome}",
                    "detail": f"prefixo pede {esperada}, nome diz {declarada}",
                })
    return found


def measure():
    all_found = (violations_in_source() + violations_in_css()
                 + violations_in_token_source() + violations_grammar()
                 + violations_prefix_property())
    by_kind = {}
    for a in all_found:
        by_kind[a["kind"]] = by_kind.get(a["kind"], 0) + 1
    return all_found, by_kind


def main():
    all_found, current = measure()

    if "--listar" in sys.argv:
        for a in all_found:
            # As checagens antigas emitem `local`; as duas novas emitem
            # `path`+`line`. Ler so `local` fazia `--listar` estourar KeyError —
            # justamente o comando que a mensagem de erro do guard recomenda.
            onde = a.get("local") or f"{a.get('path', '?')}:{a.get('line', '?')}"
            print(f"  {a['kind']:18} {a['name']:34} {onde}")
        print(f"\ntotal: {len(all_found)}")
        return 0

    if "--record" in sys.argv:
        BASELINE.write_text(json.dumps(current, indent=2, sort_keys=True) + "\n")
        print("baseline da lei de naming gravada:")
        for k, v in sorted(current.items()):
            print(f"  {k:20} {v}")
        return 0

    if not BASELINE.exists():
        # FALHA FECHADA. Um guard que passa quando o proprio baseline sumiu
        # nao e guard: apagar o arquivo viraria a forma mais facil de silenciar
        # a lei, e o silencio pareceria aprovacao.
        print("sem baseline — rode com --record. Estado atual:")
        for k, v in sorted(current.items()):
            print(f"  {k:20} {v}")
        print(f"baseline esperado em: {BASELINE}")
        return 1

    baseline_data = json.loads(BASELINE.read_text())
    print(f"{'TIPO':22}{'ATUAL':>7}{'BASE':>7}  STATUS")
    print("-" * 60)
    regressed = []
    for k in sorted(set(current) | set(baseline_data)):
        a, b = current.get(k, 0), baseline_data.get(k, 0)
        if a > b:
            regressed.append(k)
            st = f"✗ SUBIU (+{a - b})"
        elif a < b:
            st = f"✓ caiu (-{b - a}) — rode --record"
        else:
            st = "✓ ok"
        print(f"{k:22}{a:>7}{b:>7}  {st}")
    print("-" * 60)
    if regressed:
        print(f"LEI DE NAMING VIOLADA em: {', '.join(regressed)}")
        print("`surface`, `semantic` e `content` sao contexto, nao nome. O identificador")
        print("consumido e entidade[.variante][.anatomia][.propriedade][.estado].")
        print(f"Veja {_achar_gramatica()}; liste com --listar.")
        return 1
    print("LEI DE NAMING OK — nenhuma violacao nova.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
