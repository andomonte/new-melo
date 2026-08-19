-- 031_fix_car_vlrliq_e_dbopera_dup.sql
-- (1) FIN_CARTAO.car_valor/car_vlrliq estavam como numeric(38,0) (inteiros) — o líquido perdia
--     os centavos (ex.: 294,54 virava 295). Passa para numeric(15,2).
-- (2) db_manaus.dbopera tinha linhas DUPLICADAS por codopera (2-4x, todas idênticas) e sem
--     unicidade. Deduplica mantendo 1 por codopera e cria UNIQUE(codopera).
-- Idempotente o suficiente para rodar de novo sem erro fatal.

-- (1) Precisão monetária do cartão
ALTER TABLE db_manaus.fin_cartao ALTER COLUMN car_valor  TYPE numeric(15,2);
ALTER TABLE db_manaus.fin_cartao ALTER COLUMN car_vlrliq TYPE numeric(15,2);

-- (2) Dedupe dbopera (mantém a linha de menor ctid por codopera; duplicatas são idênticas)
DELETE FROM db_manaus.dbopera a
USING db_manaus.dbopera b
WHERE a.ctid > b.ctid
  AND a.codopera = b.codopera;

-- Unicidade para impedir novas duplicatas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'db_manaus.dbopera'::regclass AND conname = 'uq_dbopera_codopera'
  ) THEN
    ALTER TABLE db_manaus.dbopera ADD CONSTRAINT uq_dbopera_codopera UNIQUE (codopera);
  END IF;
END $$;
