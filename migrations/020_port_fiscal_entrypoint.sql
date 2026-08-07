-- FASE 3 · ponto de entrada único do cálculo de imposto (SAIDA), para a API chamar.
-- Replica a sequência do caller Delphi/FATURAMENTOS: INICIALIZACAO -> validar alíquotas
-- -> calcular_impostos_saida -> calcular_ibs_cbs. A API só valida entrada, chama isto e mapeia.
--
-- OBS: CALCULO_IMPOSTO não computa CST ICMS, FCP nem tipocfop nesta procedure — retornados
-- como NULL/0 (fiel). Derivação de CST ICMS / FCP = fora do escopo desta procedure (FASE 4).

CREATE OR REPLACE FUNCTION db_manaus.calcular_imposto_item(
  p_codprod          text,
  p_codcli           text,
  p_quantidade       numeric,
  p_valor_unitario   numeric,
  p_tipo_movimentacao text DEFAULT 'SAIDA',
  p_tipo_operacao     text DEFAULT 'VENDA',
  p_tipofat           text DEFAULT 'NOTA_FISCAL',
  p_insc_estadual     text DEFAULT '04',
  p_zerar_substituicao text DEFAULT 'N',
  p_mva_antecipado    numeric DEFAULT 0,
  -- saída (mesma nomenclatura de dbitvenda / ImpostoResponse.campos)
  OUT ncm              text,
  OUT cfop             text,
  OUT totalproduto     numeric,
  OUT icms             numeric,  -- alíquota %
  OUT baseicms         numeric,
  OUT totalicms        numeric,
  OUT icmsinterno_dest numeric,
  OUT icmsexterno_orig numeric,
  OUT mva              numeric,
  OUT basesubst_trib   numeric,
  OUT totalsubst_trib  numeric,
  OUT ipi              numeric,  -- alíquota %
  OUT baseipi          numeric,
  OUT totalipi         numeric,
  OUT cstipi           text,
  OUT pis              numeric,
  OUT basepis          numeric,
  OUT valorpis         numeric,
  OUT cstpis           text,
  OUT cofins           numeric,
  OUT basecofins       numeric,
  OUT valorcofins      numeric,
  OUT cstcofins        text,
  OUT ibs_e            numeric,  -- alíquota IBS estadual %
  OUT ibs_m            numeric,  -- alíquota IBS municipal %
  OUT valor_ibs        numeric,
  OUT cbs_aliquota     numeric,
  OUT valor_cbs        numeric,
  OUT ibscbs_cst       text,
  OUT ibscbs_cclasstrib text
)
LANGUAGE plpgsql AS $$
DECLARE
  ctx      db_manaus.ctx_calculo_imposto;
  v_aliq_ipi  numeric;
  v_aliq_icms numeric;
  v_total  numeric;
  r        record;
  ibs      record;
  v_ibs_base numeric;
BEGIN
  ctx := db_manaus._inicializar_contexto(p_tipo_movimentacao, p_tipo_operacao, p_codprod, p_codcli, NULL);
  v_aliq_ipi  := db_manaus.validar_ipi(ctx, p_tipo_movimentacao, p_tipo_operacao);
  v_aliq_icms := db_manaus.validar_icms(ctx, p_insc_estadual, NULL);
  v_total := round(p_quantidade * p_valor_unitario, 2);

  SELECT * INTO r FROM db_manaus.calcular_impostos_saida(
    ctx, p_tipo_movimentacao, p_tipofat, p_tipo_operacao, p_zerar_substituicao,
    v_aliq_ipi, v_aliq_icms, v_total, v_total, p_mva_antecipado);

  -- Base do IBS/CBS = Total - PIS - COFINS - ICMS (como o caller faz)
  v_ibs_base := v_total - r.valor_pis - r.valor_cofins - r.valor_icms;
  SELECT * INTO ibs FROM db_manaus.calcular_ibs_cbs(ctx, p_tipo_operacao, r.cfop, v_ibs_base);

  ncm := r.ncm; cfop := r.cfop; totalproduto := v_total;
  icms := v_aliq_icms; baseicms := r.base_calc_icms; totalicms := r.valor_icms;
  icmsinterno_dest := r.icms_interno_destino; icmsexterno_orig := r.icms_externo_origem;
  mva := r.mva; basesubst_trib := r.base_calc_icms_subst; totalsubst_trib := r.valor_icms_subst;
  ipi := v_aliq_ipi; baseipi := r.base_ipi; totalipi := r.valor_ipi; cstipi := r.cstipi;
  pis := r.aliquota_pis; basepis := r.base_pis; valorpis := r.valor_pis; cstpis := r.cstpis;
  cofins := r.aliquota_cofins; basecofins := r.base_cofins; valorcofins := r.valor_cofins; cstcofins := r.cstcofins;
  ibs_e := ibs.gibsuf_pibsuf; ibs_m := ibs.gibsmun_pibsmun; valor_ibs := ibs.gibscbs_vibs;
  cbs_aliquota := ibs.gcbs_pcbs; valor_cbs := ibs.gcbs_vcbs;
  ibscbs_cst := ibs.ibscbs_cst; ibscbs_cclasstrib := ibs.ibscbs_cclasstrib;
END;
$$;
