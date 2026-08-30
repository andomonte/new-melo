-- 047: campo status (ativo/inativo) para o cadastro de Forma de Pagamento (dbforma_pagto).
-- Aditivo e idempotente. Registros existentes nascem 'ativo'.

ALTER TABLE db_manaus.dbforma_pagto ADD COLUMN IF NOT EXISTS status varchar(10) DEFAULT 'ativo';
UPDATE db_manaus.dbforma_pagto SET status = 'ativo' WHERE status IS NULL;
