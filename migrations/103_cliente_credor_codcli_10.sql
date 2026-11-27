-- 103: vínculo fornecedor → cliente aceita o código de cliente do web (6+ dígitos).
-- O cadastro automático do fornecedor como cliente (devolução de compra, lib/compras/
-- devolucaoEntrada.ts criarClienteDoFornecedor) gera codcli na faixa do web (8888xx), mas
-- cad_cliente_credor.clc_codcli veio do Oracle com 5. dbclien.codcli é varchar(10).
-- Só aumenta o tamanho: nenhum dado muda.

ALTER TABLE db_manaus.cad_cliente_credor   ALTER COLUMN clc_codcli TYPE varchar(10);
ALTER TABLE db_roraima.cad_cliente_credor  ALTER COLUMN clc_codcli TYPE varchar(10);
ALTER TABLE db_rondonia.cad_cliente_credor ALTER COLUMN clc_codcli TYPE varchar(10);
