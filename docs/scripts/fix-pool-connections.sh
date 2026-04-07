#!/bin/bash
# Script para corrigir todas as conexões new Pool() para usar getPgPool()

echo "🔧 Corrigindo conexões de banco de dados..."
echo ""

# Lista de arquivos que precisam ser corrigidos
FILES=$(grep -rl "new Pool(" src/pages/api/faturamento src/pages/api/boleto src/pages/api/postgresql 2>/dev/null || true)

if [ -z "$FILES" ]; then
  echo "✅ Nenhum arquivo encontrado com 'new Pool()'"
  exit 0
fi

TOTAL=$(echo "$FILES" | wc -l)
echo "📋 Encontrados $TOTAL arquivos com 'new Pool()'"
echo ""

COUNT=0
for FILE in $FILES; do
  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] Processando: $FILE"
  
  # Verificar se já tem o import correto
  if ! grep -q "import.*getPgPool.*from.*@/lib/pg" "$FILE"; then
    # Adicionar import do getPgPool após outros imports
    sed -i "/^import.*from 'pg';/a import { getPgPool } from '@/lib/pg';" "$FILE"
    echo "  ✓ Adicionado import getPgPool"
  fi
  
  # Remover declaração de pool local se existir
  if grep -q "^const pool = new Pool" "$FILE" || grep -q "^let pool.*= new Pool" "$FILE"; then
    sed -i "/^const pool = new Pool/d" "$FILE"
    sed -i "/^let pool.*= new Pool/d" "$FILE"
    echo "  ✓ Removida declaração local de pool"
  fi
  
  # Substituir pool por getPgPool() nas queries
  # Mas precisa ser feito manualmente pois depende do contexto
  echo "  ⚠️  Revisar manualmente: substituir 'pool.query' por 'getPgPool().query'"
done

echo ""
echo "✅ Processamento concluído!"
echo ""
echo "⚠️  ATENÇÃO: Você precisa revisar manualmente cada arquivo e:"
echo "   1. Substituir 'pool.query(...)' por 'getPgPool().query(...)'"
echo "   2. Remover imports não utilizados do 'pg'"
echo "   3. Testar a aplicação"
