-- Script para adicionar colunas de impostos IBS/CBS na dbitvenda
-- e colunas de CNPJ/IE da empresa na dbvenda
-- Executar no schema db_manaus

-- Colunas para IBS/CBS nos itens da venda
ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_ibs NUMERIC(10,4);
ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS aliquota_cbs NUMERIC(10,4);
ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS valor_ibs NUMERIC(15,4);
ALTER TABLE dbitvenda ADD COLUMN IF NOT EXISTS valor_cbs NUMERIC(15,4);

-- Colunas para CNPJ/IE da empresa na venda
ALTER TABLE dbvenda ADD COLUMN IF NOT EXISTS cnpj_empresa VARCHAR(18);
ALTER TABLE dbvenda ADD COLUMN IF NOT EXISTS ie_empresa VARCHAR(20);
