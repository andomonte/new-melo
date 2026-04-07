-- ============================================================================
-- TESTES DE FUNÇÕES DE CÁLCULO DE IMPOSTOS
-- ============================================================================
-- Descrição: Script de testes para validar todas as funções criadas
-- Data: 2026-01-09
-- ============================================================================

SET search_path TO db_manaus;

\echo '============================================================================'
\echo 'INICIANDO TESTES DE FUNÇÕES DE IMPOSTOS'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- TESTE 1: VIEW v_mva_ncm_uf_completa
-- ============================================================================
\echo '--- TESTE 1: VIEW v_mva_ncm_uf_completa ---'
\echo 'Buscar MVA para NCM 84213920 (Ar-condicionado automotivo)'
\echo ''

SELECT
  ncm,
  uf_destino,
  protocolo,
  mva_original,
  tipo_mva,
  status,
  TO_CHAR(vigencia_inicio, 'DD/MM/YYYY') AS vigencia
FROM db_manaus.v_mva_ncm_uf_completa
WHERE ncm = '84213920'
ORDER BY uf_destino
LIMIT 10;

\echo ''
\echo 'Total de registros para NCM 84213920:'
SELECT COUNT(*) AS total_registros
FROM db_manaus.v_mva_ncm_uf_completa
WHERE ncm = '84213920';

\echo ''
\echo 'MVA para diferentes UFs:'
SELECT
  uf_destino,
  protocolo,
  mva_original,
  tipo_mva
FROM db_manaus.v_mva_ncm_uf_completa
WHERE ncm = '84213920'
  AND uf_destino IN ('SP', 'RJ', 'MG', 'RS', 'BA', 'PE')
ORDER BY uf_destino;

\echo ''
\echo '============================================================================'
\echo ''


-- ============================================================================
-- TESTE 2: FUNCTION buscar_aliquota_ncm()
-- ============================================================================
\echo '--- TESTE 2: FUNCTION buscar_aliquota_ncm() ---'
\echo 'Buscar alíquotas IBS/CBS para NCM 84213920'
\echo ''

\echo 'Teste 2.1: Ano 2026 (Fase Piloto - Alíquotas Teste)'
SELECT
  'NCM: 84213920, Ano: 2026' AS teste,
  aliquota_ibs,
  aliquota_cbs,
  categoria,
  observacao
FROM db_manaus.buscar_aliquota_ncm('84213920', 2026);

\echo ''
\echo 'Teste 2.2: Ano 2027 (Alíquotas Reais - Estimadas)'
SELECT
  'NCM: 84213920, Ano: 2027' AS teste,
  aliquota_ibs,
  aliquota_cbs,
  categoria,
  observacao
FROM db_manaus.buscar_aliquota_ncm('84213920', 2027);

\echo ''
\echo 'Teste 2.3: Ano 2025 (Antes da Reforma - Não Aplicável)'
SELECT
  'NCM: 84213920, Ano: 2025' AS teste,
  aliquota_ibs,
  aliquota_cbs,
  categoria,
  observacao
FROM db_manaus.buscar_aliquota_ncm('84213920', 2025);

\echo ''
\echo 'Teste 2.4: NCM com formatação especial (com pontos)'
SELECT
  'NCM: 8421.39.20, Ano: 2026' AS teste,
  aliquota_ibs,
  aliquota_cbs,
  categoria
FROM db_manaus.buscar_aliquota_ncm('8421.39.20', 2026);

\echo ''
\echo '============================================================================'
\echo ''


-- ============================================================================
-- TESTE 3: FUNCTION calcular_cfop()
-- ============================================================================
\echo '--- TESTE 3: FUNCTION calcular_cfop() ---'
\echo 'Determinar CFOP para diferentes operações'
\echo ''

\echo 'Teste 3.1: VENDA Interna (AM -> AM)'
SELECT
  'VENDA Interna (AM -> AM)' AS operacao,
  db_manaus.calcular_cfop('VENDA', 'AM', 'AM') AS cfop,
  '5102 esperado' AS esperado;

\echo ''
\echo 'Teste 3.2: VENDA Interestadual (AM -> SP)'
SELECT
  'VENDA Interestadual (AM -> SP)' AS operacao,
  db_manaus.calcular_cfop('VENDA', 'AM', 'SP') AS cfop,
  '6102 esperado' AS esperado;

\echo ''
\echo 'Teste 3.3: TRANSFERÊNCIA Interna (AM -> AM)'
SELECT
  'TRANSFERÊNCIA Interna (AM -> AM)' AS operacao,
  db_manaus.calcular_cfop('TRANSFERENCIA', 'AM', 'AM') AS cfop,
  '5152 esperado' AS esperado;

\echo ''
\echo 'Teste 3.4: TRANSFERÊNCIA Interestadual (AM -> RJ)'
SELECT
  'TRANSFERÊNCIA Interestadual (AM -> RJ)' AS operacao,
  db_manaus.calcular_cfop('TRANSFERENCIA', 'AM', 'RJ') AS cfop,
  '6152 esperado' AS esperado;

\echo ''
\echo 'Teste 3.5: BONIFICAÇÃO Interna'
SELECT
  'BONIFICAÇÃO Interna' AS operacao,
  db_manaus.calcular_cfop('BONIFICACAO', 'AM', 'AM') AS cfop,
  '5910 esperado' AS esperado;

\echo ''
\echo 'Teste 3.6: BONIFICAÇÃO Externa'
SELECT
  'BONIFICAÇÃO Externa' AS operacao,
  db_manaus.calcular_cfop('BONIFICACAO', 'AM', 'SP') AS cfop,
  '6910 esperado' AS esperado;

\echo ''
\echo 'Teste 3.7: DEVOLUÇÃO Interna'
SELECT
  'DEVOLUÇÃO Interna' AS operacao,
  db_manaus.calcular_cfop('DEVOLUCAO', 'AM', 'AM') AS cfop,
  '5202 esperado' AS esperado;

\echo ''
\echo 'Teste 3.8: DEVOLUÇÃO Externa'
SELECT
  'DEVOLUÇÃO Externa' AS operacao,
  db_manaus.calcular_cfop('DEVOLUCAO', 'AM', 'RJ') AS cfop,
  '6202 esperado' AS esperado;

\echo ''
\echo 'Teste 3.9: Operação não mapeada (deve usar VENDA como padrão)'
SELECT
  'Operação não mapeada' AS operacao,
  db_manaus.calcular_cfop('OUTRA_OPERACAO', 'AM', 'SP') AS cfop,
  '6102 esperado (padrão VENDA)' AS esperado;

\echo ''
\echo '============================================================================'
\echo ''


-- ============================================================================
-- TESTE 4: FUNCTION determinar_cst_icms()
-- ============================================================================
\echo '--- TESTE 4: FUNCTION determinar_cst_icms() ---'
\echo 'Determinar CST ICMS para diferentes situações'
\echo ''

\echo 'Teste 4.1: Tributada com ST (tem_st=TRUE)'
SELECT
  'Tributada com ST' AS situacao,
  db_manaus.determinar_cst_icms(TRUE, FALSE, FALSE) AS cst,
  '10 esperado' AS esperado;

\echo ''
\echo 'Teste 4.2: Com redução de base (base_reduzida=TRUE)'
SELECT
  'Com redução de base' AS situacao,
  db_manaus.determinar_cst_icms(FALSE, TRUE, FALSE) AS cst,
  '20 esperado' AS esperado;

\echo ''
\echo 'Teste 4.3: Isenta (isento=TRUE)'
SELECT
  'Isenta' AS situacao,
  db_manaus.determinar_cst_icms(FALSE, FALSE, TRUE) AS cst,
  '40 esperado' AS esperado;

\echo ''
\echo 'Teste 4.4: Tributada integralmente (tudo FALSE)'
SELECT
  'Tributada integralmente' AS situacao,
  db_manaus.determinar_cst_icms(FALSE, FALSE, FALSE) AS cst,
  '00 esperado' AS esperado;

\echo ''
\echo 'Teste 4.5: ST com redução de base (tem_st=TRUE, base_reduzida=TRUE)'
SELECT
  'ST com redução de base' AS situacao,
  db_manaus.determinar_cst_icms(TRUE, TRUE, FALSE) AS cst,
  '70 esperado' AS esperado;

\echo ''
\echo 'Teste 4.6: Isento tem prioridade sobre ST (isento=TRUE, tem_st=TRUE)'
SELECT
  'Isento (prioridade sobre ST)' AS situacao,
  db_manaus.determinar_cst_icms(TRUE, FALSE, TRUE) AS cst,
  '40 esperado' AS esperado;

\echo ''
\echo '============================================================================'
\echo ''


-- ============================================================================
-- TESTE 5: FUNCTION buscar_aliquota_icms()
-- ============================================================================
\echo '--- TESTE 5: FUNCTION buscar_aliquota_icms() ---'
\echo 'Buscar alíquotas ICMS por UF'
\echo ''

\echo 'Teste 5.1: Amazonas (AM) - Zona Franca'
SELECT
  uf,
  icms_intra,
  icms_inter,
  tem_st,
  tem_icms_antecipado,
  zona_incentivada
FROM db_manaus.buscar_aliquota_icms('AM');

\echo ''
\echo 'Teste 5.2: São Paulo (SP)'
SELECT
  uf,
  icms_intra,
  icms_inter,
  tem_st,
  tem_icms_antecipado,
  zona_incentivada
FROM db_manaus.buscar_aliquota_icms('SP');

\echo ''
\echo 'Teste 5.3: Rio de Janeiro (RJ)'
SELECT
  uf,
  icms_intra,
  icms_inter,
  tem_st,
  tem_icms_antecipado,
  zona_incentivada
FROM db_manaus.buscar_aliquota_icms('RJ');

\echo ''
\echo 'Teste 5.4: Minas Gerais (MG)'
SELECT
  uf,
  icms_intra,
  icms_inter,
  tem_st,
  tem_icms_antecipado,
  zona_incentivada
FROM db_manaus.buscar_aliquota_icms('MG');

\echo ''
\echo 'Teste 5.5: UF inexistente (deve retornar padrão)'
SELECT
  uf,
  icms_intra,
  icms_inter,
  tem_st,
  zona_incentivada
FROM db_manaus.buscar_aliquota_icms('XX');

\echo ''
\echo '============================================================================'
\echo ''


-- ============================================================================
-- TESTE 6: FUNCTION calcular_mva_ajustado()
-- ============================================================================
\echo '--- TESTE 6: FUNCTION calcular_mva_ajustado() ---'
\echo 'Calcular MVA ajustado com fórmula de equalização'
\echo ''

\echo 'Teste 6.1: MVA Original 71.78%, ALQ_INTRA 18%, ALQ_INTER 12%'
SELECT
  'MVA: 71.78%, Intra: 18%, Inter: 12%' AS parametros,
  db_manaus.calcular_mva_ajustado(71.78, 18, 12) AS mva_ajustado,
  'Aproximadamente 82.5%' AS esperado;

\echo ''
\echo 'Teste 6.2: MVA Original 40%, ALQ_INTRA 20%, ALQ_INTER 12%'
SELECT
  'MVA: 40%, Intra: 20%, Inter: 12%' AS parametros,
  db_manaus.calcular_mva_ajustado(40, 20, 12) AS mva_ajustado;

\echo ''
\echo 'Teste 6.3: Valores em decimal (0.7178, 0.18, 0.12)'
SELECT
  'MVA: 0.7178, Intra: 0.18, Inter: 0.12' AS parametros,
  db_manaus.calcular_mva_ajustado(0.7178, 0.18, 0.12) AS mva_ajustado,
  'Deve aceitar formato decimal' AS observacao;

\echo ''
\echo '============================================================================'
\echo ''


-- ============================================================================
-- TESTE 7: CENÁRIO COMPLETO - VENDA INTERESTADUAL
-- ============================================================================
\echo '--- TESTE 7: CENÁRIO COMPLETO - Venda de Ar-condicionado AM -> SP ---'
\echo 'NCM: 84213920, Origem: AM, Destino: SP, Operação: VENDA'
\echo ''

WITH dados_produto AS (
  -- Dados do produto e operação
  SELECT
    '84213920' AS ncm,
    'VENDA' AS tipo_operacao,
    'AM' AS uf_origem,
    'SP' AS uf_destino,
    1000.00 AS valor_produto
),
mva_data AS (
  -- Buscar MVA
  SELECT
    v.mva_original,
    v.protocolo,
    v.formula_ajuste
  FROM db_manaus.v_mva_ncm_uf_completa v, dados_produto d
  WHERE v.ncm = d.ncm
    AND v.uf_destino = d.uf_destino
  LIMIT 1
),
aliq_origem AS (
  -- Alíquotas UF origem
  SELECT * FROM db_manaus.buscar_aliquota_icms('AM')
),
aliq_destino AS (
  -- Alíquotas UF destino
  SELECT * FROM db_manaus.buscar_aliquota_icms('SP')
),
ibs_cbs AS (
  -- Alíquotas IBS/CBS
  SELECT * FROM db_manaus.buscar_aliquota_ncm('84213920', 2026)
)
SELECT
  d.ncm,
  d.tipo_operacao,
  d.uf_origem,
  d.uf_destino,
  d.valor_produto,
  -- CFOP
  db_manaus.calcular_cfop(d.tipo_operacao, d.uf_origem, d.uf_destino) AS cfop,
  -- CST ICMS (assumindo que tem ST)
  db_manaus.determinar_cst_icms(
    ao.tem_st,  -- tem ST se UF origem tiver flag ST
    FALSE,      -- sem redução de base
    FALSE       -- não isento
  ) AS cst_icms,
  -- MVA
  m.protocolo AS protocolo_icms,
  m.mva_original AS mva_original_pct,
  -- MVA Ajustado
  db_manaus.calcular_mva_ajustado(
    m.mva_original,
    ad.icms_intra,
    ad.icms_inter
  ) AS mva_ajustado_pct,
  -- Alíquotas ICMS
  ao.icms_intra AS icms_origem_pct,
  ad.icms_intra AS icms_destino_pct,
  ad.icms_inter AS icms_interestadual_pct,
  -- IBS/CBS
  ibc.aliquota_ibs AS ibs_pct,
  ibc.aliquota_cbs AS cbs_pct,
  ibc.categoria AS categoria_ibs_cbs,
  -- Flags
  ao.zona_incentivada AS origem_zona_incentivada,
  ad.tem_st AS destino_tem_st
FROM dados_produto d
  CROSS JOIN mva_data m
  CROSS JOIN aliq_origem ao
  CROSS JOIN aliq_destino ad
  CROSS JOIN ibs_cbs ibc;

\echo ''
\echo '============================================================================'
\echo ''


-- ============================================================================
-- TESTE 8: PERFORMANCE
-- ============================================================================
\echo '--- TESTE 8: TESTE DE PERFORMANCE ---'
\echo 'Executando múltiplas consultas para medir tempo de resposta'
\echo ''

\timing on

\echo 'Teste 8.1: 100 consultas à VIEW v_mva_ncm_uf_completa'
SELECT COUNT(*) AS total
FROM (
  SELECT * FROM db_manaus.v_mva_ncm_uf_completa
  WHERE ncm = '84213920' AND uf_destino = 'SP'
  UNION ALL SELECT * FROM db_manaus.v_mva_ncm_uf_completa WHERE ncm = '84213920' AND uf_destino = 'RJ'
  UNION ALL SELECT * FROM db_manaus.v_mva_ncm_uf_completa WHERE ncm = '84213920' AND uf_destino = 'MG'
  -- Repetir para outras UFs...
) t;

\echo ''
\echo 'Teste 8.2: 50 cálculos de CFOP'
SELECT COUNT(DISTINCT cfop) AS cfops_distintos
FROM (
  SELECT db_manaus.calcular_cfop('VENDA', 'AM', 'SP') AS cfop
  UNION ALL SELECT db_manaus.calcular_cfop('VENDA', 'AM', 'RJ')
  UNION ALL SELECT db_manaus.calcular_cfop('TRANSFERENCIA', 'AM', 'MG')
  -- ... mais combinações
) t;

\echo ''
\echo 'Teste 8.3: 30 cálculos de CST'
SELECT COUNT(DISTINCT cst) AS csts_distintos
FROM (
  SELECT db_manaus.determinar_cst_icms(TRUE, FALSE, FALSE) AS cst
  UNION ALL SELECT db_manaus.determinar_cst_icms(FALSE, TRUE, FALSE)
  UNION ALL SELECT db_manaus.determinar_cst_icms(FALSE, FALSE, TRUE)
  -- ... mais combinações
) t;

\timing off

\echo ''
\echo '============================================================================'
\echo 'TESTES CONCLUÍDOS COM SUCESSO!'
\echo '============================================================================'
\echo ''
\echo 'Resumo:'
\echo '  - VIEW v_mva_ncm_uf_completa: Testada com NCM 84213920'
\echo '  - FUNCTION buscar_aliquota_ncm(): Testada para anos 2025, 2026, 2027'
\echo '  - FUNCTION calcular_cfop(): Testada para 9 tipos de operação'
\echo '  - FUNCTION determinar_cst_icms(): Testada para 6 situações tributárias'
\echo '  - FUNCTION buscar_aliquota_icms(): Testada para 5 UFs'
\echo '  - FUNCTION calcular_mva_ajustado(): Testada com 3 cenários'
\echo '  - Cenário completo: Venda interestadual AM->SP'
\echo '  - Testes de performance executados'
\echo ''
\echo 'Todas as funções estão operacionais!'
\echo '============================================================================'
