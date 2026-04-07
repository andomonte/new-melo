-- ============================================================================
-- Tabela de Transição IBS/CBS (LC 214/2025 - Reforma Tributária 2026)
-- ============================================================================
-- Este script cria as tabelas necessárias para o novo sistema tributário
-- IBS (Imposto sobre Bens e Serviços) e CBS (Contribuição sobre Bens e Serviços)
-- que substituirão ICMS, ISS, PIS, COFINS e IPI

-- 1) Tabela de alíquotas de transição por ano
CREATE TABLE IF NOT EXISTS ibs_cbs_transicao (
    id SERIAL PRIMARY KEY,
    ano INTEGER NOT NULL UNIQUE,
    aliquota_cbs DECIMAL(5,2) NOT NULL,
    aliquota_ibs DECIMAL(5,2) NOT NULL,
    icms_residual INTEGER NOT NULL DEFAULT 100, -- % do ICMS que ainda se aplica
    iss_residual INTEGER NOT NULL DEFAULT 100,  -- % do ISS que ainda se aplica
    fase_teste BOOLEAN NOT NULL DEFAULT FALSE,
    observacao VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir dados da transição (2026-2033)
INSERT INTO ibs_cbs_transicao (ano, aliquota_cbs, aliquota_ibs, icms_residual, iss_residual, fase_teste, observacao)
VALUES
    (2026, 0.9,  0.1,  100, 100, TRUE,  'Fase teste - apenas informativo'),
    (2027, 0.9,  0.1,  100, 100, FALSE, 'CBS começa a valer'),
    (2028, 0.9,  0.1,  100, 100, FALSE, 'Preparação para IBS'),
    (2029, 3.8,  7.8,  90,  90,  FALSE, 'IBS inicia transição'),
    (2030, 5.5,  11.2, 70,  70,  FALSE, 'Transição progressiva'),
    (2031, 7.1,  14.6, 50,  50,  FALSE, 'Transição progressiva'),
    (2032, 8.5,  17.5, 30,  30,  FALSE, 'Última fase de transição'),
    (2033, 9.3,  18.7, 0,   0,   FALSE, 'Sistema completo')
ON CONFLICT (ano) DO UPDATE SET
    aliquota_cbs = EXCLUDED.aliquota_cbs,
    aliquota_ibs = EXCLUDED.aliquota_ibs,
    icms_residual = EXCLUDED.icms_residual,
    iss_residual = EXCLUDED.iss_residual,
    fase_teste = EXCLUDED.fase_teste,
    observacao = EXCLUDED.observacao,
    updated_at = CURRENT_TIMESTAMP;

-- 2) Tabela de municípios ZFM (Zona Franca de Manaus)
CREATE TABLE IF NOT EXISTS ibs_cbs_zfm (
    id SERIAL PRIMARY KEY,
    cod_ibge VARCHAR(7) NOT NULL UNIQUE,
    municipio VARCHAR(100) NOT NULL,
    uf VARCHAR(2) NOT NULL DEFAULT 'AM',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ibs_cbs_zfm (cod_ibge, municipio, uf)
VALUES
    ('1302603', 'MANAUS', 'AM'),
    ('1303569', 'RIO PRETO DA EVA', 'AM'),
    ('1303536', 'PRESIDENTE FIGUEIREDO', 'AM')
ON CONFLICT (cod_ibge) DO NOTHING;

-- 3) Tabela de municípios ALC (Áreas de Livre Comércio)
CREATE TABLE IF NOT EXISTS ibs_cbs_alc (
    id SERIAL PRIMARY KEY,
    cod_ibge VARCHAR(7) NOT NULL UNIQUE,
    municipio VARCHAR(100) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ibs_cbs_alc (cod_ibge, municipio, uf)
VALUES
    -- Acre
    ('1200104', 'BRASILEIA', 'AC'),
    ('1200252', 'EPITACIOLANDIA', 'AC'),
    ('1200203', 'CRUZEIRO DO SUL', 'AC'),
    -- Amazonas
    ('1304062', 'TABATINGA', 'AM'),
    -- Rondônia
    ('1100106', 'GUAJARA-MIRIM', 'RO'),
    -- Roraima
    ('1400100', 'BOA VISTA', 'RR'),
    ('1400159', 'BONFIM', 'RR'),
    -- Amapá
    ('1600303', 'MACAPA', 'AP'),
    ('1600600', 'SANTANA', 'AP')
ON CONFLICT (cod_ibge) DO NOTHING;

-- 4) Tabela de créditos presumidos
CREATE TABLE IF NOT EXISTS ibs_cbs_credito_presumido (
    id SERIAL PRIMARY KEY,
    uf VARCHAR(2) NOT NULL,
    regiao VARCHAR(50) NOT NULL,
    percentual_ibs DECIMAL(5,2) NOT NULL,
    descricao VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sul e Sudeste (exceto ES) - 7.5%
INSERT INTO ibs_cbs_credito_presumido (uf, regiao, percentual_ibs, descricao)
VALUES
    ('SP', 'SUDESTE', 7.5, 'Bens das regiões Sul e Sudeste (exceto ES)'),
    ('RJ', 'SUDESTE', 7.5, 'Bens das regiões Sul e Sudeste (exceto ES)'),
    ('MG', 'SUDESTE', 7.5, 'Bens das regiões Sul e Sudeste (exceto ES)'),
    ('PR', 'SUL', 7.5, 'Bens das regiões Sul e Sudeste (exceto ES)'),
    ('SC', 'SUL', 7.5, 'Bens das regiões Sul e Sudeste (exceto ES)'),
    ('RS', 'SUL', 7.5, 'Bens das regiões Sul e Sudeste (exceto ES)')
ON CONFLICT DO NOTHING;

-- Norte, Nordeste, Centro-Oeste e ES - 13.5%
INSERT INTO ibs_cbs_credito_presumido (uf, regiao, percentual_ibs, descricao)
VALUES
    -- Norte
    ('AC', 'NORTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('AM', 'NORTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('AP', 'NORTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('PA', 'NORTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('RO', 'NORTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('RR', 'NORTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('TO', 'NORTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    -- Nordeste
    ('AL', 'NORDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('BA', 'NORDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('CE', 'NORDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('MA', 'NORDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('PB', 'NORDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('PE', 'NORDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('PI', 'NORDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('RN', 'NORDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('SE', 'NORDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    -- Centro-Oeste
    ('DF', 'CENTRO-OESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('GO', 'CENTRO-OESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('MT', 'CENTRO-OESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    ('MS', 'CENTRO-OESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES'),
    -- Sudeste (apenas ES)
    ('ES', 'SUDESTE', 13.5, 'Bens das regiões Norte, Nordeste, Centro-Oeste e ES')
ON CONFLICT DO NOTHING;

-- 5) Tabela de categorias de alíquota
CREATE TABLE IF NOT EXISTS ibs_cbs_categoria (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    multiplicador DECIMAL(3,2) NOT NULL,
    descricao VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ibs_cbs_categoria (codigo, multiplicador, descricao)
VALUES
    ('PADRAO', 1.00, 'Alíquota padrão'),
    ('REDUZIDA_50', 0.50, '50% da alíquota padrão'),
    ('REDUZIDA_60', 0.60, '60% da alíquota padrão'),
    ('REDUZIDA_30', 0.30, '30% da alíquota padrão'),
    ('ZERO', 0.00, 'Alíquota zero'),
    ('ZERO_ZFM', 0.00, 'Isento - Zona Franca de Manaus'),
    ('ZERO_ALC', 0.00, 'Isento - Área de Livre Comércio'),
    ('ZERO_EXPORTACAO', 0.00, 'Isento - Exportação'),
    ('TRIBUTACAO_70', 0.70, '70% da alíquota (entrada ZFM não industrial)'),
    ('ESPECIFICA', 1.00, 'Regime específico setorial')
ON CONFLICT (codigo) DO UPDATE SET
    multiplicador = EXCLUDED.multiplicador,
    descricao = EXCLUDED.descricao;

-- 6) Tabela de CST IBS/CBS
CREATE TABLE IF NOT EXISTS ibs_cbs_cst (
    id SERIAL PRIMARY KEY,
    cst VARCHAR(3) NOT NULL UNIQUE,
    descricao VARCHAR(255) NOT NULL,
    cclasstrib VARCHAR(10),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ibs_cbs_cst (cst, descricao, cclasstrib)
VALUES
    ('000', 'Tributação normal', '000001'),
    ('200', 'Operação com suspensão', '200022'),
    ('410', 'Não incidência', '410001'),
    ('500', 'Imunidade', '500001'),
    ('900', 'Outros', '900001')
ON CONFLICT (cst) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    cclasstrib = EXCLUDED.cclasstrib;

-- 7) Função para buscar alíquotas do ano
CREATE OR REPLACE FUNCTION buscar_aliquota_ibs_cbs(p_ano INTEGER)
RETURNS TABLE(
    ano INTEGER,
    aliquota_cbs DECIMAL,
    aliquota_ibs DECIMAL,
    aliquota_total DECIMAL,
    icms_residual INTEGER,
    iss_residual INTEGER,
    fase_teste BOOLEAN,
    observacao VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.ano,
        t.aliquota_cbs,
        t.aliquota_ibs,
        t.aliquota_cbs + t.aliquota_ibs AS aliquota_total,
        t.icms_residual,
        t.iss_residual,
        t.fase_teste,
        t.observacao
    FROM ibs_cbs_transicao t
    WHERE t.ano = p_ano;

    -- Se não encontrar, retornar o mais recente disponível
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            t.ano,
            t.aliquota_cbs,
            t.aliquota_ibs,
            t.aliquota_cbs + t.aliquota_ibs AS aliquota_total,
            t.icms_residual,
            t.iss_residual,
            t.fase_teste,
            t.observacao
        FROM ibs_cbs_transicao t
        WHERE t.ano <= p_ano
        ORDER BY t.ano DESC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 8) Função para verificar se município está na ZFM
CREATE OR REPLACE FUNCTION is_municipio_zfm(p_cod_ibge VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM ibs_cbs_zfm
        WHERE cod_ibge = p_cod_ibge AND ativo = TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- 9) Função para verificar se município está em ALC
CREATE OR REPLACE FUNCTION is_municipio_alc(p_cod_ibge VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM ibs_cbs_alc
        WHERE cod_ibge = p_cod_ibge AND ativo = TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- 10) Função para buscar crédito presumido por UF
CREATE OR REPLACE FUNCTION buscar_credito_presumido(p_uf VARCHAR)
RETURNS TABLE(
    uf VARCHAR,
    regiao VARCHAR,
    percentual_ibs DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cp.uf,
        cp.regiao,
        cp.percentual_ibs
    FROM ibs_cbs_credito_presumido cp
    WHERE cp.uf = UPPER(p_uf) AND cp.ativo = TRUE
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE ibs_cbs_transicao IS 'Alíquotas de transição IBS/CBS (2026-2033) conforme LC 214/2025';
COMMENT ON TABLE ibs_cbs_zfm IS 'Municípios da Zona Franca de Manaus com direito a alíquota zero';
COMMENT ON TABLE ibs_cbs_alc IS 'Municípios das Áreas de Livre Comércio com direito a alíquota zero';
COMMENT ON TABLE ibs_cbs_credito_presumido IS 'Créditos presumidos por UF para operações com ZFM';
COMMENT ON TABLE ibs_cbs_categoria IS 'Categorias de alíquota (padrão, reduzida, zero, etc.)';
COMMENT ON TABLE ibs_cbs_cst IS 'Códigos de Situação Tributária para IBS/CBS';
