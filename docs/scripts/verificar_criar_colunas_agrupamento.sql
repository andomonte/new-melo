-- Script para verificar e criar a coluna codgp na tabela dbfatura
-- Esta coluna é necessária para o sistema de agrupamento de faturas

DO $$ 
BEGIN
    -- Verificar se a coluna codgp existe na tabela dbfatura
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dbfatura'
        AND column_name = 'codgp'
    ) THEN
        -- Criar a coluna codgp
        ALTER TABLE dbfatura ADD COLUMN codgp INTEGER;
        
        -- Criar índice para performance
        CREATE INDEX idx_dbfatura_codgp ON dbfatura(codgp);
        
        RAISE NOTICE 'Coluna codgp criada na tabela dbfatura com sucesso';
    ELSE
        RAISE NOTICE 'Coluna codgp já existe na tabela dbfatura';
    END IF;

    -- Verificar se a coluna agp existe na tabela dbfatura
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dbfatura'
        AND column_name = 'agp'
    ) THEN
        -- Criar a coluna agp
        ALTER TABLE dbfatura ADD COLUMN agp VARCHAR(1) DEFAULT 'N';
        
        RAISE NOTICE 'Coluna agp criada na tabela dbfatura com sucesso';
    ELSE
        RAISE NOTICE 'Coluna agp já existe na tabela dbfatura';
    END IF;
END $$;

-- Verificar estrutura final das colunas de agrupamento
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'dbfatura'
AND column_name IN ('codgp', 'agp')
ORDER BY column_name;

-- Verificar se há índices nas colunas de agrupamento
SELECT 
    i.indexname,
    i.indexdef
FROM pg_indexes i
WHERE i.tablename = 'dbfatura'
AND (i.indexdef LIKE '%codgp%' OR i.indexdef LIKE '%agp%');
