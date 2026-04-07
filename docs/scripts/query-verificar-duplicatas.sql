-- Verificar faturas com múltiplas NFes
SELECT 
  f.codfat,
  f.nroform,
  COUNT(nfe.codfat) as qtd_nfes,
  STRING_AGG(nfe.nrodoc_fiscal::text, ', ') as numeros_nfe,
  STRING_AGG(SUBSTRING(nfe.chave, 1, 20), ', ') as chaves_resumo
FROM db_manaus.dbfatura f
LEFT JOIN db_manaus.dbfat_nfe nfe ON f.codfat = nfe.codfat
WHERE f.codfat IS NOT NULL
GROUP BY f.codfat, f.nroform
HAVING COUNT(nfe.codfat) > 1
ORDER BY f.codfat DESC
LIMIT 20;

-- Detalhes específicos da fatura 000234542
SELECT 
  f.codfat,
  f.nroform,
  f.codcli,
  f.data,
  c.nome as cliente_nome,
  COUNT(nfe.codfat) as qtd_nfes
FROM db_manaus.dbfatura f
LEFT JOIN db_manaus.dbclien c ON f.codcli = c.codcli
LEFT JOIN db_manaus.dbfat_nfe nfe ON f.codfat = nfe.codfat
WHERE f.codfat = '000234542'
GROUP BY f.codfat, f.nroform, f.codcli, f.data, c.nome;

-- Todas as NFes da fatura 000234542
SELECT 
  codfat,
  nrodoc_fiscal,
  serie,
  SUBSTRING(chave, 1, 30) as chave_resumo,
  numprotocolo,
  status,
  data
FROM db_manaus.dbfat_nfe
WHERE codfat = '000234542'
ORDER BY data DESC;
