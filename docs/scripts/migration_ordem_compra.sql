-- Migration: Adicionar coluna ordem_compra e migrar dados do campo obs
-- Data: 2025-11-18

-- 1. Adicionar coluna ordem_compra na tabela dbpgto
ALTER TABLE db_manaus.dbpgto 
ADD COLUMN IF NOT EXISTS ordem_compra VARCHAR(50);

-- 2. Migrar dados: extrair ordem de compra do campo obs
-- Padrão: "Pagamento ref. Ordem de Compra #10014 - Parcela 3/3 - BOLETO"
-- Extrai tudo que vem depois do # até o próximo espaço ou traço
UPDATE db_manaus.dbpgto
SET ordem_compra = TRIM(
  SUBSTRING(
    obs FROM '#([0-9]+)'
  )
)
WHERE obs LIKE '%Ordem de Compra #%'
  AND (ordem_compra IS NULL OR ordem_compra = '');

-- 3. Verificar resultados
SELECT 
  cod_pgto,
  obs,
  ordem_compra,
  CASE 
    WHEN ordem_compra IS NOT NULL THEN 'Migrado'
    WHEN obs LIKE '%Ordem de Compra #%' THEN 'Padrão não encontrado'
    ELSE 'Sem ordem de compra'
  END as status_migracao
FROM db_manaus.dbpgto
WHERE obs LIKE '%Ordem de Compra #%'
ORDER BY cod_pgto DESC
LIMIT 20;

-- 4. Estatísticas da migração
SELECT 
  COUNT(*) as total_registros,
  COUNT(ordem_compra) as com_ordem_compra,
  COUNT(*) - COUNT(ordem_compra) as sem_ordem_compra,
  COUNT(CASE WHEN obs LIKE '%Ordem de Compra #%' THEN 1 END) as obs_com_padrao
FROM db_manaus.dbpgto;
