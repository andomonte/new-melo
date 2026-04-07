-- ================================================================================
-- EXEMPLOS DE CONSULTAS - TABELAS DE IMPOSTOS
-- ================================================================================

-- ================================================================================
-- 1. BUSCAR MVA POR NCM ESPECÍFICO
-- ================================================================================
SELECT
  l."LEI_PROTOCOLO",
  l."LEI_TIPO",
  l."LEI_STATUS",
  l."LEI_MVA_AJUSTADA" AS formula_mva,
  ln."LIN_NCM",
  ln."LIN_MVA_ST_ORIGINAL" AS mva_percentual,
  ln."LIN_CEST"
FROM cad_legislacao_icmsst_ncm ln
INNER JOIN cad_legislacao_icmsst l
  ON l."LEI_ID" = ln."LIN_LEI_ID"
WHERE ln."LIN_NCM" = '84213920'
  AND ln."LIN_STATUS" = 'REGRA'
  AND l."LEI_STATUS" = 'EM VIGOR';

-- ================================================================================
-- 2. LISTAR TODOS OS NCMs DE UM PROTOCOLO ESPECÍFICO (ex: Protocolo 41)
-- ================================================================================
SELECT
  ln."LIN_NCM",
  ln."LIN_MVA_ST_ORIGINAL",
  ln."LIN_CEST",
  c.descricao AS cest_descricao,
  c.segmento
FROM cad_legislacao_icmsst l
INNER JOIN cad_legislacao_icmsst_ncm ln
  ON ln."LIN_LEI_ID" = l."LEI_ID"
LEFT JOIN dbcest c
  ON c.cest = ln."LIN_CEST"
WHERE l."LEI_PROTOCOLO" = 41
  AND l."LEI_STATUS" = 'EM VIGOR'
  AND ln."LIN_STATUS" = 'REGRA'
ORDER BY ln."LIN_NCM";

-- ================================================================================
-- 3. BUSCAR NCMs POR PREFIXO (ex: todos que começam com 8421)
-- ================================================================================
SELECT
  ln."LIN_NCM",
  l."LEI_PROTOCOLO",
  ln."LIN_MVA_ST_ORIGINAL",
  ln."LIN_CEST",
  c.descricao AS produto_descricao
FROM cad_legislacao_icmsst_ncm ln
INNER JOIN cad_legislacao_icmsst l
  ON l."LEI_ID" = ln."LIN_LEI_ID"
LEFT JOIN dbcest c
  ON c.ncm = ln."LIN_NCM"
WHERE ln."LIN_NCM" LIKE '8421%'
  AND ln."LIN_STATUS" = 'REGRA'
  AND l."LEI_STATUS" = 'EM VIGOR'
ORDER BY ln."LIN_NCM";

-- ================================================================================
-- 4. LISTAR TODOS OS PROTOCOLOS EM VIGOR
-- ================================================================================
SELECT
  "LEI_PROTOCOLO" AS protocolo,
  "LEI_TIPO" AS tipo,
  "LEI_DATA_VIGENCIA" AS vigencia,
  COUNT(*) OVER (PARTITION BY "LEI_ID") AS total_ncms
FROM cad_legislacao_icmsst
WHERE "LEI_STATUS" = 'EM VIGOR'
ORDER BY "LEI_PROTOCOLO";

-- ================================================================================
-- 5. BUSCAR ALÍQUOTA ESPECÍFICA POR CÓDIGO
-- ================================================================================
SELECT
  codigo,
  n_ne_co AS aliq_norte_nordeste_centro_oeste,
  s_se AS aliq_sul_sudeste,
  importado AS aliq_importado
FROM fis_tributo_aliquota
WHERE codigo = 'A001';

-- ================================================================================
-- 6. BUSCAR CEST POR NCM
-- ================================================================================
SELECT
  cest,
  ncm,
  segmento,
  descricao
FROM dbcest
WHERE ncm = '9032899';

-- ================================================================================
-- 7. LISTAR AUTOPEÇAS COM CEST
-- ================================================================================
SELECT
  cest,
  ncm,
  descricao
FROM dbcest
WHERE segmento = 'AUTOPEÇAS'
ORDER BY cest
LIMIT 20;

-- ================================================================================
-- 8. ESTATÍSTICAS GERAIS
-- ================================================================================
SELECT
  'CAD_LEGISLACAO_ICMSST' AS tabela,
  COUNT(*) AS total_registros,
  COUNT(CASE WHEN "LEI_STATUS" = 'EM VIGOR' THEN 1 END) AS em_vigor,
  COUNT(CASE WHEN "LEI_STATUS" = 'REVOGADO' THEN 1 END) AS revogados
FROM cad_legislacao_icmsst

UNION ALL

SELECT
  'CAD_LEGISLACAO_ICMSST_NCM' AS tabela,
  COUNT(*) AS total_registros,
  COUNT(CASE WHEN "LIN_STATUS" = 'REGRA' THEN 1 END) AS regras,
  COUNT(CASE WHEN "LIN_CEST" IS NOT NULL THEN 1 END) AS com_cest
FROM cad_legislacao_icmsst_ncm

UNION ALL

SELECT
  'FIS_TRIBUTO_ALIQUOTA' AS tabela,
  COUNT(*) AS total_registros,
  NULL AS campo1,
  NULL AS campo2
FROM fis_tributo_aliquota

UNION ALL

SELECT
  'DBCEST' AS tabela,
  COUNT(*) AS total_registros,
  COUNT(DISTINCT segmento) AS segmentos_unicos,
  NULL AS campo2
FROM dbcest;

-- ================================================================================
-- 9. QUERY COMPLETA PARA CÁLCULO DE ST
-- Exemplo: Produto com NCM 84213920
-- ================================================================================
WITH produto AS (
  SELECT '84213920' AS ncm
),
legislacao AS (
  SELECT
    l."LEI_PROTOCOLO",
    l."LEI_MVA_AJUSTADA",
    ln."LIN_MVA_ST_ORIGINAL",
    ln."LIN_NCM",
    ln."LIN_CEST"
  FROM cad_legislacao_icmsst_ncm ln
  INNER JOIN cad_legislacao_icmsst l
    ON l."LEI_ID" = ln."LIN_LEI_ID"
  INNER JOIN produto p
    ON p.ncm = ln."LIN_NCM"
  WHERE ln."LIN_STATUS" = 'REGRA'
    AND l."LEI_STATUS" = 'EM VIGOR'
  LIMIT 1
),
cest_info AS (
  SELECT c.*
  FROM dbcest c
  INNER JOIN legislacao l
    ON c.cest = l."LIN_CEST"
)
SELECT
  p.ncm,
  l."LEI_PROTOCOLO" AS protocolo_aplicavel,
  l."LIN_MVA_ST_ORIGINAL" AS mva_original_percent,
  l."LEI_MVA_AJUSTADA" AS formula_mva_ajustada,
  c.cest,
  c.descricao AS produto_descricao,
  c.segmento
FROM produto p
LEFT JOIN legislacao l ON true
LEFT JOIN cest_info c ON true;

-- ================================================================================
-- 10. VERIFICAR NCMS SEM MVA DEFINIDA
-- ================================================================================
-- Esta query ajuda a identificar possíveis inconsistências
SELECT DISTINCT
  ln."LIN_NCM",
  ln."LIN_STATUS",
  ln."LIN_MVA_ST_ORIGINAL"
FROM cad_legislacao_icmsst_ncm ln
WHERE ln."LIN_MVA_ST_ORIGINAL" IS NULL
  AND ln."LIN_STATUS" = 'REGRA'
LIMIT 10;
