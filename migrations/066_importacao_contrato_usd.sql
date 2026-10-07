-- 066_importacao_contrato_usd.sql
-- Contratos de câmbio da DI: conversão para dólar + cotação do dólar por data.
--
-- Problema: o XML da DI traz contratos em moedas diferentes (USD, EUR, CNY...).
-- O motor de custo trabalha em USD, então cada contrato precisa do seu valor em dólar.
--
-- Semântica das colunas de dbent_importacao_contratos:
--   moeda          : moeda do contrato (USD, EUR, CNY...)
--   vl_merc_dolar  : valor NA MOEDA do contrato (nome histórico; nem sempre é USD)
--   taxa_dolar     : taxa da MOEDA do contrato -> BRL (p/ USD = dólar->BRL)
--   vl_reais       : vl_merc_dolar * taxa_dolar (BRL)
--   taxa_usd  (NOVO): taxa do DÓLAR -> BRL usada p/ converter este contrato em USD
--   vl_usd    (NOVO): valor do contrato convertido para dólar = vl_reais / taxa_usd
--
-- cotacao_dolar: cache da cotação do dólar por data (fonte: Contas a Pagar / PTAX / manual),
-- consultada quando o contrato não tem taxa do dólar (ex.: moeda estrangeira).
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
        ADD COLUMN IF NOT EXISTS taxa_usd numeric,   -- dólar -> BRL usado na conversão
        ADD COLUMN IF NOT EXISTS vl_usd   numeric;   -- valor do contrato em dólar
    $f$, s);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.cotacao_dolar (
        data        date PRIMARY KEY,
        taxa        numeric NOT NULL,          -- dólar -> BRL (venda)
        taxa_compra numeric,
        fonte       varchar(20) DEFAULT 'PTAX',
        created_at  timestamp DEFAULT NOW()
      );
    $f$, s);
  END LOOP;
END
$mig$;
