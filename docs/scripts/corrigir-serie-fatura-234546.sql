-- Corrigir série da fatura que tem a NFe número 1
UPDATE db_manaus.dbfatura 
SET serie = '2' 
WHERE codfat = '000234546';

-- Verificar se funcionou
SELECT 
  f.codfat,
  f.serie,
  f.nroform,
  nfe.nrodoc_fiscal,
  nfe.status,
  nfe.chave
FROM db_manaus.dbfatura f
INNER JOIN db_manaus.dbfat_nfe nfe ON nfe.codfat = f.codfat
WHERE f.codfat = '000234546';
