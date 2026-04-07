-- Script para adicionar campos comerciais na tabela dbclien
-- Executar com cuidado: verifica se coluna já existe antes de adicionar

-- Campo: precovenda (Preço de Venda)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dbclien' AND column_name = 'precovenda'
    ) THEN
        ALTER TABLE dbclien ADD COLUMN precovenda NUMERIC(15,2) DEFAULT 0;
        RAISE NOTICE 'Coluna precovenda adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna precovenda já existe';
    END IF;
END $$;

-- Campo: descontoaplic (Desconto Aplicado)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dbclien' AND column_name = 'descontoaplic'
    ) THEN
        ALTER TABLE dbclien ADD COLUMN descontoaplic VARCHAR(1) DEFAULT 'N';
        RAISE NOTICE 'Coluna descontoaplic adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna descontoaplic já existe';
    END IF;
END $$;

-- Campo: benmd (Bloqueio de Preço - BENMD)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dbclien' AND column_name = 'benmd'
    ) THEN
        ALTER TABLE dbclien ADD COLUMN benmd VARCHAR(1) DEFAULT 'N';
        RAISE NOTICE 'Coluna benmd adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna benmd já existe';
    END IF;
END $$;

-- Campo: habilitarlocalentrega (Habilitar Local de Entrega)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dbclien' AND column_name = 'habilitarlocalentrega'
    ) THEN
        ALTER TABLE dbclien ADD COLUMN habilitarlocalentrega VARCHAR(1) DEFAULT '0';
        RAISE NOTICE 'Coluna habilitarlocalentrega adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna habilitarlocalentrega já existe';
    END IF;
END $$;

-- Verificação final
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    column_default
FROM information_schema.columns 
WHERE table_name = 'dbclien' 
  AND column_name IN ('precovenda', 'descontoaplic', 'benmd', 'habilitarlocalentrega')
ORDER BY column_name;
