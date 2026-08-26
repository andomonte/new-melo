-- 041_dbprodfat_desconto_acrescimo_scale.sql
--
-- dbprodfat.desconto/acrescimo vieram da migração Oracle como numeric(38,0) (SCALE 0 =
-- inteiro), truncando os centavos do rateio por item (ex.: 9,90 virava 10; 27,38 virava 27).
-- No Oracle são NUMBER(22) e guardam 2 casas (ex.: 6.52, 5.85). Ajusta a escala para 2
-- casas para o rateio de desconto/acréscimo por produto fechar ao centavo.
ALTER TABLE db_manaus.dbprodfat ALTER COLUMN desconto  TYPE numeric(18,2);
ALTER TABLE db_manaus.dbprodfat ALTER COLUMN acrescimo TYPE numeric(18,2);
