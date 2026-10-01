-- 059_dbfatura_dev_id_bigint.sql
-- dbfatura.dev_id: integer -> bigint.
--
-- No Oracle o dev_id é NUMBER e os valores reais passam de 12 bilhões
-- (ex.: 12026080177 — parece ano+mês+sequência), bem acima do teto do integer
-- (2.147.483.647). Com a coluna como integer, qualquer fatura com devolução
-- vinda do ERP estoura com "valor fora do intervalo para o tipo integer".
--
-- Descoberto ao carregar 2 anos de dbfatura do Oracle para a base de teste.
-- Alargar é seguro: integer cabe em bigint, nenhum dado é perdido.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema
    FROM information_schema.columns
    WHERE table_name = 'dbfatura' AND column_name = 'dev_id'
      AND data_type = 'integer' AND table_schema LIKE 'db\_%'
  LOOP
    EXECUTE format('ALTER TABLE %I.dbfatura ALTER COLUMN dev_id TYPE bigint', s);
    RAISE NOTICE '% : dbfatura.dev_id agora é bigint', s;
  END LOOP;
END $$;
