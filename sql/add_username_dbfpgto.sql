-- Adicionar campo username na tabela dbfpgto para registrar o usuário que fez o pagamento
-- Data: 22/12/2025

-- Verificar se a coluna já existe antes de criar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'db_manaus'
        AND table_name = 'dbfpgto'
        AND column_name = 'username'
    ) THEN
        ALTER TABLE db_manaus.dbfpgto
        ADD COLUMN username VARCHAR(100);

        -- Adicionar comentário na coluna
        COMMENT ON COLUMN db_manaus.dbfpgto.username IS 'Nome do usuário que registrou o pagamento';

        -- Criar índice para melhor performance em consultas
        CREATE INDEX IF NOT EXISTS idx_dbfpgto_username
        ON db_manaus.dbfpgto(username);

        RAISE NOTICE 'Campo username adicionado com sucesso na tabela dbfpgto';
    ELSE
        RAISE NOTICE 'Campo username já existe na tabela dbfpgto';
    END IF;
END $$;