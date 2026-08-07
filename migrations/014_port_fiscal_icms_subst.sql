-- FASE 2 · Bloco 4b — port do ST: MVA_PRODUTO_LEGISLACAO e CALCULAR_ICMS_SUBST.
-- Tradução FIEL. mva_derivado_petroleo fica como stub (produtos de petróleo = FASE 4).

-- Variante de legislacao_icms que devolve o LEI_id usado (NULL se não achou produto no protocolo).
-- Necessária porque Calcular_ICMS_Subst passa xLEI_id_Usado a MVA_PRODUTO_LEGISLACAO.
CREATE OR REPLACE FUNCTION db_manaus._legislacao_icms_leiid(
  ctx    db_manaus.ctx_calculo_imposto,
  v_tipo text
) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
  v_produto      boolean := false;
  v_lei_id_usado numeric := NULL;
  v_emp_uf       text;
  rec            record;
BEGIN
  SELECT uf INTO v_emp_uf FROM db_manaus.dadosempresa LIMIT 1;
  IF (v_tipo = 'CONVENIO') OR (v_tipo = 'PROTOCOLO') THEN
    FOR rec IN
      SELECT picms."LEI_ID" AS lei_id FROM db_manaus.cad_legislacao_icmsst picms
        JOIN db_manaus.cad_legislacao_signatario pso ON picms."LEI_ID" = pso."LES_LEI_ID"
        JOIN db_manaus.cad_legislacao_signatario psd ON picms."LEI_ID" = psd."LES_LEI_ID"
       WHERE pso."LES_UF" = ctx.uf_origem AND psd."LES_UF" = ctx.uf_destino
         AND picms."LEI_STATUS" = 'EM VIGOR' AND picms."LEI_TIPO" = v_tipo
       ORDER BY picms."LEI_ID" DESC
    LOOP
      IF NOT v_produto THEN
        v_produto := db_manaus.produto_icms(ctx, rec.lei_id);
        IF v_produto THEN v_lei_id_usado := rec.lei_id; END IF;
      END IF;
    END LOOP;
  ELSIF (v_tipo = 'RESOLUCAO') OR (v_tipo = 'DECRETO') THEN
    FOR rec IN
      SELECT picms."LEI_ID" AS lei_id FROM db_manaus.cad_legislacao_icmsst picms
        JOIN db_manaus.cad_legislacao_signatario pso ON picms."LEI_ID" = pso."LES_LEI_ID"
       WHERE pso."LES_UF" = v_emp_uf AND v_emp_uf = ctx.uf_destino
         AND picms."LEI_STATUS" = 'EM VIGOR' AND picms."LEI_TIPO" = v_tipo
       ORDER BY picms."LEI_ID" DESC
    LOOP
      IF NOT v_produto THEN
        v_produto := db_manaus.produto_icms(ctx, rec.lei_id);
        IF v_produto THEN v_lei_id_usado := rec.lei_id; END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN v_lei_id_usado;
END;
$$;

-- Stub (FASE 4): produtos derivados de petróleo (NCM 2710193) não são nossos casos de teste.
CREATE OR REPLACE FUNCTION db_manaus.mva_derivado_petroleo(v_tipo_mov text)
RETURNS numeric LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'mva_derivado_petroleo ainda nao portado (FASE 4)';
END;
$$;

-- MVA_PRODUTO_LEGISLACAO: MVA ajustado do protocolo. A fórmula LEI_MVA_AJUSTADA é avaliada
-- via SQL dinâmico (adaptação: placeholders nomeados :MVA_ST_ORIGINAL/:ALQ_INTER/:ALQ_INTRA
-- substituídos pelos valores, e a expressão aritmética resultante é executada).
CREATE OR REPLACE FUNCTION db_manaus.mva_produto_legislacao(
  ctx         db_manaus.ctx_calculo_imposto,
  v_lei_id    numeric,
  v_tipo_mov  text
) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
  v_lei_mva_ajustada text;
  v_mva_st_original  numeric := NULL;
  v_icms_ext         numeric;
  x                  integer;
  v_formula          text;
  v_len              integer;
  xresult            numeric := 0;
BEGIN
  SELECT "LEI_MVA_AJUSTADA" INTO v_lei_mva_ajustada
    FROM db_manaus.cad_legislacao_icmsst WHERE "LEI_ID" = v_lei_id;

  -- LIN_MVA_ST_ORIGINAL do NCM (cheio, depois 7,6,5,4,3)
  SELECT "LIN_MVA_ST_ORIGINAL" INTO v_mva_st_original FROM db_manaus.cad_legislacao_icmsst_ncm
   WHERE "LIN_LEI_ID" = v_lei_id AND "LIN_NCM" = ctx.ncm_clasfiscal LIMIT 1;
  IF v_mva_st_original IS NULL THEN
    FOREACH v_len IN ARRAY ARRAY[7,6,5,4,3] LOOP
      SELECT "LIN_MVA_ST_ORIGINAL" INTO v_mva_st_original FROM db_manaus.cad_legislacao_icmsst_ncm
       WHERE "LIN_LEI_ID" = v_lei_id AND "LIN_NCM" = substr(ctx.ncm_clasfiscal,1,v_len)
         AND length("LIN_NCM") = v_len LIMIT 1;
      EXIT WHEN v_mva_st_original IS NOT NULL;
    END LOOP;
  END IF;

  -- nº de ':' (placeholders) = 1 ou 3
  x := char_length(v_lei_mva_ajustada) - char_length(replace(v_lei_mva_ajustada, ':', ''));

  IF ctx.prodimportado THEN v_icms_ext := 4.00; ELSE v_icms_ext := ctx.uf_orig_icmsexterno; END IF;

  -- (ramo ENTRADA_COMPRAS + RegimeTributario=0 é escopo ENTRADA/FASE 4; em SAIDA não se aplica)
  IF x = 3 THEN
    v_formula := replace(replace(replace(v_lei_mva_ajustada,
      ':MVA_ST_ORIGINAL', '(' || (v_mva_st_original/100)::text || ')'),
      ':ALQ_INTER',       '(' || (v_icms_ext/100)::text || ')'),
      ':ALQ_INTRA',       '(' || (ctx.uf_dest_icmsinterno/100)::text || ')');
    EXECUTE 'SELECT round((' || v_formula || '),4)' INTO xresult;
  ELSIF x = 1 THEN
    v_formula := replace(v_lei_mva_ajustada,
      ':MVA_ST_ORIGINAL', '(' || (v_mva_st_original/100)::text || ')');
    EXECUTE 'SELECT round((' || v_formula || '),4)' INTO xresult;
  ELSE
    xresult := 0;
  END IF;

  RETURN xresult;
END;
$$;

-- CALCULAR_ICMS_SUBST: determinação do MVA e cálculo de base/valor da ST.
CREATE OR REPLACE FUNCTION db_manaus.calcular_icms_subst(
  ctx             db_manaus.ctx_calculo_imposto,
  p_tipo_mov      text,
  p_tipo_op       text,
  zerar_subst     text,
  valor_ipi       numeric,
  total_produto   numeric,
  mva_antecipado  numeric,
  base_produto    numeric,
  valoricms       numeric,
  OUT base_calc_icms_subst numeric,
  OUT valor_icms_subst     numeric,
  OUT mva                  numeric,
  OUT icms_interno_destino numeric,
  OUT icms_externo_origem  numeric
)
LANGUAGE plpgsql AS $$
DECLARE
  v_emp_uf text;
  v_lei_id numeric;
BEGIN
  SELECT uf INTO v_emp_uf FROM db_manaus.dadosempresa LIMIT 1;
  icms_interno_destino := ctx.uf_dest_icmsinterno;
  IF ctx.prodimportado THEN icms_externo_origem := 4.00; ELSE icms_externo_origem := ctx.uf_orig_icmsexterno; END IF;

  -- Determinação do MVA
  IF zerar_subst = 'S' THEN
    icms_interno_destino := 0.00; icms_externo_origem := 0.00; mva := 0;
  ELSIF ctx.dest_tipodestino = 'F' AND ctx.dest_inscestadual = 'ISENTO' THEN
    icms_interno_destino := 0.00; icms_externo_origem := 0.00; mva := 0;
  ELSIF mva_antecipado > 0 THEN
    mva := mva_antecipado / 100;
  ELSIF db_manaus.derivado_petroleo(ctx) THEN
    mva := db_manaus.mva_derivado_petroleo(p_tipo_mov);
  ELSIF (ctx.uf_origem <> ctx.uf_destino)
        AND (db_manaus._legislacao_icms_leiid(ctx, 'CONVENIO') IS NOT NULL) THEN
    mva := db_manaus.mva_produto_legislacao(ctx, db_manaus._legislacao_icms_leiid(ctx, 'CONVENIO'), p_tipo_mov);
  ELSIF (ctx.uf_origem <> ctx.uf_destino)
        AND (db_manaus._legislacao_icms_leiid(ctx, 'PROTOCOLO') IS NOT NULL) THEN
    mva := db_manaus.mva_produto_legislacao(ctx, db_manaus._legislacao_icms_leiid(ctx, 'PROTOCOLO'), p_tipo_mov);
  ELSIF (ctx.uf_origem <> ctx.uf_destino)
        AND (db_manaus._legislacao_icms_leiid(ctx, 'DECRETO') IS NOT NULL) THEN
    mva := db_manaus.mva_produto_legislacao(ctx, db_manaus._legislacao_icms_leiid(ctx, 'DECRETO'), p_tipo_mov);
  ELSIF (ctx.uf_origem <> ctx.uf_destino)
        AND (db_manaus._legislacao_icms_leiid(ctx, 'RESOLUCAO') IS NOT NULL) THEN
    mva := db_manaus.mva_produto_legislacao(ctx, db_manaus._legislacao_icms_leiid(ctx, 'RESOLUCAO'), p_tipo_mov);
  ELSIF (COALESCE(ctx.ncm_agregado,0) > 0) AND (ctx.uf_origem <> ctx.uf_destino) THEN
    IF v_emp_uf = 'RO' THEN
      mva := ROUND(COALESCE(ctx.ncm_agregado,0.00) / 100, 4);
    ELSE
      mva := ROUND((((1 + (COALESCE(ctx.ncm_agregado,0.00)/100)) * (1 - (icms_externo_origem/100)) /
                    (1 - (icms_interno_destino/100))) - 1), 4);
    END IF;
  ELSE
    mva := 0;
  END IF;

  -- Base e Valor da ST
  IF mva > 0 THEN
    IF ctx.uf_destino = 'MT' THEN
      mva := 0.18;
      base_calc_icms_subst := ROUND(((total_produto*(icms_externo_origem/100)) + ((total_produto+valor_ipi)*0.18)) / (icms_interno_destino/100), 2);
      valor_icms_subst := ROUND(((total_produto+valor_ipi)*0.18), 2);
    ELSIF ctx.uf_destino = 'MS' THEN
      mva := 0.18;
      base_calc_icms_subst := ROUND(((total_produto*(icms_externo_origem/100)) + ((total_produto+valor_ipi)*0.18)) / (icms_interno_destino/100), 2);
      valor_icms_subst := ROUND(((total_produto+valor_ipi)*0.18), 2);
    ELSIF ctx.dest_tipodestino = 'F' AND ctx.dest_inscestadual <> 'ISENTO' THEN
      mva := 0.00;
      base_calc_icms_subst := ROUND(total_produto + valor_ipi, 2);
      valor_icms_subst := ROUND((base_calc_icms_subst*(icms_interno_destino/100)) - ((base_produto)*(icms_externo_origem/100)), 2);
    -- (ramo ENTRADA_COMPRAS BaseReduzida_ST: escopo ENTRADA/FASE 4)
    ELSE
      base_calc_icms_subst := ROUND(((total_produto+valor_ipi)*(1+mva)), 2);
      IF db_manaus.derivado_petroleo(ctx) THEN
        valor_icms_subst := ROUND((base_calc_icms_subst*(icms_interno_destino/100)), 2);
      ELSE
        valor_icms_subst := ROUND((base_calc_icms_subst*(icms_interno_destino/100)) - ((base_produto)*(icms_externo_origem/100)), 2);
      END IF;
    END IF;
  ELSE
    base_calc_icms_subst := 0.00;
    valor_icms_subst := 0.00;
  END IF;
END;
$$;
