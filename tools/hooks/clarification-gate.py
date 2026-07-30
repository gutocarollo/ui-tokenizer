#!/usr/bin/env python3
"""Stop hook: pergunta de escolha ao dono exige bloco D[n], nao pergunta seca.

Por que existe: a regra ja estava em prosa (CLAUDE.md §6, e a skill
`clarification-plan` que foi deletada) e mesmo assim o agente terminou turno atras
de turno com "Sigo por qual?", "Quer que eu...?", "Prefere A ou B?". Regra em prosa
que ninguem verifica nao e regra — e sugestao.

O gate e deterministico e mede DUAS coisas no texto final do turno:

  1. o turno faz uma PERGUNTA DE ESCOLHA ao dono?
  2. se faz, ele traz o bloco `### D[n]` com o formato obrigatorio?

Se (1) e nao (2), bloqueia e devolve o formato. Se nao ha pergunta de escolha,
sai do caminho.

O que NAO conta como pergunta de escolha, para o gate nao virar ruido:
  - pergunta retorica dentro de explicacao ("por que isso importa?")
  - pergunta em bloco de codigo ou citacao
  - pedido de credencial/acesso que o dono precisa prover (nao ha opcao a comparar)

Contrato: exit 0 = libera; exit 2 = bloqueia (stderr vai para o modelo).
`stop_hook_active` true = ja bloqueou uma vez neste turno -> libera, evita loop.
"""
import json
import re
import sys

# Perguntas que pedem ESCOLHA do dono. Sao os padroes que o agente de fato usou.
CHOICE_PATTERNS = [
    # verbo de 1a pessoa do presente + interrogacao = pedido de permissao.
    # Generalizado depois que `"Sigo criando os 32 tokens?"` escapou de um padrao
    # que exigia `sigo por/com/para` — o objeto direto varia, o verbo nao.
    r"\b(?:sigo|crio|implemento|executo|rodo|aplico|migro|comeco|avanco|prossigo|"
    r"gero|escrevo|renomeio|removo|adiciono|instalo|commito|pusho)\b",
    r"\bquer\s+que\s+eu\b",
    r"\bprefere\b",
    r"\bqual\s+(?:voce|vc|deles|delas|opcao|caminho|dos)",
    r"\b(?:posso|devo|faco)\b",
    r"\bautoriza\b",
    r"\bconfirma\b",
    r"\bA\s+ou\s+B\b",
]

# O bloco obrigatorio e seus elementos.
D_BLOCK = re.compile(r"^#{2,4}\s*D\d+\s*[—\-:]", re.MULTILINE)
REQUIRED_ELEMENTS = {
    "Comportamento": r"\*\*Comportamento",
    "Exemplo aplicado bom": r"\*\*Exemplo aplicado bom",
    "Exemplo aplicado ruim": r"\*\*Exemplo aplicado ruim",
    "Quando escolher": r"\*\*Quando escolher",
    "Minha recomendacao": r"\*\*(?:Minha recomenda|Recomenda[cç][aã]o)",
}


def strip_code_and_quotes(text: str) -> str:
    """Remove fenced code and blockquotes: pergunta ali nao e pergunta ao dono."""
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"^\s*>.*$", " ", text, flags=re.MULTILINE)
    return text


def assistant_texts_from_tail(path, limit=400):
    texts = []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            lines = fh.readlines()[-limit:]
    except OSError:
        return texts
    for line in lines:
        try:
            rec = json.loads(line)
        except ValueError:
            continue
        msg = rec.get("message") or {}
        if msg.get("role") != "assistant":
            continue
        content = msg.get("content")
        if isinstance(content, str):
            texts.append(content)
        elif isinstance(content, list):
            txt = "".join(
                c.get("text", "") for c in content
                if isinstance(c, dict) and c.get("type") == "text"
            )
            if txt.strip():
                texts.append(txt)
    return texts


def main():
    try:
        data = json.load(sys.stdin)
    except ValueError:
        return 0
    if data.get("stop_hook_active"):
        return 0

    last_assistant_message = data.get("last_assistant_message")
    if isinstance(last_assistant_message, str) and last_assistant_message.strip():
        texts = [last_assistant_message]
    else:
        transcript = data.get("transcript_path")
        if not transcript:
            return 0
        texts = assistant_texts_from_tail(transcript)
        if not texts:
            return 0

    raw = texts[-1]
    body = strip_code_and_quotes(raw)

    # (1) ha pergunta de ESCOLHA?
    hits = [p for p in CHOICE_PATTERNS if re.search(p, body, re.IGNORECASE)]
    if not hits:
        return 0
    # exige tambem um ponto de interrogacao fora de codigo — pattern sozinho
    # pode aparecer em prosa afirmativa ("posso seguir porque X ja passou").
    if "?" not in body:
        return 0

    # (2) o bloco obrigatorio esta presente e completo?
    if D_BLOCK.search(raw):
        faltando = [
            nome for nome, rx in REQUIRED_ELEMENTS.items()
            if not re.search(rx, raw, re.IGNORECASE)
        ]
        if not faltando:
            return 0
        sys.stderr.write(
            "CLARIFICATION-GATE: o bloco D[n] existe mas esta incompleto.\n"
            f"Faltam os elementos: {', '.join(faltando)}.\n"
            "Cada opcao precisa de Comportamento, Exemplo aplicado bom, Exemplo "
            "aplicado ruim, Quando escolher — e o turno precisa de UMA "
            "**Minha recomendacao** com o caminho que voce escolheria e por que.\n"
        )
        return 2

    sys.stderr.write(
        "CLARIFICATION-GATE: voce esta pedindo uma escolha ao dono sem o bloco D[n].\n"
        f"Padrao detectado: {hits[0]}\n\n"
        "Pergunta seca e proibida. Reescreva o final do turno assim:\n\n"
        "### D1 — [pergunta concreta da decisao]\n\n"
        "**Opcao A — [nome]**\n"
        "- **Comportamento:** o que o sistema/processo passa a fazer.\n"
        "- **Exemplo aplicado bom:** no caso REAL [arquivo/token/rota/comando], acontece X.\n"
        "- **Exemplo aplicado ruim:** no caso REAL [...], acontece Y.\n"
        "- **Quando escolher:** se a prioridade for Z.\n\n"
        "**Opcao B — [nome]**\n"
        "- (os mesmos quatro itens)\n\n"
        "**Opcao C** quando A e B isoladas forem insuficientes (hibrido, spike, fallback).\n\n"
        "**Minha recomendacao:** [qual, e por que, com o dado que sustenta].\n\n"
        "Exemplo aplicado = entidade, arquivo, token, rota, comando ou tela REAL do "
        "contexto analisado. Analogia generica nao vale.\n"
        "Se a decisao NAO precisa do dono — e voce consegue decidir com evidencia — "
        "entao decida, execute, e relate a escolha em vez de perguntar.\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
