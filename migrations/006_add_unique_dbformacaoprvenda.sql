-- Adiciona unique constraint em (CODPROD, TIPOPRECO) na DBFORMACAOPRVENDA
-- Necessário para o ON CONFLICT funcionar corretamente no upsert

ALTER TABLE db_manaus."DBFORMACAOPRVENDA"
  ADD CONSTRAINT dbformacaoprvenda_codprod_tipopreco_uk
  UNIQUE ("CODPROD", "TIPOPRECO");
