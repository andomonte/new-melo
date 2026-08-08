-- FASE 4 · P3 (A2, parte 2b) — orquestração ENTRADA (fecha o BLOCO A).
-- 1) calcular_pis_cofins_compra  (Oracle 2495-2721): crédito por regime do fornecedor + flags rc_*.
-- 2) calcular_impostos_entrada   (Oracle 613-699, ramo ENTRADA): base ajustada por RowRegraCredor
--    no PIS/COFINS e na ST; validar_cfop_entrada; uso/consumo (prod_tipo='MC').
-- 3) calcular_impostos_saida vira DISPATCHER: ENTRADA/ENTRADA_COMPRAS -> calcular_impostos_entrada
--    (mantém o entry-point calcular_imposto_item intocado).

-- ===== 1) PIS/COFINS de compra =====
CREATE OR REPLACE FUNCTION db_manaus.calcular_pis_cofins_compra(
  ctx           db_manaus.ctx_calculo_imposto,
  p_tipo_mov    text,
  p_tipo_op     text,
  base_produto  numeric,
  cfop          text,
  OUT aliquota_pis numeric, OUT aliquota_cofins numeric,
  OUT base_pis numeric, OUT base_cofins numeric,
  OUT valor_pis numeric, OUT valor_cofins numeric,
  OUT cstpis text, OUT cstcofins text
)
LANGUAGE plpgsql AS $$
DECLARE
  v_soma numeric;
BEGIN
  IF p_tipo_mov <> 'ENTRADA_COMPRAS' THEN
    cstpis:='08'; cstcofins:='08'; valor_pis:=0.00; valor_cofins:=0.00;
    base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=0.00; aliquota_cofins:=0.00;
  ELSE
    -- Fornecedor Simples Nacional ('0')
    IF ctx.orig_regimetributario = '0' AND p_tipo_op IN ('COMPRA','TRANSFERENCIA') THEN
      cstpis:='73'; cstcofins:='73'; valor_pis:=0; valor_cofins:=0; base_pis:=0; base_cofins:=0; aliquota_pis:=0; aliquota_cofins:=0;

    -- Fornecedor Lucro Presumido ('1'), interestadual p/ AM
    ELSIF ctx.orig_regimetributario = '1' AND p_tipo_op IN ('COMPRA','TRANSFERENCIA')
          AND ctx.uf_origem <> 'AM' AND ctx.uf_destino = 'AM' THEN
      IF COALESCE(ctx.rc_piscofins_365, 1) = 1 THEN
        cstpis:='50'; cstcofins:='50';
        valor_pis    := round(base_produto*0.0065, 2) * (-1);
        valor_cofins := round(base_produto*0.03,   2) * (-1);
        base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=0.65; aliquota_cofins:=3.00;
      ELSE
        cstpis:='73'; cstcofins:='73'; valor_pis:=0; valor_cofins:=0; base_pis:=0; base_cofins:=0; aliquota_pis:=0; aliquota_cofins:=0;
      END IF;

    -- Fornecedor Lucro Real ('2')
    ELSIF ctx.orig_regimetributario = '2' AND p_tipo_op IN ('COMPRA','TRANSFERENCIA') THEN
      -- 9.25 (interestadual p/ AM, fabricante)
      IF (COALESCE(ctx.prod_pis,0) + COALESCE(ctx.prod_cofins,0)) = 9.25
         AND ctx.uf_origem <> 'AM' AND ctx.uf_destino = 'AM' AND ctx.orig_fabricante = 'S' THEN
        IF COALESCE(ctx.rc_piscofins_925, 1) = 1 THEN
          cstpis:='50'; cstcofins:='50';
          valor_pis:=round(base_produto*0.0165,2)*(-1); valor_cofins:=round(base_produto*0.076,2)*(-1);
          base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=1.65; aliquota_cofins:=7.60;
        ELSE
          cstpis:='73'; cstcofins:='73'; valor_pis:=0; valor_cofins:=0; base_pis:=0; base_cofins:=0; aliquota_pis:=0; aliquota_cofins:=0;
        END IF;

      -- 11.50 (destino AM, fabricante)
      ELSIF (COALESCE(ctx.prod_pis,0) + COALESCE(ctx.prod_cofins,2)) = 11.50
            AND ctx.uf_destino = 'AM' AND ctx.orig_fabricante = 'S' THEN
        v_soma := COALESCE(ctx.rc_piscofins_1150, 0);
        IF v_soma = 0 THEN
          cstpis:='73'; cstcofins:='73'; valor_pis:=0; valor_cofins:=0; base_pis:=0; base_cofins:=0; aliquota_pis:=0; aliquota_cofins:=0;
        ELSIF v_soma = 1 THEN  -- COBRAR
          cstpis:='50'; cstcofins:='50';
          valor_pis:=round(base_produto*0.0200,2); valor_cofins:=round(base_produto*0.0950,2);
          base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=2.00; aliquota_cofins:=9.50;
        ELSIF v_soma = 2 THEN  -- DESCONTAR
          cstpis:='73'; cstcofins:='73';
          valor_pis:=round(base_produto*0.0200,2)*(-1); valor_cofins:=round(base_produto*0.0950,2)*(-1);
          base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=2.00; aliquota_cofins:=9.50;
        ELSIF v_soma = 3 THEN  -- DESCONTAR P/ DEPOIS COBRAR
          cstpis:='73'; cstcofins:='73';
          valor_pis:=round(base_produto*0.0200*0.885,2); valor_cofins:=round(base_produto*0.0950*0.885,2);
          base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=2.00; aliquota_cofins:=9.50;
        ELSE
          cstpis:='73'; cstcofins:='73'; valor_pis:=0; valor_cofins:=0; base_pis:=0; base_cofins:=0; aliquota_pis:=0; aliquota_cofins:=0;
        END IF;

      -- 13.10 (destino AM, fabricante)
      ELSIF (COALESCE(ctx.prod_pis,0) + COALESCE(ctx.prod_cofins,2)) = 13.10
            AND ctx.uf_destino = 'AM' AND ctx.orig_fabricante = 'S' THEN
        v_soma := COALESCE(ctx.rc_piscofins_1310, 0);
        IF v_soma = 0 THEN
          cstpis:='73'; cstcofins:='73'; valor_pis:=0; valor_cofins:=0; base_pis:=0; base_cofins:=0; aliquota_pis:=0; aliquota_cofins:=0;
        ELSIF v_soma = 1 THEN  -- COBRAR 13.10
          cstpis:='50'; cstcofins:='50';
          valor_pis:=round(base_produto*0.0230,2); valor_cofins:=round(base_produto*0.108,2);
          base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=2.30; aliquota_cofins:=10.80;
        ELSIF v_soma = 2 THEN  -- DESCONTAR 13.10
          cstpis:='73'; cstcofins:='73';
          valor_pis:=round(base_produto*0.0230,2)*(-1); valor_cofins:=round(base_produto*0.108,2)*(-1);
          base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=2.30; aliquota_cofins:=10.80;
        ELSIF v_soma = 3 THEN  -- DESCONTAR P/ DEPOIS COBRAR 13.10
          cstpis:='50'; cstcofins:='50';
          valor_pis:=round(base_produto*0.0230*0.869,2); valor_cofins:=round(base_produto*0.108*0.869,2);
          base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=2.30; aliquota_cofins:=10.80;
        ELSIF v_soma = 4 THEN  -- APLICAR DESCONTO 9.25
          cstpis:='73'; cstcofins:='73';
          valor_pis:=round(base_produto*0.0165,2)*(-1); valor_cofins:=round(base_produto*0.076,2)*(-1);
          base_pis:=base_produto; base_cofins:=base_produto; aliquota_pis:=1.65; aliquota_cofins:=7.60;
        ELSE
          cstpis:='73'; cstcofins:='73'; valor_pis:=0; valor_cofins:=0; base_pis:=0; base_cofins:=0; aliquota_pis:=0; aliquota_cofins:=0;
        END IF;

      ELSE
        cstpis:='73'; cstcofins:='73'; valor_pis:=0; valor_cofins:=0; base_pis:=0; base_cofins:=0; aliquota_pis:=0; aliquota_cofins:=0;
      END IF;

    ELSE
      cstpis:='73'; cstcofins:='73'; valor_pis:=0; valor_cofins:=0; base_pis:=0; base_cofins:=0; aliquota_pis:=0; aliquota_cofins:=0;
    END IF;

    -- override por CFOP (Oracle 2717)
    IF cfop IN ('1102','1403','3102','1202','1411','2202','2411','3202') THEN
      cstpis:='50'; cstcofins:='50';
    END IF;
  END IF;
END;
$$;

-- ===== 2) orquestração ENTRADA =====
CREATE OR REPLACE FUNCTION db_manaus.calcular_impostos_entrada(
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
    -- IPI
    IF aliquota_ipi > 0 THEN base_ipi := round(base_produto, 2); ELSE base_ipi := 0.00; END IF;
    cstipi := db_manaus.validar_cstipi(ctx, p_tipo_mov, p_tipo_op);
    valor_ipi := round(base_produto * (aliquota_ipi/100), 2);

    -- ICMS
    SELECT c.base_calc_icms, c.valor_icms INTO base_calc_icms, valor_icms
      FROM db_manaus.calcular_icms(ctx, p_tipo_mov, cfop, aliquota_icms, total_produto) c;

    -- Tipo de operação de entrada (CFOP fixo/null + Pode_ST)
    SELECT t.uf_iguais, t.pode_st, t.cfop INTO v_uf_iguais, v_pode_st, v_cfop_op
      FROM db_manaus.tipo_operacao_entrada(ctx, p_tipo_op) t;
    cfop := v_cfop_op;

    -- PIS/COFINS compra: base ajustada por rc_desc_icms_sufra_piscofins
    IF COALESCE(ctx.rc_desc_icms_sufra_piscofins, 0) = 1 THEN
      v_basealterada := base_produto - valor_icms;
    ELSE
      v_basealterada := base_produto;
    END IF;
    SELECT p.aliquota_pis, p.aliquota_cofins, p.base_pis, p.base_cofins, p.valor_pis, p.valor_cofins, p.cstpis, p.cstcofins
      INTO aliquota_pis, aliquota_cofins, base_pis, base_cofins, valor_pis, valor_cofins, cstpis, cstcofins
      FROM db_manaus.calcular_pis_cofins_compra(ctx, p_tipo_mov, p_tipo_op, v_basealterada, cfop) p;

    -- ST
    IF v_pode_st THEN
      IF p_tipo_mov = 'ENTRADA_COMPRAS' THEN
        IF COALESCE(ctx.rc_basereduzida_st, 0) = 1 THEN v_basealterada := total_produto;
        ELSE v_basealterada := base_produto; END IF;
        IF COALESCE(ctx.rc_desc_icms_sufra_st, 0) = 1 THEN
          v_basealterada := v_basealterada - valor_icms;
        END IF;
        IF COALESCE(ctx.rc_desc_piscofins_st, 0) = 1 AND valor_cofins < 0 THEN
          v_basealterada := v_basealterada + valor_pis + valor_cofins;
        END IF;
        IF COALESCE(ctx.rc_acres_piscofins_st, 0) = 1 AND valor_cofins > 0 THEN
          v_basealterada := v_basealterada + valor_pis + valor_cofins;
        END IF;
      ELSE
        v_basealterada := total_produto;
      END IF;

      SELECT s.base_calc_icms_subst, s.valor_icms_subst, s.mva, s.icms_interno_destino, s.icms_externo_origem
        INTO base_calc_icms_subst, valor_icms_subst, mva, icms_interno_destino, icms_externo_origem
        FROM db_manaus.calcular_icms_subst(ctx, p_tipo_mov, p_tipo_op, zerar_subst, valor_ipi,
               v_basealterada, mva_antecipado, base_produto, valor_icms) s;

      IF db_manaus.validar_cfop_entrada(ctx, p_tipo_op, v_uf_iguais, mva, valor_icms_subst) IS NOT NULL THEN
        cfop := db_manaus.validar_cfop_entrada(ctx, p_tipo_op, v_uf_iguais, mva, valor_icms_subst);
      END IF;
    ELSE
      base_calc_icms_subst := 0.00; valor_icms_subst := 0.00; mva := 0.00;
      icms_interno_destino := 0.00; icms_externo_origem := 0.00;
    END IF;

    -- uso/consumo (ENTRADA_COMPRAS + produto tipo 'MC')
    IF p_tipo_mov = 'ENTRADA_COMPRAS' AND ctx.prod_tipo = 'MC' THEN
      cfop := db_manaus.valida_cfop_usoconsumo(ctx, v_uf_iguais);
    END IF;
  END IF;
END;
$$;

-- ===== 3) calcular_impostos_saida vira dispatcher (remove o guard) =====
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
  -- Dispatch: ENTRADA/ENTRADA_COMPRAS delega para a orquestração de entrada.
  IF p_tipo_mov IN ('ENTRADA','ENTRADA_COMPRAS') THEN
    SELECT e.ncm, e.cstipi, e.base_ipi, e.valor_ipi, e.base_calc_icms, e.valor_icms,
           e.base_calc_icms_subst, e.valor_icms_subst, e.mva, e.icms_interno_destino, e.icms_externo_origem, e.cfop,
           e.aliquota_pis, e.aliquota_cofins, e.base_pis, e.base_cofins, e.valor_pis, e.valor_cofins, e.cstpis, e.cstcofins
      INTO ncm, cstipi, base_ipi, valor_ipi, base_calc_icms, valor_icms,
           base_calc_icms_subst, valor_icms_subst, mva, icms_interno_destino, icms_externo_origem, cfop,
           aliquota_pis, aliquota_cofins, base_pis, base_cofins, valor_pis, valor_cofins, cstpis, cstcofins
      FROM db_manaus.calcular_impostos_entrada(ctx, p_tipo_mov, p_tipofat, p_tipo_op, zerar_subst,
             aliquota_ipi, aliquota_icms, total_produto, base_produto, mva_antecipado) e;
    RETURN;
  END IF;

  ncm := ctx.ncm_clasfiscal;

  IF (p_tipofat = 'NOTA_FISCAL') OR (p_tipo_mov = 'ENTRADA_COMPRAS') THEN
    IF aliquota_ipi > 0 THEN base_ipi := round(base_produto, 2); ELSE base_ipi := 0.00; END IF;
    cstipi := db_manaus.validar_cstipi(ctx, p_tipo_mov, p_tipo_op);
    valor_ipi := round(base_produto * (aliquota_ipi/100), 2);

    SELECT c.base_calc_icms, c.valor_icms INTO base_calc_icms, valor_icms
      FROM db_manaus.calcular_icms(ctx, p_tipo_mov, cfop, aliquota_icms, total_produto) c;

    SELECT t.uf_iguais, t.pode_st, t.cfop INTO v_uf_iguais, v_pode_st, v_cfop_op
      FROM db_manaus.tipo_operacao_saida(ctx, p_tipo_op) t;
    cfop := v_cfop_op;

    SELECT p.aliquota_pis, p.aliquota_cofins, p.base_pis, p.base_cofins, p.valor_pis, p.valor_cofins, p.cstpis, p.cstcofins
      INTO aliquota_pis, aliquota_cofins, base_pis, base_cofins, valor_pis, valor_cofins, cstpis, cstcofins
      FROM db_manaus.calcular_pis_cofins_saida(ctx, p_tipo_op, base_produto) p;

    IF ctx.uf_origem = 'RO' AND ctx.dest_codigo = '00169' AND ctx.uf_destino = ctx.uf_origem THEN
      v_pode_st := false;
      IF db_manaus.validar_cfop_saida(ctx, p_tipo_op, v_uf_iguais, mva, valor_icms_subst) IS NOT NULL THEN
        cfop := db_manaus.validar_cfop_saida(ctx, p_tipo_op, v_uf_iguais, mva, valor_icms_subst);
      END IF;
    END IF;

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
