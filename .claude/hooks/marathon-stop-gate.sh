#!/usr/bin/env bash
# marathon-stop-gate — Stop hook. Inerte sem maratona ativa.
# Com .claude/runs/ACTIVE + itens abertos no RUN.md: bloqueia a parada e
# devolve a "Próxima ação". Anti-prisão: 3 bloqueios consecutivos SEM o RUN.md
# mudar → libera com aviso (progresso real zera os strikes).
set -uo pipefail
IN=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
[ "$(jq -r '.stop_hook_active // false' <<<"$IN")" = "true" ] && exit 0
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
ACTIVE="$ROOT/.claude/runs/ACTIVE"
[ -f "$ACTIVE" ] || exit 0
SLUG=$(head -1 "$ACTIVE" | tr -d '[:space:]')
RUN="$ROOT/.claude/runs/$SLUG/RUN.md"
[ -f "$RUN" ] || exit 0

OPEN=$(grep -c '^- \[ \]' "$RUN" || true)
[ "$OPEN" -eq 0 ] && exit 0   # checklist zerado — parada legítima

# AGUARDANDO decisão do usuário = parada legítima
NEXT=$(awk '/^## Próxima ação/{getline; while($0 ~ /^\s*$/) getline; print; exit}' "$RUN")
case "$NEXT" in AGUARDANDO:*) exit 0 ;; esac

# 3 strikes sem progresso → libera
STRIKES="$ROOT/.claude/runs/$SLUG/.stop-strikes"
MTIME=$(stat -c %Y "$RUN" 2>/dev/null || echo 0)
read -r COUNT LAST < <(cat "$STRIKES" 2>/dev/null || echo "0 0")
[ "$MTIME" != "$LAST" ] && COUNT=0   # RUN.md mudou desde o último strike = progresso
if [ "$COUNT" -ge 3 ]; then
  rm -f "$STRIKES"
  echo '{"systemMessage":"marathon-stop-gate: 3 bloqueios sem progresso no RUN.md — liberando a parada. Maratona segue ATIVA ('"$SLUG"'); retome com a skill marathon ou encerre com rm .claude/runs/ACTIVE."}'
  exit 0
fi
echo "$((COUNT + 1)) $MTIME" > "$STRIKES"

cat >&2 <<EOF
MARATHON ATIVA ($SLUG): $OPEN item(ns) abertos no checklist — a parada foi bloqueada.
Próxima ação registrada: ${NEXT:-"(vazia — atualize o RUN.md)"}
Continue executando (skill marathon §2: fechar item → marcar [x] → atualizar Próxima ação).
Se está genuinamente bloqueado em decisão do usuário: escreva "AGUARDANDO: <pergunta>" na seção Próxima ação e pare.
Encerrar a maratona de vez: rm .claude/runs/ACTIVE
EOF
exit 2
