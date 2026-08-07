-- FASE 2 · Bloco 6 — orquestração CALCULAR_IMPOSTOS (bloco clássico) + auxiliares
-- TIPO_OPERACAO_SAIDA e VALIDAR_CSTIPI. Tradução FIEL do caminho SAIDA/NOTA_FISCAL.
-- (IBS/CBS = Bloco 7, função isolada; ENTRADA e operações especiais = FASE 4.)

CREATE OR REPLACE FUNCTION db_manaus.tipo_operacao_saida(
  ctx          db_manaus.ctx_calculo_imposto,
  tipooperacao text,
  OUT uf_iguais boolean,
  OUT pode_st   boolean,
  OUT cfop      text
)
LANGUAGE plpgsql AS $$
BEGIN
  -- Para VENDA/TRANSFERENCIA/DEVOLUCAO_*/REMESSA_* (visíveis): UF_Iguais=(orig=dest),
  -- Pode_ST=True, CFOP=null. Nuances de Pode_ST por operação especial = FASE 4.
  uf_iguais := (ctx.uf_origem = ctx.uf_destino);
  pode_st   := true;
  cfop      := NULL;
END;
$$;

CREATE OR REPLACE FUNCTION db_manaus.validar_cstipi(
  ctx        db_manaus.ctx_calculo_imposto,
  p_tipo_mov text,
  p_tipo_op  text
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  xresult text := '99';
BEGIN
  -- Apenas o ramo SAIDA está portado (ENTRADA/ENTRADA_COMPRAS = FASE 4).
  IF p_tipo_mov = 'SAIDA' THEN
    IF ((ctx.prod_isentoipi = 'S') AND (ctx.uf_dest_zona_isentivada = 'N'))
       OR (ctx.prod_isentoipi IN ('I','T'))
       OR ((ctx.prod_isentoipi = 'C') AND (ctx.uf_origem <> ctx.uf_destino) AND (p_tipo_op NOT IN ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO')))
       OR ((ctx.prod_isentoipi = 'C') AND (p_tipo_op IN ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO')))
       OR ((ctx.prod_isentoipi = 'P') AND (p_tipo_op IN ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO')))
    THEN
      xresult := '50';
    ELSIF (ctx.prod_isentoipi = 'Z') THEN
      xresult := '51';
    ELSIF ((ctx.prod_isentoipi = 'S') AND (ctx.uf_dest_zona_isentivada = 'S')) THEN
      xresult := '55';
    ELSE
      xresult := '99';
    END IF;
  END IF;
  RETURN xresult;
END;
$$;

-- CALCULAR_IMPOSTOS (bloco clássico), caminho SAIDA/NOTA_FISCAL.
CREATE OR REPLACE FUNCTION db_manaus.calcular_impostos_saida(
  ctx            db_manaus.ctx_calculo_imposto,
  p_tipo_mov     text,
  p_tipofat      text,
  p_tipo_op      text,
  zerar_subst    text,
  aliquota_ipi   numeric,
  aliquota_icms  numeric,
  total_produto  numeric,
  base_produto   numeric,
  mva_antecipado numeric,
  OUT ncm text, OUT cstipi text, OUT base_ipi numeric, OUT valor_ipi numeric,
  OUT base_calc_icms numeric, OUT valor_icms numeric,
  OUT base_calc_icms_subst numeric, OUT valor_icms_subst numeric, OUT mva numeric,
  OUT icms_interno_destino numeric, OUT icms_externo_origem numeric, OUT cfop text,
  OUT aliquota_pis numeric, OUT aliquota_cofins numeric, OUT base_pis numeric, OUT base_cofins numeric,
  OUT valor_pis numeric, OUT valor_cofins numeric, OUT cstpis text, OUT cstcofins text
)
LANGUAGE plpgsql AS $$
DECLARE
  v_uf_iguais boolean; v_pode_st boolean; v_cfop_op text;
  v_basealterada numeric;
BEGIN
  ncm := ctx.ncm_clasfiscal;

  IF (p_tipofat = 'NOTA_FISCAL') OR (p_tipo_mov = 'ENTRADA_COMPRAS') THEN
    -- Base/CST/Valor IPI
    IF aliquota_ipi > 0 THEN base_ipi := round(base_produto, 2); ELSE base_ipi := 0.00; END IF;
    cstipi := db_manaus.validar_cstipi(ctx, p_tipo_mov, p_tipo_op);
    valor_ipi := round(base_produto * (aliquota_ipi/100), 2);

    -- ICMS (CFOP ainda NULL — não é um dos especiais 5551/6651/1553)
    SELECT c.base_calc_icms, c.valor_icms INTO base_calc_icms, valor_icms
      FROM db_manaus.calcular_icms(ctx, p_tipo_mov, cfop, aliquota_icms, total_produto) c;

    -- Tipo de operação de saída
    SELECT t.uf_iguais, t.pode_st, t.cfop INTO v_uf_iguais, v_pode_st, v_cfop_op
      FROM db_manaus.tipo_operacao_saida(ctx, p_tipo_op) t;
    cfop := v_cfop_op;

    -- PIS/COFINS
    SELECT p.aliquota_pis, p.aliquota_cofins, p.base_pis, p.base_cofins, p.valor_pis, p.valor_cofins, p.cstpis, p.cstcofins
      INTO aliquota_pis, aliquota_cofins, base_pis, base_cofins, valor_pis, valor_cofins, cstpis, cstcofins
      FROM db_manaus.calcular_pis_cofins_saida(ctx, p_tipo_op, base_produto) p;

    -- Caso especial RO/00169 (não se aplica a AM; MVA/ValorST ainda 0 aqui)
    IF ctx.uf_origem = 'RO' AND ctx.dest_codigo = '00169' AND ctx.uf_destino = ctx.uf_origem THEN
      v_pode_st := false;
      IF db_manaus.validar_cfop_saida(ctx, p_tipo_op, v_uf_iguais, mva, valor_icms_subst) IS NOT NULL THEN
        cfop := db_manaus.validar_cfop_saida(ctx, p_tipo_op, v_uf_iguais, mva, valor_icms_subst);
      END IF;
    END IF;

    -- ST
    IF v_pode_st THEN
      v_basealterada := total_produto;
      SELECT s.base_calc_icms_subst, s.valor_icms_subst, s.mva, s.icms_interno_destino, s.icms_externo_origem
        INTO base_calc_icms_subst, valor_icms_subst, mva, icms_interno_destino, icms_externo_origem
        FROM db_manaus.calcular_icms_subst(ctx, p_tipo_mov, p_tipo_op, zerar_subst, valor_ipi,
               v_basealterada, mva_antecipado, base_produto, valor_icms) s;
      IF db_manaus.validar_cfop_saida(ctx, p_tipo_op, v_uf_iguais, mva, valor_icms_subst) IS NOT NULL THEN
        cfop := db_manaus.validar_cfop_saida(ctx, p_tipo_op, v_uf_iguais, mva, valor_icms_subst);
      END IF;
    ELSE
      base_calc_icms_subst := 0.00; valor_icms_subst := 0.00; mva := 0.00;
      icms_interno_destino := 0.00; icms_externo_origem := 0.00;
    END IF;
  END IF;
END;
$$;
