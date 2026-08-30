#!/usr/bin/env bash
#
# Sobe o trabalho da feature-a para a main (mescla "para cima").
# Uso: bash tools/git-promote-feature-a.sh   (ou o atalho: git promote-fa)
#
# Roda a partir da pasta principal (main) via -C, então funciona mesmo se você
# estiver com o terminal na pasta feature-a.
set -euo pipefail

MAIN_DIR="C:/Projetos/SysMelo"
FEATURE_BRANCH="feature-a"

# A main não pode ter alterações pendentes na hora do merge.
if [ -n "$(git -C "$MAIN_DIR" status --porcelain --untracked-files=no)" ]; then
  echo "ATENÇÃO: a pasta principal (main) tem alterações não commitadas." >&2
  echo "Commite ou descarte antes de subir a feature-a. Nada foi alterado." >&2
  git -C "$MAIN_DIR" status --short >&2
  exit 1
fi

echo "== Subindo $FEATURE_BRANCH para a main =="
git -C "$MAIN_DIR" merge "$FEATURE_BRANCH"
echo "== main agora em: =="
git -C "$MAIN_DIR" log --oneline -3
