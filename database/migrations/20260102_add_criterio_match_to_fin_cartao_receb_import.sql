-- Adicionar coluna criterio_match para armazenar qual critério de conciliação foi aplicado
-- Migration: 20260102_add_criterio_match_to_fin_cartao_receb_import

ALTER TABLE db_manaus.fin_cartao_receb_import
ADD COLUMN IF NOT EXISTS criterio_match VARCHAR(50);

COMMENT ON COLUMN db_manaus.fin_cartao_receb_import.criterio_match IS 'Critério de match utilizado na conciliação: CRITERIO_1_DOCUMENTO, CRITERIO_2_NSU_AUTH_OPER, CRITERIO_3_NSU_VALOR, CRITERIO_4_AUTH_VALOR_DATA';

-- Criar índice para consultas por critério
CREATE INDEX IF NOT EXISTS idx_fin_cartao_receb_import_criterio 
ON db_manaus.fin_cartao_receb_import(criterio_match);
