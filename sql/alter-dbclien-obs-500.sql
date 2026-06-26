-- Padroniza o limite da coluna obs (Observações) do cliente em 500 caracteres
-- em todas as filiais. Manaus (db_manaus) já era VARCHAR(500); as demais eram 100.
-- Operação segura: apenas aumenta o limite (não há perda de dados).
-- Aplicado em produção em 2026-06.

ALTER TABLE db_boavista.dbclien ALTER COLUMN obs TYPE VARCHAR(500);
ALTER TABLE db_rondonia.dbclien ALTER COLUMN obs TYPE VARCHAR(500);
ALTER TABLE db_roraima.dbclien  ALTER COLUMN obs TYPE VARCHAR(500);
ALTER TABLE public.dbclien      ALTER COLUMN obs TYPE VARCHAR(500);
-- db_manaus já estava em VARCHAR(500).
