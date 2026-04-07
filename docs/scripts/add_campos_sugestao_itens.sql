-- Adiciona campos faltantes para funcionalidade de Sugestão Automática
-- Campos usados no sistema legado Oracle que ainda não existem no PostgreSQL

SET search_path TO db_manaus;

BEGIN;

\echo ''
\echo '========================================='
\echo 'ADICIONANDO CAMPOS PARA SUGESTÃO AUTOMÁTICA'
\echo '========================================='
\echo ''

-- 1. Adicionar campo itr_status (Status do item)
\echo 'Adicionando campo itr_status...'
ALTER TABLE cmp_it_requisicao
  ADD COLUMN IF NOT EXISTS itr_status VARCHAR(1) DEFAULT 'P';

COMMENT ON COLUMN cmp_it_requisicao.itr_status IS
  'Status do item: P=Pendente, F=Finalizado, C=Cancelado';

-- 2. Adicionar campo itr_inf (Informações adicionais)
\echo 'Adicionando campo itr_inf...'
ALTER TABLE cmp_it_requisicao
  ADD COLUMN IF NOT EXISTS itr_inf TEXT;

COMMENT ON COLUMN cmp_it_requisicao.itr_inf IS
  'Campo informativo adicional para observações do item';

\echo ''
\echo 'Criando índice para performance em consultas por status...'
CREATE INDEX IF NOT EXISTS idx_item_req_status
  ON cmp_it_requisicao(itr_status);

\echo ''
\echo '========================================='
\echo 'VERIFICAÇÃO DOS CAMPOS'
\echo '========================================='
\echo ''

-- Verificar estrutura da tabela
SELECT
  column_name as "Campo",
  data_type as "Tipo",
  character_maximum_length as "Tamanho",
  column_default as "Padrão",
  is_nullable as "Nulo?"
FROM information_schema.columns
WHERE table_schema = 'db_manaus'
  AND table_name = 'cmp_it_requisicao'
  AND column_name IN ('itr_status', 'itr_inf', 'itr_quantidade_sugerida', 'itr_data_sugestao')
ORDER BY ordinal_position;

\echo ''
\echo '========================================='
\echo 'CAMPOS ADICIONADOS COM SUCESSO!'
\echo '========================================='
\echo ''

COMMIT;
