-- ================================================================================
-- SCHEMA COMPLETO - TABELAS DE IMPOSTOS
-- Migração Oracle → PostgreSQL
-- Data: 2026-01-09
-- ================================================================================

-- ================================================================================
-- 1. CAD_LEGISLACAO_ICMSST (16 registros)
-- Protocolos ICMS-ST (41, 49, 129, etc.)
-- ================================================================================
CREATE TABLE IF NOT EXISTS cad_legislacao_icmsst (
  "LEI_ID" NUMERIC NOT NULL,
  "LEI_PROTOCOLO" NUMERIC NOT NULL,
  "LEI_DATA_CADASTRO" TIMESTAMP NOT NULL,
  "LEI_STATUS" VARCHAR(20) NOT NULL,
  "LEI_DATA_VIGENCIA" TIMESTAMP NOT NULL,
  "LEI_DATA_PUBLICACAO" TIMESTAMP NOT NULL,
  "LEI_MVA_AJUSTADA" VARCHAR(100) NOT NULL,
  "LEI_TIPO" VARCHAR(20),
  PRIMARY KEY ("LEI_ID")
);

COMMENT ON TABLE cad_legislacao_icmsst IS 'Legislação e protocolos ICMS-ST';
COMMENT ON COLUMN cad_legislacao_icmsst."LEI_ID" IS 'ID único da legislação';
COMMENT ON COLUMN cad_legislacao_icmsst."LEI_PROTOCOLO" IS 'Número do protocolo (ex: 41, 129, 1785)';
COMMENT ON COLUMN cad_legislacao_icmsst."LEI_MVA_AJUSTADA" IS 'Fórmula de cálculo da MVA ajustada';
COMMENT ON COLUMN cad_legislacao_icmsst."LEI_STATUS" IS 'Status: EM VIGOR, REVOGADO';

-- ================================================================================
-- 2. CAD_LEGISLACAO_ICMSST_NCM (1.823 registros) - TABELA CRÍTICA
-- Relaciona NCM x Protocolo x MVA - ESSENCIAL para cálculo de ST
-- ================================================================================
CREATE TABLE IF NOT EXISTS cad_legislacao_icmsst_ncm (
  "LIN_ID" NUMERIC NOT NULL,
  "LIN_LEI_ID" NUMERIC NOT NULL,
  "LIN_NCM" VARCHAR(9) NOT NULL,
  "LIN_STATUS" VARCHAR(10) NOT NULL,
  "LIN_MVA_ST_ORIGINAL" NUMERIC(6, 3),
  "LIN_CEST" VARCHAR(8),
  PRIMARY KEY ("LIN_ID")
);

-- Foreign Key
ALTER TABLE cad_legislacao_icmsst_ncm
ADD CONSTRAINT fk_legislacao_ncm_lei
FOREIGN KEY ("LIN_LEI_ID")
REFERENCES cad_legislacao_icmsst("LEI_ID")
ON DELETE CASCADE;

COMMENT ON TABLE cad_legislacao_icmsst_ncm IS 'NCMs sujeitos a ST por protocolo - TABELA CRÍTICA';
COMMENT ON COLUMN cad_legislacao_icmsst_ncm."LIN_NCM" IS 'Código NCM (8 dígitos)';
COMMENT ON COLUMN cad_legislacao_icmsst_ncm."LIN_MVA_ST_ORIGINAL" IS 'MVA original em % (ex: 71.78)';
COMMENT ON COLUMN cad_legislacao_icmsst_ncm."LIN_CEST" IS 'Código CEST quando aplicável';

-- ================================================================================
-- 3. FIS_TRIBUTO_ALIQUOTA (249 registros)
-- Alíquotas específicas por exceção fiscal
-- ================================================================================
CREATE TABLE IF NOT EXISTS fis_tributo_aliquota (
  codigo VARCHAR(4),
  n_ne_co NUMERIC,
  s_se NUMERIC,
  importado NUMERIC
);

COMMENT ON TABLE fis_tributo_aliquota IS 'Alíquotas específicas por código de exceção';
COMMENT ON COLUMN fis_tributo_aliquota.codigo IS 'Código da exceção (ex: A001, A002)';
COMMENT ON COLUMN fis_tributo_aliquota.n_ne_co IS 'Alíquota Norte/Nordeste/Centro-Oeste';
COMMENT ON COLUMN fis_tributo_aliquota.s_se IS 'Alíquota Sul/Sudeste';
COMMENT ON COLUMN fis_tributo_aliquota.importado IS 'Alíquota para produtos importados';

-- ================================================================================
-- 4. DBCEST (1.119 registros)
-- Código CEST para ST
-- ================================================================================
CREATE TABLE IF NOT EXISTS dbcest (
  id SERIAL PRIMARY KEY,
  cest VARCHAR(7) NOT NULL,
  ncm VARCHAR(8),
  segmento VARCHAR(100),
  descricao VARCHAR(1000)
);

COMMENT ON TABLE dbcest IS 'Código Especificador da Substituição Tributária';
COMMENT ON COLUMN dbcest.cest IS 'Código CEST (7 dígitos)';
COMMENT ON COLUMN dbcest.ncm IS 'NCM relacionado';
COMMENT ON COLUMN dbcest.segmento IS 'Segmento (ex: AUTOPEÇAS)';

-- ================================================================================
-- ÍNDICES PARA OTIMIZAÇÃO
-- ================================================================================

-- CAD_LEGISLACAO_ICMSST
CREATE INDEX IF NOT EXISTS idx_legislacao_icmsst_protocolo
  ON cad_legislacao_icmsst("LEI_PROTOCOLO");

CREATE INDEX IF NOT EXISTS idx_legislacao_icmsst_status
  ON cad_legislacao_icmsst("LEI_STATUS");

-- CAD_LEGISLACAO_ICMSST_NCM (CRÍTICO)
CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_ncm
  ON cad_legislacao_icmsst_ncm("LIN_NCM");

CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_lei_id
  ON cad_legislacao_icmsst_ncm("LIN_LEI_ID");

CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_ncm_lei
  ON cad_legislacao_icmsst_ncm("LIN_NCM", "LIN_LEI_ID");

CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_status
  ON cad_legislacao_icmsst_ncm("LIN_STATUS");

CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_cest
  ON cad_legislacao_icmsst_ncm("LIN_CEST");

-- FIS_TRIBUTO_ALIQUOTA
CREATE INDEX IF NOT EXISTS idx_tributo_aliquota_codigo
  ON fis_tributo_aliquota(codigo);

-- DBCEST
CREATE INDEX IF NOT EXISTS idx_dbcest_cest
  ON dbcest(cest);

CREATE INDEX IF NOT EXISTS idx_dbcest_ncm
  ON dbcest(ncm);

CREATE INDEX IF NOT EXISTS idx_dbcest_segmento
  ON dbcest(segmento);

-- ================================================================================
-- QUERY EXEMPLO: Buscar MVA por NCM
-- ================================================================================
/*
SELECT
  l."LEI_PROTOCOLO",
  l."LEI_TIPO",
  l."LEI_MVA_AJUSTADA",
  ln."LIN_NCM",
  ln."LIN_MVA_ST_ORIGINAL",
  ln."LIN_CEST",
  c.descricao AS cest_descricao
FROM cad_legislacao_icmsst_ncm ln
INNER JOIN cad_legislacao_icmsst l
  ON l."LEI_ID" = ln."LIN_LEI_ID"
LEFT JOIN dbcest c
  ON c.cest = ln."LIN_CEST"
WHERE ln."LIN_NCM" LIKE '8421%'
  AND ln."LIN_STATUS" = 'REGRA'
  AND l."LEI_STATUS" = 'EM VIGOR'
ORDER BY ln."LIN_NCM";
*/

-- ================================================================================
-- FIM DO SCHEMA
-- ================================================================================
