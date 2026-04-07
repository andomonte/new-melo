-- CreateTable
CREATE TABLE IF NOT EXISTS smtp_config (
    id SERIAL PRIMARY KEY,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 587,
    secure BOOLEAN NOT NULL DEFAULT false,
    username VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255) NOT NULL DEFAULT 'Sistema NFe',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Criar índice para busca rápida da configuração ativa
CREATE INDEX IF NOT EXISTS idx_smtp_config_ativo ON smtp_config(ativo);

-- Comentários nas colunas
COMMENT ON TABLE smtp_config IS 'Configurações SMTP para envio de emails de NFe';
COMMENT ON COLUMN smtp_config.host IS 'Servidor SMTP (ex: smtp.gmail.com)';
COMMENT ON COLUMN smtp_config.port IS 'Porta SMTP (587 para TLS, 465 para SSL)';
COMMENT ON COLUMN smtp_config.secure IS 'Usar conexão segura SSL/TLS';
COMMENT ON COLUMN smtp_config.username IS 'Usuário para autenticação SMTP';
COMMENT ON COLUMN smtp_config.password IS 'Senha ou App Password para autenticação';
COMMENT ON COLUMN smtp_config.from_email IS 'Email remetente padrão';
COMMENT ON COLUMN smtp_config.from_name IS 'Nome do remetente padrão';
COMMENT ON COLUMN smtp_config.ativo IS 'Indica se esta configuração está ativa';
