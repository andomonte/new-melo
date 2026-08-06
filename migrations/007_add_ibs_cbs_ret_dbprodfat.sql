-- Migração 007: adicionar em db_manaus.dbprodfat as colunas fiscais que hoje
-- existem em dbitvenda mas faltam em dbprodfat, para que o snapshot de itens da
-- fatura possa guardar um resultado recalculado completo (IBS/CBS + alíquotas por
-- item + ST retido).
--
-- Tipos/precisão espelham dbitvenda. Todas NULLABLE e SEM default numérico
-- (o valor deve ser sempre o efetivamente calculado; ausência = não calculado).
--
-- ESCOPO: apenas o schema. NÃO altera o código de gravação (salvar.ts continua
-- copiando só as 48 colunas atuais até o passo de wiring).
--
-- Colunas (todas em dbitvenda):
--   aliquota_icms        numeric(5,2)
--   aliquota_ipi         numeric(5,2)
--   aliquota_ibs         numeric(5,2)
--   aliquota_cbs         numeric(5,2)
--   ibs_e                numeric(5,2)
--   ibs_m                numeric(5,2)
--   valor_ibs            numeric(11,2)
--   valor_cbs            numeric(11,2)
--   basesubst_trib_ret   numeric(15,2)
--   totalsubst_trib_ret  numeric(15,2)

ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS aliquota_icms       numeric(5,2);
ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS aliquota_ipi        numeric(5,2);
ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS aliquota_ibs        numeric(5,2);
ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS aliquota_cbs        numeric(5,2);
ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS ibs_e               numeric(5,2);
ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS ibs_m               numeric(5,2);
ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS valor_ibs           numeric(11,2);
ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS valor_cbs           numeric(11,2);
ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS basesubst_trib_ret  numeric(15,2);
ALTER TABLE db_manaus.dbprodfat ADD COLUMN IF NOT EXISTS totalsubst_trib_ret numeric(15,2);

COMMENT ON COLUMN db_manaus.dbprodfat.aliquota_icms       IS 'Alíquota ICMS (%) do item — espelho de dbitvenda.aliquota_icms';
COMMENT ON COLUMN db_manaus.dbprodfat.aliquota_ipi        IS 'Alíquota IPI (%) do item — espelho de dbitvenda.aliquota_ipi';
COMMENT ON COLUMN db_manaus.dbprodfat.aliquota_ibs        IS 'Alíquota IBS total (%) — Reforma Tributária — espelho de dbitvenda';
COMMENT ON COLUMN db_manaus.dbprodfat.aliquota_cbs        IS 'Alíquota CBS (%) — Reforma Tributária — espelho de dbitvenda';
COMMENT ON COLUMN db_manaus.dbprodfat.ibs_e               IS 'Alíquota IBS Estadual (%) — substitui ICMS';
COMMENT ON COLUMN db_manaus.dbprodfat.ibs_m               IS 'Alíquota IBS Municipal (%) — substitui ISS';
COMMENT ON COLUMN db_manaus.dbprodfat.valor_ibs           IS 'Valor IBS (R$) do item — espelho de dbitvenda.valor_ibs';
COMMENT ON COLUMN db_manaus.dbprodfat.valor_cbs           IS 'Valor CBS (R$) do item — espelho de dbitvenda.valor_cbs';
COMMENT ON COLUMN db_manaus.dbprodfat.basesubst_trib_ret  IS 'Base de ST retido (R$) — espelho de dbitvenda.basesubst_trib_ret';
COMMENT ON COLUMN db_manaus.dbprodfat.totalsubst_trib_ret IS 'Total de ST retido (R$) — espelho de dbitvenda.totalsubst_trib_ret';
