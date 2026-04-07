-- Script SQL para criar tabelas de Contas a Pagar
-- Execute no PostgreSQL schema db_manaus

-- Tabela principal de contas a pagar para NFe
CREATE TABLE IF NOT EXISTS contas_pagar_nfe (
    id SERIAL PRIMARY KEY,
    nfe_id VARCHAR(50), -- Relaciona com dbnfe_ent ou nfe_entrada
    fornecedor_id VARCHAR(6) NOT NULL, -- FK para dbcredor
    numero_nfe VARCHAR(20),
    serie_nfe VARCHAR(10),
    chave_nfe VARCHAR(44),
    valor_total DECIMAL(15,2) NOT NULL,
    valor_pago DECIMAL(15,2) DEFAULT 0,
    valor_desconto DECIMAL(15,2) DEFAULT 0,
    valor_juros DECIMAL(15,2) DEFAULT 0,
    data_vencimento DATE NOT NULL,
    data_emissao DATE NOT NULL,
    data_pagamento DATE,
    status VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, PARCIAL, PAGA, CANCELADA
    conta_financeira_id INTEGER, -- FK para cad_conta_financeira
    centro_custo_id INTEGER,
    parcela_numero INTEGER DEFAULT 1,
    total_parcelas INTEGER DEFAULT 1,
    forma_pagamento VARCHAR(30) DEFAULT 'A_PRAZO', -- A_VISTA, A_PRAZO, BOLETO, PIX, etc
    observacoes TEXT,
    observacoes_pagamento TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Tabela de log de operações
CREATE TABLE IF NOT EXISTS contas_pagar_log (
    id SERIAL PRIMARY KEY,
    conta_id INTEGER NOT NULL REFERENCES contas_pagar_nfe(id),
    acao VARCHAR(50) NOT NULL, -- CRIADA, ALTERADA, PAGA, CANCELADA, etc
    usuario VARCHAR(100) NOT NULL,
    detalhes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de movimentos financeiros
CREATE TABLE IF NOT EXISTS movimentos_financeiros (
    id SERIAL PRIMARY KEY,
    conta_pagar_id INTEGER REFERENCES contas_pagar_nfe(id),
    tipo_movimento VARCHAR(20) NOT NULL, -- PAGAMENTO, DESCONTO, JUROS, ESTORNO
    valor DECIMAL(15,2) NOT NULL,
    data_movimento DATE NOT NULL,
    forma_pagamento VARCHAR(30),
    conta_bancaria_id INTEGER,
    descricao TEXT,
    usuario VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contas_pagar_nfe_fornecedor ON contas_pagar_nfe(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_nfe_status ON contas_pagar_nfe(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_nfe_vencimento ON contas_pagar_nfe(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_nfe_nfe_id ON contas_pagar_nfe(nfe_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_nfe_numero ON contas_pagar_nfe(numero_nfe);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_nfe_deleted ON contas_pagar_nfe(deleted_at);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_log_conta ON contas_pagar_log(conta_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_log_data ON contas_pagar_log(created_at);

CREATE INDEX IF NOT EXISTS idx_movimentos_financeiros_conta ON movimentos_financeiros(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_financeiros_data ON movimentos_financeiros(data_movimento);

-- Comentários das tabelas
COMMENT ON TABLE contas_pagar_nfe IS 'Contas a pagar geradas a partir de NFes de entrada';
COMMENT ON TABLE contas_pagar_log IS 'Log de todas as operações realizadas nas contas a pagar';
COMMENT ON TABLE movimentos_financeiros IS 'Movimentações financeiras relacionadas às contas a pagar';

-- Comentários dos campos principais
COMMENT ON COLUMN contas_pagar_nfe.nfe_id IS 'ID da NFe que originou esta conta (pode ser dbnfe_ent.num_ent ou nfe_entrada.id)';
COMMENT ON COLUMN contas_pagar_nfe.fornecedor_id IS 'Código do fornecedor/credor na tabela dbcredor';
COMMENT ON COLUMN contas_pagar_nfe.valor_total IS 'Valor total a ser pago';
COMMENT ON COLUMN contas_pagar_nfe.valor_pago IS 'Valor já pago (soma de todos os pagamentos)';
COMMENT ON COLUMN contas_pagar_nfe.status IS 'Status: PENDENTE=não pago, PARCIAL=parcialmente pago, PAGA=totalmente pago, CANCELADA=cancelado';
COMMENT ON COLUMN contas_pagar_nfe.conta_financeira_id IS 'Centro de custo/conta financeira (tabela cad_conta_financeira)';
COMMENT ON COLUMN contas_pagar_nfe.forma_pagamento IS 'Forma de pagamento: A_VISTA, A_PRAZO, BOLETO, PIX, DINHEIRO, etc';