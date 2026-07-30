#!/usr/bin/env python3
"""
GUARD DE COESAO — ratchet de CONTAGEM DE VALORES DISTINTOS.

POR QUE EXISTE
--------------
O `ds-gate.sh` mede hex CRAVADO e ficou em 0 durante toda a degradacao que o
owner reclamou. Ele e cego para o defeito real: `bg-theme-modal-border` e um
token, passa no gate, e pinta o hover com a cor de BORDA. Um workflow de 10
agentes mediu o app por pixel e achou 4,1% de adesao aos valores decididos
enquanto o gate dizia "100% tokenizado".

A licao: hardcode nao e a metrica. INCOERENCIA e a metrica. Cinco nomes de
token para o mesmo valor sao pior que um hex, porque parecem certos.

Este guard conta VALORES DISTINTOS por eixo e falha quando a contagem SOBE.
Mesma mecanica de ratchet do ds-gate: a baseline so encolhe.

USO
  python3 scripts/ds-cohesion.py              # compara contra a baseline
  python3 scripts/ds-cohesion.py --record     # grava a baseline current
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src"
BASELINE = ROOT / "scripts" / "ds-cohesion-baseline.json"

# Tamanhos acima disto sao ilustracao/avatar, nao icone de UI — nao entram na escala.
ILLUSTRATION_MIN = 28


def source_files():
    # `.tsx` entra junto: a galeria do design system em src/pages/DesignSystem
    # e TypeScript, e um guard que nao enxerga o codigo novo nao e guard. Sem
    # esta linha, o unico lugar do repo que se DECLARA aderente a lei ficaria
    # isento de toda checagem dela.
    return sorted(SOURCE.rglob("*.jsx")) + sorted(SOURCE.rglob("*.tsx"))


def axis_neutral_hover(textos):
    """Tons distintos de hover NEUTRO. O defeito original: 49 tons, 1046 usages.

    BASELINE SUBIU DE 1 PARA 2 EM 2026-07-28 — declarado, nao acidental.

    O banner deste guard diz "baseline only shrinks", entao uma subida precisa de
    justificativa escrita ou vira ratchet frouxo sem trilha (achado N1 da
    auditoria adversarial r2).

    O 2o tom e `sidebar-item-active-hover` (#DEDDD8), consumido em
    `src/components/Sidebar/ActiveWorkspaces/ThreadContainer/index.jsx`. Ele NAO
    e divergencia: e o hover de um item JA SELECIONADO, que parte de um fundo
    elevado, enquanto o `sidebar-item-hover` parte de fundo transparente. Colapsar
    os dois recria o bug de "continua com cor de hover depois de selecionado",
    que o dono reportou e que custou varias rodadas.

    Valor decidido pelo dono (familia ancorada no #EDECE8 que ele amostrou).
    Ou seja: 2 e o piso CORRETO deste eixo, nao divida. Se um 3o tom neutro
    aparecer, ai sim e regressao.
    """
    found = set()
    for t in textos:
        for m in re.finditer(r"hover:bg-([a-z][a-z0-9-]*)(/\d+)?", t):
            nome, alfa = m.group(1), m.group(2) or ""
            # roles semanticos tem hover proprio de proposito (destrutivo,
            # sucesso, marca). O eixo aqui e o hover NEUTRO.
            if re.search(r"destructive|success|warning|info|primary|accent|transparent|premium|error|delete-hover|disable-hover|code-hover|selected", nome):
                continue
            found.add(nome + alfa)
    return found


def axis_icon_size(textos):
    """Tamanhos de icone de UI. O defeito original: 18 tamanhos em 421 usages."""
    found = set()
    for t in textos:
        for m in re.finditer(r"size=\{(\d+)\}", t):
            n = int(m.group(1))
            if n < ILLUSTRATION_MIN:
                found.add(n)
    return found


def axis_surface_token(textos):
    """Tokens distintos usados como fundo de superficie neutra."""
    found = set()
    for t in textos:
        for m in re.finditer(r"(?<![a-z:-])bg-(surface-[a-z-]+|theme-bg-[a-z-]+|app-bg|sidebar-bg|chatarea-bg|popover-bg|prompt-bg)", t):
            found.add(m.group(1))
    return found


def axis_container_border(textos):
    """Linhas com borda de container (borda + rounded, fora de campo e divisoria)."""
    n = 0
    for t in textos:
        for linha in t.split("\n"):
            if "rounded" not in linha:
                continue
            if re.search(r"<input|<textarea|<select|placeholder:", linha):
                continue
            if re.search(r"\bborder-[tblrxy]\b|\bborder-[tblrxy]-", linha):
                continue
            if re.search(r"\bborder-(border|theme)-[a-z-]+\b", linha):
                n += 1
    return n


# So o CONTEUDO de className conta. `disabled: !ready` e `sm: {...}` sao chaves
# de objeto JS, nao className — a primeira versao deste eixo acusou 20 delas.
RX_CLASS_NAME = re.compile(r'className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})')

VARIANTS = r"hover|light|dark|focus|active|disabled|group-hover|peer|sm|md|lg|xl"


def _skip_quoted(text, start, quote):
    """Return the position immediately after a JS single/double-quoted string."""
    i = start + 1
    while i < len(text):
        if text[i] == "\\":
            i += 2
        elif text[i] == quote:
            return i + 1
        else:
            i += 1
    return len(text)


def _skip_line_comment(text, start):
    i = start + 2
    while i < len(text) and text[i] not in "\r\n":
        i += 1
    return i


def _skip_block_comment(text, start):
    end = text.find("*/", start + 2)
    return len(text) if end == -1 else end + 2


def _skip_nested_template(text, start):
    """Skip a nested JS template literal, including its own expressions."""
    i = start + 1
    while i < len(text):
        if text[i] == "\\":
            i += 2
        elif text.startswith("${", i):
            i = _skip_template_expression(text, i + 2)
        elif text[i] == "`":
            return i + 1
        else:
            i += 1
    return len(text)


def _skip_template_expression(text, start):
    """Skip a `${...}` body, starting just after `${`."""
    depth = 1
    i = start
    while i < len(text):
        if text.startswith("//", i):
            i = _skip_line_comment(text, i)
        elif text.startswith("/*", i):
            i = _skip_block_comment(text, i)
        elif text[i] in ("'", '"'):
            i = _skip_quoted(text, i, text[i])
        elif text[i] == "`":
            i = _skip_nested_template(text, i)
        elif text[i] == "{":
            depth += 1
            i += 1
        elif text[i] == "}":
            depth -= 1
            i += 1
            if depth == 0:
                return i
        elif text[i] == "\\":
            i += 2
        else:
            i += 1
    return len(text)


def template_static_segments(template):
    """Return only the static segments of a JS template literal body."""
    segments = []
    segment_start = 0
    i = 0
    while i < len(template):
        if template[i] == "\\":
            i += 2
        elif template.startswith("${", i):
            segments.append(template[segment_start:i])
            i = _skip_template_expression(template, i + 2)
            segment_start = i
        else:
            i += 1
    segments.append(template[segment_start:])
    return segments


def axis_broken_token(textos):
    """Token de className invalido — o que ja escapou para o DOM 3 vezes nesta sessao."""
    n = 0
    for t in textos:
        # var cravada como valor arbitrario em vez do token: escapa do rename e
        # do guard de par, porque nao e nem hex nem className conhecida.
        n += len(re.findall(r"\[var\(--color-[a-z0-9-]+\)\]", t))
        for m in RX_CLASS_NAME.finditer(t):
            cls = next(g for g in m.groups() if g is not None)
            if m.group(2) is not None:
                # Aspas em expressoes `${...}` delimitam strings JS validas. So
                # aspas no texto estatico da template escapam para o DOM.
                for segment in template_static_segments(cls):
                    n += len(re.findall(r'"[a-z-]+:', segment))
            # prefixo de variante sem a utilitaria depois -> className morta
            n += len(re.findall(rf"\b({VARIANTS}):(?=\s|$)", cls))
    return n


# Chaves em INGLES. Elas nao sao rotulo de tela: sao identificador de codigo e
# chave do baseline JSON, e identificador nao mistura idioma. A descricao ao
# lado e que e texto humano — essa fica em pt.
AXES = {
    "hover-neutral-tones": (axis_neutral_hover, "tons distintos de hover neutro"),
    "icon-sizes": (axis_icon_size, "tamanhos de icone de UI"),
    "surface-tokens": (axis_surface_token, "tokens usados como superficie neutra"),
    "container-border": (axis_container_border, "containers com borda desenhada"),
    "broken-token": (axis_broken_token, "tokens de className invalidos"),
}


def measure():
    textos = [f.read_text() for f in source_files()]
    fora = {}
    for key, (fn, _) in AXES.items():
        r = fn(textos)
        fora[key] = len(r) if isinstance(r, set) else r
    return fora


def main():
    current = measure()
    record = "--record" in sys.argv

    if record:
        BASELINE.write_text(json.dumps(current, indent=2, sort_keys=True) + "\n")
        print("baseline de coesao gravada:")
        for k, v in sorted(current.items()):
            print(f"  {k:22} {v}")
        return 0

    if not BASELINE.exists():
        print("sem baseline — rode com --record. Relatorio:")
        for k, v in sorted(current.items()):
            print(f"  {k:22} {v:>5}   {AXES[k][1]}")
        return 0

    baseline_data = json.loads(BASELINE.read_text())
    print(f"{'EIXO':24}{'ATUAL':>7}{'BASE':>7}  STATUS")
    print("-" * 62)
    regressed = []
    for k in sorted(AXES):
        a, b = current[k], baseline_data.get(k, current[k])
        if a > b:
            status = f"✗ SUBIU (+{a - b})"
            regressed.append(k)
        elif a < b:
            status = f"✓ caiu (-{b - a}) — rode --record"
        else:
            status = "✓ ok"
        print(f"{k:24}{a:>7}{b:>7}  {status}")
    print("-" * 62)
    if regressed:
        print(f"COESAO REGREDIU em: {', '.join(regressed)}")
        print("Um valor novo num eixo ja unificado e uma divergencia sendo")
        print("reintroduzida. Reuse o token que ja existe ou justifique o papel novo.")
        return 1
    print("COESAO OK — nenhum eixo regrediu.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
