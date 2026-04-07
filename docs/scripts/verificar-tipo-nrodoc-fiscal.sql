-- Verificar tipo do campo nrodoc_fiscal
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'db_manaus'
  AND table_name = 'dbfat_nfe'
  AND column_name IN ('nrodoc_fiscal', 'serie');

-- Verificar valores salvos recentemente
SELECT 
    codfat,
    nrodoc_fiscal,
    serie,
    LENGTH(nrodoc_fiscal::text) as tamanho_nrodoc,
    data
FROM db_manaus.dbfat_nfe
WHERE codfat = '000234542'
ORDER BY data DESC;
