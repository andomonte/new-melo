-- Migração para adicionar suporte ao histórico de entradas de NFe
-- Criação da tabela de histórico de mudanças de status das NFes

-- Tabela para histórico de mudanças de status das NFes
CREATE TABLE IF NOT EXISTS dbnfe_ent_historico (
    id SERIAL PRIMARY KEY,
    codnfe_ent INTEGER NOT NULL,
    tipo_acao VARCHAR(50) NOT NULL,
    previous_status VARCHAR(1),
    new_status VARCHAR(1),
    user_id VARCHAR(50) NOT NULL,
    user_name VARCHAR(200),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Chave estrangeira para a NFe
    CONSTRAINT fk_nfe_historico_nfe
        FOREIGN KEY (codnfe_ent)
        REFERENCES dbnfe_ent(codnfe_ent)
        ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_nfe_historico_codnfe
    ON dbnfe_ent_historico(codnfe_ent);

CREATE INDEX IF NOT EXISTS idx_nfe_historico_user
    ON dbnfe_ent_historico(user_id);

CREATE INDEX IF NOT EXISTS idx_nfe_historico_tipo
    ON dbnfe_ent_historico(tipo_acao);

CREATE INDEX IF NOT EXISTS idx_nfe_historico_created
    ON dbnfe_ent_historico(created_at);

-- Comentários nas colunas
COMMENT ON TABLE dbnfe_ent_historico IS 'Histórico de mudanças e ações nas entradas de NFe';
COMMENT ON COLUMN dbnfe_ent_historico.codnfe_ent IS 'ID da NFe de entrada';
COMMENT ON COLUMN dbnfe_ent_historico.tipo_acao IS 'Tipo de ação (UPLOAD, ASSOCIACAO, PROCESSAMENTO, ENTRADA_GERADA, PAGAMENTO_ANTECIPADO, etc)';
COMMENT ON COLUMN dbnfe_ent_historico.previous_status IS 'Status anterior (R=Recebida, A=Em Andamento, C=Associação Concluída, S=Processada)';
COMMENT ON COLUMN dbnfe_ent_historico.new_status IS 'Novo status';
COMMENT ON COLUMN dbnfe_ent_historico.user_id IS 'ID do usuário que fez a ação';
COMMENT ON COLUMN dbnfe_ent_historico.user_name IS 'Nome do usuário que fez a ação';
COMMENT ON COLUMN dbnfe_ent_historico.comments IS 'Detalhes da ação em JSON';
COMMENT ON COLUMN dbnfe_ent_historico.created_at IS 'Data e hora da ação';
