-- Script para limpar dados inválidos na tabela dbfatura
-- Esses registros com vírgulas podem estar causando problemas

-- 1. Verificar registros com problemas
SELECT 'Registros problemáticos encontrados:' as info;
SELECT codfat, codcli, nroform, selo 
FROM db_manaus.dbfatura 
WHERE codfat LIKE '%,%' 
   OR nroform LIKE '%,%' 
   OR selo LIKE '%,%'
   OR codfat !~ '^[0-9]+$'
   OR (nroform IS NOT NULL AND nroform !~ '^[0-9]+$')
   OR (selo IS NOT NULL AND selo !~ '^[0-9]+$')
LIMIT 20;

-- 2. Contar quantos registros problemáticos existem
SELECT 
  COUNT(*) FILTER (WHERE codfat LIKE '%,%' OR codfat !~ '^[0-9]+$') as codfat_invalidos,
  COUNT(*) FILTER (WHERE nroform LIKE '%,%' OR (nroform IS NOT NULL AND nroform !~ '^[0-9]+$')) as nroform_invalidos,
  COUNT(*) FILTER (WHERE selo LIKE '%,%' OR (selo IS NOT NULL AND selo !~ '^[0-9]+$')) as selo_invalidos
FROM db_manaus.dbfatura;

-- ATENÇÃO: As queries abaixo são para CORRIGIR os dados
-- Descomente apenas se tiver certeza que deseja executar a correção

/*
-- 3. Opção A: Pegar apenas o primeiro valor quando há vírgula
-- Para codfat
UPDATE db_manaus.dbfatura
SET codfat = SPLIT_PART(codfat, ',', 1)
WHERE codfat LIKE '%,%';

-- Para nroform
UPDATE db_manaus.dbfatura
SET nroform = SPLIT_PART(nroform, ',', 1)
WHERE nroform LIKE '%,%';

-- Para selo
UPDATE db_manaus.dbfatura
SET selo = SPLIT_PART(selo, ',', 1)
WHERE selo LIKE '%,%';
*/

/*
-- 4. Opção B: Remover caracteres não numéricos
-- Para codfat
UPDATE db_manaus.dbfatura
SET codfat = REGEXP_REPLACE(codfat, '[^0-9]', '', 'g')
WHERE codfat !~ '^[0-9]+$';

-- Para nroform
UPDATE db_manaus.dbfatura
SET nroform = REGEXP_REPLACE(nroform, '[^0-9]', '', 'g')
WHERE nroform IS NOT NULL AND nroform !~ '^[0-9]+$';

-- Para selo
UPDATE db_manaus.dbfatura
SET selo = REGEXP_REPLACE(selo, '[^0-9]', '', 'g')
WHERE selo IS NOT NULL AND selo !~ '^[0-9]+$';
*/

-- 5. Verificar após correção
/*
SELECT 'Após correção:' as info;
SELECT COUNT(*) as total_registros,
       COUNT(*) FILTER (WHERE codfat ~ '^[0-9]+$') as codfat_validos,
       COUNT(*) FILTER (WHERE nroform IS NULL OR nroform ~ '^[0-9]+$') as nroform_validos,
       COUNT(*) FILTER (WHERE selo IS NULL OR selo ~ '^[0-9]+$') as selo_validos
FROM db_manaus.dbfatura;
*/
