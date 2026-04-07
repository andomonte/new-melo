-- Migração de IDs de Ordens de Compra - APENAS 2025 (Versão Corrigida)

SET search_path TO db_manaus;

BEGIN;

\echo ''
\echo '========================================='
\echo 'MIGRAÇÃO DE ORDENS 2025 - INICIANDO'
\echo '========================================='
\echo ''

-- 1. Criar tabela temporária para mapear IDs
CREATE TEMP TABLE temp_mapeamento_2025 (
  orc_id_antigo BIGINT PRIMARY KEY,
  orc_id_novo BIGINT UNIQUE,
  orc_req_id BIGINT,
  orc_req_versao INT,
  orc_data DATE,
  orc_unm_id_entrega BIGINT,
  filial_numero INT,
  filial_nome TEXT,
  ano INT,
  mes INT,
  sequencial INT
);

-- 2. Popular com dados das ordens de 2025
INSERT INTO temp_mapeamento_2025 (
  orc_id_antigo,
  orc_req_id,
  orc_req_versao,
  orc_data,
  orc_unm_id_entrega,
  filial_numero,
  filial_nome,
  ano,
  mes
)
SELECT
  oc.orc_id,
  oc.orc_req_id,
  oc.orc_req_versao,
  oc.orc_data,
  oc.orc_unm_id_entrega,
  CAST(
    SUBSTRING(
      REGEXP_REPLACE(COALESCE(u.unm_cnpj, '04618302000189'), '[^0-9]', '', 'g'),
      9, 4
    ) AS INTEGER
  ) as filial_numero,
  COALESCE(u.unm_nome, 'Sem filial') as filial_nome,
  EXTRACT(YEAR FROM oc.orc_data)::INT as ano,
  EXTRACT(MONTH FROM oc.orc_data)::INT as mes
FROM cmp_ordem_compra oc
LEFT JOIN cad_unidade_melo u ON u.unm_id = oc.orc_unm_id_entrega
WHERE oc.orc_data >= '2025-01-01'
ORDER BY oc.orc_data, oc.orc_id;

-- 3. Calcular sequencial
WITH sequenciais AS (
  SELECT
    orc_id_antigo,
    ROW_NUMBER() OVER (
      PARTITION BY filial_numero, ano, mes
      ORDER BY orc_data, orc_id_antigo
    ) as seq
  FROM temp_mapeamento_2025
)
UPDATE temp_mapeamento_2025 t
SET sequencial = s.seq
FROM sequenciais s
WHERE t.orc_id_antigo = s.orc_id_antigo;

-- 4. Gerar novo ID
UPDATE temp_mapeamento_2025
SET orc_id_novo = CAST(
  LPAD(filial_numero::TEXT, 1, '0') ||
  LPAD(ano::TEXT, 4, '0') ||
  LPAD(mes::TEXT, 2, '0') ||
  LPAD(sequencial::TEXT, 4, '0')
  AS BIGINT
);

-- 5. Validar colisões
DO $$
DECLARE
  total_ordens INT;
  ids_distintos INT;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT orc_id_novo)
  INTO total_ordens, ids_distintos
  FROM temp_mapeamento_2025;

  IF total_ordens != ids_distintos THEN
    RAISE EXCEPTION 'ERRO: Colisão de IDs! % ordens mas % IDs distintos', total_ordens, ids_distintos;
  END IF;
END $$;

-- 6. Validar conflitos com existentes
DO $$
DECLARE
  conflitos INT;
BEGIN
  SELECT COUNT(*) INTO conflitos
  FROM temp_mapeamento_2025 t
  WHERE EXISTS (
    SELECT 1 FROM cmp_ordem_compra oc
    WHERE oc.orc_id = t.orc_id_novo
    AND oc.orc_id != t.orc_id_antigo
  );

  IF conflitos > 0 THEN
    RAISE EXCEPTION 'ERRO: % IDs novos já existem!', conflitos;
  END IF;
END $$;

-- 7. Preview
\echo ''
\echo 'PREVIEW:'
SELECT
  orc_id_antigo as "Antigo",
  orc_id_novo as "Novo",
  TO_CHAR(orc_data, 'DD/MM/YYYY') as "Data",
  filial_nome as "Filial"
FROM temp_mapeamento_2025
ORDER BY orc_data, orc_id_antigo;

-- 8. EXECUTAR MIGRAÇÃO
\echo ''
\echo 'Executando migração...'

-- Criar sequência temporária
CREATE TEMP SEQUENCE temp_migration_seq START WITH 90000000000;

-- Mover para range temporário
UPDATE cmp_ordem_compra
SET orc_id = nextval('temp_migration_seq')
WHERE orc_id IN (SELECT orc_id_antigo FROM temp_mapeamento_2025);

-- Aplicar IDs novos
UPDATE cmp_ordem_compra oc
SET orc_id = t.orc_id_novo
FROM temp_mapeamento_2025 t
WHERE oc.orc_req_id = t.orc_req_id
  AND oc.orc_req_versao = t.orc_req_versao;

-- 9. Verificar resultado
\echo ''
\echo 'RESULTADO FINAL:'
SELECT
  COUNT(*) as "Migradas",
  MIN(orc_id) as "Min ID",
  MAX(orc_id) as "Max ID"
FROM cmp_ordem_compra
WHERE orc_id IN (SELECT orc_id_novo FROM temp_mapeamento_2025);

\echo ''
\echo 'Amostra:'
SELECT
  oc.orc_id as "ID",
  TO_CHAR(oc.orc_data, 'DD/MM/YYYY') as "Data",
  u.unm_nome as "Filial"
FROM cmp_ordem_compra oc
LEFT JOIN cad_unidade_melo u ON u.unm_id = oc.orc_unm_id_entrega
WHERE oc.orc_id IN (SELECT orc_id_novo FROM temp_mapeamento_2025)
ORDER BY oc.orc_data, oc.orc_id
LIMIT 10;

\echo ''
\echo 'MIGRAÇÃO CONCLUÍDA!'
\echo ''

COMMIT;
