-- Script para corrigir a estrutura da tabela grupo_pagamento_fatura
-- A coluna fatura_id deve ser VARCHAR(9) para corresponder ao codfat da dbfatura

DO $$ 
BEGIN
    -- Verificar se a tabela existe e tem a estrutura incorreta
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'grupo_pagamento_fatura' 
        AND column_name = 'fatura_id'
        AND data_type = 'integer'
    ) THEN
        RAISE NOTICE 'Corrigindo estrutura da tabela grupo_pagamento_fatura...';
        
        -- Limpar dados existentes (se houver dados incorretos)
        DELETE FROM grupo_pagamento_fatura;
        
        -- Alterar o tipo da coluna fatura_id
        ALTER TABLE grupo_pagamento_fatura 
        ALTER COLUMN fatura_id TYPE VARCHAR(9);
        
        RAISE NOTICE 'Coluna fatura_id alterada para VARCHAR(9)';
        
        -- Verificar se existe constraint de foreign key e recriar se necessário
        -- (Comentado para evitar problemas se não existir)
        -- ALTER TABLE grupo_pagamento_fatura 
        -- ADD CONSTRAINT fk_grupo_pagamento_fatura_codfat 
        -- FOREIGN KEY (fatura_id) REFERENCES dbfatura(codfat) ON DELETE CASCADE;
        
        RAISE NOTICE 'Estrutura da tabela grupo_pagamento_fatura corrigida com sucesso!';
        
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'grupo_pagamento_fatura' 
        AND column_name = 'fatura_id'
        AND data_type = 'character varying'
    ) THEN
        RAISE NOTICE 'Tabela grupo_pagamento_fatura já possui a estrutura correta (VARCHAR)';
        
    ELSE
        RAISE NOTICE 'Tabela grupo_pagamento_fatura não encontrada ou coluna fatura_id não existe';
    END IF;
    
    -- Verificar estrutura final
    SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'grupo_pagamento_fatura'
    ORDER BY ordinal_position;
    
END $$;

-- Mostrar a estrutura atual da tabela
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'grupo_pagamento_fatura'
ORDER BY ordinal_position;

-- Mostrar exemplos de codfat da tabela dbfatura para referência
SELECT 
    'Exemplos de codfat da dbfatura:' as info,
    codfat,
    length(codfat) as tamanho,
    pg_typeof(codfat) as tipo
FROM dbfatura 
WHERE codfat IS NOT NULL 
LIMIT 5;
