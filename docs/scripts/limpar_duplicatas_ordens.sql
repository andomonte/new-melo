-- Limpeza de duplicatas criadas pela migração
-- Remove linhas de 2002 que receberam IDs do formato 2025 incorretamente

SET search_path TO db_manaus;

BEGIN;

\echo ''
\echo '========================================='
\echo 'LIMPEZA DE DUPLICATAS - PREVIEW'
\echo '========================================='
\echo ''

-- Preview das linhas que serão deletadas
SELECT
  orc_id as "ID (formato 2025)",
  orc_req_id as "Requisição",
  TO_CHAR(orc_data, 'DD/MM/YYYY') as "Data (2002)",
  orc_status as "Status",
  orc_valor_total as "Valor",
  TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') as "Criado em"
FROM cmp_ordem_compra
WHERE LENGTH(orc_id::TEXT) = 11
  AND orc_data < '2025-01-01'
ORDER BY orc_id, orc_data;

\echo ''
\echo 'Total de linhas que serão deletadas:'
SELECT COUNT(*) as "Total"
FROM cmp_ordem_compra
WHERE LENGTH(orc_id::TEXT) = 11
  AND orc_data < '2025-01-01';

\echo ''
\echo '========================================='
\echo 'EXECUTANDO LIMPEZA...'
\echo '========================================='
\echo ''

-- Deletar linhas incorretas
DELETE FROM cmp_ordem_compra
WHERE LENGTH(orc_id::TEXT) = 11
  AND orc_data < '2025-01-01';

\echo ''
\echo 'Linhas deletadas:'
\echo ''

-- Verificar resultado
\echo ''
\echo '========================================='
\echo 'VERIFICAÇÃO FINAL'
\echo '========================================='
\echo ''

-- Confirmar que não há mais duplicatas de IDs 2025
SELECT
  orc_id,
  COUNT(*) as qtd_linhas,
  STRING_AGG(DISTINCT TO_CHAR(orc_data, 'YYYY-MM-DD'), ', ') as datas
FROM cmp_ordem_compra
WHERE LENGTH(orc_id::TEXT) = 11
GROUP BY orc_id
HAVING COUNT(*) > 1;

\echo ''
\echo 'Total de ordens 2025 (deve ser 34):'
SELECT COUNT(*) as "Total 2025"
FROM cmp_ordem_compra
WHERE orc_data >= '2025-01-01';

\echo ''
\echo 'Total de ordens antigas preservadas:'
SELECT COUNT(*) as "Total antigas"
FROM cmp_ordem_compra
WHERE orc_data < '2025-01-01';

\echo ''
\echo 'Amostra das ordens 2025 (sem duplicatas):'
SELECT
  orc_id,
  TO_CHAR(orc_data, 'DD/MM/YYYY') as data,
  orc_status,
  orc_req_id
FROM cmp_ordem_compra
WHERE orc_data >= '2025-01-01'
ORDER BY orc_data, orc_id
LIMIT 10;

\echo ''
\echo '========================================='
\echo 'LIMPEZA CONCLUÍDA!'
\echo '========================================='
\echo ''

COMMIT;
