-- 067_importacao_contrato_origem_taxa.sql
-- Origem da Taxa Dólar de cada contrato de câmbio, para o usuário saber de onde veio:
--   CAP    : taxa do título no Contas a Pagar (achado pelo nº do contrato)
--   XML    : taxa do dólar que veio no XML da DI (TAXA DOLAR EUA)
--   PTAX   : cotação do Banco Central na data da DI (botão buscar)
--   MANUAL : digitada pelo usuário
--
-- Aditivo e idempotente; roda em cada schema db_*.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'dbent_importacao_contratos' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;
    EXECUTE format($f$
      ALTER TABLE %I.dbent_importacao_contratos
        ADD COLUMN IF NOT EXISTS origem_taxa varchar(10);  -- CAP | XML | PTAX | MANUAL
    $f$, s);
  END LOOP;
END
$mig$;
