-- MIGRAÇÃO DE TABELAS DE IMPOSTOS
-- Gerado em: 2026-01-10T01:05:43.723Z
-- Oracle -> PostgreSQL


-- Tabela: CAD_LEGISLACAO_ICMSST
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


-- Tabela: CAD_LEGISLACAO_ICMSST_NCM
CREATE TABLE IF NOT EXISTS cad_legislacao_icmsst_ncm (
  lin_id NUMERIC NOT NULL,
  lin_lei_id NUMERIC NOT NULL,
  lin_ncm VARCHAR(9) NOT NULL,
  lin_status VARCHAR(10) NOT NULL,
  lin_mva_st_original NUMERIC(6, 3),
  lin_cest VARCHAR(8),
  PRIMARY KEY (lin_id)
);


-- Tabela: FIS_TRIBUTO_ALIQUOTA
CREATE TABLE IF NOT EXISTS fis_tributo_aliquota (
  codigo VARCHAR(4),
  n_ne_co NUMERIC,
  s_se NUMERIC,
  importado NUMERIC
);


-- Tabela: DBCEST
CREATE TABLE IF NOT EXISTS dbcest (
  cest VARCHAR(7) NOT NULL,
  ncm VARCHAR(8),
  segmento VARCHAR(100),
  descricao VARCHAR(1000)
);

