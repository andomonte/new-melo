-- 082 — Taxa de conversão das contas a pagar internacionais com 6 casas decimais
-- (23/11/2026). A tela passou a completar a taxa com 6 casas; a coluna era numeric(10,4)
-- e arredondava para 4. numeric(16,6) mantém a mesma parte inteira (até 10 dígitos).
-- Só aumenta a precisão: os valores existentes não mudam. Nenhuma view depende da coluna.

BEGIN;

ALTER TABLE db_manaus.dbpgto    ALTER COLUMN taxa_conversao TYPE numeric(16,6);
ALTER TABLE db_manaus.dbfpgto   ALTER COLUMN taxa_conversao TYPE numeric(16,6);
ALTER TABLE db_roraima.dbpgto   ALTER COLUMN taxa_conversao TYPE numeric(16,6);
ALTER TABLE db_roraima.dbfpgto  ALTER COLUMN taxa_conversao TYPE numeric(16,6);
ALTER TABLE db_rondonia.dbpgto  ALTER COLUMN taxa_conversao TYPE numeric(16,6);
ALTER TABLE db_rondonia.dbfpgto ALTER COLUMN taxa_conversao TYPE numeric(16,6);

COMMIT;
