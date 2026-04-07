-- ================================================================================
-- ÍNDICES PARA TABELAS DE IMPOSTOS
-- Gerado em: 2026-01-09
-- Otimização de consultas para cálculo de ST
-- ================================================================================

-- Tabela: CAD_LEGISLACAO_ICMSST
-- Protocolos e legislação ICMS-ST
CREATE INDEX IF NOT EXISTS idx_legislacao_icmsst_protocolo ON cad_legislacao_icmsst("LEI_PROTOCOLO");
CREATE INDEX IF NOT EXISTS idx_legislacao_icmsst_status ON cad_legislacao_icmsst("LEI_STATUS");

-- Tabela: CAD_LEGISLACAO_ICMSST_NCM (CRÍTICO para cálculo de ST)
-- Relaciona NCM x Protocolo x MVA
CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_ncm ON cad_legislacao_icmsst_ncm("LIN_NCM");
CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_lei_id ON cad_legislacao_icmsst_ncm("LIN_LEI_ID");
CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_ncm_lei ON cad_legislacao_icmsst_ncm("LIN_NCM", "LIN_LEI_ID");
CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_status ON cad_legislacao_icmsst_ncm("LIN_STATUS");
CREATE INDEX IF NOT EXISTS idx_legislacao_ncm_cest ON cad_legislacao_icmsst_ncm("LIN_CEST");

-- Tabela: FIS_TRIBUTO_ALIQUOTA
-- Alíquotas específicas por exceção
CREATE INDEX IF NOT EXISTS idx_tributo_aliquota_codigo ON fis_tributo_aliquota(codigo);

-- Tabela: DBCEST
-- Código CEST para ST
CREATE INDEX IF NOT EXISTS idx_dbcest_cest ON dbcest(cest);
CREATE INDEX IF NOT EXISTS idx_dbcest_ncm ON dbcest(ncm);
CREATE INDEX IF NOT EXISTS idx_dbcest_segmento ON dbcest(segmento);
