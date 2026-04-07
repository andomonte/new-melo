-- Script COMPLETO para corrigir valores totais das ordens de compra
-- Calcula somando itens de AMBAS as tabelas: cmp_requisicao_item E cmp_it_requisicao

BEGIN;

-- Atualizar os valores totais usando AMBAS as fontes de itens
UPDATE db_manaus.cmp_ordem_compra orc
SET orc_valor_total = COALESCE(
    -- Primeiro tenta somar de cmp_requisicao_item (preco_total direto)
    (
        SELECT SUM(ri.preco_total)
        FROM db_manaus.cmp_requisicao_item ri
        WHERE ri.req_id = orc.orc_req_id
          AND ri.req_versao = orc.orc_req_versao
    ),
    -- Se não tiver, tenta calcular de cmp_it_requisicao (preco * qtd)
    (
        SELECT SUM(itr.itr_pr_unitario * itr.itr_quantidade)
        FROM db_manaus.cmp_it_requisicao itr
        WHERE itr.itr_req_id = orc.orc_req_id
          AND itr.itr_req_versao = orc.orc_req_versao
    ),
    0
)
WHERE orc.orc_req_id IS NOT NULL;

-- Verificar os resultados
SELECT
    'DEPOIS' as momento,
    COUNT(*) as total_ordens,
    COUNT(CASE WHEN orc_valor_total IS NULL OR orc_valor_total = 0 THEN 1 END) as ordens_sem_valor,
    COUNT(CASE WHEN orc_valor_total > 0 THEN 1 END) as ordens_com_valor,
    MIN(orc_valor_total) as menor_valor,
    MAX(orc_valor_total) as maior_valor,
    ROUND(AVG(orc_valor_total)::numeric, 2) as valor_medio
FROM db_manaus.cmp_ordem_compra;

COMMIT;

-- Mostrar as 15 ordens com maiores valores
SELECT
    orc_id,
    orc_req_id,
    orc_valor_total,
    orc_status
FROM db_manaus.cmp_ordem_compra
WHERE orc_valor_total > 0
ORDER BY orc_valor_total DESC
LIMIT 15;
