#!/usr/bin/env python3
"""ds-dead-classes — 3 vetores de morte silenciosa do design system.

Nenhum destes falha o build; todos falham o PIXEL. Por isso sao guard, nao
convencao escrita.

  (a) CLASSE MORTA — sufixo theme-*/papel usado em src/ sem definicao no
      tailwind.config. A classe nao gera CSS e o elemento fica com a cor
      herdada. (Havia 10 sufixos assim, em 38 ocorrencias.)
  (b) ALPHA SEM CANAL — `X-<token>/N` cujo token NAO esta na forma
      rgb(var(--x-rgb) / <alpha-value>). Medido no tailwind 3.4.6: a forma
      var(--x) com /N emite ZERO regra — o fundo some sem erro.
  (c) PAR ORFAO (guard x runtime) — todo nome de PAIRS deve existir como
      --<nome> no CSS E como cor no config apontando para --<nome>-rgb. Sem
      isto, apontar a utility direto para a paleta deixaria o ds-pairs-check
      VERDE validando um token que a tela nao usa.

Uso: python3 .harness/lib/ds-dead-classes.py   (exit 1 se algum vetor acusar)
"""
from __future__ import annotations

import json
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
TW_CONFIG = BASE / "tailwind.config.js"

PAIRS = ["primary", "destructive", "success", "info", "premium", "warning"]
PREFIXES = r"(?:bg|text|border|ring|divide|fill|stroke|from|via|to)"

fails: list[str] = []


def tailwind_colors() -> dict:
    """Resolve as cores REAIS do config (nao regex no arquivo): o config e ESM e
    espalha a ponte gerada, entao so o runtime sabe o valor final."""
    script = (
        "import('file://%s').then(m=>{const c=(m.default.theme?.extend?.colors)||{};"
        "console.log(JSON.stringify(c))})" % TW_CONFIG
    )
    out = subprocess.run(["node", "-e", script], cwd=BASE, capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        print(f"ds-dead-classes: nao consegui carregar {TW_CONFIG} — {out.stderr[:200]}")
        sys.exit(1)
    return json.loads(out.stdout.strip() or "{}")


def flat(colors: dict, prefix: str = "") -> dict:
    out = {}
    for k, v in colors.items():
        name = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(flat(v, f"{name}-"))
        else:
            out[name] = str(v)
    return out


colors = flat(tailwind_colors())
files = list(SRC.rglob("*.jsx")) + list(SRC.rglob("*.js"))
text = "\n".join(p.read_text(encoding="utf-8", errors="ignore") for p in files)

used = set(re.findall(rf"(?<![\w-]){PREFIXES}-(theme-[a-z0-9-]+)(?![\w-])", text))
dead = sorted(u for u in used if u not in colors)
if dead:
    fails.append(f"(a) {len(dead)} classe(s) MORTA(s): {', '.join(dead[:8])}")

alpha_used = set(re.findall(rf"(?<![\w-]){PREFIXES}-([a-z0-9-]+)/\d+(?![\w-])", text))
no_channel = sorted(
    t for t in alpha_used
    if t in colors and "<alpha-value>" not in colors[t]
    and not t.startswith(("white", "black", "transparent"))
)
if no_channel:
    fails.append(f"(b) {len(no_channel)} token(s) com /N SEM canal (emitem ZERO css): {', '.join(no_channel[:8])}")

# FORK-PATCH — vetor (d): TOKEN QUE NAO EXISTE EM LUGAR NENHUM.
#
# Buraco estrutural achado por revisao adversarial em 2026-07-27, com 211 usos de
# `surface-hover` em 90 arquivos emitindo ZERO CSS enquanto este guard reportava
# "0 mortas". Por que escapava dos dois vetores existentes:
#   (a) so casa o prefixo `theme-*`  -> `surface-hover` nao entra;
#   (b) exige `t in colors`          -> token INEXISTENTE nunca entra.
# Os dois pressupunham que o token EXISTE. O caso pior — nome inventado por um
# migrador, que o Tailwind ignora em silencio — passava batido.
#
# Este vetor pega o complemento: classe com CARA de token do nosso vocabulario
# (nome composto por hifen, sem sufixo de escala numerica, fora da paleta do
# Tailwind) cujo nome NAO esta no config. Conservador de proposito: nome de uma
# palavra so e forma arbitraria ficam de fora, para nao gerar falso positivo.
TW_BUILTIN = {
    "transparent", "current", "inherit", "none", "white", "black", "auto",
    "clip", "ellipsis", "wrap", "nowrap", "balance", "pretty", "left", "right",
    "center", "justify", "start", "end", "top", "bottom", "solid", "dashed",
    "dotted", "double", "hidden", "opacity",
}
# `text-` e `border-` nao servem so a cor: `text-body-lg` e fontSize e `border-b-2`
# e largura direcional. Sem consultar as OUTRAS escalas da ponte, o vetor acusaria
# token valido como fantasma — trocar um falso negativo por falso positivo nao e
# progresso.
_outras = {}
try:
    _o = subprocess.run(
        ["node", "-e",
         "import('file://%s').then(m=>{const t=m.default.theme?.extend||{};"
         "console.log(JSON.stringify(Object.assign({},t.fontSize,t.spacing,t.borderRadius,"
         "t.borderWidth,t.boxShadow,t.zIndex,t.opacity,t.backgroundImage,t.textColor,"
         "t.backgroundColor,t.borderColor,t.gradientColorStops,t.ringColor,t.fill,t.stroke)))})" % TW_CONFIG],
        cwd=BASE, capture_output=True, text=True, timeout=60)
    if _o.returncode == 0:
        _outras = json.loads(_o.stdout.strip() or "{}")
except Exception:
    pass

_DIRECIONAL = re.compile(r"^[btlrxyse]-")   # border-b-2, border-x-4...
# Utilitarios NATIVOS do Tailwind cujo nome, depois do prefixo, parece token nosso.
# `border-spacing-0` vira "spacing-0" ao cortar `border-`; nao e cor.
_NATIVO = re.compile(r"^(spacing|opacity|separate|collapse|solid|none)-")
# Buscar no arquivo INTEIRO gera falso positivo caro: "text-embedding-3-large" e nome
# de modelo da OpenAI dentro de um array, "text-generation-webui.png" e path de import
# e id="text-size-btn" e atributo. Nenhum e classe. Entao o vetor (d) so olha o que
# esta DENTRO de className/class — e ignora o artefato gerado, que lista os proprios
# tokens e casaria com todos eles.
_fonte = "\n".join(
    p.read_text(encoding="utf-8", errors="ignore")
    for p in files
    if "styles/generated" not in str(p)
)
_css_literal = ""
for _p in [BASE / _q.strip() for _q in (get_config("DS_GATE_CSS_PATH", "") or "").split(",") if _q.strip()]:
    if _p.is_file():
        _css_literal += _p.read_text(encoding="utf-8", errors="ignore")

# Captura do conteudo de className. A versao anterior usava ["\'`{] como abridor e,
# em `className={` + backtick, o `{` casava e o grupo parava no backtick seguinte:
# capturava STRING VAZIA. Ou seja, o vetor era cego a `className={`...`}` — a forma
# EXATA do bug que ele foi criado para pegar (ThreadItem Linha 70), presente em 107
# arquivos. Provado por mutacao: token inventado em template literal saia exit 0.
#
# Agora: pega o corpo de className="..." / '...' / `...` E, para className={...},
# pega o bloco inteiro ate o fecha-chaves equilibrado, o que cobre template literal,
# ternario e concatenacao (`classNames += "..."`).
_classnames_parts = []
for m in re.finditer(r'class(?:Name)?\s*=\s*(["\'`])((?:(?!\1).){0,4000})\1', _fonte, re.S):
    _classnames_parts.append(m.group(2))
for m in re.finditer(r'class(?:Name)?\s*=\s*\{', _fonte):
    i = m.end() - 1
    profundidade = 0
    for j in range(i, min(i + 4000, len(_fonte))):
        if _fonte[j] == "{":
            profundidade += 1
        elif _fonte[j] == "}":
            profundidade -= 1
            if profundidade == 0:
                _classnames_parts.append(_fonte[i + 1:j])
                break
_classnames = " ".join(_classnames_parts)
# Guarda o PREFIXO junto do nome: a isencao de classe CSS literal depende do par
# (prefixo, token), nao so do token. `.text-tremor-content` existir NAO pode isentar
# `bg-tremor-content`, que nao existe — furo provado por mutacao pelo revisor.
_pares = set(re.findall(rf"(?<![\w-])({PREFIXES})-([a-z][a-z0-9]*(?:-[a-z0-9]+)+)(?![\w-])", _classnames))
tokenish = {t for _, t in _pares}
fantasma = sorted(
    t for t in tokenish
    if t not in colors
    and t not in _outras
    and t.split("-")[0] not in TW_BUILTIN
    and not _DIRECIONAL.match(t)
    and not re.search(r"-\d{2,3}$", t)
    and not t.startswith("theme-")
    and not _NATIVO.match(t)
    # classe CSS literal escrita a mao no tier 3 (ex.: `.text-tremor-content` no
    # index.css) nao passa pelo config do Tailwind e nao e classe morta.
    # A isencao exige a classe EXATA (prefixo utilitario + nome). Antes casava por
    # sufixo: `.text-tremor-content` no index.css isentava tambem `bg-tremor-content`,
    # que nao existe em lugar nenhum. Provado por mutacao pelo revisor.
    # E ghost a menos que TODO uso desse token tenha a classe literal correspondente.
    # (O `not` aqui e essencial: sem ele a condicao INCLUI o token justamente quando a
    #  classe existe — inversao que eu introduzi ao trocar para checagem por prefixo.)
    and not all(
        re.search(rf"\.(?:[a-z-]+\\?:)*{pref}-{re.escape(t)}(?![\w-])", _css_literal)
        for pref, tok in _pares if tok == t
    )
)
if fantasma:
    fails.append(
        f"(d) {len(fantasma)} token(s) INEXISTENTE(s) no config — emitem ZERO css: "
        f"{', '.join(fantasma[:8])}"
    )


css_paths = [BASE / p.strip() for p in (get_config("DS_GATE_CSS_PATH", "") or "").split(",") if p.strip()]
css = "\n".join(p.read_text() for p in css_paths if p.is_file())
orphans = []
for pair in PAIRS:
    in_css = re.search(rf"--{re.escape(pair)}\s*:", css) is not None
    cfg = colors.get(pair, "")
    ok = f"--{pair}-rgb" in cfg or f"--{pair})" in cfg
    if not in_css:
        orphans.append(f"{pair} (sem --{pair} no CSS)")
    elif not ok:
        orphans.append(f"{pair} (config -> '{cfg[:40]}', nao --{pair}-rgb)")
if orphans:
    fails.append(f"(c) {len(orphans)} par(es) ORFAO(S): {'; '.join(orphans)}")

for f in fails:
    print(f"  FALHA {f}")
print(f"ds-dead-classes: (a) {len(dead)} mortas, (b) {len(no_channel)} alphas sem canal, "
      f"(c) {len(orphans)} pares orfaos, (d) {len(fantasma)} tokens inexistentes")
sys.exit(1 if fails else 0)
