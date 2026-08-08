-- BLOCO B (B1) — campos fiscais na venda: MOVIMENTAÇÃO + OPERAÇÃO.
-- Alimentam diretamente o motor: db_manaus.calcular_imposto_item(
--   p_tipo_movimentacao := dbvenda.tipo_movimentacao,
--   p_tipo_operacao     := dbvenda.tipo_operacao).
--
-- NÃO confundir com dbvenda.operacao (bigint = "Documento" comercial de dboperacao_venda,
-- usado para roteamento/consulta, que NÃO entra no cálculo fiscal).
--
-- Default SAIDA/VENDA = comportamento atual (toda venda existente é saída/venda) — sem regressão.
-- ADD COLUMN com DEFAULT constante é metadata-only no PostgreSQL 11+ (não reescreve as 152k linhas).
-- INSERTs existentes (finalizarVenda) que omitem as colunas usam o DEFAULT → seguem funcionando.

ALTER TABLE db_manaus.dbvenda
  ADD COLUMN IF NOT EXISTS tipo_movimentacao varchar(20) NOT NULL DEFAULT 'SAIDA';

ALTER TABLE db_manaus.dbvenda
  ADD COLUMN IF NOT EXISTS tipo_operacao varchar(40) NOT NULL DEFAULT 'VENDA';

COMMENT ON COLUMN db_manaus.dbvenda.tipo_movimentacao IS
  'Movimentação fiscal p/ cálculo do imposto: SAIDA | ENTRADA | ENTRADA_COMPRAS (default SAIDA). Alimenta calcular_imposto_item.p_tipo_movimentacao. Distinta de dbvenda.operacao (Documento comercial).';
COMMENT ON COLUMN db_manaus.dbvenda.tipo_operacao IS
  'Operação fiscal p/ cálculo/CFOP: VENDA | TRANSFERENCIA | DEVOLUCAO_* | REMESSA_* | EXTRAVIO_* ... (default VENDA). Alimenta calcular_imposto_item.p_tipo_operacao.';
