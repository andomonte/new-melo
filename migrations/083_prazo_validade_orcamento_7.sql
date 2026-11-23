-- 083 — Prazo máximo de validade do orçamento: 7 dias (23/11/2026).
-- Manaus estava com 10; Roraima e Rondônia não tinham o parâmetro (a tela usava o
-- padrão do código). Grava 7 nas três filiais.

BEGIN;

UPDATE db_manaus.tb_parametros SET valor = '7' WHERE chave = 'prazo_validade_orcamento';

INSERT INTO db_roraima.tb_parametros (chave, valor, tipo, descricao)
SELECT 'prazo_validade_orcamento', '7', 'INT', 'Prazo máximo de validade do orçamento em dias'
WHERE NOT EXISTS (SELECT 1 FROM db_roraima.tb_parametros WHERE chave = 'prazo_validade_orcamento');
UPDATE db_roraima.tb_parametros SET valor = '7' WHERE chave = 'prazo_validade_orcamento';

INSERT INTO db_rondonia.tb_parametros (chave, valor, tipo, descricao)
SELECT 'prazo_validade_orcamento', '7', 'INT', 'Prazo máximo de validade do orçamento em dias'
WHERE NOT EXISTS (SELECT 1 FROM db_rondonia.tb_parametros WHERE chave = 'prazo_validade_orcamento');
UPDATE db_rondonia.tb_parametros SET valor = '7' WHERE chave = 'prazo_validade_orcamento';

COMMIT;
