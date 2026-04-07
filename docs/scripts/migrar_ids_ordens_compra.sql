-- Script de Migração de IDs de Ordens de Compra
-- Converte IDs antigos (sequencial simples) para novo padrão
-- Formato: [Filial 1 dig][Ano 4 dig][Mês 2 dig][Sequencial 4 dig]
-- Total: 11 dígitos

-- IMPORTANTE: Execute este script em horário de baixo movimento
-- Este script irá renumerar TODAS as ordens existentes

BEGIN;

-- 1. Criar tabela temporária para mapear IDs antigos → novos
CREATE TEMP TABLE temp_mapeamento_ordens (
  orc_id_antigo BIGINT,
  orc_id_novo BIGINT,
  orc_req_id BIGINT,
  orc_req_versao INT,
  orc_data DATE,
  orc_unm_id_entrega BIGINT,
  filial_numero INT,
  ano INT,
  mes INT,
  sequencial INT
);

-- 2. Popular tabela temporária com dados das ordens existentes
-- Buscar CNPJ da filial e extrair número
INSERT INTO temp_mapeamento_ordens (
  orc_id_antigo,
  orc_req_id,
  orc_req_versao,
  orc_data,
  orc_unm_id_entrega,
  filial_numero,
  ano,
  mes
)
SELECT
  oc.orc_id,
  oc.orc_req_id,
  oc.orc_req_versao,
  oc.orc_data,
  oc.orc_unm_id_entrega,
  -- Extrair número da filial do CNPJ (posições 8-11, converter para int)
  CAST(
    SUBSTRING(
      REGEXP_REPLACE(COALESCE(u.unm_cnpj, '04618302000189'), '[^0-9]', '', 'g'),
      9, 4
    ) AS INTEGER
  ) as filial_numero,
  EXTRACT(YEAR FROM oc.orc_data)::INT as ano,
  EXTRACT(MONTH FROM oc.orc_data)::INT as mes
FROM db_manaus.cmp_ordem_compra oc
LEFT JOIN db_manaus.cad_unidade_melo u ON u.unm_id = oc.orc_unm_id_entrega
ORDER BY oc.orc_data, oc.orc_id;

-- 3. Calcular sequencial para cada ordem dentro do seu mês/filial
-- Usa ROW_NUMBER() particionado por filial, ano e mês
WITH sequenciais AS (
  SELECT
    orc_id_antigo,
    ROW_NUMBER() OVER (
      PARTITION BY filial_numero, ano, mes
      ORDER BY orc_data, orc_id_antigo
    ) as seq
  FROM temp_mapeamento_ordens
)
UPDATE temp_mapeamento_ordens t
SET sequencial = s.seq
FROM sequenciais s
WHERE t.orc_id_antigo = s.orc_id_antigo;

-- 4. Gerar novo ID no formato: [filial][ano][mês][sequencial]
UPDATE temp_mapeamento_ordens
SET orc_id_novo = CAST(
  LPAD(filial_numero::TEXT, 1, '0') ||
  LPAD(ano::TEXT, 4, '0') ||
  LPAD(mes::TEXT, 2, '0') ||
  LPAD(sequencial::TEXT, 4, '0')
  AS BIGINT
);

-- 5. Verificar se há colisões (não deveria ter)
DO $$
DECLARE
  colisoes INT;
BEGIN
  SELECT COUNT(*) INTO colisoes
  FROM temp_mapeamento_ordens
  GROUP BY orc_id_novo
  HAVING COUNT(*) > 1;

  IF colisoes > 0 THEN
    RAISE EXCEPTION 'ERRO: Foram detectadas colisões de IDs! Abortando migração.';
  END IF;
END $$;

-- 6. Verificar se algum ID novo já existe no banco (não deveria)
DO $$
DECLARE
  conflitos INT;
BEGIN
  SELECT COUNT(*) INTO conflitos
  FROM temp_mapeamento_ordens t
  WHERE EXISTS (
    SELECT 1 FROM db_manaus.cmp_ordem_compra oc
    WHERE oc.orc_id = t.orc_id_novo
    AND oc.orc_id != t.orc_id_antigo
  );

  IF conflitos > 0 THEN
    RAISE EXCEPTION 'ERRO: Alguns IDs novos já existem no banco! Abortando migração.';
  END IF;
END $$;

-- 7. Mostrar preview da migração (primeiras 20 linhas)
\echo ''
\echo '=== PREVIEW DA MIGRAÇÃO (primeiras 20 ordens) ==='
\echo ''
SELECT
  orc_id_antigo as "ID Antigo",
  orc_id_novo as "ID Novo",
  TO_CHAR(orc_data, 'DD/MM/YYYY') as "Data",
  orc_unm_id_entrega as "Filial",
  filial_numero || '/' || ano || '/' || LPAD(mes::TEXT, 2, '0') || ' seq:' || sequencial as "Detalhes"
FROM temp_mapeamento_ordens
ORDER BY orc_data, orc_id_antigo
LIMIT 20;

\echo ''
\echo '=== ESTATÍSTICAS DA MIGRAÇÃO ==='
SELECT
  COUNT(*) as total_ordens,
  COUNT(DISTINCT filial_numero) as total_filiais,
  COUNT(DISTINCT ano || '-' || mes) as total_meses,
  MIN(orc_id_antigo) as min_id_antigo,
  MAX(orc_id_antigo) as max_id_antigo,
  MIN(orc_id_novo) as min_id_novo,
  MAX(orc_id_novo) as max_id_novo
FROM temp_mapeamento_ordens;

-- 8. PERGUNTA DE CONFIRMAÇÃO
\prompt 'Deseja prosseguir com a migração? (SIM/NAO): ' confirmar

-- 9. Executar migração se confirmado
-- NOTA: Como psql não permite IF com variável de prompt diretamente,
-- este script deve ser executado manualmente em duas etapas:
--
-- ETAPA 1: Execute até aqui para ver o preview
-- ETAPA 2: Se estiver OK, execute a parte abaixo

-- ========== DESCOMENTAR PARA EXECUTAR A MIGRAÇÃO ==========

/*

-- 10. Desabilitar constraints temporariamente
ALTER TABLE db_manaus.cmp_ordem_compra DISABLE TRIGGER ALL;

-- 11. Criar nova sequência temporária para evitar conflitos
CREATE TEMP SEQUENCE temp_id_seq START WITH 99999999999;

-- 12. Mover IDs antigos para range temporário (evita colisões)
UPDATE db_manaus.cmp_ordem_compra
SET orc_id = nextval('temp_id_seq')
WHERE orc_id IN (SELECT orc_id_antigo FROM temp_mapeamento_ordens);

-- 13. Atualizar para IDs novos
UPDATE db_manaus.cmp_ordem_compra oc
SET orc_id = t.orc_id_novo
FROM temp_mapeamento_ordens t
WHERE oc.orc_req_id = t.orc_req_id
  AND oc.orc_req_versao = t.orc_req_versao;

-- 14. Re-habilitar constraints
ALTER TABLE db_manaus.cmp_ordem_compra ENABLE TRIGGER ALL;

-- 15. Verificar resultado
SELECT
  COUNT(*) as total_migradas,
  MIN(orc_id) as menor_id,
  MAX(orc_id) as maior_id
FROM db_manaus.cmp_ordem_compra
WHERE orc_id IN (SELECT orc_id_novo FROM temp_mapeamento_ordens);

\echo ''
\echo '=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ==='
\echo ''

*/

-- Se chegou até aqui sem erros, pode fazer COMMIT
-- COMMIT;

-- Ou ROLLBACK se preferir revisar:
ROLLBACK;
