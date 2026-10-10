-- 072_dbfatura_importacao_id.sql
-- Liga a fatura (NF-e) à DI de importação que a originou. Usado pela emissão da
-- nota de nacionalização pela VIA NACIONAL: a nota vira uma dbfatura normal
-- (aparece na Consulta de Faturas) e o `emitir-faturado` reconhece, por este
-- campo, que deve montar o XML pelo builder de importação (gerarXmlImportacao)
-- em vez do nacional — assim a reemissão funciona pelo faturamento padrão.
--
-- Aditivo e idempotente. Roda em cada schema db_* que tenha dbfatura.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'dbfatura' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    EXECUTE format($f$
      ALTER TABLE %I.dbfatura
        ADD COLUMN IF NOT EXISTS importacao_id integer;
    $f$, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_dbfatura_importacao ON %I.dbfatura(importacao_id);$f$, s);
    RAISE NOTICE '--- dbfatura.importacao_id garantido em % ---', s;
  END LOOP;
END
$mig$;
