-- Script para deletar o fornecedor de teste que está bloqueando novos cadastros
-- ATENÇÃO: Execute apenas se tiver certeza que esse fornecedor é apenas um teste!

BEGIN;

-- Verificar o fornecedor antes de deletar
SELECT 
    cod_credor, 
    nome, 
    cpf_cgc,
    data_cad
FROM db_manaus.dbcredor 
WHERE cod_credor = '99999';

-- Se confirmar que é teste, descomente a linha abaixo:
-- DELETE FROM db_manaus.dbcredor WHERE cod_credor = '99999';

-- COMMIT; -- Descomente para efetivar a exclusão
ROLLBACK; -- Manter isso para não deletar acidentalmente
