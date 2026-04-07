-- Verificar estrutura da tabela dbreceb
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'db_manaus' 
AND table_name = 'dbreceb'
ORDER BY ordinal_position;

-- Listar primeiras linhas para ver os dados
SELECT * FROM db_manaus.dbreceb LIMIT 1;
