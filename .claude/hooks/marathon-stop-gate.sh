#!/usr/bin/env bash
# marathon-stop-gate — Stop hook. Inerte sem maratona ativa.
# Com a maratona localizada + itens abertos no RUN.md: bloqueia a parada e
# devolve a "Próxima ação". Anti-prisão: 3 bloqueios consecutivos SEM o RUN.md
# mudar → libera com aviso (progresso real zera os strikes).
#
# CROSS-REPO (2026-08-01): a localização do run saiu daqui para
# marathon-locate.sh. Antes disso o gate procurava SÓ em
# "$CLAUDE_PROJECT_DIR/.claude/runs/ACTIVE" — e uma maratona que vive em outro
# working directory era invisível, virando no-op silencioso. Medido: a maratona
# graph-loop-fechar (em ui-tokenizer-v2, sessão ancorada em learnhouse) rodou
# horas sem produzir UM .stop-strikes. Era esta a causa do "a maratona sempre
# para".
set -uo pipefail
IN=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
[ "$(jq -r '.stop_hook_active // false' <<<"$IN")" = "true" ] && exit 0
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"

. "$(dirname "${BASH_SOURCE[0]}")/marathon-locate.sh"
marathon_locate "$ROOT" ".claude/runs" || exit 0
SLUG="$MARATHON_SLUG"
RUN="$MARATHON_RUN_MD"
TEARDOWN="$(marathon_teardown_hint)"

# Aberto = "[ ]" (a fazer) ou "[~]" (em curso), em QUALQUER indentação.
# A âncora antiga era '^- \[ \]', que ignorava em silêncio todo item ANINHADO:
# um RUN.md cujo trabalho restante estivesse sob um item pai contava ZERO
# abertos e o gate liberava a parada. Medido no RUN.md real de
# graph-loop-fechar: contava 1, havia 5 abertos.
OPEN=$(grep -c '^[[:space:]]*- \[[ ~]\]' "$RUN" || true)
[ "$OPEN" -eq 0 ] && exit 0   # checklist zerado — parada legítima

# AGUARDANDO decisão do usuário = parada legítima
NEXT=$(awk '/^## Próxima ação/{getline; while($0 ~ /^\s*$/) getline; print; exit}' "$RUN")
case "$NEXT" in AGUARDANDO:*) exit 0 ;; esac

# 3 strikes sem progresso → libera.
#
# Progresso é medido pelo CONTEÚDO do RUN.md, não pelo mtime. O mtime errava nos
# dois sentidos: tem granularidade de 1 segundo, então duas edições reais dentro
# do mesmo segundo liam como "sem progresso"; e um `touch` sozinho zerava o
# contador, então um agente girando em falso podia manter o gate armado sem
# mudar nada. O checksum responde a única pergunta que o contador faz — o estado
# durável andou?
STRIKES="$MARATHON_RUN_DIR/.stop-strikes"
STAMP=$( (cksum < "$RUN") 2>/dev/null | awk '{print $1"-"$2}' )
[ -n "$STAMP" ] || STAMP=0
read -r COUNT LAST < <(cat "$STRIKES" 2>/dev/null || echo "0 0")
[ "$STAMP" != "$LAST" ] && COUNT=0   # conteúdo do RUN.md mudou = progresso
if [ "$COUNT" -ge 3 ]; then
  rm -f "$STRIKES"
  echo '{"systemMessage":"marathon-stop-gate: 3 bloqueios sem progresso no RUN.md — liberando a parada. Maratona segue ATIVA ('"$SLUG"'); retome com a skill marathon ou encerre com: '"$TEARDOWN"'"}'
  exit 0
fi
echo "$((COUNT + 1)) $STAMP" > "$STRIKES"

cat >&2 <<EOF
MARATHON ATIVA ($SLUG): $OPEN item(ns) abertos no checklist — a parada foi bloqueada.
Diretório do run: $MARATHON_RUN_DIR (localizado via: $MARATHON_SOURCE_KIND)
Próxima ação registrada: ${NEXT:-"(vazia — atualize o RUN.md)"}
Continue executando (skill marathon §2: fechar item → marcar [x] → atualizar Próxima ação).
Se está genuinamente bloqueado em decisão do usuário: escreva "AGUARDANDO: <pergunta>" na seção Próxima ação e pare.
Encerrar a maratona de vez: $TEARDOWN
EOF
exit 2
