-- Adicionar campos para integração com Asaas na tabela dbfatura
-- Execute este script no banco de dados

ALTER TABLE db_manaus.dbfatura 
ADD COLUMN IF NOT EXISTS asaas_cobranca_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS asaas_cliente_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS linha_digitavel VARCHAR(100),
ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(100),
ADD COLUMN IF NOT EXISTS url_boleto VARCHAR(500),
ADD COLUMN IF NOT EXISTS status_boleto VARCHAR(20);

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_dbfatura_asaas_cobranca 
ON db_manaus.dbfatura(asaas_cobranca_id);

COMMENT ON COLUMN db_manaus.dbfatura.asaas_cobranca_id IS 'ID da cobrança no Asaas';
COMMENT ON COLUMN db_manaus.dbfatura.asaas_cliente_id IS 'ID do cliente no Asaas';
COMMENT ON COLUMN db_manaus.dbfatura.linha_digitavel IS 'Linha digitável do boleto';
COMMENT ON COLUMN db_manaus.dbfatura.codigo_barras IS 'Código de barras do boleto';
COMMENT ON COLUMN db_manaus.dbfatura.url_boleto IS 'URL para download do boleto PDF';
COMMENT ON COLUMN db_manaus.dbfatura.status_boleto IS 'Status da cobrança: PENDING, RECEIVED, CONFIRMED, etc';
