-- SQL para consultar faturas onde codgp não é null (faturas agrupadas)

-- Consulta básica
SELECT * FROM dbfatura WHERE codgp IS NOT NULL;

-- Consulta com campos específicos (mais legível)
SELECT 
    codfat,
    nroform,
    data,
    totalnf,
    codgp,
    agp,
    codcli,
    nfs,
    cancel
FROM dbfatura 
WHERE codgp IS NOT NULL
ORDER BY codgp, data DESC;

-- Consulta agrupada por codgp (ver quantas faturas em cada grupo)
SELECT 
    codgp,
    COUNT(*) as quantidade_faturas,
    SUM(totalnf) as valor_total_grupo,
    MIN(data) as data_primeira_fatura,
    MAX(data) as data_ultima_fatura,
    string_agg(codfat, ', ') as faturas_do_grupo
FROM dbfatura 
WHERE codgp IS NOT NULL
GROUP BY codgp
ORDER BY codgp;

-- Consulta detalhada com informações do cliente (se houver tabela de clientes)
SELECT 
    f.codfat,
    f.nroform,
    f.data,
    f.totalnf,
    f.codgp,
    f.agp,
    f.codcli,
    -- c.nome as cliente_nome,  -- descomente se tiver tabela de clientes
    f.nfs,
    f.cancel
FROM dbfatura f
-- LEFT JOIN dbclien c ON f.codcli = c.codcli  -- descomente se tiver tabela de clientes
WHERE f.codgp IS NOT NULL
ORDER BY f.codgp, f.data DESC;

-- Consulta para ver apenas faturas agrupadas ativas (agp = 'S')
SELECT 
    codfat,
    nroform,
    data,
    totalnf,
    codgp,
    agp,
    codcli
FROM dbfatura 
WHERE codgp IS NOT NULL 
  AND agp = 'S'
  AND cancel = 'N'  -- apenas faturas não canceladas
ORDER BY codgp, data DESC;
