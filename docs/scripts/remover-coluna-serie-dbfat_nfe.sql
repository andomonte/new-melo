-- Migration: Remover coluna 'serie' de dbfat_nfe
-- Motivo: Série foi adicionada por engano em dbfat_nfe
-- A série correta está em dbfatura.serie e deve vir de lá

-- Verificar se a coluna existe antes de remover
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'db_manaus' 
        AND table_name = 'dbfat_nfe' 
        AND column_name = 'serie'
    ) THEN
        -- Remover a coluna
        ALTER TABLE db_manaus.dbfat_nfe DROP COLUMN serie;
        RAISE NOTICE 'Coluna serie removida de dbfat_nfe';
    ELSE
        RAISE NOTICE 'Coluna serie não existe em dbfat_nfe';
    END IF;
END $$;

-- Comentário para documentação
COMMENT ON TABLE db_manaus.dbfat_nfe IS 'Tabela de registros de NFe. A série da NFe vem de dbfatura.serie, não armazenamos série aqui.';

-- Verificar estrutura após remoção
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'db_manaus' 
  AND table_name = 'dbfat_nfe'
ORDER BY ordinal_position;
