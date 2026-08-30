-- 046: campo status (ativo/inativo) para os cadastros de Conta Financeira e Banco.
-- Aditivo e idempotente. Registros existentes nascem 'ativo'.

ALTER TABLE db_manaus.cad_conta_financeira ADD COLUMN IF NOT EXISTS status varchar(10) DEFAULT 'ativo';
UPDATE db_manaus.cad_conta_financeira SET status = 'ativo' WHERE status IS NULL;

ALTER TABLE db_manaus.dbbanco ADD COLUMN IF NOT EXISTS status varchar(10) DEFAULT 'ativo';
UPDATE db_manaus.dbbanco SET status = 'ativo' WHERE status IS NULL;

-- dbbanco_cobranca = os 9 bancos de cobrança (o que o cadastro "Bancos e Contas" edita
-- e a base da lista de banco do Novo Título / cobrança GP).
ALTER TABLE db_manaus.dbbanco_cobranca ADD COLUMN IF NOT EXISTS status varchar(10) DEFAULT 'ativo';
UPDATE db_manaus.dbbanco_cobranca SET status = 'ativo' WHERE status IS NULL;
