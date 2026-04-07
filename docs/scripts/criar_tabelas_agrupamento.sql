-- Script para criar a tabela grupo_pagamento_fatura
-- Este script pode ser executado manualmente ou através de uma migração

-- Verificar se a tabela já existe antes de criar
DO $$ 
BEGIN
    -- Criar tabela grupo_pagamento se não existir
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grupo_pagamento') THEN
        CREATE TABLE grupo_pagamento (
            id SERIAL PRIMARY KEY,
            codigo_gp INTEGER NOT NULL UNIQUE,
            cliente_id VARCHAR(5),
            data_criacao TIMESTAMP DEFAULT NOW(),
            status VARCHAR(10) DEFAULT 'ATIVO',
            usuario_criacao VARCHAR(4),
            observacoes TEXT
        );
        
        -- Criar índices
        CREATE INDEX idx_grupo_pagamento_codigo_gp ON grupo_pagamento(codigo_gp);
        CREATE INDEX idx_grupo_pagamento_cliente_id ON grupo_pagamento(cliente_id);
        CREATE INDEX idx_grupo_pagamento_data_criacao ON grupo_pagamento(data_criacao);
        
        RAISE NOTICE 'Tabela grupo_pagamento criada com sucesso';
    ELSE
        RAISE NOTICE 'Tabela grupo_pagamento já existe';
    END IF;

    -- Criar tabela grupo_pagamento_fatura se não existir
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grupo_pagamento_fatura') THEN
        CREATE TABLE grupo_pagamento_fatura (
            id SERIAL PRIMARY KEY,
            grupo_pagamento_id INTEGER NOT NULL,
            fatura_id VARCHAR(9) NOT NULL,  -- CORRIGIDO: VARCHAR(9) para corresponder ao codfat
            data_inclusao TIMESTAMP DEFAULT NOW(),
            usuario_inclusao VARCHAR(4),
            
            -- Constraints
            UNIQUE(grupo_pagamento_id, fatura_id),
            
            -- Foreign Keys
            FOREIGN KEY (grupo_pagamento_id) REFERENCES grupo_pagamento(id) ON DELETE CASCADE
            -- FOREIGN KEY (fatura_id) REFERENCES dbfatura(codfat) ON DELETE CASCADE -- Descomentado se necessário
        );
        
        -- Criar índices para melhor performance
        CREATE INDEX idx_grupo_pagamento_fatura_grupo_id ON grupo_pagamento_fatura(grupo_pagamento_id);
        CREATE INDEX idx_grupo_pagamento_fatura_fatura_id ON grupo_pagamento_fatura(fatura_id);
        CREATE INDEX idx_grupo_pagamento_fatura_data_inclusao ON grupo_pagamento_fatura(data_inclusao);
        
        RAISE NOTICE 'Tabela grupo_pagamento_fatura criada com sucesso';
    ELSE
        RAISE NOTICE 'Tabela grupo_pagamento_fatura já existe';
    END IF;
    
    -- Migrar dados existentes da coluna codgp para a tabela de relacionamento
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grupo_pagamento_fatura') THEN
        -- Inserir grupos existentes na tabela grupo_pagamento
        INSERT INTO grupo_pagamento (codigo_gp, cliente_id, data_criacao, status, usuario_criacao)
        SELECT DISTINCT 
            f.codgp,
            f.codcli,
            MIN(f.data) as data_criacao,
            'ATIVO',
            'migração'
        FROM dbfatura f 
        WHERE f.codgp IS NOT NULL 
            AND f.agp = 'S'
            AND NOT EXISTS (SELECT 1 FROM grupo_pagamento gp WHERE gp.codigo_gp = f.codgp)
        GROUP BY f.codgp, f.codcli;
        
        -- Inserir relacionamentos na tabela grupo_pagamento_fatura
        INSERT INTO grupo_pagamento_fatura (grupo_pagamento_id, fatura_id, data_inclusao, usuario_inclusao)
        SELECT DISTINCT 
            gp.id,
            f.codfat,
            f.data,
            'migração'
        FROM dbfatura f
        JOIN grupo_pagamento gp ON gp.codigo_gp = f.codgp
        WHERE f.codgp IS NOT NULL 
            AND f.agp = 'S'
            AND NOT EXISTS (
                SELECT 1 FROM grupo_pagamento_fatura gpf 
                WHERE gpf.grupo_pagamento_id = gp.id 
                AND gpf.fatura_id = f.codfat
            );
        
        RAISE NOTICE 'Migração de dados concluída';
    END IF;
END $$;

-- Comentários sobre o uso das tabelas
COMMENT ON TABLE grupo_pagamento IS 'Tabela principal para armazenar informações dos grupos de pagamento';
COMMENT ON TABLE grupo_pagamento_fatura IS 'Tabela de relacionamento N:N entre grupos de pagamento e faturas - serve como suporte para localizar melhor as faturas agrupadas';
COMMENT ON COLUMN grupo_pagamento_fatura.grupo_pagamento_id IS 'ID do grupo (referência para grupo_pagamento.id) ou código do grupo para compatibilidade';
COMMENT ON COLUMN grupo_pagamento_fatura.fatura_id IS 'Código da fatura (referência para dbfatura.codfat)';
