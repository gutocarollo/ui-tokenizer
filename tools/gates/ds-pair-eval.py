#!/usr/bin/env python3
"""ds-pair-eval — evaluates whether a PAIR (text color x background color)
keeps contrast across the configured production themes.

PORTED from apps/web/scripts/ds-pair-eval.py (reference donor harness) —
rescue plan §R1a. Complements ds-pairs-check.py (which validates the pairs in
the CSS DEFINITION); THIS one evaluates the pair at the POINT OF USE — e.g.
"text-foreground over bg-white" or "text-white/70 over bg-surface-selected" —
deterministically judging when a pair "fits" (PASS in all themes) and when it
does not (FAIL, with the themes that fail).

GENERICITY (vs. the source version): zero hardcoded brand name.
  - CSS path: HARNESS_WEB_APP_DIR + DS_GATE_CSS_PATH (.harness/harness.conf).
    Missing = fail-open (every pair becomes "unresolvable", not a crash).
  - Themes: PROJECT_THEMES (CSV of data-theme attribute values). Each theme
    T generates two entries — "T" (light variant, `[data-theme="T"] {`) and
    "T-dark" (dark variant, `[data-theme="T"].dark`) — plus the two base
    entries always present: "light" (:root) and "dark-base" (neutral .dark).
    Empty = evaluates only light/dark-base (no brand overlay).

CLI:
  python3 .harness/lib/ds-pair-eval.py --text text-foreground --bg bg-white
  python3 .harness/lib/ds-pair-eval.py --text text-white/70 --bg bg-surface-selected --non-text
  echo '[{"text":"text-muted-foreground","bg":"bg-card"}]' | python3 .harness/lib/ds-pair-eval.py --batch

Exit 1 if any pair FAILS in any theme (useful in a gate).
"""
from __future__ import annotations

import re
import sys
import json
import pathlib
import argparse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _tooling_conf import get_config, get_config_csv, project_root  # noqa: E402

ROOT = project_root()
WEB_APP_DIR = (get_config("HARNESS_WEB_APP_DIR", ".") or ".").strip("/") or "."
CSS_REL = get_config("DS_GATE_CSS_PATH", "styles/globals.css") or "styles/globals.css"
# FORK-PATCH (ver .harness/README-FORK.md): DS_GATE_CSS_PATH aceita CSV — os
# tokens vivem em styles/generated/color-tokens.css e o tier 3 em index.css;
# um caminho só não cobre os dois e o guard não resolve @import. A ordem do CSV
# é a ordem da cascata.
_BASE_DIR = ROOT if WEB_APP_DIR == "." else ROOT / WEB_APP_DIR
_CSS_LIST = [_BASE_DIR / _p.strip() for _p in CSS_REL.split(",") if _p.strip()]
_CSS_FOUND = [_p for _p in _CSS_LIST if _p.is_file()]
CSS = _CSS_FOUND[0] if _CSS_FOUND else _CSS_LIST[0]

if CSS.is_file():
    SRC = re.sub(r'/\*.*?\*/', '', "\n".join(_p.read_text() for _p in _CSS_FOUND), flags=re.S)  # without comments
else:
    print(f"ds-pair-eval: tokens CSS not found at {CSS} — pairs become unresolvable (fail-open).", file=sys.stderr)
    SRC = ''

# ── themes: base (light=:root, dark-base=neutral .dark) always present; each
# PROJECT_THEMES theme adds a light + dark variant via data-theme. ──
# FORK-PATCH (ver .harness/README-FORK.md): modelo de tema DESTE app.
# A cascata aqui e o INVERSO do harness-doador: `:root` = tema DARK
# (src/index.css L9) e `[data-theme="light"]` = overlay (L108). Nao existe
# classe `.dark` (grep = 0) — useTheme.js so faz setAttribute('data-theme').
#
# O modelo generico do template tambem tinha uma BOMBA: com PROJECT_THEMES=light,
# THEME_SEL['light'] era sobrescrito e BASE_OF['light'] virava 'light', fazendo
# o `while b:` de _resolve_var girar PARA SEMPRE. O modelo fixo abaixo mata a
# ambiguidade, e o guarda de ciclo em _resolve_var e a rede de seguranca.
THEME_SEL: dict[str, str] = {
    'dark': r':root\s*\{',
    'light': r'\[data-theme="light"\]\s*\{',
}
BASE_OF: dict[str, str] = {'light': 'dark'}  # o overlay light herda do :root

def _block(sel):
    """corpo do bloco CSS do seletor. FORK-PATCH: usa finditer e CONCATENA todos
    os blocos que casam — com DS_GATE_CSS_PATH em CSV ha mais de um `:root` na
    concatenacao (index.css vem antes do artefato gerado) e ler so o primeiro
    tornaria os tokens do artefato invisiveis."""
    out = []
    for m in re.finditer(sel, SRC):
        i = SRC.index('{', m.start())
        depth = 0
        for j in range(i, len(SRC)):
            if SRC[j] == '{':
                depth += 1
            elif SRC[j] == '}':
                depth -= 1
                if depth == 0:
                    out.append(SRC[i:j])
                    break
    return "\n".join(out)


BLOCKS = {k: _block(v) for k, v in THEME_SEL.items()}


def _resolve_var(name, theme):
    """hex value of the --name token in the theme (with inheritance + var() chains)."""
    scopes = [BLOCKS.get(theme, '')]
    b = BASE_OF.get(theme)
    _seen = {theme}  # FORK-PATCH: guarda de ciclo — BASE_OF mal configurado
    while b and b not in _seen:  # (ex.: BASE_OF['light']='light') travava aqui
        _seen.add(b)
        scopes.append(BLOCKS.get(b, ''))
        b = BASE_OF.get(b)
    scopes.append(SRC)  # last resort: any definition
    # FORK-PATCH: PREFIXO POR TIER (adaptacao #4 do porte). O vocabulario por
    # papel e emitido como `--color-surface-panel`, enquanto os alias de par e os
    # `--theme-*` sao emitidos crus. Tenta o nome exato e, so entao, com o
    # prefixo `color-` — assim `bg-surface-panel` resolve sem que o mapa TOKENS
    # precise duplicar cada nome.
    _candidates = [name] + ([f'color-{name}'] if not name.startswith(('theme-', 'color-')) else [])
    for scope in scopes:
        m = None
        for _cand in _candidates:
            m = re.search(r'--' + re.escape(_cand) + r':\s*([^;]+);', scope)
            if m:
                break
        if not m:
            continue
        val = m.group(1).strip()
        vm = re.match(r'var\((--[\w-]+)\)', val)
        if vm:
            return _resolve_var(vm.group(1)[2:], theme)
        hm = re.match(r'#([0-9a-fA-F]{6})\b', val)
        if hm:
            return '#' + hm.group(1).lower()
        return None  # rgb(...)/rgba(...) → non-hex, signals unresolvable
    return None


# ── Tailwind palette (neutral families + white/black — generic, not brand
# vocabulary) ──
PALETTE = {
    'white': '#ffffff', 'black': '#000000', 'transparent': None,
}
_RAMPS = {
    'slate': ['f8fafc', 'f1f5f9', 'e2e8f0', 'cbd5e1', '94a3b8', '64748b', '475569', '334155', '1e293b', '0f172a', '020617'],
    'gray': ['f9fafb', 'f3f4f6', 'e5e7eb', 'd1d5db', '9ca3af', '6b7280', '4b5563', '374151', '1f2937', '111827', '030712'],
    'zinc': ['fafafa', 'f4f4f5', 'e4e4e7', 'd4d4d8', 'a1a1aa', '71717a', '52525b', '3f3f46', '27272a', '18181b', '09090b'],
    'neutral': ['fafafa', 'f5f5f5', 'e5e5e5', 'd4d4d4', 'a3a3a3', '737373', '525252', '404040', '262626', '171717', '0a0a0a'],
    'stone': ['fafaf9', 'f5f5f4', 'e7e5e4', 'd6d3d1', 'a8a29e', '78716c', '57534e', '44403c', '292524', '1c1917', '0c0a09'],
}
_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
for fam, hexes in _RAMPS.items():
    for stop, h in zip(_STOPS, hexes):
        PALETTE[f'{fam}-{stop}'] = '#' + h

# valid semantic tokens (--var names that appear as a bg-/text- class)
TOKENS = {'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
          'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
          'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring',
          'success', 'success-foreground', 'info', 'info-foreground', 'warning', 'warning-foreground',
          'premium', 'premium-foreground', 'surface-selected', 'surface-selected-foreground',
          'foreground-subtle', 'foreground-faint', 'sidebar', 'sidebar-foreground',
          'sidebar-item-foreground', 'sidebar-accent', 'sidebar-border', 'sidebar-panel',
          'sidebar-mobile-panel', 'sidebar-mobile-panel-foreground',
          'sidebar-mobile-panel-muted-foreground', 'sidebar-mobile-panel-accent',
          'sidebar-mobile-panel-border', 'sidebar-mobile-panel-active',
          'sidebar-mobile-panel-active-foreground', 'sidebar-mobile-panel-rail', 'overlay',
          'success-fill', 'warning-fill', 'destructive-fill', 'info-fill', 'premium-fill',
          'success-soft', 'success-soft-foreground', 'info-soft', 'info-soft-foreground',
          'warning-soft', 'warning-soft-foreground', 'destructive-soft', 'destructive-soft-foreground',
          'premium-soft', 'premium-soft-foreground',
          # FORK-PATCH: vocabulario por papel (tier 2 do DTCG portado) —
          # sem isto o oraculo nao resolve bg-surface-panel/text-content-primary.
          'border-default', 'border-default-rgb', 'border-emphasis', 'border-emphasis-rgb', 'border-faint', 'border-faint-rgb', 'border-hairline', 'border-hairline-rgb', 'border-strong', 'border-strong-rgb', 'border-subtle', 'border-subtle-rgb', 'content-disabled', 'content-on-active', 'content-primary', 'content-secondary', 'content-tertiary', 'surface-canvas', 'surface-canvas-rgb', 'surface-deep', 'surface-deep-rgb', 'surface-emphasis', 'surface-emphasis-rgb', 'surface-panel', 'surface-panel-rgb', 'surface-raised', 'surface-raised-rgb', 'surface-sunken', 'surface-sunken-rgb',
          # FORK-PATCH: aliases --theme-* (tier 3), que sao a API consumida
          # pelos 2.421 call-sites hoje.
          'theme-action-menu-bg', 'theme-action-menu-item-hover', 'theme-attachment-bg', 'theme-attachment-error-bg', 'theme-attachment-icon', 'theme-attachment-icon-spinner', 'theme-attachment-icon-spinner-bg', 'theme-attachment-success-bg', 'theme-attachment-text', 'theme-attachment-text-secondary', 'theme-bg-chat', 'theme-bg-chat-input', 'theme-bg-container', 'theme-bg-primary', 'theme-bg-secondary', 'theme-bg-sidebar', 'theme-button-code-hover-bg', 'theme-button-code-hover-text', 'theme-button-cta', 'theme-button-delete-hover-bg', 'theme-button-delete-hover-text', 'theme-button-disable-hover-bg', 'theme-button-disable-hover-text', 'theme-button-primary', 'theme-button-primary-hover', 'theme-button-text', 'theme-chat-input-border', 'theme-checklist-button-border', 'theme-checklist-button-hover-bg', 'theme-checklist-button-hover-border', 'theme-checklist-button-text', 'theme-checklist-checkbox-border', 'theme-checklist-checkbox-fill', 'theme-checklist-checkbox-text', 'theme-checklist-item-bg', 'theme-checklist-item-bg-hover', 'theme-checklist-item-completed-bg', 'theme-checklist-item-completed-text', 'theme-checklist-item-hover', 'theme-checklist-item-text', 'theme-file-picker-hover', 'theme-file-row-even', 'theme-file-row-odd', 'theme-file-row-selected-even', 'theme-file-row-selected-odd', 'theme-home-bg-button', 'theme-home-bg-card', 'theme-home-border', 'theme-home-button-primary', 'theme-home-button-primary-hover', 'theme-home-button-secondary', 'theme-home-button-secondary-border', 'theme-home-button-secondary-border-hover', 'theme-home-button-secondary-hover', 'theme-home-button-secondary-hover-text', 'theme-home-button-secondary-text', 'theme-home-text', 'theme-home-text-secondary', 'theme-home-update-card-bg', 'theme-home-update-card-hover', 'theme-home-update-source', 'theme-loader', 'theme-modal-border', 'theme-placeholder', 'theme-popup-menu-bg', 'theme-settings-input-active', 'theme-settings-input-bg', 'theme-settings-input-placeholder', 'theme-settings-input-text', 'theme-sidebar-border', 'theme-sidebar-footer-icon', 'theme-sidebar-footer-icon-fill', 'theme-sidebar-footer-icon-hover', 'theme-sidebar-item-default', 'theme-sidebar-item-hover', 'theme-sidebar-item-selected', 'theme-sidebar-item-text-active', 'theme-sidebar-item-text-inactive', 'theme-sidebar-item-workspace-active', 'theme-sidebar-item-workspace-inactive', 'theme-sidebar-subitem-default', 'theme-sidebar-subitem-hover', 'theme-sidebar-subitem-selected', 'theme-sidebar-thread-selected', 'theme-text-primary', 'theme-text-secondary'}


def parse_class(cls):
    """'text-white/70' -> ('white', 0.7); 'bg-muted' -> ('muted', 1.0)."""
    cls = cls.strip()
    m = re.match(r'(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide)-(.+)', cls)
    body = m.group(1) if m else cls
    alpha = 1.0
    if '/' in body:
        body, op = body.rsplit('/', 1)
        try:
            alpha = int(op) / 100
        except ValueError:
            alpha = 1.0
    return body, alpha


# FORK-PATCH (gap ALTA/MEDIA da rodada 2): TOKENS era uma allowlist ESCRITA A MAO,
# e todo token do vocabulario ausente dela virava "unresolvable" — silenciosamente,
# com exit 0. Medido neste repo: 93 tokens declarados no artefato eram invisiveis ao
# oraculo, inclusive os 4 `content-*` de status que o EXCEPTIONS.json autoriza
# CITANDO medicoes deste script. Um oraculo que nao consegue medir o par nao reprova
# o par: ele responde "nao sei" com a mesma cara de "passou".
#
# Corrigir acrescentando os 4 nomes a mao so adiaria o problema ate o proximo token.
# A lista passa a ser DERIVADA do artefato: todo `--color-X` / `--X` declarado no CSS
# carregado e um token valido por construcao, entao a allowlist nao pode driftar do
# vocabulario. A lista escrita a mao continua como piso (nomes shadcn que podem nao
# estar emitidos neste repo).
TOKENS |= {
    _m[len('--color-'):] if _m.startswith('--color-') else _m[2:]
    for _m in re.findall(r'--[a-z][a-z0-9-]*(?=\s*:)', SRC)
}


def to_hex(colorname, theme):
    if colorname in TOKENS:
        return _resolve_var(colorname, theme)
    if colorname in PALETTE:
        return PALETTE[colorname]
    return None


def _lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = f(r), f(g), f(b)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _composite(fg, bg, a):
    if a >= 1:
        return fg
    fr, fgc, fb = (int(fg[i:i + 2], 16) for i in (1, 3, 5))
    br, bgc, bb = (int(bg[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02x%02x%02x' % (round(fr * a + br * (1 - a)), round(fgc * a + bgc * (1 - a)), round(fb * a + bb * (1 - a)))


def _contrast(a, b):
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return round((hi + 0.05) / (lo + 0.05), 2)


# FORK-PATCH (causa raiz do gap ALTA-1 da rodada 2): o alpha do FUNDO era parseado
# (`ba`) e nunca usado — `--bg destructive/25` era medido como `destructive` SOLIDO.
# Resultado: `destructive-foreground` sobre `bg-destructive/25` reportava PASS 5,58:1
# quando o valor real e 1,50:1 no tema light. Foi este falso-verde que me deixou
# embarcar um rotulo quase invisivel em repouso nos botoes destrutivos: eu medi, o
# oraculo aprovou, e ele estava medindo outra coisa.
#
# Agora um fundo translucido e composto sobre a superficie de baixo. Quando essa
# superficie NAO resolve, o par vira `unresolvable` em vez de cair para solido:
# tratar translucido como solido em silencio e exatamente o defeito acima.
UNDER_DEFAULT = 'surface-canvas'


def evaluate(text_cls, bg_cls, non_text=False, under=UNDER_DEFAULT):
    """Returns {theme: {'text':hex,'bg':hex,'ratio':x,'pass':bool}} + global 'ok' + 'fails'."""
    tname, ta = parse_class(text_cls)
    bname, ba = parse_class(bg_cls)
    thr = 3.0 if non_text else 4.5
    out = {}
    fails = []
    for theme in THEME_SEL:
        thex = to_hex(tname, theme)
        bhex = to_hex(bname, theme)
        if bhex and ba < 1:
            uhex = to_hex(under, theme)
            if not uhex:
                out[theme] = {'text': thex, 'bg': None, 'ratio': None, 'pass': None,
                              'note': f'unresolvable (fundo /{int(ba * 100)} sobre "{under}" nao resolvido)'}
                fails.append(theme)
                continue
            bhex = _composite(bhex, uhex, ba)
        if not thex or not bhex:
            out[theme] = {'text': thex, 'bg': bhex, 'ratio': None, 'pass': None,
                          'note': 'unresolvable (rgba/alias/unknown)'}
            continue
        eff = _composite(thex, bhex, ta)  # text with opacity over the background
        r = _contrast(eff, bhex)
        ok = r >= thr
        out[theme] = {'text': eff, 'bg': bhex, 'ratio': r, 'pass': ok}
        if not ok:
            fails.append(theme)
    resolved = [t for t in out.values() if t['ratio'] is not None]
    return {'text': text_cls, 'bg': bg_cls, 'threshold': thr,
            'ok': len(fails) == 0 and len(resolved) > 0, 'fails': fails, 'themes': out}


def _print(res):
    print(f"PAIR: {res['text']}  x  {res['bg']}   (threshold {res['threshold']})")
    for t, d in res['themes'].items():
        if d['ratio'] is None:
            print(f"  {t:10} —      {d.get('note', '')}")
        else:
            print(f"  {t:10} {d['ratio']:5}:1  {'PASS' if d['pass'] else 'FAIL'}   ({d['text']} over {d['bg']})")
    v = 'OK (fits)' if res['ok'] else f"does NOT fit — FAILS in: {', '.join(res['fails']) or 'unresolvable'}"
    print(f"  -> {v}\n")


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--text')
    ap.add_argument('--bg')
    ap.add_argument('--non-text', action='store_true')
    ap.add_argument('--under', default=UNDER_DEFAULT,
                    help='superficie sob um fundo translucido (default: %(default)s)')
    ap.add_argument('--batch', action='store_true', help='reads JSON [{text,bg,non_text?}] from stdin')
    a = ap.parse_args()
    if a.batch:
        pairs = json.load(sys.stdin)
        results = [evaluate(p['text'], p['bg'], p.get('non_text', False), p.get('under', a.under)) for p in pairs]
        print(json.dumps(results, ensure_ascii=False))
        sys.exit(1 if any(not r['ok'] for r in results) else 0)
    if not a.text or not a.bg:
        ap.error('use --text and --bg (or --batch)')
    res = evaluate(a.text, a.bg, a.non_text, a.under)
    _print(res)
    sys.exit(0 if res['ok'] else 1)
