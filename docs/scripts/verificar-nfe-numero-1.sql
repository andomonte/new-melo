-- 🔍 VERIFICAR SE EXISTEM NFes NÚMEROS 1 E 2 JÁ AUTORIZADAS

-- 1. Buscar em dbfat_nfe (qualquer status)
SELECT 
  'dbfat_nfe' as tabela,
  codfat,
  nrodoc_fiscal as numero,
  status,
  chave,
  dthrprotocolo,
  numprotocolo
FROM db_manaus.dbfat_nfe
WHERE chave IN (
  '13251018053139000169550020000000011208942310', -- Número 1
  '13251018053139000169550020000000021000240867'  -- Número 2
)
   OR chave LIKE '%55002000000001%' -- Série 002, Número 1
   OR chave LIKE '%55002000000002%' -- Série 002, Número 2
   OR nrodoc_fiscal IN ('1', '000000001', '2', '000000002')
ORDER BY dthrprotocolo DESC;

-- 2. Buscar em dbfatura com série 2
SELECT 
  'dbfatura' as tabela,
  codfat,
  nroform,
  serie,
  totalnf,
  data
FROM db_manaus.dbfatura
WHERE serie = '2'
  AND nroform IN ('1', '000000001', '2', '000000002')
ORDER BY data DESC;

-- 3. Buscar TODAS as NFes da série 2 autorizadas
SELECT 
  codfat,
  CAST(nfe.nrodoc_fiscal AS INTEGER) as numero,
  nfe.nrodoc_fiscal as numero_original,
  status,
  SUBSTRING(chave, 26, 9) as numero_na_chave,
  chave,
  dthrprotocolo
FROM db_manaus.dbfat_nfe nfe
INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
WHERE f.serie = '2'
  AND nfe.status = '100'
ORDER BY CAST(nfe.nrodoc_fiscal AS INTEGER) ASC;

-- 4. Verificar se existem as chaves específicas que a SEFAZ mencionou
SELECT 
  'Chaves SEFAZ mencionadas' as tipo,
  codfat,
  chave,
  status,
  nrodoc_fiscal,
  dthrprotocolo
FROM db_manaus.dbfat_nfe
WHERE chave IN (
  '13251018053139000169550020000000011208942310', -- Número 1
  '13251018053139000169550020000000021000240867'  -- Número 2
);

-- 5. Inserir NFes faltantes no banco (se confirmadas pela SEFAZ)
-- ⚠️ EXECUTE APENAS SE AS NFes FOREM CONFIRMADAS COMO AUTORIZADAS
/*
INSERT INTO db_manaus.dbfat_nfe (
  codfat, 
  chave, 
  status, 
  nrodoc_fiscal,
  modelo,
  dthrprotocolo
) VALUES 
  -- NFe Número 1
  (
    'A_DESCOBRIR', -- Descobrir qual CODFAT
    '13251018053139000169550020000000011208942310',
    '100', -- Autorizada
    '1',
    '55', -- NFe
    NOW() -- Ajustar com data real
  ),
  -- NFe Número 2
  (
    'A_DESCOBRIR', -- Descobrir qual CODFAT
    '13251018053139000169550020000000021000240867',
    '100', -- Autorizada
    '2',
    '55', -- NFe
    NOW() -- Ajustar com data real
  );
*/
