-- Script para verificar as colunas reais da tabela dbreceb e outras tabelas relacionadas

-- 1. Verificar colunas da tabela dbreceb (contas a receber)
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'db_manaus' 
  AND table_name = 'dbreceb'
ORDER BY ordinal_position;

-- 2. Verificar colunas da tabela dbclien (clientes)
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'db_manaus' 
  AND table_name = 'dbclien'
ORDER BY ordinal_position;

-- 3. Verificar colunas da tabela dbfreceb (histórico de recebimentos)
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'db_manaus' 
  AND table_name = 'dbfreceb'
ORDER BY ordinal_position;

-- 4. Verificar colunas da tabela dbconta (contas bancárias)
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'db_manaus' 
  AND table_name = 'dbconta'
ORDER BY ordinal_position;

-- 5. Verificar colunas da tabela dbvend (vendedores)
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'db_manaus' 
  AND table_name = 'dbvend'
ORDER BY ordinal_position;

-- 6. Listar TODAS as tabelas disponíveis no schema db_manaus
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'db_manaus'
ORDER BY table_name;

-- 7. Fazer um SELECT de exemplo na dbreceb para ver dados reais (primeiras 5 linhas)
SELECT *
FROM db_manaus.dbreceb
LIMIT 5;
