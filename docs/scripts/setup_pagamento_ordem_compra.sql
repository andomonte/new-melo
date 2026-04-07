-- 1. Criação da nova tabela para armazenar as parcelas de pagamento da ordem de compra
-- Isso cria um registro detalhado de cada parcela configurada pelo comprador.
CREATE TABLE IF NOT EXISTS db_manaus.ordem_pagamento_parcelas (
    id SERIAL PRIMARY KEY,
    orc_id BIGINT NOT NULL,
    banco VARCHAR(10) NOT NULL,
    tipo_documento VARCHAR(50) NOT NULL,
    numero_parcela INTEGER NOT NULL,
    valor_parcela NUMERIC(15, 2) NOT NULL,
    dias INTEGER NOT NULL,
    data_vencimento DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, CONFIRMADO, REJEITADO
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Adiciona um índice para busca rápida por ordem de compra
CREATE INDEX IF NOT EXISTS idx_ordem_pagamento_parcelas_orc_id ON db_manaus.ordem_pagamento_parcelas(orc_id);

-- 2. Alteração na tabela de Ordem de Compra (cmp_ordem_compra)
-- Adiciona colunas para armazenar a configuração geral do pagamento e facilitar o controle.

-- Adiciona a coluna para marcar se o pagamento foi configurado
ALTER TABLE db_manaus.cmp_ordem_compra ADD COLUMN IF NOT EXISTS orc_pagamento_configurado BOOLEAN DEFAULT FALSE;

-- Adiciona a coluna para armazenar o banco principal da transação
ALTER TABLE db_manaus.cmp_ordem_compra ADD COLUMN IF NOT EXISTS orc_banco VARCHAR(10);

-- Adiciona a coluna para o tipo de documento principal
ALTER TABLE db_manaus.cmp_ordem_compra ADD COLUMN IF NOT EXISTS orc_tipo_documento VARCHAR(50);

-- Adiciona a coluna para o valor de entrada, se houver
ALTER TABLE db_manaus.cmp_ordem_compra ADD COLUMN IF NOT EXISTS orc_valor_entrada NUMERIC(15, 2);

-- Comentários para clareza
COMMENT ON COLUMN db_manaus.cmp_ordem_compra.orc_pagamento_configurado IS 'Indica se a configuração de pagamento detalhada foi realizada para esta ordem de compra.';
COMMENT ON COLUMN db_manaus.cmp_ordem_compra.orc_banco IS 'Código do banco selecionado para a operação de pagamento.';
COMMENT ON COLUMN db_manaus.cmp_ordem_compra.orc_tipo_documento IS 'Tipo de documento principal usado para o pagamento (Boleto, Transferência, etc.).';
COMMENT ON COLUMN db_manaus.cmp_ordem_compra.orc_valor_entrada IS 'Valor pago como entrada na configuração do pagamento.';

-- Função para atualizar o campo `updated_at` automaticamente
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para a nova tabela de parcelas
DO $$
BEGIN
   IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'set_timestamp_ordem_pagamento_parcelas'
   ) THEN
      CREATE TRIGGER set_timestamp_ordem_pagamento_parcelas
      BEFORE UPDATE ON db_manaus.ordem_pagamento_parcelas
      FOR EACH ROW
      EXECUTE PROCEDURE trigger_set_timestamp();
   END IF;
END
$$;
