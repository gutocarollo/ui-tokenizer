#!/usr/bin/env python3
"""Guard de CONTRASTE de pares declarados, avaliado por tema.

POR QUE EXISTE. O anel de foco dos campos de configuracao passa em 3,00:1 sobre
o fundo escuro do input — exatamente o minimo que a WCAG 2.2 SC 1.4.11 exige de
indicador de foco. "Exatamente no minimo" significa que qualquer clareada no
fundo do input derruba o par, em silencio, sem erro de build e sem teste
vermelho. O par so foi descoberto porque alguem mediu com um probe manual.

Este guard transforma essa medicao em regra executavel: os pares ficam
DECLARADOS aqui, com o minimo e o motivo, e sao reavaliados em TODO tema a cada
commit.

O que ele NAO faz: adivinhar pares. Um par so e verificado se estiver na tabela
PARES. Guard que tenta inferir o universo sozinho gera falso positivo, vira
ruido e acaba desligado.

    python3 scripts/ds-contrast-pairs.py [--verbose]
"""
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FONTES = [
    RAIZ / "src/styles/generated/color-tokens.css",
    RAIZ / "src/index.css",
]

# (rotulo, token do primeiro plano, token do fundo, minimo, motivo)
PARES = [
    (
        "anel de foco x fundo do campo de configuracao",
        "--theme-button-primary",
        "--theme-settings-input-bg",
        3.0,
        "WCAG 2.2 SC 1.4.11 (Non-text Contrast) exige 3:1 para indicador de foco. "
        "Medido em 2026-07-31: 3,00:1 no tema escuro — passa NO LIMITE.",
    ),
]

TEMAS = [":root", '[data-theme="light"]', '[data-theme="dark"]']

# Tokens que existem em DUAS notacoes e precisam concordar.
#
# POR QUE: `text-content-primary` compila para
# `rgb(var(--color-content-primary-rgb) / 1)` e `text-theme-text-primary` para
# `var(--theme-text-primary)` -> `var(--color-content-primary)`. Sao caminhos
# DIFERENTES para a mesma cor: um le a notacao `-rgb`, o outro o hex. Eles
# concordam hoje nos 3 temas — verificado — e nada no repo garante que
# continuem. Se divergirem, duas classes que todo mundo trata como sinonimo
# passam a pintar cores diferentes, sem erro de build e sem teste vermelho.
#
# 1537 usos dependem dessa concordancia (1114 + 423).
ESPELHOS = [
    ("--color-content-primary", "--color-content-primary-rgb"),
]


class GuardError(Exception):
    pass


def blocos_por_tema(texto):
    """Mapa tema -> {token: valor cru}, na ordem em que aparecem no arquivo."""
    saida = {}
    for m in re.finditer(r"(?m)^\s*([^\n{]+?)\s*\{", texto):
        seletor = m.group(1).strip()
        if seletor not in TEMAS:
            continue
        fim = texto.find("}", m.end())
        if fim < 0:
            continue
        corpo = texto[m.end():fim]
        alvo = saida.setdefault(seletor, {})
        for d in re.finditer(r"(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);", corpo):
            alvo[d.group(1)] = d.group(2).strip()
    return saida


def carregar():
    temas = {t: {} for t in TEMAS}
    for arquivo in FONTES:
        if not arquivo.exists():
            raise GuardError(f"fonte ausente: {arquivo}")
        for seletor, decls in blocos_por_tema(arquivo.read_text(encoding="utf8")).items():
            temas[seletor].update(decls)
    return temas


def resolver(token, decls, base, vistos=None):
    """Segue a cadeia var() ate um valor concreto.

    `base` e o bloco :root: um tema so redeclara o que muda, o resto herda.
    Ciclo levanta em vez de girar — fail-closed.
    """
    vistos = vistos or set()
    if token in vistos:
        raise GuardError(f"ciclo de var() em {token}")
    vistos.add(token)
    valor = decls.get(token, base.get(token))
    if valor is None:
        raise GuardError(f"token {token} nao existe em nenhum bloco")
    m = re.fullmatch(r"var\((--[a-zA-Z0-9-]+)\)", valor.strip())
    if m:
        return resolver(m.group(1), decls, base, vistos)
    return valor.strip()


def para_rgb(valor):
    v = valor.strip()
    m = re.fullmatch(r"#([0-9a-fA-F]{6})", v)
    if m:
        h = m.group(1)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    m = re.fullmatch(r"#([0-9a-fA-F]{3})", v)
    if m:
        h = m.group(1)
        return tuple(int(c * 2, 16) for c in h)
    m = re.fullmatch(r"rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+).*\)", v)
    if m:
        return tuple(int(m.group(i)) for i in (1, 2, 3))
    raise GuardError(f"nao sei ler a cor {v!r} (guard nao adivinha)")


def luminancia(rgb):
    def canal(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (canal(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    la, lb = luminancia(a), luminancia(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def main():
    verbose = "--verbose" in sys.argv
    try:
        temas = carregar()
    except GuardError as e:
        print(f"ds-contrast-pairs: PAROU — {e}")
        return 2

    base = temas.get(":root", {})
    falhas = []
    espelhos = []
    # Erro de AVALIACAO (token ausente, ciclo, cor ilegivel) e categoria
    # diferente de reprovacao de contraste: um diz "o guard nao consegue medir",
    # o outro diz "medi e regrediu". Em CI a resposta a cada um e diferente, e
    # colapsar os dois em exit 1 esconde guard quebrado dentro de "falhou".
    erros = []
    linhas = []
    for rotulo, tk_fg, tk_bg, minimo, motivo in PARES:
        for seletor in TEMAS:
            try:
                fg = para_rgb(resolver(tk_fg, temas[seletor], base))
                bg = para_rgb(resolver(tk_bg, temas[seletor], base))
            except GuardError as e:
                erros.append(f"{rotulo} [{seletor}]: {e}")
                continue
            c = contraste(fg, bg)
            ok = c >= minimo
            linhas.append(f"  {seletor:22} {rotulo:46} {c:5.2f}:1  min {minimo:.2f}  {'ok' if ok else 'REPROVA'}")
            if not ok:
                falhas.append(
                    f"{rotulo} [{seletor}]: {c:.2f}:1 abaixo do minimo {minimo:.2f}\n"
                    f"      rgb{fg} sobre rgb{bg}\n"
                    f"      {motivo}"
                )

    if verbose or falhas or erros:
        print("ds-contrast-pairs")
        for l in linhas:
            print(l)
    for tk_hex, tk_rgb in ESPELHOS:
        for seletor in TEMAS:
            try:
                h = para_rgb(resolver(tk_hex, temas[seletor], base))
                r_raw = resolver(tk_rgb, temas[seletor], base)
                r = tuple(int(x) for x in re.split(r"[\s,]+", r_raw.strip()) if x)
            except (GuardError, ValueError) as e:
                erros.append(f"espelho {tk_hex}/{tk_rgb} [{seletor}]: {e}")
                continue
            ok = h == r
            espelhos.append(f"  {seletor:22} {tk_hex} = rgb{h}  x  {tk_rgb} = rgb{r}  {'ok' if ok else 'DIVERGEM'}")
            if not ok:
                falhas.append(
                    f"espelho {tk_hex} x {tk_rgb} [{seletor}]: rgb{h} != rgb{r}\n"
                    f"      Duas classes tratadas como sinonimo passariam a pintar cores diferentes."
                )
    if (verbose or falhas or erros) and espelhos:
        for l in espelhos:
            print(l)
    if erros:
        print("\nGUARD NAO CONSEGUIU AVALIAR (nao e regressao de contraste — e o guard cego):")
        for e in erros:
            print(f"  - {e}")
        return 2
    if falhas:
        print("\nCONTRASTE REPROVOU:")
        for f in falhas:
            print(f"  - {f}")
        return 1
    print(f"ds-contrast-pairs: OK — {len(PARES)} par(es) x {len(TEMAS)} tema(s), nenhum abaixo do minimo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
