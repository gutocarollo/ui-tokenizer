#!/usr/bin/env python3
"""ds-bundle-classes — toda classe usada em src/ tem de GERAR CSS no bundle.

Diferenca para ds-dead-classes.py: aquele valida contra o tailwind.config
(a INTENCAO). Este valida contra o CSS REALMENTE EMITIDO (o artefato). Sao
oraculos diferentes: uma classe pode estar no config e nao ser emitida
(variante nao gerada, arbitrary value invalido, purge nao vendo o arquivo),
e uma classe plain-CSS pode ter sido renomeada no index.css sem que o config
saiba. Ambos os casos falham o PIXEL sem falhar o build.

Fonte do CSS emitido (em ordem de preferencia):
  1) --css <path>            arquivo ja gerado
  2) dev server              $DS_BUNDLE_URL (default http://localhost:<porta>/src/index.css?direct)
  3) dist/assets/*.css       build de producao (yarn build)

Uso:
  python3 .harness/lib/ds-bundle-classes.py            # check (ratchet)
  python3 .harness/lib/ds-bundle-classes.py --list     # enumera fantasmas
  python3 .harness/lib/ds-bundle-classes.py --update-baseline
Exit 1 quando o numero de classes fantasma AUMENTA sobre o baseline.
"""
from __future__ import annotations

import os
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _tooling_conf import get_config, project_root  # noqa: E402

ROOT = project_root()
WEB = (get_config("HARNESS_WEB_APP_DIR", ".") or ".").strip("/") or "."
BASE = ROOT if WEB == "." else ROOT / WEB
SRC = BASE / "src"
PORT = get_config("HARNESS_DEV_WEB_PORT", "3006")
BASELINE = BASE / ".ds-bundle-baseline.txt"

SKIP_DIRS = ("node_modules", "styles/generated", "dist", "build")

_RE_STR = re.compile(r'class(?:Name)?\s*=\s*(["\'`])((?:(?!\1).){0,6000})\1', re.S)
# Classe candidata: token com hifen ou variante. Ignora nomes de 1 palavra sem
# hifen (flex, block, hidden) — sao utilitarios nativos estaveis e inflariam o
# ruido sem risco real.
_RE_CLASS = re.compile(r'(?<![\w:/.-])((?:[a-z][a-z0-9]*:)*[a-z][a-z0-9]*(?:-[a-z0-9.%\[\]#/_-]+)+)(?![\w-])')
# Formas que nao sao classe estatica e nunca devem ser cobradas:
_IGNORE = re.compile(
    r'^(data-|aria-|https?:|w-full$|h-full$)'
    r'|[${}`]'          # interpolacao -> classe dinamica, fora do escopo
    r'|\.(jsx?|css|png|svg|json)$'
)


def classname_blocks(text: str):
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


def used_classes() -> dict[str, str]:
    """classe -> primeiro path:linha onde aparece."""
    out: dict[str, str] = {}
    for p in list(SRC.rglob("*.jsx")) + list(SRC.rglob("*.js")):
        s = str(p)
        if any(d in s for d in SKIP_DIRS):
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        rel = p.relative_to(ROOT)
        for blk in classname_blocks(text):
            if "${" in blk or "`" in blk:
                # template literal: so as partes literais, sem interpolacao
                blk = re.sub(r'\$\{[^}]*\}', ' ', blk)
            for m in _RE_CLASS.finditer(blk):
                cls = m.group(1)
                if _IGNORE.search(cls):
                    continue
                out.setdefault(cls, f"{rel}")
    return out


def emitted_css() -> str:
    args = sys.argv[1:]
    if "--css" in args:
        return pathlib.Path(args[args.index("--css") + 1]).read_text(errors="ignore")
    url = os.environ.get("DS_BUNDLE_URL", f"http://localhost:{PORT}/src/index.css?direct")
    r = subprocess.run(["curl", "-sf", "--max-time", "30", url], capture_output=True, text=True)
    if r.returncode == 0 and len(r.stdout) > 50_000:
        return r.stdout
    dist = sorted((BASE / "dist" / "assets").glob("*.css"), key=lambda p: p.stat().st_size, reverse=True) \
        if (BASE / "dist" / "assets").is_dir() else []
    if dist:
        return "\n".join(p.read_text(errors="ignore") for p in dist)
    print("ds-bundle-classes: sem CSS emitido (dev server fora do ar e sem dist/). "
          "Suba a stack ou rode `yarn build`. Fail-open.", file=sys.stderr)
    sys.exit(0)


def escape_selector(cls: str) -> str:
    """Selector CSS que o Tailwind emite para a classe (escapa : / . [ ] % # /)."""
    return "." + re.sub(r'([:/.\[\]%#!])', r'\\\1', cls)


def emitted(cls: str, css: str) -> bool:
    """A classe gera CSS? Aceita tambem a forma !important (`!bg-x` -> `.\\!bg-x`),
    porque o call site escreve `!bg-x` e o miner captura `bg-x` depois do `!`."""
    if escape_selector(cls) in css:
        return True
    if escape_selector("!" + cls) in css:
        return True
    # variante com ! depois do prefixo de variante: `hover:!bg-x`
    if ":" in cls:
        head, _, tail = cls.rpartition(":")
        if escape_selector(head + ":!" + tail) in css:
            return True
    return False


def main() -> int:
    args = sys.argv[1:]
    css = emitted_css()
    used = used_classes()
    ghosts = {c: where for c, where in used.items() if not emitted(c, css)}

    if "--list" in args:
        for c in sorted(ghosts):
            print(f"{ghosts[c]}: {c}")
        return 0

    n = len(ghosts)
    base = None
    if BASELINE.is_file():
        try:
            base = int(BASELINE.read_text().split("=")[-1].strip())
        except Exception:
            base = None

    if "--update-baseline" in args:
        BASELINE.write_text(f"# classes usadas em src/ que NAO geram CSS no bundle. So encolhe.\nghosts={n}\n")
        print(f">> baseline atualizado: ghosts={n}")
        return 0

    print(f"classes distintas usadas: {len(used)} | sem CSS no bundle: {n} | baseline: {base if base is not None else '-'}")
    if base is not None and n > base:
        print("X PIOROU — classes novas que nao geram CSS (o navegador ignora em silencio):")
        for c in sorted(ghosts)[:20]:
            print(f"   {ghosts[c]}: {c}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
