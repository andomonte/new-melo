-- FASE 4 · P1 — expõe no entry-point os flags de ajuste do faturamento e porta o CST ICMS.
-- Replica FIELMENTE a pré-computação do caller Oracle CARREGA_PRODFATAUX (linhas 194-261):
--   ZERAR IPI  -> Aliquota_IPI = 0 (e regra TRANSFERENCIA/DEVOLUCAO_TRANSFERENCIA + AM + Insc '04' -> IPI 0)
--   ZERAR ICMS -> Aliquota_ICMS = 0
--   DESCONTO ICMS SUFRAMA -> se substr(strib,1,1) NOT IN ('1','2','6','7'): ICMS 0 E Total reduzido
--   Base_Produto (param 8) SEMPRE qtd*prunit cheio; só Total_Produto é reduzido pela Suframa.
--   ZERAR SUBSTITUICAO / MVA_ANTECIPADO já eram params (lógica em calcular_icms_subst) — agora expostos.
-- CST IPI: o Oracle sobrescreve com VALIDAR_CSTIPI (o preset '99' do caller é morto) -> mantido de calcular_impostos_saida.
-- CST ICMS: portado de ICMS_CST e chamado após o cálculo, como o caller faz
--   (xCstICMS := ICMS_CST(vDescontoSuframa, xCFOP, xTotalicms_aux, xtotalsubst_trib_aux)).
-- Trechos comentados no Oracle (Percsubst=0 / Derivado_Petroleo / PROTOCOLO_1785) permanecem inativos.

-- 1) CST do ICMS — tradução fiel de CALCULO_IMPOSTO.ICMS_CST (corpo do dump, linhas 3313-3364).
CREATE OR REPLACE FUNCTION db_manaus.icms_cst(
  ctx               db_manaus.ctx_calculo_imposto,
  desconto_suframa  text,
  cfop              text,
  valor_icms        numeric,
  valor_icms_subst  numeric
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  s1 text := COALESCE(substr(ctx.prod_strib, 1, 1), '0');  -- nvl(substr(Strib,1,1),'0')
BEGIN
  IF ctx.uf_destino = 'EX' THEN
    RETURN s1 || '40';
  ELSIF (valor_icms > 0) AND (valor_icms_subst > 0) AND ctx.basereduzida THEN
    RETURN s1 || '70';
  ELSIF (valor_icms > 0) AND (valor_icms_subst > 0) THEN
    RETURN s1 || '10';
  ELSIF (valor_icms = 0.00) AND (valor_icms_subst > 0) THEN
    RETURN s1 || '30';
  ELSIF (valor_icms > 0) AND ctx.basereduzida THEN
    RETURN s1 || '20';
  ELSIF (valor_icms > 0) THEN
    RETURN s1 || '00';
  ELSIF (desconto_suframa = 'S') THEN
    RETURN s1 || '40';
  ELSIF cfop IN ('5949') THEN
    RETURN s1 || '40';
  ELSIF ((db_manaus.derivado_petroleo(ctx)
          OR db_manaus.legislacao_icms(ctx, 'PROTOCOLO')
          OR db_manaus.legislacao_icms(ctx, 'CONVENIO')
          OR db_manaus.legislacao_icms(ctx, 'RESOLUCAO')
          OR db_manaus.legislacao_icms(ctx, 'DECRETO')
          OR ((COALESCE(ctx.ncm_agregado, 0) > 0) AND (ctx.uf_origem = ctx.uf_destino)))
         AND (valor_icms = 0.00)) THEN
    RETURN s1 || '60';
  ELSIF cfop IN ('6915','6916') THEN
    RETURN s1 || '50';
  ELSE
    RETURN s1 || '40';
  END IF;
END;
$$;

-- 2) Entry-point com os flags + CST ICMS. DROP+CREATE porque a assinatura/retorno muda
--    (novos params IN com DEFAULT — chamadas antigas de 10 args seguem válidas — e novo OUT csticms).
DROP FUNCTION IF EXISTS db_manaus.calcular_imposto_item(
  text, text, numeric, numeric, text, text, text, text, text, numeric);

CREATE OR REPLACE FUNCTION db_manaus.calcular_imposto_item(
  p_codprod           text,
  p_codcli            text,
  p_quantidade        numeric,
  p_valor_unitario    numeric,
  p_tipo_movimentacao text DEFAULT 'SAIDA',
  p_tipo_operacao     text DEFAULT 'VENDA',
  p_tipofat           text DEFAULT 'NOTA_FISCAL',
  p_insc_estadual     text DEFAULT '04',
  p_zerar_substituicao text DEFAULT 'N',
  p_mva_antecipado    numeric DEFAULT 0,
  -- FASE 4 P1: flags de ajuste do faturamento (default = comportamento de venda "limpo")
  p_zerar_ipi         text DEFAULT 'N',
  p_zerar_icms        text DEFAULT 'N',
  p_desconto_suframa  text DEFAULT 'N',
  p_cfop_manual       text DEFAULT NULL,
  -- saída (mesma nomenclatura de dbitvenda / ImpostoResponse.campos)
  OUT ncm              text,
  OUT cfop             text,
  OUT totalproduto     numeric,
  OUT icms             numeric,  -- alíquota %
  OUT baseicms         numeric,
  OUT totalicms        numeric,
  OUT icmsinterno_dest numeric,
  OUT icmsexterno_orig numeric,
  OUT csticms          text,     -- FASE 4 P1: CST do ICMS (ICMS_CST)
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
  OUT ibs_e            numeric,
  OUT ibs_m            numeric,
  OUT valor_ibs        numeric,
  OUT cbs_aliquota     numeric,
  OUT valor_cbs        numeric,
  OUT ibscbs_cst       text,
  OUT ibscbs_cclasstrib text
)
LANGUAGE plpgsql AS $$
DECLARE
  ctx        db_manaus.ctx_calculo_imposto;
  v_icms_real numeric;      -- alíquota ICMS "cheia" (Validar_ICMS), usada no desconto Suframa
  v_aliq_ipi  numeric;
  v_aliq_icms numeric;      -- alíquota efetivamente passada (pode ser 0 por zerar/suframa)
  v_suframa   boolean;
  v_total     numeric;      -- Total_Produto (reduzido pela Suframa quando aplicável)
  v_base      numeric;      -- Base_Produto (SEMPRE cheio)
  r          record;
  ibs        record;
  v_ibs_base numeric;
BEGIN
  ctx := db_manaus._inicializar_contexto(p_tipo_movimentacao, p_tipo_operacao, p_codprod, p_codcli, NULL);

  -- alíquota ICMS "cheia" (idempotente; usada no desconto Suframa e como fallback)
  v_icms_real := db_manaus.validar_icms(ctx, p_insc_estadual, p_cfop_manual);

  -- Suframa aplica? (fiel: strib NULL -> condição falsa, sem desconto)
  v_suframa := COALESCE(
    (p_desconto_suframa = 'S') AND (substr(ctx.prod_strib, 1, 1) NOT IN ('1','2','6','7')),
    false);

  -- IPI (caller L195-209): zerar, ou TRANSFERENCIA/DEVOLUCAO_TRANSFERENCIA + AM + Insc '04' -> 0
  IF p_zerar_ipi = 'S' THEN
    v_aliq_ipi := 0.00;
  ELSE
    v_aliq_ipi := db_manaus.validar_ipi(ctx, p_tipo_movimentacao, p_tipo_operacao);
    IF (ctx.uf_origem = 'AM')
       AND (p_tipo_operacao IN ('TRANSFERENCIA','DEVOLUCAO_TRANSFERENCIA'))
       AND (p_insc_estadual = '04') THEN
      -- (Oracle também busca custo de última entrada via GET_LAST_ENTRADA; não afeta o imposto)
      v_aliq_ipi := 0.00;
    END IF;
  END IF;

  -- ICMS (caller L212-219): zerar ou Suframa -> 0
  IF (p_zerar_icms = 'S') OR v_suframa THEN
    v_aliq_icms := 0.00;
  ELSE
    v_aliq_icms := v_icms_real;
  END IF;

  -- Total_Produto: reduzido pela Suframa (caller L221-226); Base_Produto sempre cheio (param 8, L240)
  IF v_suframa THEN
    v_total := round(p_quantidade * p_valor_unitario * (100 - v_icms_real) / 100, 2);
  ELSE
    v_total := round(p_quantidade * p_valor_unitario, 2);
  END IF;
  v_base := round(p_quantidade * p_valor_unitario, 2);

  SELECT * INTO r FROM db_manaus.calcular_impostos_saida(
    ctx, p_tipo_movimentacao, p_tipofat, p_tipo_operacao, p_zerar_substituicao,
    v_aliq_ipi, v_aliq_icms, v_total, v_base, p_mva_antecipado);

  -- CST ICMS (caller L574): ICMS_CST(desconto_suframa, cfop, valor_icms, valor_icms_subst)
  csticms := db_manaus.icms_cst(ctx, p_desconto_suframa, r.cfop, r.valor_icms, r.valor_icms_subst);

  -- Base do IBS/CBS = Total - PIS - COFINS - ICMS
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
