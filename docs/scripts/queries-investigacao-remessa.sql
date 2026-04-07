-- QUERIES PARA INVESTIGAR PROCEDURES DE REMESSA NO ORACLE

-- ==========================================
-- 1. PROCEDURES COM "REMESSA" NO NOME
-- ==========================================
SELECT 
  object_name,
  object_type,
  status,
  TO_CHAR(created, 'DD/MM/YYYY HH24:MI:SS') as criado_em,
  TO_CHAR(last_ddl_time, 'DD/MM/YYYY HH24:MI:SS') as ultima_modificacao
FROM all_objects
WHERE object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
  AND UPPER(object_name) LIKE '%REMESSA%'
  AND owner = 'GERAL'
ORDER BY object_name;

-- ==========================================
-- 2. PROCEDURES COM "REMESSA" NO CÓDIGO
-- ==========================================
SELECT DISTINCT
  name,
  type,
  COUNT(*) as ocorrencias
FROM all_source
WHERE UPPER(text) LIKE '%REMESSA%'
  AND owner = 'GERAL'
  AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
GROUP BY name, type
ORDER BY name;

-- ==========================================
-- 3. PROCEDURES COM "CNAB" NO CÓDIGO
-- ==========================================
SELECT DISTINCT
  name,
  type,
  COUNT(*) as ocorrencias
FROM all_source
WHERE (UPPER(text) LIKE '%CNAB%' OR UPPER(text) LIKE '%BOLETO%')
  AND owner = 'GERAL'
  AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
GROUP BY name, type
ORDER BY name;

-- ==========================================
-- 4. TABELAS COM "REMESSA" NO NOME
-- ==========================================
SELECT 
  table_name,
  num_rows,
  TO_CHAR(last_analyzed, 'DD/MM/YYYY') as ultima_analise
FROM all_tables
WHERE UPPER(table_name) LIKE '%REMESSA%'
  AND owner = 'GERAL'
ORDER BY table_name;

-- ==========================================
-- 5. BUSCAR LINHAS ESPECÍFICAS COM REMESSA
-- ==========================================
SELECT 
  name,
  type,
  line,
  TRIM(text) as codigo
FROM all_source
WHERE UPPER(text) LIKE '%REMESSA%'
  AND owner = 'GERAL'
  AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE BODY')
ORDER BY name, line;

-- ==========================================
-- 6. PACKAGES QUE PODEM CONTER REMESSA
-- ==========================================
SELECT 
  object_name,
  object_type,
  status
FROM all_objects
WHERE object_type = 'PACKAGE'
  AND owner = 'GERAL'
  AND object_name IN (
    SELECT DISTINCT name 
    FROM all_source 
    WHERE UPPER(text) LIKE '%REMESSA%' 
    AND owner = 'GERAL'
  )
ORDER BY object_name;

-- ==========================================
-- 7. BUSCAR PROCEDURES DE BOLETO/TÍTULO
-- ==========================================
SELECT DISTINCT
  name,
  type
FROM all_source
WHERE (
    UPPER(text) LIKE '%TITULO%' OR 
    UPPER(text) LIKE '%BOLETO%' OR
    UPPER(text) LIKE '%COBRANCA%'
  )
  AND owner = 'GERAL'
  AND type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE')
GROUP BY name, type
ORDER BY name;

-- ==========================================
-- 8. VERIFICAR TABELAS DE BOLETO/COBRANÇA
-- ==========================================
SELECT 
  table_name,
  num_rows
FROM all_tables
WHERE (
    UPPER(table_name) LIKE '%BOLETO%' OR
    UPPER(table_name) LIKE '%TITULO%' OR
    UPPER(table_name) LIKE '%COBRANCA%' OR
    UPPER(table_name) LIKE '%BANCO%'
  )
  AND owner = 'GERAL'
ORDER BY table_name;
