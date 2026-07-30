#!/usr/bin/env python3
"""ds-variety — ratchet de VARIEDADE de vocabulario visual (nao de hardcode).

Complementa ds-gate.sh. O ds-gate mede SINTAXE ("existe literal cru?") e hoje
imprime 0 em todas as dimensoes = "100% tokenizado". Este guard mede a pergunta
que o dono fez e que o ds-gate nao responde: quantas MANEIRAS DIFERENTES de
dizer a mesma coisa o app ainda tem, e que fracao da UI passa por primitivo
compartilhado.

Dimensoes (todas contadas sobre o conteudo de className/class em src/**.jsx|js):
  hover-tones     classes distintas hover:bg-* (variante light: normalizada)
  icon-sizes      valores distintos de size={n} / size="n" em JSX
  radius-scales   nomes de escala distintos de rounded-* (direcional normalizado)
  panel-surfaces  classes distintas bg-* usadas em painel de overlay
  legacy-vocab    ocorrencias de *-theme-* (vocabulario legado do fork)
  shared-coverage arquivos .jsx que importam components/lib / total (permilagem)

Ratchet: compara com .ds-variety-baseline.txt (dentro de HARNESS_WEB_APP_DIR).
FALHA (exit 1) se qualquer dimensao PIORA. Direcao de melhora: menor para tudo,
EXCETO shared-coverage, onde melhora = maior. Sem baseline = report-only.

Uso:
  python3 .harness/lib/ds-variety.py                 # check (ratchet)
  python3 .harness/lib/ds-variety.py --report        # so imprime
  python3 .harness/lib/ds-variety.py --update-baseline
  python3 .harness/lib/ds-variety.py --list <dim>    # enumera path:linha:valor
"""
from __future__ import annotations

import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _tooling_conf import get_config, project_root  # noqa: E402

ROOT = project_root()
WEB = (get_config("HARNESS_WEB_APP_DIR", ".") or ".").strip("/") or "."
BASE = ROOT if WEB == "." else ROOT / WEB
SRC = BASE / "src"
BASELINE = BASE / ".ds-variety-baseline.txt"

SKIP_DIRS = ("node_modules", "styles/generated", "dist", "build")

# ---- extracao do conteudo de className ---------------------------------------
_RE_STR = re.compile(r'class(?:Name)?\s*=\s*(["\'`])((?:(?!\1).){0,6000})\1', re.S)


def _classname_blocks(text: str):
    """Corpo de className="..." e de className={...} (chaves equilibradas)."""
    for m in _RE_STR.finditer(text):
        yield m.group(2)
    for m in re.finditer(r'class(?:Name)?\s*=\s*\{', text):
        i = m.end() - 1
        depth = 0
        for j in range(i, min(i + 6000, len(text))):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    yield text[i + 1:j]
                    break


def _files():
    for p in list(SRC.rglob("*.jsx")) + list(SRC.rglob("*.js")):
        s = str(p)
        if any(d in s for d in SKIP_DIRS):
            continue
        yield p


# ---- dimensoes ---------------------------------------------------------------
RE_HOVER = re.compile(r'(?<![\w-])(?:light:|dark:|group-hover:)?hover:bg-([a-z0-9][\w./\[\]%#-]*)')
RE_SIZE = re.compile(r'\bsize=\{?\s*"?(\d{1,3})"?\s*\}?')
RE_ROUND = re.compile(r'(?<![\w-])rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?(?:-([a-z0-9][\w.\[\]%#-]*))?(?![\w-])')
RE_LEGACY = re.compile(r'(?<![\w-])(?:bg|text|border|ring|divide|fill|stroke|from|via|to)-theme-[a-z0-9-]+')
# painel de overlay = className que contem absolute|fixed + z-|shadow|rounded e um bg-
RE_BG = re.compile(r'(?<![\w-])bg-([a-z0-9][\w./\[\]%#-]*)')

DIRECTIONS = ("t", "b", "l", "r", "s", "e", "tl", "tr", "bl", "br", "ss", "se", "es", "ee")


def collect():
    hover, icons, radius, legacy, panels = set(), set(), set(), 0, set()
    listing = {"hover-tones": [], "icon-sizes": [], "radius-scales": [],
               "legacy-vocab": [], "panel-surfaces": []}
    lib_importers, total_jsx = 0, 0

    for p in _files():
        text = p.read_text(encoding="utf-8", errors="ignore")
        rel = p.relative_to(ROOT)
        if p.suffix == ".jsx":
            total_jsx += 1
            if "components/lib/" in text:
                lib_importers += 1
        # size={n} vale no JSX inteiro (e prop, nao className)
        for m in RE_SIZE.finditer(text):
            icons.add(m.group(1))
            listing["icon-sizes"].append(f"{rel}:{text[:m.start()].count(chr(10))+1}:{m.group(0)}")
        for blk in _classname_blocks(text):
            for m in RE_HOVER.finditer(blk):
                hover.add(m.group(1))
                listing["hover-tones"].append(f"{rel}: hover:bg-{m.group(1)}")
            for m in RE_ROUND.finditer(blk):
                radius.add(m.group(1) or "DEFAULT")
                listing["radius-scales"].append(f"{rel}: {m.group(0)}")
            n = len(RE_LEGACY.findall(blk))
            legacy += n
            for mm in RE_LEGACY.finditer(blk):
                listing["legacy-vocab"].append(f"{rel}: {mm.group(0)}")
            is_panel = (("absolute" in blk or "fixed" in blk)
                        and ("z-" in blk or "shadow" in blk)
                        and "inset-0" not in blk)
            if is_panel:
                for m in RE_BG.finditer(blk):
                    panels.add(m.group(1))
                    listing["panel-surfaces"].append(f"{rel}: bg-{m.group(1)}")

    coverage = round(1000 * lib_importers / total_jsx) if total_jsx else 0
    return {
        "hover-tones": len(hover),
        "icon-sizes": len(icons),
        "radius-scales": len(radius),
        "panel-surfaces": len(panels),
        "legacy-vocab": legacy,
        "shared-coverage": coverage,
    }, listing, {"hover": sorted(hover), "icons": sorted(icons, key=int),
                 "radius": sorted(radius), "panels": sorted(panels),
                 "lib_importers": lib_importers, "total_jsx": total_jsx}


# melhora = MENOR, exceto shared-coverage
HIGHER_IS_BETTER = {"shared-coverage"}
ORDER = ["hover-tones", "icon-sizes", "radius-scales", "panel-surfaces",
         "legacy-vocab", "shared-coverage"]


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    now, listing, detail = collect()

    if mode == "--list":
        want = sys.argv[2] if len(sys.argv) > 2 else None
        for d in ORDER:
            if want and d != want:
                continue
            print(f"### {d}")
            for line in sorted(set(listing.get(d, []))):
                print(line)
        return 0

    if mode == "--values":
        print("hover:      " + " ".join(detail["hover"]))
        print("icon sizes: " + " ".join(detail["icons"]))
        print("radius:     " + " ".join(detail["radius"]))
        print("panel bg:   " + " ".join(detail["panels"]))
        print(f"lib importers: {detail['lib_importers']}/{detail['total_jsx']} .jsx")
        return 0

    base = {}
    if BASELINE.is_file():
        for line in BASELINE.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                base[k.strip()] = int(v.strip())

    if mode == "--update-baseline":
        BASELINE.write_text(
            "# ds-variety baseline — ratchet de variedade de vocabulario visual.\n"
            "# So encolhe (shared-coverage so cresce). Gerado por --update-baseline.\n"
            + "".join(f"{d}={now[d]}\n" for d in ORDER)
        )
        print(f">> baseline atualizado em {BASELINE}")
        return 0

    print(f"{'DIMENSAO':<18}{'ATUAL':>8}{'BASELINE':>10}   STATUS")
    print("-" * 60)
    fail = 0
    for d in ORDER:
        n, b = now[d], base.get(d)
        if mode == "--report" or b is None:
            status = "report"
        elif (n > b and d not in HIGHER_IS_BETTER) or (n < b and d in HIGHER_IS_BETTER):
            status = f"X PIOROU ({b} -> {n})"
            fail = 1
        elif n != b:
            status = f"ok melhorou ({b} -> {n})"
        else:
            status = "ok"
        print(f"{d:<18}{n:>8}{(b if b is not None else '-'):>10}   {status}")
    print("-" * 60)
    print("shared-coverage e por MIL arquivos .jsx (1000 = 100% dos .jsx importam de components/lib).")
    return fail


if __name__ == "__main__":
    sys.exit(main())
