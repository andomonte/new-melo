CREATE TABLE IF NOT EXISTS cad_legislacao_icmsst (
  lei_id NUMERIC NOT NULL,
  lei_protocolo NUMERIC NOT NULL,
  lei_data_cadastro TIMESTAMP NOT NULL,
  lei_status VARCHAR(20) NOT NULL,
  lei_data_vigencia TIMESTAMP NOT NULL,
  lei_data_publicacao TIMESTAMP NOT NULL,
  lei_mva_ajustada VARCHAR(100) NOT NULL,
  lei_tipo VARCHAR(20),
  PRIMARY KEY (lei_id)
);