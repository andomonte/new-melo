-- Adicionar coluna serie na tabela dbfat_nfe
ALTER TABLE db_manaus.dbfat_nfe 
ADD COLUMN IF NOT EXISTS serie VARCHAR(3);

-- Comentar a coluna
COMMENT ON COLUMN db_manaus.dbfat_nfe.serie IS 'Série da NFe retornada pela SEFAZ';

-- Verificar a estrutura
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_schema = 'db_manaus' 
  AND table_name = 'dbfat_nfe' 
  AND column_name IN ('nrodoc_fiscal', 'serie')
ORDER BY ordinal_position;

-- Exibir algumas linhas para conferência
SELECT codfat, nrodoc_fiscal, serie, chave, numprotocolo 
FROM db_manaus.dbfat_nfe 
ORDER BY "data" DESC 
LIMIT 5;
