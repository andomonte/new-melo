-- Script para corrigir valores totais das ordens de compra
-- Calcula o total somando os itens da requisição relacionada

-- Primeiro, vamos ver quantas ordens têm valor NULL ou 0
SELECT
    COUNT(*) as total_ordens,
    COUNT(CASE WHEN orc_valor_total IS NULL OR orc_valor_total = 0 THEN 1 END) as ordens_sem_valor,
    COUNT(CASE WHEN orc_valor_total > 0 THEN 1 END) as ordens_com_valor
FROM db_manaus.cmp_ordem_compra;

-- Atualizar os valores totais de TODAS as ordens baseado nos itens da requisição
UPDATE db_manaus.cmp_ordem_compra orc
SET orc_valor_total = (
    SELECT COALESCE(SUM(ri.preco_total), 0)
    FROM db_manaus.cmp_requisicao_item ri
    WHERE ri.req_id = orc.orc_req_id
      AND ri.req_versao = orc.orc_req_versao
)
WHERE orc.orc_req_id IS NOT NULL;

-- Verificar os resultados após a atualização
SELECT
    COUNT(*) as total_ordens,
    COUNT(CASE WHEN orc_valor_total IS NULL OR orc_valor_total = 0 THEN 1 END) as ordens_sem_valor,
    COUNT(CASE WHEN orc_valor_total > 0 THEN 1 END) as ordens_com_valor,
    MIN(orc_valor_total) as menor_valor,
    MAX(orc_valor_total) as maior_valor,
    AVG(orc_valor_total) as valor_medio
FROM db_manaus.cmp_ordem_compra;

-- Mostrar algumas ordens atualizadas
SELECT
    orc_id,
    orc_req_id,
    orc_valor_total,
    orc_fornecedor_cod
FROM db_manaus.cmp_ordem_compra
ORDER BY orc_id DESC
LIMIT 10;
