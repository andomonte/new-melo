-- =====================================================================
-- MIGRATION: Criar SEQUENCE para geração de CODPROD
-- Data: 2026-01-10
-- Objetivo: Resolver race condition na geração de código de produto
-- =====================================================================

-- 1. Buscar o maior código numérico atual para iniciar a sequence
DO $$
DECLARE
  v_max_codprod INTEGER;
  v_schema TEXT;
BEGIN
  -- Para cada schema (MANAUS, RORAIMA, RONDONIA)
  FOR v_schema IN SELECT unnest(ARRAY['db_manaus', 'db_roraima', 'db_rondonia'])
  LOOP
    -- Buscar o maior código numérico
    EXECUTE format('
      SELECT COALESCE(MAX(CAST(codprod AS INTEGER)), 0)
      FROM %I.dbprod
      WHERE codprod ~ ''^[0-9]+$''
    ', v_schema) INTO v_max_codprod;

    RAISE NOTICE 'Schema: % - Maior CODPROD numérico: %', v_schema, v_max_codprod;

    -- Criar a SEQUENCE começando do próximo número
    EXECUTE format('
      CREATE SEQUENCE IF NOT EXISTS %I.seq_dbprod_codprod
      START WITH %s
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1
    ', v_schema, v_max_codprod + 1);

    RAISE NOTICE 'SEQUENCE criada: %I.seq_dbprod_codprod (start: %)', v_schema, v_max_codprod + 1;
  END LOOP;
END $$;

-- 2. Verificar se as sequences foram criadas corretamente
SELECT
  schemaname,
  sequencename,
  last_value
FROM pg_sequences
WHERE sequencename = 'seq_dbprod_codprod'
ORDER BY schemaname;

-- =====================================================================
-- NOTAS:
-- =====================================================================
-- 1. Esta sequence garante que não haverá códigos duplicados mesmo
--    com cadastros simultâneos
--
-- 2. O START WITH é baseado no maior código numérico existente + 1
--
-- 3. Para obter o próximo código:
--    SELECT LPAD(nextval('seq_dbprod_codprod')::TEXT, 6, '0')
--
-- 4. Se precisar resetar a sequence:
--    ALTER SEQUENCE seq_dbprod_codprod RESTART WITH {numero}
--
-- 5. Para ver o valor atual sem incrementar:
--    SELECT last_value FROM seq_dbprod_codprod
-- =====================================================================
