-- 064_tb_filial_cidade_uf.sql
-- Adiciona Cidade e UF ao cadastro de filiais (tb_filial).
-- tb_filial é a tabela central (db_manaus); roda onde ela existir. Aditivo e idempotente.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'tb_filial' AND table_schema LIKE 'db\_%'
      AND table_type = 'BASE TABLE'   -- tb_filial é VIEW nas filiais; tabela real só no central
    ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;
    EXECUTE format($f$
      ALTER TABLE %I.tb_filial
        ADD COLUMN IF NOT EXISTS cidade varchar,
        ADD COLUMN IF NOT EXISTS uf     varchar(2);
    $f$, s);
  END LOOP;
END
$mig$;
