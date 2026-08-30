#!/usr/bin/env bash
#
# Atualiza a worktree feature-a com o que está na main (sincroniza "para baixo").
# Uso: bash tools/git-sync-feature-a.sh   (ou o atalho: git sync-fa)
#
# Enquanto a feature-a não tiver commits próprios, é um fast-forward (risco zero).
# Se tiver, cai num merge normal da main dentro da feature-a.
set -euo pipefail

MAIN_DIR="C:/Projetos/SysMelo"
FEATURE_DIR="C:/Projetos/sysmelo-feature-a"
FEATURE_BRANCH="feature-a"

if [ ! -d "$FEATURE_DIR/.git" ] && [ ! -f "$FEATURE_DIR/.git" ]; then
  echo "ERRO: worktree não encontrada em $FEATURE_DIR" >&2
  exit 1
fi

# Não mexer se o outro agente deixou alterações pendentes na feature-a.
if [ -n "$(git -C "$FEATURE_DIR" status --porcelain)" ]; then
  echo "ATENÇÃO: a worktree feature-a tem alterações não commitadas." >&2
  echo "Commite ou descarte antes de sincronizar. Nada foi alterado." >&2
  git -C "$FEATURE_DIR" status --short >&2
  exit 1
fi

echo "== feature-a: $(git -C "$FEATURE_DIR" log --oneline -1) =="
echo "== main:      $(git -C "$MAIN_DIR" log --oneline -1 main) =="

if git -C "$FEATURE_DIR" merge --ff-only main; then
  echo "OK: fast-forward aplicado."
else
  echo "feature-a tem commits próprios — fazendo merge normal da main."
  git -C "$FEATURE_DIR" merge main
fi

echo "== feature-a agora em: $(git -C "$FEATURE_DIR" log --oneline -1) =="
