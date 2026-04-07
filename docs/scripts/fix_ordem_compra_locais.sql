-- Script para copiar previsão de chegada e locais de entrega/destino das requisições para as ordens de compra
-- Similar ao que fizemos com os valores totais

BEGIN;

-- Atualizar previsão de chegada, local de entrega e destino
UPDATE db_manaus.cmp_ordem_compra orc
SET
    orc_previsao_chegada = r.req_previsao_chegada,
    orc_unm_id_entrega = r.req_unm_id_entrega,
    orc_unm_id_destino = r.req_unm_id_destino
FROM db_manaus.cmp_requisicao r
WHERE orc.orc_req_id = r.req_id
  AND orc.orc_req_versao = r.req_versao;

-- Verificar resultados
SELECT
    'DEPOIS' as momento,
    COUNT(*) as total_ordens,
    COUNT(CASE WHEN orc_previsao_chegada IS NOT NULL THEN 1 END) as ordens_com_previsao,
    COUNT(CASE WHEN orc_unm_id_entrega IS NOT NULL THEN 1 END) as ordens_com_local_entrega,
    COUNT(CASE WHEN orc_unm_id_destino IS NOT NULL THEN 1 END) as ordens_com_local_destino
FROM db_manaus.cmp_ordem_compra;

COMMIT;

-- Mostrar algumas ordens atualizadas
SELECT
    orc_id,
    orc_req_id,
    orc_previsao_chegada,
    orc_unm_id_entrega,
    orc_unm_id_destino
FROM db_manaus.cmp_ordem_compra
WHERE orc_previsao_chegada IS NOT NULL
ORDER BY orc_id DESC
LIMIT 10;
