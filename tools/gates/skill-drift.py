#!/usr/bin/env python3
"""skill-drift — a copia vendorizada da skill nao pode divergir da canonica.

    python3 skill-drift.py --check      # os arquivos batem o manifesto?
    python3 skill-drift.py --sync       # regrava o manifesto a partir da canonica
    python3 skill-drift.py --selftest

POR QUE EXISTE, e a causa raiz e mais funda que "esqueci de sincronizar".

O repo-alvo carrega 47 arquivos da skill porque um guard de INTEGRIDADE DE LINK
reclamou de markdown quebrado, e a correcao foi versionar o codigo em vez de
arrumar o link. No commit que fez isso, o risco foi DECLARADO EM PROSA:

    "passam a existir duas copias rastreadas da mesma skill. Sem um passo de
     sync no loop, elas divergem de novo."

Em tres dias divergiram em 21 arquivos — e os npm scripts do alvo executam a
copia VELHA, inclusive o gate `tokens:workflow:prove`, que e o que decide se o
trabalho esta concluido. Provar conclusao com codigo desatualizado prova outra
coisa.

Prosa nao e enforcement. Foi a mesma licao do clarification-gate: regra que
ninguem verifica nao e regra, e sugestao.

DOIS NIVEIS, e o segundo existe porque o primeiro sozinho e fragil:

  NIVEL 1  vendorizado x MANIFESTO   sempre roda, nao precisa da canonica.
                                     Pega edicao local na copia.
  NIVEL 2  manifesto x CANONICA      roda quando a canonica esta presente.
                                     Pega a canonica tendo andado.

Um guard de nivel unico ("compare com a canonica") falha ABERTO em qualquer
clone que nao tenha o repo irmao — e falhar aberto num guard de drift e nao ter
guard. O manifesto viaja com o alvo e mantem o nivel 1 sempre armado.

Sai 1 quando ha divergencia. Nunca corrige sozinho: sync e ato deliberado, e
sincronizar automaticamente num pre-commit esconderia a divergencia dentro de um
commit que passa.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

MANIFESTO = "skill-sync.json"
IGNORAR_DIR = {"__pycache__", ".pytest_cache", "node_modules"}
IGNORAR_ARQ = {".DS_Store", MANIFESTO}


def sha(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as fh:
        for bloco in iter(lambda: fh.read(65536), b""):
            h.update(bloco)
    return h.hexdigest()


def inventario(raiz: Path) -> dict:
    """path relativo -> sha256, ordenado para o JSON ser estavel entre corridas."""
    out = {}
    for base, dirs, arqs in os.walk(raiz):
        dirs[:] = sorted(d for d in dirs if d not in IGNORAR_DIR)
        for a in sorted(arqs):
            if a in IGNORAR_ARQ:
                continue
            p = Path(base) / a
            out[str(p.relative_to(raiz))] = sha(p)
    return dict(sorted(out.items()))


def git_head(repo: Path) -> str | None:
    try:
        r = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"],
                           capture_output=True, text=True, timeout=10)
        return r.stdout.strip() or None if r.returncode == 0 else None
    except Exception:
        return None


def diff(esperado: dict, atual: dict) -> tuple[list, list, list]:
    faltando = [k for k in esperado if k not in atual]
    extra = [k for k in atual if k not in esperado]
    mudou = [k for k in esperado if k in atual and esperado[k] != atual[k]]
    return sorted(faltando), sorted(extra), sorted(mudou)


def imprime(titulo: str, faltando, extra, mudou, limite=12):
    print(f"  {titulo}")
    for rot, lista in (("AUSENTE  ", faltando), ("EXTRA    ", extra), ("DIVERGE  ", mudou)):
        for k in lista[:limite]:
            print(f"    {rot}{k}")
        if len(lista) > limite:
            print(f"    ... e mais {len(lista) - limite}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--vendored", default=".claude/skills/tokenize-design-system",
                    help="copia dentro do repo-alvo")
    ap.add_argument("--canonical", default=None,
                    help="a canonica; default = env SKILL_CANONICAL_ROOT")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--sync", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    if a.selftest:
        return selftest()
    if not (a.check or a.sync):
        ap.error("use --check, --sync ou --selftest")

    vend = Path(a.vendored).resolve()
    if not vend.is_dir():
        print(f"skill-drift: SKIP — nao ha copia vendorizada em {a.vendored}")
        return 0

    canon_arg = a.canonical or os.environ.get("SKILL_CANONICAL_ROOT")
    canon = Path(canon_arg).resolve() if canon_arg else None
    man_path = vend / MANIFESTO

    # ---- SYNC: a canonica manda, e o ato e deliberado ----
    if a.sync:
        if not canon or not canon.is_dir():
            print("skill-drift: PAROU — --sync exige a canonica.")
            print("  passe --canonical <path> ou exporte SKILL_CANONICAL_ROOT.")
            return 1
        inv = inventario(canon)
        man_path.write_text(json.dumps({
            "canonicalRoot": str(canon),
            "canonicalHead": git_head(canon),
            "files": inv,
        }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"skill-drift: manifesto gravado — {len(inv)} arquivos de {canon}")
        print(f"  ATENCAO: o manifesto so registra. Copie os arquivos separadamente")
        print(f"  (rsync -a --delete) e rode --check para provar que bateu.")
        return 0

    # ---- CHECK nivel 1: vendorizado x manifesto ----
    if not man_path.exists():
        print(f"skill-drift: FAIL — nao ha {MANIFESTO} em {a.vendored}.")
        print("  Copia vendorizada sem manifesto e drift que ninguem consegue detectar.")
        print("  Rode --sync com a canonica para criar.")
        return 1

    man = json.loads(man_path.read_text(encoding="utf-8"))
    atual = inventario(vend)
    f1, e1, m1 = diff(man["files"], atual)

    problemas = []
    if f1 or e1 or m1:
        problemas.append(("nivel 1 — vendorizado x manifesto", f1, e1, m1))

    # ---- CHECK nivel 2: manifesto x canonica (so se ela existir) ----
    nivel2 = None
    if canon and canon.is_dir():
        inv_c = inventario(canon)
        f2, e2, m2 = diff(inv_c, man["files"])
        nivel2 = (f2, e2, m2)
        if f2 or e2 or m2:
            problemas.append(("nivel 2 — manifesto x canonica (a canonica andou)", f2, e2, m2))

    if a.json:
        print(json.dumps({
            "ok": not problemas,
            "vendored": str(vend),
            "canonical": str(canon) if canon else None,
            "nivel1": {"faltando": f1, "extra": e1, "mudou": m1},
            "nivel2": None if nivel2 is None else
                      {"faltando": nivel2[0], "extra": nivel2[1], "mudou": nivel2[2]},
        }, indent=1))
        return 1 if problemas else 0

    if not problemas:
        n2 = "e a canonica" if nivel2 is not None else "(canonica ausente — nivel 2 nao rodou)"
        print(f"skill-drift: OK — {len(atual)} arquivos batem o manifesto {n2}")
        return 0

    print(f"skill-drift: FAIL — {len(problemas)} nivel(is) com divergencia\n")
    for titulo, f, e, m in problemas:
        imprime(titulo, f, e, m)
        print()
    print("  Por que isso bloqueia: os npm scripts do alvo executam a copia")
    print("  vendorizada, inclusive o gate de conclusao. Divergencia significa que")
    print("  o gate prova o comportamento de OUTRO codigo.")
    print("  Conserto: rsync -a --delete <canonica>/ <vendorizada>/ && --sync && --check")
    return 1


def selftest() -> int:
    """Um guard que nunca foi visto falhando nao e guard, e intencao."""
    import shutil
    import tempfile
    ok = True
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        canon = td / "canon"
        (canon / "scripts").mkdir(parents=True)
        (canon / "scripts" / "a.mjs").write_text("original\n")
        (canon / "SKILL.md").write_text("# skill\n")
        vend = td / "vend"
        shutil.copytree(canon, vend)

        cwd = os.getcwd()
        try:
            os.chdir(td)
            argv = sys.argv

            def rodar(args):
                sys.argv = ["skill-drift"] + args
                try:
                    return main()
                finally:
                    sys.argv = argv

            r = rodar(["--sync", "--vendored", str(vend), "--canonical", str(canon)])
            ok &= (r == 0); print(f"  {'OK  ' if r == 0 else 'FAIL'} sync cria o manifesto")

            r = rodar(["--check", "--vendored", str(vend), "--canonical", str(canon)])
            ok &= (r == 0); print(f"  {'OK  ' if r == 0 else 'FAIL'} copia intacta passa")

            (vend / "scripts" / "a.mjs").write_text("editado localmente\n")
            r = rodar(["--check", "--vendored", str(vend)])
            ok &= (r == 1); print(f"  {'OK  ' if r == 1 else 'FAIL'} edicao local na copia FALHA (nivel 1, sem canonica)")
            (vend / "scripts" / "a.mjs").write_text("original\n")

            (canon / "scripts" / "b.mjs").write_text("nova\n")
            r = rodar(["--check", "--vendored", str(vend), "--canonical", str(canon)])
            ok &= (r == 1); print(f"  {'OK  ' if r == 1 else 'FAIL'} canonica andou FALHA (nivel 2)")

            (vend / MANIFESTO).unlink()
            r = rodar(["--check", "--vendored", str(vend)])
            ok &= (r == 1); print(f"  {'OK  ' if r == 1 else 'FAIL'} sem manifesto FALHA (nao passa por omissao)")
        finally:
            os.chdir(cwd)
    print(f"\nskill-drift --selftest: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
