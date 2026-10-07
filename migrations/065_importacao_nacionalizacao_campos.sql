-- 065_importacao_nacionalizacao_campos.sql
-- Campos adicionais do cabeçalho da DI usados na tela Dados Gerais (Importação)
-- e na emissão da NF-e de nacionalização:
--   outros_valores : vOutro livre digitado pelo usuário (compõe a nota)
--   peso_bruto     : cargaPesoBruto do XML da DI (kg)
--   especie        : espécie de volume (nomeEmbalagem do XML da DI)
--
-- Os demais campos do grupo DI (local_desembaraco, uf_desembaraco, data_desembaraco,
-- via_transporte, forma_importacao, valor_afrmm) e peso_liquido JÁ EXISTEM
-- (migration 063 + coluna original). Aditivo e idempotente; roda em cada schema db_*.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'dbent_importacao' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;
    EXECUTE format($f$
      ALTER TABLE %I.dbent_importacao
        ADD COLUMN IF NOT EXISTS outros_valores numeric DEFAULT 0,  -- vOutro livre
        ADD COLUMN IF NOT EXISTS peso_bruto     numeric,            -- cargaPesoBruto (kg)
        ADD COLUMN IF NOT EXISTS especie        varchar;            -- espécie de volume
    $f$, s);
  END LOOP;
END
$mig$;
