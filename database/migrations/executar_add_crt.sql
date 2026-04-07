-- Adicionar campo CRT (Código de Regime Tributário) na tabela dadosempresa
-- CRT: '1' = Simples Nacional, '2' = Simples Nacional - excesso sublimite, '3' = Regime Normal

-- Verificar se o campo já existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'db_manaus' 
        AND table_name = 'dadosempresa' 
        AND column_name = 'crt'
    ) THEN
        ALTER TABLE db_manaus.dadosempresa 
        ADD COLUMN crt VARCHAR(1) DEFAULT '1';
        
        RAISE NOTICE 'Campo CRT adicionado com sucesso!';
    ELSE
        RAISE NOTICE 'Campo CRT já existe na tabela.';
    END IF;
END $$;

-- Atualizar registros existentes que estejam NULL
UPDATE db_manaus.dadosempresa 
SET crt = '1' 
WHERE crt IS NULL;

-- Verificar resultado
SELECT 
    'Total de empresas:' as descricao,
    COUNT(*) as quantidade 
FROM db_manaus.dadosempresa
UNION ALL
SELECT 
    'Empresas com CRT = 1 (Simples Nacional):' as descricao,
    COUNT(*) as quantidade 
FROM db_manaus.dadosempresa 
WHERE crt = '1'
UNION ALL
SELECT 
    'Empresas com CRT = 2 (Simples - Excesso):' as descricao,
    COUNT(*) as quantidade 
FROM db_manaus.dadosempresa 
WHERE crt = '2'
UNION ALL
SELECT 
    'Empresas com CRT = 3 (Regime Normal):' as descricao,
    COUNT(*) as quantidade 
FROM db_manaus.dadosempresa 
WHERE crt = '3';
