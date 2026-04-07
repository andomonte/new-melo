-- Script para verificar e corrigir automaticamente problemas na estrutura do banco
-- relacionados ao sistema de agrupamento de faturas

DO $$
DECLARE
    resultado RECORD;
    msg TEXT := '';
BEGIN
    -- Verificar se a tabela dbfatura existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'dbfatura'
    ) THEN
        RAISE EXCEPTION 'Tabela dbfatura não encontrada! Verifique a estrutura do banco.';
    END IF;

    msg := msg || '✓ Tabela dbfatura encontrada' || chr(10);

    -- Verificar e criar coluna codgp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dbfatura' 
        AND column_name = 'codgp'
    ) THEN
        ALTER TABLE dbfatura ADD COLUMN codgp INTEGER;
        msg := msg || '✓ Coluna codgp criada na tabela dbfatura' || chr(10);
    ELSE
        msg := msg || '✓ Coluna codgp já existe na tabela dbfatura' || chr(10);
    END IF;

    -- Verificar e criar coluna agp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dbfatura' 
        AND column_name = 'agp'
    ) THEN
        ALTER TABLE dbfatura ADD COLUMN agp VARCHAR(1) DEFAULT 'N';
        msg := msg || '✓ Coluna agp criada na tabela dbfatura' || chr(10);
    ELSE
        msg := msg || '✓ Coluna agp já existe na tabela dbfatura' || chr(10);
    END IF;

    -- Verificar e criar índice para codgp
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'dbfatura' 
        AND indexname = 'idx_dbfatura_codgp'
    ) THEN
        CREATE INDEX idx_dbfatura_codgp ON dbfatura(codgp);
        msg := msg || '✓ Índice idx_dbfatura_codgp criado' || chr(10);
    ELSE
        msg := msg || '✓ Índice idx_dbfatura_codgp já existe' || chr(10);
    END IF;

    -- Verificar e criar índice para agp
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'dbfatura' 
        AND indexname = 'idx_dbfatura_agp'
    ) THEN
        CREATE INDEX idx_dbfatura_agp ON dbfatura(agp);
        msg := msg || '✓ Índice idx_dbfatura_agp criado' || chr(10);
    ELSE
        msg := msg || '✓ Índice idx_dbfatura_agp já existe' || chr(10);
    END IF;

    -- Verificar e criar tabela grupo_pagamento
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'grupo_pagamento'
    ) THEN
        CREATE TABLE grupo_pagamento (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            descricao TEXT,
            cliente_id INTEGER,
            valor_total DECIMAL(15,2),
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) DEFAULT 'ativo',
            criado_por INTEGER,
            observacoes TEXT
        );
        msg := msg || '✓ Tabela grupo_pagamento criada' || chr(10);
    ELSE
        msg := msg || '✓ Tabela grupo_pagamento já existe' || chr(10);
    END IF;

    -- Verificar e criar tabela grupo_pagamento_fatura
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'grupo_pagamento_fatura'
    ) THEN
        CREATE TABLE grupo_pagamento_fatura (
            id SERIAL PRIMARY KEY,
            grupo_pagamento_id INTEGER NOT NULL,
            fatura_id VARCHAR(50) NOT NULL,
            data_associacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            observacoes TEXT,
            FOREIGN KEY (grupo_pagamento_id) REFERENCES grupo_pagamento(id) ON DELETE CASCADE
        );
        
        CREATE INDEX idx_grupo_pagamento_fatura_grupo ON grupo_pagamento_fatura(grupo_pagamento_id);
        CREATE INDEX idx_grupo_pagamento_fatura_fatura ON grupo_pagamento_fatura(fatura_id);
        CREATE UNIQUE INDEX idx_grupo_pagamento_fatura_unique ON grupo_pagamento_fatura(grupo_pagamento_id, fatura_id);
        
        msg := msg || '✓ Tabela grupo_pagamento_fatura criada com índices' || chr(10);
    ELSE
        msg := msg || '✓ Tabela grupo_pagamento_fatura já existe' || chr(10);
        
        -- Verificar se fatura_id tem o tipo correto
        SELECT data_type INTO resultado 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'grupo_pagamento_fatura' 
        AND column_name = 'fatura_id';
        
        IF resultado.data_type = 'integer' THEN
            -- Corrigir tipo da coluna fatura_id
            ALTER TABLE grupo_pagamento_fatura ALTER COLUMN fatura_id TYPE VARCHAR(50);
            msg := msg || '✓ Tipo da coluna fatura_id corrigido para VARCHAR(50)' || chr(10);
        END IF;
    END IF;

    -- Verificar estatísticas das colunas
    SELECT 
        COUNT(*) as total_faturas,
        COUNT(codgp) as faturas_com_codgp,
        COUNT(CASE WHEN agp = 'S' THEN 1 END) as faturas_agrupadas
    INTO resultado
    FROM dbfatura;

    msg := msg || chr(10) || '📊 ESTATÍSTICAS:' || chr(10);
    msg := msg || '   Total de faturas: ' || resultado.total_faturas || chr(10);
    msg := msg || '   Faturas com codgp: ' || resultado.faturas_com_codgp || chr(10);
    msg := msg || '   Faturas agrupadas (agp=S): ' || resultado.faturas_agrupadas || chr(10);

    -- Verificar grupos de pagamento
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'grupo_pagamento'
    ) THEN
        SELECT COUNT(*) INTO resultado FROM grupo_pagamento;
        msg := msg || '   Grupos de pagamento: ' || resultado.count || chr(10);
        
        SELECT COUNT(*) INTO resultado FROM grupo_pagamento_fatura;
        msg := msg || '   Associações fatura-grupo: ' || resultado.count || chr(10);
    END IF;

    msg := msg || chr(10) || '🎉 ESTRUTURA VERIFICADA E CORRIGIDA COM SUCESSO!' || chr(10);
    msg := msg || 'O sistema de agrupamento de faturas está pronto para uso.';

    RAISE NOTICE '%', msg;
END $$;
