-- Preview da Migração de IDs de Ordens de Compra
-- Este script APENAS VISUALIZA como ficaria a migração
-- NÃO FAZ ALTERAÇÕES no banco de dados

SET search_path TO db_manaus;

-- Simular a migração e mostrar resultado
WITH dados_ordens AS (
  SELECT
    oc.orc_id,
    oc.orc_req_id,
    oc.orc_req_versao,
    oc.orc_data,
    oc.orc_unm_id_entrega,
    -- Extrair número da filial do CNPJ
    CAST(
      SUBSTRING(
        REGEXP_REPLACE(COALESCE(u.unm_cnpj, '04618302000189'), '[^0-9]', '', 'g'),
        9, 4
      ) AS INTEGER
    ) as filial_numero,
    EXTRACT(YEAR FROM oc.orc_data)::INT as ano,
    EXTRACT(MONTH FROM oc.orc_data)::INT as mes,
    u.unm_nome as filial_nome,
    u.unm_cnpj
  FROM cmp_ordem_compra oc
  LEFT JOIN cad_unidade_melo u ON u.unm_id = oc.orc_unm_id_entrega
),
com_sequencial AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY filial_numero, ano, mes
      ORDER BY orc_data, orc_id
    ) as sequencial
  FROM dados_ordens
),
com_novo_id AS (
  SELECT
    *,
    CAST(
      LPAD(filial_numero::TEXT, 1, '0') ||
      LPAD(ano::TEXT, 4, '0') ||
      LPAD(mes::TEXT, 2, '0') ||
      LPAD(sequencial::TEXT, 4, '0')
      AS BIGINT
    ) as novo_id
  FROM com_sequencial
)
SELECT
  orc_id as "ID Antigo",
  novo_id as "ID Novo",
  TO_CHAR(orc_data, 'DD/MM/YYYY') as "Data Ordem",
  COALESCE(filial_nome, 'Sem filial') as "Filial",
  filial_numero as "Nº Filial",
  ano || '/' || LPAD(mes::TEXT, 2, '0') as "Ano/Mês",
  sequencial as "Seq",
  orc_req_id as "Req ID"
FROM com_novo_id
WHERE orc_data >= '2024-01-01'  -- Apenas ordens recentes
ORDER BY orc_data, orc_id;
