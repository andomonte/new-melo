-- =====================================================================
-- ROLLBACK: Remover SEQUENCE seq_dbprod_codprod
-- Data: 2026-01-10
-- Objetivo: Reverter migration 001 se necessário
-- =====================================================================

-- ATENÇÃO: Execute este script APENAS se quiser desfazer a migration!

DO $$
DECLARE
  v_schema TEXT;
BEGIN
  -- Para cada schema (MANAUS, RORAIMA, RONDONIA)
  FOR v_schema IN SELECT unnest(ARRAY['db_manaus', 'db_roraima', 'db_rondonia'])
  LOOP
    -- Remover a SEQUENCE
    EXECUTE format('DROP SEQUENCE IF EXISTS %I.seq_dbprod_codprod', v_schema);

    RAISE NOTICE 'SEQUENCE removida: %I.seq_dbprod_codprod', v_schema;
  END LOOP;
END $$;

-- Verificar se foram removidas
SELECT
  schemaname,
  sequencename
FROM pg_sequences
WHERE sequencename = 'seq_dbprod_codprod';

-- =====================================================================
-- NOTAS:
-- =====================================================================
-- Após executar o rollback, será necessário reverter também o código
-- em src/pages/api/produtos/add.ts para a versão anterior
-- =====================================================================
