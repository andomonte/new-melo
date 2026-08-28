-- 044_dbvenda_forma_pgto.sql
--
-- Forma de pagamento REAL selecionada na venda (DINHEIRO / PIX / CARTÃO DE DÉBITO /
-- CARTÃO DE CRÉDITO). O frontend da venda já envia isso (formaPagamento), mas era
-- descartado — o obsfat colapsa pix/débito/dinheiro em "A VISTA" e não distingue.
-- Campo WEB-only (não existe no Oracle). Vendas antigas/migradas ficam NULL → o
-- faturamento cai no fallback do obsfat (crédito / à vista genérico).
ALTER TABLE db_manaus.dbvenda ADD COLUMN IF NOT EXISTS forma_pgto varchar(30);
