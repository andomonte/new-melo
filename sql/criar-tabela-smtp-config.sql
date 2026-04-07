-- ============================================================================
-- Script de criação da tabela smtp_config
-- Sistema de Faturamento - Melo
-- Data: 05/01/2026
-- ============================================================================
-- 
-- Descrição: 
-- Tabela para armazenar configurações SMTP do sistema de envio de emails.
-- As senhas são criptografadas com AES-256-CBC antes de serem armazenadas.
--
-- ============================================================================

-- Remove a tabela se já existir (cuidado em produção!)
-- DROP TABLE IF EXISTS smtp_config CASCADE;

-- Criação da tabela smtp_config
CREATE TABLE IF NOT EXISTS smtp_config (
    -- Identificador único
    id SERIAL PRIMARY KEY,
    
    -- Configurações do servidor SMTP
    host VARCHAR(255) NOT NULL,
    
    port INTEGER NOT NULL DEFAULT 587 
        CHECK (port > 0 AND port <= 65535),
    
    secure BOOLEAN NOT NULL DEFAULT false,
    
    -- Credenciais de autenticação
    username VARCHAR(255) NOT NULL,
    
    password TEXT NOT NULL,
    
    -- Informações do remetente
    from_email VARCHAR(255) NOT NULL,
    
    from_name VARCHAR(255) NOT NULL DEFAULT 'Sistema NFe',
    
    -- Controle de ativação
    ativo BOOLEAN NOT NULL DEFAULT true,
    
    -- Auditoria
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Comentário da tabela
COMMENT ON TABLE smtp_config IS 'Configurações SMTP para envio de emails de NFe';

-- Comentários das colunas
COMMENT ON COLUMN smtp_config.id IS 'Identificador único da configuração';
COMMENT ON COLUMN smtp_config.host IS 'Endereço do servidor SMTP (ex: smtp.gmail.com)';
COMMENT ON COLUMN smtp_config.port IS 'Porta do servidor SMTP (587 para TLS, 465 para SSL)';
COMMENT ON COLUMN smtp_config.secure IS 'true para SSL (porta 465), false para TLS (porta 587)';
COMMENT ON COLUMN smtp_config.username IS 'Usuário/email para autenticação SMTP';
COMMENT ON COLUMN smtp_config.password IS 'Senha criptografada com AES-256-CBC';
COMMENT ON COLUMN smtp_config.from_email IS 'Email que aparecerá no campo "De:"';
COMMENT ON COLUMN smtp_config.from_name IS 'Nome do remetente que aparecerá no email';
COMMENT ON COLUMN smtp_config.ativo IS 'Define qual configuração está ativa (apenas uma por vez)';
COMMENT ON COLUMN smtp_config.created_at IS 'Data e hora de criação do registro';
COMMENT ON COLUMN smtp_config.updated_at IS 'Data e hora da última atualização';

-- Índice para buscar rapidamente a configuração ativa
CREATE INDEX IF NOT EXISTS idx_smtp_config_ativo 
    ON smtp_config(ativo) 
    WHERE ativo = true;

COMMENT ON INDEX idx_smtp_config_ativo IS 'Índice para otimizar busca da configuração ativa';

-- ============================================================================
-- Dados de exemplo (opcional - remover em produção)
-- ============================================================================

-- Configuração de exemplo para Gmail (DESCOMENTADO)
/*
INSERT INTO smtp_config (
    host,
    port,
    secure,
    username,
    password,
    from_email,
    from_name,
    ativo
) VALUES (
    'smtp.gmail.com',
    587,
    false,
    'seu-email@gmail.com',
    'SENHA_CRIPTOGRAFADA_AQUI',  -- Use a API para inserir (será criptografada automaticamente)
    'nfe@empresa.com',
    'Empresa - NFe',
    true
);
*/

-- ============================================================================
-- Verificação
-- ============================================================================

-- Verificar se a tabela foi criada
SELECT 
    table_name, 
    table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'smtp_config';

-- Verificar estrutura da tabela
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'smtp_config'
ORDER BY ordinal_position;

-- Verificar índices criados
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'smtp_config';

-- ============================================================================
-- Consultas úteis
-- ============================================================================

-- Listar todas as configurações
-- SELECT id, host, port, secure, username, from_email, from_name, ativo, created_at 
-- FROM smtp_config 
-- ORDER BY updated_at DESC;

-- Buscar configuração ativa
-- SELECT * FROM smtp_config WHERE ativo = true;

-- Contar total de configurações
-- SELECT COUNT(*) as total_configs FROM smtp_config;

-- ============================================================================
-- IMPORTANTE - SEGURANÇA
-- ============================================================================
-- 
-- 1. As senhas são criptografadas pela API, NÃO insira senhas direto no banco!
-- 2. Configure a variável de ambiente: SMTP_ENCRYPTION_KEY (32 caracteres)
-- 3. Use a tela de administração do sistema para gerenciar configurações
-- 4. Para Gmail, gere uma "Senha de app" em:
--    https://myaccount.google.com/apppasswords
--
-- ============================================================================
