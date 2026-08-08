-- FASE 4 · P3 (A2, parte 2a) — estende ctx + contexto ENTRADA/ENTRADA_COMPRAS.
-- 1) ALTER TYPE: campos do fornecedor (origem), tipo do produto e flags de RowRegraCredor.
-- 2) _inicializar_contexto: suporte COMPLETO a SAÍDA (inalterado) + ENTRADA + ENTRADA_COMPRAS.
--    (Oracle CALCULO_IMPOSTO.INICIALIZACAO/ORIGEM_DESTINO: 3055-3231.)
-- 3) Guard temporário em calcular_impostos_saida: enquanto a orquestração ENTRADA não existe
--    (parte 2b), ENTRADA levanta erro explícito em vez de rodar a lógica de SAÍDA.

-- ===== 1) novos atributos no tipo (idempotente) =====
DO $$
DECLARE
  v_attrs text[][] := ARRAY[
    ['orig_regimetributario','text'], ['orig_fabricante','text'], ['prod_tipo','text'],
    ['rc_piscofins_365','numeric'], ['rc_piscofins_925','numeric'],
    ['rc_piscofins_1150','numeric'], ['rc_piscofins_1310','numeric'],
    ['rc_desc_icms_sufra_piscofins','numeric'], ['rc_basereduzida_st','numeric'],
    ['rc_desc_icms_sufra_st','numeric'], ['rc_desc_piscofins_st','numeric'],
    ['rc_acres_piscofins_st','numeric']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(v_attrs, 1) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN pg_type t ON t.typrelid = a.attrelid
      WHERE t.typname = 'ctx_calculo_imposto'
        AND t.typnamespace = 'db_manaus'::regnamespace
        AND a.attname = v_attrs[i][1] AND NOT a.attisdropped
    ) THEN
      EXECUTE format('ALTER TYPE db_manaus.ctx_calculo_imposto ADD ATTRIBUTE %I %s CASCADE',
                     v_attrs[i][1], v_attrs[i][2]);
    END IF;
  END LOOP;
END $$;

-- ===== 2) _inicializar_contexto com os 3 movimentos =====
CREATE OR REPLACE FUNCTION db_manaus._inicializar_contexto(
  p_tipo_mov      text,
  p_tipo_op       text,
  p_codprod       text,
  p_codigo        text,
  p_codterceiro   text
) RETURNS db_manaus.ctx_calculo_imposto
LANGUAGE plpgsql AS $$
DECLARE
  ctx        db_manaus.ctx_calculo_imposto;
  v_emp_uf   text;
  v_emp_mun  text;
  v_ter      text := COALESCE(NULLIF(trim(p_codterceiro), ''), p_codigo);
  v_orig_kind text;  v_orig_code text;   -- 'EMP' | 'CLI' | 'FOR'
  v_dest_kind text;  v_dest_code text;
BEGIN
  SELECT uf, municipio INTO v_emp_uf, v_emp_mun FROM db_manaus.dadosempresa LIMIT 1;

  -- ---- decide quem é ORIGEM e quem é DESTINO por movimento+operação ----
  IF p_tipo_mov = 'SAIDA' THEN
    IF p_tipo_op IN ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA',
                     'REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO') THEN
      v_orig_kind:='CLI'; v_orig_code:=p_codigo;  v_dest_kind:='EMP';
    ELSIF p_tipo_op = 'EXTRAVIO_AVARIA_FABRICA' THEN
      v_orig_kind:='CLI'; v_orig_code:=v_ter;     v_dest_kind:='EMP';
    ELSIF p_tipo_op = 'EXTRAVIO_AVARIA_CLIENTE' THEN
      v_orig_kind:='EMP';                          v_dest_kind:='CLI'; v_dest_code:=v_ter;
    ELSE
      v_orig_kind:='EMP';                          v_dest_kind:='CLI'; v_dest_code:=v_ter;
    END IF;

  ELSIF p_tipo_mov = 'ENTRADA_COMPRAS' THEN
    IF p_tipo_op IN ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA',
                     'RETORNO_GARANTIA_CLIENTE','RETORNO_CONSERTO') THEN
      v_orig_kind:='EMP';                          v_dest_kind:='FOR'; v_dest_code:=p_codigo;
    ELSE
      v_orig_kind:='FOR'; v_orig_code:=p_codigo;   v_dest_kind:='EMP';
    END IF;

  ELSIF p_tipo_mov = 'ENTRADA' THEN
    IF p_tipo_op IN ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA',
                     'RETORNO_GARANTIA_CLIENTE','RETORNO_CONSERTO') THEN
      v_orig_kind:='EMP';                          v_dest_kind:='CLI'; v_dest_code:=p_codigo;
    ELSE
      v_orig_kind:='CLI'; v_orig_code:=p_codigo;   v_dest_kind:='EMP';
    END IF;
  ELSE
    RAISE EXCEPTION 'tipo_movimentacao % nao suportado', p_tipo_mov;
  END IF;

  -- ---- ORIGEM ----
  IF v_orig_kind = 'EMP' THEN
    ctx.uf_origem := v_emp_uf;
    SELECT "ICMSINTERNO","ICMSEXTERNO" INTO ctx.uf_orig_icmsinterno, ctx.uf_orig_icmsexterno
      FROM db_manaus.dbuf_n WHERE "UF" = v_emp_uf;
    ctx.cidade_orig_codmun := (SELECT m.codmunicipio FROM db_manaus.dbmunicipio m
                                WHERE m.descricao = v_emp_mun AND m.uf = v_emp_uf LIMIT 1);
    ctx.orig_regimetributario := '2';  ctx.orig_fabricante := 'N';   -- SETDADOS MELO
  ELSIF v_orig_kind = 'CLI' THEN
    SELECT c.uf, c.codmunicipio, c.sit_tributaria INTO ctx.uf_origem, ctx.cidade_orig_codmun, ctx.orig_regimetributario
      FROM db_manaus.dbclien c WHERE c.codcli = v_orig_code;
    SELECT "ICMSINTERNO","ICMSEXTERNO" INTO ctx.uf_orig_icmsinterno, ctx.uf_orig_icmsexterno
      FROM db_manaus.dbuf_n WHERE "UF" = ctx.uf_origem;
    ctx.orig_fabricante := 'N';         -- SETDADOS cliente usa fabricante 'N'
  ELSE  -- FOR (fornecedor)
    SELECT f.uf, f.codmunicipio, f.regime_tributacao, f.fabricante
      INTO ctx.uf_origem, ctx.cidade_orig_codmun, ctx.orig_regimetributario, ctx.orig_fabricante
      FROM db_manaus.dbcredor f WHERE f.cod_credor = v_orig_code;
    SELECT "ICMSINTERNO","ICMSEXTERNO" INTO ctx.uf_orig_icmsinterno, ctx.uf_orig_icmsexterno
      FROM db_manaus.dbuf_n WHERE "UF" = ctx.uf_origem;
    -- RowRegraCredor (cad_credor_regra_faturamento por crf_id = cod_credor)
    SELECT r.piscofins_365, r.piscofins_925, r.piscofins_1150, r.piscofins_1310,
           r.desc_icms_sufra_piscofins, r.basereduzida_st, r.desc_icms_sufra_st,
           r.desc_piscofins_st, r.acres_piscofins_st
      INTO ctx.rc_piscofins_365, ctx.rc_piscofins_925, ctx.rc_piscofins_1150, ctx.rc_piscofins_1310,
           ctx.rc_desc_icms_sufra_piscofins, ctx.rc_basereduzida_st, ctx.rc_desc_icms_sufra_st,
           ctx.rc_desc_piscofins_st, ctx.rc_acres_piscofins_st
      FROM db_manaus.cad_credor_regra_faturamento r WHERE r.crf_id = v_orig_code;
  END IF;

  -- ---- DESTINO ----
  IF v_dest_kind = 'EMP' THEN
    ctx.uf_destino := v_emp_uf;
    SELECT "ICMSINTERNO","ICMSEXTERNO","ZONA_ISENTIVADA"
      INTO ctx.uf_dest_icmsinterno, ctx.uf_dest_icmsexterno, ctx.uf_dest_zona_isentivada
      FROM db_manaus.dbuf_n WHERE "UF" = v_emp_uf;
    ctx.cidade_dest_codmun := (SELECT m.codmunicipio FROM db_manaus.dbmunicipio m
                                WHERE m.descricao = v_emp_mun AND m.uf = v_emp_uf LIMIT 1);
    ctx.dest_codigo:='000'; ctx.dest_tipodestino:='R'; ctx.dest_inscestadual:='MELO'; ctx.dest_regimetributario:='2';
  ELSIF v_dest_kind = 'CLI' THEN
    SELECT c.uf, c.tipocliente, COALESCE(c.iest,'ISENTO'), c.sit_tributaria, c.codmunicipio, c.codcli
      INTO ctx.uf_destino, ctx.dest_tipodestino, ctx.dest_inscestadual, ctx.dest_regimetributario,
           ctx.cidade_dest_codmun, ctx.dest_codigo
      FROM db_manaus.dbclien c WHERE c.codcli = v_dest_code;
    SELECT "ICMSINTERNO","ICMSEXTERNO","ZONA_ISENTIVADA"
      INTO ctx.uf_dest_icmsinterno, ctx.uf_dest_icmsexterno, ctx.uf_dest_zona_isentivada
      FROM db_manaus.dbuf_n WHERE "UF" = ctx.uf_destino;
  ELSE  -- FOR (fornecedor) — SETDADOS DESTINO fornecedor: tipo 'R', iest, regime
    SELECT f.uf, COALESCE(f.iest,'ISENTO'), f.regime_tributacao, f.codmunicipio, f.cod_credor
      INTO ctx.uf_destino, ctx.dest_inscestadual, ctx.dest_regimetributario, ctx.cidade_dest_codmun, ctx.dest_codigo
      FROM db_manaus.dbcredor f WHERE f.cod_credor = v_dest_code;
    ctx.dest_tipodestino := 'R';
    SELECT "ICMSINTERNO","ICMSEXTERNO","ZONA_ISENTIVADA"
      INTO ctx.uf_dest_icmsinterno, ctx.uf_dest_icmsexterno, ctx.uf_dest_zona_isentivada
      FROM db_manaus.dbuf_n WHERE "UF" = ctx.uf_destino;
  END IF;

  -- ---- produto / NCM / flags (comum) ----
  SELECT p.strib, p.isentoipi, COALESCE(p.ipi,0), COALESCE(p.percsubst,0), p.clasfiscal, p.pis, p.cofins, p.tipo
    INTO ctx.prod_strib, ctx.prod_isentoipi, ctx.prod_ipi, ctx.prod_percsubst, ctx.prod_clasfiscal,
         ctx.prod_pis, ctx.prod_cofins, ctx.prod_tipo
    FROM db_manaus.dbprod p WHERE p.codprod = p_codprod;

  ctx.ncm_ipi        := COALESCE(ctx.prod_ipi, 0);
  ctx.ncm_agregado   := COALESCE(ctx.prod_percsubst, 0);
  ctx.ncm_pis        := ctx.prod_pis;
  ctx.ncm_cofins     := ctx.prod_cofins;
  ctx.ncm_clasfiscal := substr(ctx.prod_clasfiscal, 1, 8);
  ctx.prodimportado  := substr(ctx.prod_strib, 1, 1) IN ('1','2','3','8');
  ctx.basereduzida   := false;
  ctx.regra_cobrar_ipi_import := NULL;

  RETURN ctx;
END;
$$;

-- ===== 3) guard temporário: ENTRADA ainda não tem orquestração (parte 2b) =====
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
  IF p_tipo_mov IN ('ENTRADA','ENTRADA_COMPRAS') THEN
    RAISE EXCEPTION 'orquestracao ENTRADA pendente (FASE 4 A2 parte 2b)';
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
