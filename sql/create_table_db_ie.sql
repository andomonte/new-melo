-- Criação da tabela db_ie
-- Armazena informações de inscrição estadual e dados do contribuinte

-- Se a tabela já existe, primeiro remova-a com CASCADE
DROP TABLE IF EXISTS db_ie CASCADE;

-- Criação da nova tabela db_ie
CREATE TABLE IF NOT EXISTS db_ie (
    inscricaoestadual VARCHAR(14) PRIMARY KEY,
    cgc VARCHAR(18) NOT NULL,
    nomecontribuinte VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Remover índices existentes se houver
DROP INDEX IF EXISTS idx_db_ie_cgc;
DROP INDEX IF EXISTS idx_db_ie_nomecontribuinte;

-- Criar novos índices para melhorar performance de consultas
CREATE INDEX idx_db_ie_cgc ON db_ie(cgc);
CREATE INDEX idx_db_ie_nomecontribuinte ON db_ie(nomecontribuinte);
