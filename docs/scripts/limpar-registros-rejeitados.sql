-- LIMPEZA DE REGISTROS REJEITADOS DA FATURA 000234583

-- 1. Verificar registros atuais
SELECT 
    codfat, 
    nrodoc_fiscal, 
    LEFT(chave, 50) as chave_inicio,
    status
FROM db_manaus.dbfat_nfe
WHERE codfat = '000234583'
ORDER BY chave;

-- 2. Deletar todos os registros rejeitados
DELETE FROM db_manaus.dbfat_nfe
WHERE codfat = '000234583';

-- 3. Verificar último número autorizado
SELECT 
    MAX(CAST(nfe.nrodoc_fiscal AS INTEGER)) as ultimo_numero_autorizado,
    COUNT(*) as total_autorizadas
FROM db_manaus.dbfat_nfe nfe
INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
WHERE f.serie = '2' AND nfe.status = '100';

-- 4. Listar últimas NFes autorizadas
SELECT 
    nfe.codfat,
    nfe.nrodoc_fiscal,
    LEFT(nfe.chave, 50) as chave,
    nfe.status
FROM db_manaus.dbfat_nfe nfe
INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
WHERE f.serie = '2' AND nfe.status = '100'
ORDER BY CAST(nfe.nrodoc_fiscal AS INTEGER) DESC
LIMIT 5;
