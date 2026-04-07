-- ============================================================================
-- INFRAESTRUTURA SQL PARA CÁLCULO DE IMPOSTOS - PostgreSQL
-- ============================================================================
-- Banco: PostgreSQL
-- Schema: db_manaus
-- Data: 2026-01-09
-- Descrição: Views e functions para cálculo de impostos (ICMS-ST, IBS, CBS, CFOP, CST)
-- ============================================================================

SET search_path TO db_manaus;

-- ============================================================================
-- 1. VIEW: v_mva_ncm_uf_completa
-- ============================================================================
-- Descrição: Retorna MVA (Margem de Valor Agregado) baseado em NCM e UF
-- Uso: Consultar MVA para cálculo de ICMS-ST
-- Performance: Indexada por NCM e UF (< 10ms esperado)
-- ============================================================================

-- Dropar VIEW antiga se existir (para recriar com estrutura melhorada)
DROP VIEW IF EXISTS db_manaus.v_mva_ncm_uf_completa CASCADE;

CREATE OR REPLACE VIEW db_manaus.v_mva_ncm_uf_completa AS
WITH
-- Dados da legislação ICMS-ST
lei AS (
  SELECT
    l."LEI_ID" AS lei_id,
    l."LEI_PROTOCOLO" AS protocolo,
    l."LEI_STATUS" AS status,
    l."LEI_DATA_VIGENCIA" AS vigencia_inicio,
    l."LEI_MVA_AJUSTADA" AS formula_mva_ajustada,
    l."LEI_TIPO" AS tipo_legislacao
  FROM db_manaus.cad_legislacao_icmsst l
),
-- NCMs e MVAs originais
ncm AS (
  SELECT
    ln."LIN_LEI_ID" AS lei_id,
    SUBSTRING(regexp_replace(ln."LIN_NCM"::text, '[^0-9]'::text, ''::text, 'g') FROM 1 FOR 8) AS ncm,
    ln."LIN_NCM" AS ncm_original,
    COALESCE(ln."LIN_MVA_ST_ORIGINAL", 0) AS mva_original,
    ln."LIN_CEST" AS cest,
    ln."LIN_STATUS" AS status_ncm
  FROM db_manaus.cad_legislacao_icmsst_ncm ln
  WHERE ln."LIN_STATUS" = 'REGRA'
),
-- UFs signatárias do protocolo
uf_signatario AS (
  SELECT
    s."LES_LEI_ID" AS lei_id,
    UPPER(TRIM(s."LES_UF")) AS uf_destino,
    s."LES_MVA_ST_ORIGINAL" AS mva_uf_especifico
  FROM db_manaus.cad_legislacao_signatario s
)
SELECT
  n.ncm,
  n.ncm_original,
  u.uf_destino,
  'AM' AS uf_origem,  -- Assumindo origem sempre AM (Manaus)
  l.protocolo,
  -- MVA: prioriza MVA específico da UF, senão usa MVA do NCM
  COALESCE(u.mva_uf_especifico, n.mva_original) AS mva_original,
  l.formula_mva_ajustada AS formula_ajuste,
  n.cest,
  l.status,
  l.vigencia_inicio,
  l.tipo_legislacao,
  -- Flag indicando se MVA é específico da UF ou genérico
  CASE
    WHEN u.mva_uf_especifico IS NOT NULL THEN 'ESPECIFICO_UF'
    ELSE 'PADRAO_NCM'
  END AS tipo_mva
FROM ncm n
  JOIN uf_signatario u ON u.lei_id = n.lei_id
  JOIN lei l ON l.lei_id = n.lei_id
WHERE l.status = 'EM VIGOR'
  AND n.status_ncm = 'REGRA'
ORDER BY n.ncm, u.uf_destino, l.vigencia_inicio DESC;

COMMENT ON VIEW db_manaus.v_mva_ncm_uf_completa IS
'View para buscar MVA (Margem de Valor Agregado) por NCM e UF de destino.
Retorna MVA original, fórmula de ajuste e protocolo ICMS aplicável.
Uso: SELECT * FROM v_mva_ncm_uf_completa WHERE ncm = ''84213920'' AND uf_destino = ''SP'';';


-- ============================================================================
-- 2. FUNCTION: buscar_aliquota_ncm()
-- ============================================================================
-- Descrição: Retorna alíquotas IBS/CBS por NCM (Reforma Tributária 2026)
-- Parâmetros:
--   p_ncm: Código NCM do produto (8 dígitos)
--   p_ano: Ano de referência (default 2026)
-- Retorno: TABLE (aliquota_ibs, aliquota_cbs, categoria)
-- Performance: < 5ms (lookup simples)
-- ============================================================================

DROP FUNCTION IF EXISTS db_manaus.buscar_aliquota_ncm(VARCHAR, INT);

CREATE OR REPLACE FUNCTION db_manaus.buscar_aliquota_ncm(
  p_ncm VARCHAR,
  p_ano INT DEFAULT 2026
)
RETURNS TABLE (
  aliquota_ibs NUMERIC(5,2),
  aliquota_cbs NUMERIC(5,2),
  categoria VARCHAR(50),
  observacao TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Normalizar NCM (remover caracteres não numéricos e pegar 8 dígitos)
  p_ncm := SUBSTRING(regexp_replace(p_ncm, '[^0-9]', '', 'g') FROM 1 FOR 8);

  IF p_ano = 2026 THEN
    -- ========================================================================
    -- REFORMA TRIBUTÁRIA 2026 - FASE PILOTO
    -- ========================================================================
    -- Em 2026: alíquotas TESTE fixas (CBS 0.9%, IBS 0.1%)
    -- Fonte: Lei Complementar nº 214/2026 - Teste em operações selecionadas
    -- IMPORTANTE: Valores apenas informativos, não geram crédito/débito real
    -- ========================================================================
    RETURN QUERY
    SELECT
      0.10::NUMERIC(5,2) AS aliquota_ibs,
      0.90::NUMERIC(5,2) AS aliquota_cbs,
      'TESTE_2026'::VARCHAR(50) AS categoria,
      'Alíquotas teste Reforma Tributária 2026 - Apenas informativo'::TEXT AS observacao;

  ELSIF p_ano >= 2027 THEN
    -- ========================================================================
    -- REFORMA TRIBUTÁRIA 2027+ - ALÍQUOTAS REAIS
    -- ========================================================================
    -- A partir de 2027: buscar alíquotas reais de tabela
    -- TODO: Integrar com tabela fis_tributo_aliquota quando disponível
    -- Estimativa padrão baseada em alíquota de referência (27.7%)
    --   IBS (Estadual/Municipal): ~18.9%
    --   CBS (Federal): ~8.8%
    -- ========================================================================

    -- Verificar se NCM existe na tabela de alíquotas
    -- Por enquanto retornar alíquota padrão estimada
    RETURN QUERY
    SELECT
      18.90::NUMERIC(5,2) AS aliquota_ibs,
      8.80::NUMERIC(5,2) AS aliquota_cbs,
      'PADRAO_ESTIMADO'::VARCHAR(50) AS categoria,
      'Alíquota padrão estimada - Aguardando tabela oficial IBS/CBS'::TEXT AS observacao;

    -- TODO: Implementar busca real quando tabela estiver disponível:
    -- RETURN QUERY
    -- SELECT
    --   t.aliquota_ibs,
    --   t.aliquota_cbs,
    --   t.categoria,
    --   'Alíquota oficial IBS/CBS'::TEXT
    -- FROM db_manaus.tab_aliquota_ibs_cbs t
    -- WHERE t.ncm = p_ncm AND t.vigencia_inicio <= CURRENT_DATE;

  ELSE
    -- Anos anteriores a 2026: não há IBS/CBS
    RETURN QUERY
    SELECT
      0.00::NUMERIC(5,2) AS aliquota_ibs,
      0.00::NUMERIC(5,2) AS aliquota_cbs,
      'NAO_APLICAVEL'::VARCHAR(50) AS categoria,
      'IBS/CBS não aplicável antes de 2026'::TEXT AS observacao;
  END IF;
END;
$$;

COMMENT ON FUNCTION db_manaus.buscar_aliquota_ncm(VARCHAR, INT) IS
'Retorna alíquotas IBS (Imposto sobre Bens e Serviços) e CBS (Contribuição sobre Bens e Serviços)
para NCM específico, considerando ano de vigência da Reforma Tributária.
Exemplo: SELECT * FROM buscar_aliquota_ncm(''84213920'', 2026);';


-- ============================================================================
-- 3. FUNCTION: calcular_cfop()
-- ============================================================================
-- Descrição: Determina CFOP baseado em tipo de operação e UFs
-- Parâmetros:
--   p_tipo_operacao: VENDA | TRANSFERENCIA | BONIFICACAO | DEVOLUCAO
--   p_uf_origem: UF de origem (sigla 2 letras)
--   p_uf_destino: UF de destino (sigla 2 letras)
-- Retorno: VARCHAR(4) - Código CFOP
-- Performance: < 1ms (lógica condicional simples)
-- ============================================================================

DROP FUNCTION IF EXISTS db_manaus.calcular_cfop(VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION db_manaus.calcular_cfop(
  p_tipo_operacao VARCHAR,
  p_uf_origem VARCHAR,
  p_uf_destino VARCHAR
)
RETURNS VARCHAR(4)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cfop VARCHAR(4);
  v_interno BOOLEAN;
BEGIN
  -- Normalizar entradas (uppercase e trim)
  p_tipo_operacao := UPPER(TRIM(p_tipo_operacao));
  p_uf_origem := UPPER(TRIM(p_uf_origem));
  p_uf_destino := UPPER(TRIM(p_uf_destino));

  -- Determinar se é operação interna (mesma UF)
  v_interno := (p_uf_origem = p_uf_destino);

  -- Aplicar regras de CFOP
  CASE p_tipo_operacao
    -- VENDA: 5102 (interna) / 6102 (interestadual)
    WHEN 'VENDA' THEN
      v_cfop := CASE WHEN v_interno THEN '5102' ELSE '6102' END;

    -- TRANSFERÊNCIA: 5152 (interna) / 6152 (interestadual)
    WHEN 'TRANSFERENCIA', 'TRANSFERÊNCIA' THEN
      v_cfop := CASE WHEN v_interno THEN '5152' ELSE '6152' END;

    -- BONIFICAÇÃO: 5910 (interna) / 6910 (interestadual)
    WHEN 'BONIFICACAO', 'BONIFICAÇÃO' THEN
      v_cfop := CASE WHEN v_interno THEN '5910' ELSE '6910' END;

    -- DEVOLUÇÃO: 5202 (interna) / 6202 (interestadual)
    WHEN 'DEVOLUCAO', 'DEVOLUÇÃO' THEN
      v_cfop := CASE WHEN v_interno THEN '5202' ELSE '6202' END;

    -- REMESSA PARA DEMONSTRAÇÃO: 5912 (interna) / 6912 (interestadual)
    WHEN 'DEMONSTRACAO', 'DEMONSTRAÇÃO', 'REMESSA_DEMONSTRACAO' THEN
      v_cfop := CASE WHEN v_interno THEN '5912' ELSE '6912' END;

    -- VENDA PARA ENTREGA FUTURA: 5116 (interna) / 6116 (interestadual)
    WHEN 'VENDA_FUTURA', 'ENTREGA_FUTURA' THEN
      v_cfop := CASE WHEN v_interno THEN '5116' ELSE '6116' END;

    -- REMESSA PARA CONSERTO: 5915 (interna) / 6915 (interestadual)
    WHEN 'CONSERTO', 'REMESSA_CONSERTO' THEN
      v_cfop := CASE WHEN v_interno THEN '5915' ELSE '6915' END;

    -- DEFAULT: Tratar como VENDA
    ELSE
      v_cfop := CASE WHEN v_interno THEN '5102' ELSE '6102' END;
  END CASE;

  RETURN v_cfop;
END;
$$;

COMMENT ON FUNCTION db_manaus.calcular_cfop(VARCHAR, VARCHAR, VARCHAR) IS
'Determina CFOP (Código Fiscal de Operações e Prestações) baseado no tipo de operação e UFs.
Operações suportadas: VENDA, TRANSFERENCIA, BONIFICACAO, DEVOLUCAO, DEMONSTRACAO, VENDA_FUTURA, CONSERTO.
Exemplo: SELECT calcular_cfop(''VENDA'', ''AM'', ''SP''); -- Retorna 6102';


-- ============================================================================
-- 4. FUNCTION: determinar_cst_icms()
-- ============================================================================
-- Descrição: Determina CST ICMS baseado em situação tributária
-- Parâmetros:
--   p_tem_st: Produto tem Substituição Tributária? (TRUE/FALSE)
--   p_base_reduzida: Tem redução de base de cálculo? (TRUE/FALSE)
--   p_isento: Produto é isento de ICMS? (TRUE/FALSE)
-- Retorno: VARCHAR(2) - Código CST ICMS
-- Performance: < 1ms (lógica condicional simples)
-- ============================================================================

DROP FUNCTION IF EXISTS db_manaus.determinar_cst_icms(BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION db_manaus.determinar_cst_icms(
  p_tem_st BOOLEAN DEFAULT FALSE,
  p_base_reduzida BOOLEAN DEFAULT FALSE,
  p_isento BOOLEAN DEFAULT FALSE
)
RETURNS VARCHAR(2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cst VARCHAR(2);
BEGIN
  -- ========================================================================
  -- TABELA DE CST ICMS (Código de Situação Tributária)
  -- ========================================================================
  -- 00 - Tributada integralmente
  -- 10 - Tributada e com cobrança do ICMS por substituição tributária
  -- 20 - Com redução de base de cálculo
  -- 30 - Isenta ou não tributada e com cobrança do ICMS por ST
  -- 40 - Isenta
  -- 41 - Não tributada
  -- 50 - Suspensão
  -- 51 - Diferimento
  -- 60 - ICMS cobrado anteriormente por substituição tributária
  -- 70 - Com redução de base de cálculo e cobrança do ICMS por ST
  -- 90 - Outras
  -- ========================================================================

  -- Prioridade de regras (da mais específica para mais genérica)

  -- 1. Isento de ICMS
  IF p_isento THEN
    v_cst := '40';  -- Isenta

  -- 2. Substituição Tributária
  ELSIF p_tem_st THEN
    -- 2.1. ST com redução de base
    IF p_base_reduzida THEN
      v_cst := '70';  -- Com redução de base de cálculo e cobrança do ICMS por ST
    -- 2.2. ST sem redução
    ELSE
      v_cst := '10';  -- Tributada e com cobrança do ICMS por ST
    END IF;

  -- 3. Com redução de base (sem ST)
  ELSIF p_base_reduzida THEN
    v_cst := '20';  -- Com redução de base de cálculo

  -- 4. Tributação normal (sem ST, sem redução, sem isenção)
  ELSE
    v_cst := '00';  -- Tributada integralmente
  END IF;

  RETURN v_cst;
END;
$$;

COMMENT ON FUNCTION db_manaus.determinar_cst_icms(BOOLEAN, BOOLEAN, BOOLEAN) IS
'Determina CST ICMS (Código de Situação Tributária) baseado em flags de situação.
Retorna códigos: 00 (tributada), 10 (com ST), 20 (base reduzida), 40 (isenta), 70 (ST+redução).
Exemplo: SELECT determinar_cst_icms(TRUE, FALSE, FALSE); -- Retorna ''10'' (com ST)';


-- ============================================================================
-- 5. FUNCTION: buscar_aliquota_icms()
-- ============================================================================
-- Descrição: Retorna alíquotas ICMS por UF (interna, interestadual, corredor)
-- Parâmetros:
--   p_uf: Sigla da UF
-- Retorno: TABLE (icms_intra, icms_inter, icms_corredor, tem_st, zona_incentivada)
-- Performance: < 5ms (lookup em view indexada)
-- ============================================================================

DROP FUNCTION IF EXISTS db_manaus.buscar_aliquota_icms(VARCHAR);

CREATE OR REPLACE FUNCTION db_manaus.buscar_aliquota_icms(
  p_uf VARCHAR
)
RETURNS TABLE (
  uf VARCHAR(2),
  icms_intra NUMERIC(5,2),
  icms_inter NUMERIC(5,2),
  icms_corredor NUMERIC(5,2),
  tem_st BOOLEAN,
  tem_icms_antecipado BOOLEAN,
  zona_incentivada BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  p_uf := UPPER(TRIM(p_uf));

  RETURN QUERY
  SELECT
    v.uf,
    v.icms_intra,
    v.icms_inter,
    v.icms_corredor,
    (v.flag_st = 'S') AS tem_st,
    (v.flag_icms_antecip = 'S') AS tem_icms_antecipado,
    (v.zona_incentivada = 'S') AS zona_incentivada
  FROM db_manaus.v_uf_icms_flags v
  WHERE v.uf = p_uf;

  -- Se não encontrou a UF, retornar valores padrão
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      p_uf::VARCHAR(2),
      18.00::NUMERIC(5,2) AS icms_intra,
      12.00::NUMERIC(5,2) AS icms_inter,
      12.00::NUMERIC(5,2) AS icms_corredor,
      TRUE AS tem_st,
      FALSE AS tem_icms_antecipado,
      FALSE AS zona_incentivada;
  END IF;
END;
$$;

COMMENT ON FUNCTION db_manaus.buscar_aliquota_icms(VARCHAR) IS
'Retorna alíquotas e flags de ICMS para UF específica.
Exemplo: SELECT * FROM buscar_aliquota_icms(''AM'');';


-- ============================================================================
-- 6. FUNCTION: calcular_mva_ajustado()
-- ============================================================================
-- Descrição: Calcula MVA ajustado aplicando fórmula de equalização
-- Parâmetros:
--   p_mva_original: MVA original (%)
--   p_alq_intra: Alíquota ICMS interna (%)
--   p_alq_inter: Alíquota ICMS interestadual (%)
-- Retorno: NUMERIC - MVA ajustado (%)
-- Performance: < 1ms (cálculo matemático)
-- ============================================================================

DROP FUNCTION IF EXISTS db_manaus.calcular_mva_ajustado(NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION db_manaus.calcular_mva_ajustado(
  p_mva_original NUMERIC,
  p_alq_intra NUMERIC,
  p_alq_inter NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_mva_ajustado NUMERIC;
BEGIN
  -- ========================================================================
  -- FÓRMULA DE AJUSTE DE MVA
  -- ========================================================================
  -- MVA Ajustado = ((1 + MVA_original) × (1 - ALQ_inter) / (1 - ALQ_intra)) - 1
  --
  -- Onde:
  --   MVA_original: Margem de valor agregado original (decimal, ex: 0.7178 = 71.78%)
  --   ALQ_inter: Alíquota ICMS interestadual (decimal, ex: 0.12 = 12%)
  --   ALQ_intra: Alíquota ICMS interna (decimal, ex: 0.18 = 18%)
  -- ========================================================================

  -- Converter percentuais para decimais se necessário
  IF p_mva_original > 1 THEN
    p_mva_original := p_mva_original / 100;
  END IF;

  IF p_alq_intra > 1 THEN
    p_alq_intra := p_alq_intra / 100;
  END IF;

  IF p_alq_inter > 1 THEN
    p_alq_inter := p_alq_inter / 100;
  END IF;

  -- Aplicar fórmula de ajuste
  v_mva_ajustado := ((1 + p_mva_original) * (1 - p_alq_inter) / (1 - p_alq_intra)) - 1;

  -- Retornar como percentual (multiplicar por 100)
  RETURN ROUND(v_mva_ajustado * 100, 2);
END;
$$;

COMMENT ON FUNCTION db_manaus.calcular_mva_ajustado(NUMERIC, NUMERIC, NUMERIC) IS
'Calcula MVA ajustado aplicando fórmula de equalização interestadual.
Fórmula: ((1 + MVA_orig) × (1 - ALQ_inter) / (1 - ALQ_intra)) - 1
Exemplo: SELECT calcular_mva_ajustado(71.78, 18, 12); -- Retorna MVA ajustado';


-- ============================================================================
-- GRANTS E PERMISSÕES
-- ============================================================================

-- Conceder acesso de execução às funções para aplicação
GRANT EXECUTE ON FUNCTION db_manaus.buscar_aliquota_ncm(VARCHAR, INT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION db_manaus.calcular_cfop(VARCHAR, VARCHAR, VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION db_manaus.determinar_cst_icms(BOOLEAN, BOOLEAN, BOOLEAN) TO PUBLIC;
GRANT EXECUTE ON FUNCTION db_manaus.buscar_aliquota_icms(VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION db_manaus.calcular_mva_ajustado(NUMERIC, NUMERIC, NUMERIC) TO PUBLIC;

-- Conceder SELECT nas views
GRANT SELECT ON db_manaus.v_mva_ncm_uf_completa TO PUBLIC;
GRANT SELECT ON db_manaus.v_uf_icms_flags TO PUBLIC;


-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
-- Total de objetos criados:
--   1 VIEW: v_mva_ncm_uf_completa
--   6 FUNCTIONS: buscar_aliquota_ncm, calcular_cfop, determinar_cst_icms,
--                buscar_aliquota_icms, calcular_mva_ajustado
-- ============================================================================
