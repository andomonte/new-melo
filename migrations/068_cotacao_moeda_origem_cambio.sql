-- 068_cotacao_moeda_origem_cambio.sql
-- Fase 1/2 da taxa de câmbio por contrato de importação:
--
--  cotacao_moeda : cache da cotação (moeda -> BRL) por moeda + data, para qualquer
--                  moeda (USD, EUR, CNY...). Usada quando o contrato não foi achado
--                  no Contas a Pagar e precisamos buscar a taxa daquele dia no PTAX.
--
--  dbent_importacao_contratos.origem_cambio : de onde veio a Taxa Câmbio (moeda->BRL):
--                  CAP (Contas a Pagar) | PTAX | XML | MANUAL  (par com origem_taxa do dólar)
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
      CREATE TABLE IF NOT EXISTS %I.cotacao_moeda (
        moeda       varchar(5)  NOT NULL,
        data        date        NOT NULL,
        taxa        numeric     NOT NULL,          -- moeda -> BRL (venda)
        taxa_compra numeric,
        fonte       varchar(20) DEFAULT 'PTAX',
        created_at  timestamp   DEFAULT NOW(),
        PRIMARY KEY (moeda, data)
      );
    $f$, s);

    EXECUTE format($f$
      ALTER TABLE %I.dbent_importacao_contratos
        ADD COLUMN IF NOT EXISTS origem_cambio varchar(10);  -- CAP | PTAX | XML | MANUAL
    $f$, s);
  END LOOP;
END
$mig$;
