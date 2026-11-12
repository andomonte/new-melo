-- 080: cmp_produto sem linhas duplicadas
--
-- cmp_produto (minúscula) é a CMP_PRODUTO (foto do Oracle) carregada duas vezes:
-- toda linha aparece em dobro com outro id (ex.: 007453/MAO nos ids 8678 e
-- 997052), e a carga original já trazia ~149 mil linhas repetidas. Os JOINs por
-- CODPROD multiplicavam resultados (contagem errada na busca de produto da
-- promoção). Remove as cópias idênticas (todas as colunas iguais, exceto id),
-- mantendo o menor id. As removidas ficam em cmp_produto_bkp_080.
--
-- Rodar em todos os schemas db_* que tenham cmp_produto. Idempotente.

DO $$
DECLARE
  s text;
  n bigint;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'cmp_produto' AND table_schema LIKE 'db\_%'
     ORDER BY 1
  LOOP
    EXECUTE format(
      'CREATE TEMP TABLE _dup ON COMMIT DROP AS
         SELECT id FROM (
           SELECT id, row_number() OVER (PARTITION BY (to_jsonb(c) - ''id'') ORDER BY id) rn
             FROM %I.cmp_produto c) d
          WHERE rn > 1', s);

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.cmp_produto_bkp_080 AS
         SELECT c.*, now() AS bkp_em FROM %I.cmp_produto c WHERE false', s, s);
    EXECUTE format(
      'INSERT INTO %1$I.cmp_produto_bkp_080
         SELECT c.*, now() FROM %1$I.cmp_produto c JOIN _dup USING (id)', s);

    EXECUTE format('DELETE FROM %I.cmp_produto c USING _dup WHERE c.id = _dup.id', s);
    GET DIAGNOSTICS n = ROW_COUNT;
    DROP TABLE _dup;

    RAISE NOTICE '%: % linha(s) duplicada(s) removida(s)', s, n;
  END LOOP;
END $$;
