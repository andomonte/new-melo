-- Atualizar ordens existentes com observações das requisições
-- Similar ao que fizemos com locais e previsão de chegada

BEGIN;

-- Atualizar orc_observacao com dados da requisição
UPDATE db_manaus.cmp_ordem_compra orc
SET orc_observacao = r.req_observacao
FROM db_manaus.cmp_requisicao r
WHERE orc.orc_req_id = r.req_id
  AND orc.orc_req_versao = r.req_versao
  AND (orc.orc_observacao IS NULL OR orc.orc_observacao = '');

-- Verificar quantas ordens foram atualizadas
SELECT
    COUNT(*) as total_ordens_atualizadas,
    COUNT(CASE WHEN orc_observacao IS NOT NULL AND orc_observacao != '' THEN 1 END) as ordens_com_observacao
FROM db_manaus.cmp_ordem_compra;

COMMIT;
