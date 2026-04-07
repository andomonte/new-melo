-- Script para adicionar campos necessários para confirmação de entradas

-- 1. Adicionar campos de confirmação na tabela entradas_estoque
ALTER TABLE entradas_estoque ADD COLUMN IF NOT EXISTS data_confirmacao_preco TIMESTAMP;
ALTER TABLE entradas_estoque ADD COLUMN IF NOT EXISTS data_confirmacao_estoque TIMESTAMP;
ALTER TABLE entradas_estoque ADD COLUMN IF NOT EXISTS observacao_preco TEXT;
ALTER TABLE entradas_estoque ADD COLUMN IF NOT EXISTS observacao_estoque TEXT;

-- 2. Criar tabela de log de operações das entradas
CREATE TABLE IF NOT EXISTS entrada_operacoes_log (
    id SERIAL PRIMARY KEY,
    entrada_id INTEGER NOT NULL,
    operacao VARCHAR(50) NOT NULL,
    status_anterior VARCHAR(50),
    status_novo VARCHAR(50),
    observacao TEXT,
    usuario_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entrada_id) REFERENCES entradas_estoque(id) ON DELETE CASCADE
);

-- 3. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_entrada_operacoes_log_entrada_id ON entrada_operacoes_log(entrada_id);
CREATE INDEX IF NOT EXISTS idx_entrada_operacoes_log_operacao ON entrada_operacoes_log(operacao);
CREATE INDEX IF NOT EXISTS idx_entradas_estoque_status ON entradas_estoque(status);

-- 4. Atualizar status existentes (caso necessário)
-- UPDATE entradas_estoque SET status = 'PROCESSANDO' WHERE status = 'CONCLUIDA' AND data_confirmacao_estoque IS NULL;

-- 5. Comentários para documentar os novos status
COMMENT ON COLUMN entradas_estoque.status IS 'Status da entrada: PROCESSANDO, PRECO_CONFIRMADO, DISPONIVEL_VENDA';
COMMENT ON COLUMN entradas_estoque.data_confirmacao_preco IS 'Data/hora quando o preço foi confirmado';
COMMENT ON COLUMN entradas_estoque.data_confirmacao_estoque IS 'Data/hora quando o estoque foi confirmado';
COMMENT ON TABLE entrada_operacoes_log IS 'Log de todas as operações realizadas nas entradas';