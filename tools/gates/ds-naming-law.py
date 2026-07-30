#!/usr/bin/env python3
"""
GUARD DA LEI DE NAMING.

LEI (ordem direta do owner, 28/07): `semantic` e `surface` sao CONTEXTO do token,
nao NOME. O identificador que o codigo consome e
`owner.anatomia.propriedade[.variante][.estado]`. Tier, dominio e conceito ficam
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
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASELINE = ROOT / "scripts" / "ds-naming-law-baseline.json"

# As palavras proibidas NO NOME PUBLICO. Continuam validas como metadado e como
# nome de conceito na documentacao — o que a lei proibe e DIGITA-LAS no consumo.
FORBIDDEN = ("surface", "semantic")


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


def measure():
    all_found = violations_in_source() + violations_in_css() + violations_in_token_source()
    by_kind = {}
    for a in all_found:
        by_kind[a["kind"]] = by_kind.get(a["kind"], 0) + 1
    return all_found, by_kind


def main():
    all_found, current = measure()

    if "--listar" in sys.argv:
        for a in all_found:
            print(f"  {a['kind']:18} {a['name']:34} {a['local']}")
        print(f"\ntotal: {len(all_found)}")
        return 0

    if "--record" in sys.argv:
        BASELINE.write_text(json.dumps(current, indent=2, sort_keys=True) + "\n")
        print("baseline da lei de naming gravada:")
        for k, v in sorted(current.items()):
            print(f"  {k:20} {v}")
        return 0

    if not BASELINE.exists():
        print("sem baseline — rode com --record. Estado:")
        for k, v in sorted(current.items()):
            print(f"  {k:20} {v}")
        return 0

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
        print("`surface` e `semantic` sao contexto, nao nome. O identificador")
        print("consumido e owner.anatomia.propriedade[.variante][.estado].")
        print("Veja tokens/GRAMMAR.md; liste com --listar.")
        return 1
    print("LEI DE NAMING OK — nenhuma violacao nova.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
