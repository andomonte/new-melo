CREATE TABLE IF NOT EXISTS cad_legislacao_icmsst_ncm (
  lin_id NUMERIC NOT NULL,
  lin_lei_id NUMERIC NOT NULL,
  lin_ncm VARCHAR(9) NOT NULL,
  lin_status VARCHAR(10) NOT NULL,
  lin_mva_st_original NUMERIC(6, 3),
  lin_cest VARCHAR(8),
  PRIMARY KEY (lin_id)
);