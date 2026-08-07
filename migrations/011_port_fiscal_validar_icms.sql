-- FASE 2 · Bloco 2b — port de PRODUTO_ICMS, LEGISLACAO_ICMS e VALIDAR_ICMS
-- do CALCULO_IMPOSTO (Oracle) para PL/pgSQL. Tradução FIEL.
-- Colunas das tabelas de legislação são MAIÚSCULAS no PG ("LEI_ID","LES_LEI_ID","LIN_NCM"...).

-- PRODUTO_ICMS: NCM (RowNCM.Ncm = ctx.ncm_clasfiscal) está no protocolo vLEI_ID?
-- Checa NCM cheio (8) e depois substrings 7,6,5,4,3 (com filtro de comprimento).
CREATE OR REPLACE FUNCTION db_manaus.produto_icms(
  ctx      db_manaus.ctx_calculo_imposto,
  v_lei_id numeric
) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  xencontrou integer;
  v_len      integer;
BEGIN
  -- NCM cheio (sem filtro de comprimento, igual ao Oracle)
  SELECT COUNT(*) INTO xencontrou FROM db_manaus.cad_legislacao_icmsst_ncm
   WHERE "LIN_LEI_ID" = v_lei_id AND "LIN_NCM" = ctx.ncm_clasfiscal;
  IF xencontrou > 0 THEN RETURN true; END IF;
  -- substrings 7,6,5,4,3 com length(LIN_NCM)=len
  FOREACH v_len IN ARRAY ARRAY[7,6,5,4,3] LOOP
    SELECT COUNT(*) INTO xencontrou FROM db_manaus.cad_legislacao_icmsst_ncm
     WHERE "LIN_LEI_ID" = v_lei_id
       AND "LIN_NCM" = substr(ctx.ncm_clasfiscal, 1, v_len)
       AND length("LIN_NCM") = v_len;
    IF xencontrou > 0 THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- LEGISLACAO_ICMS: NCM está em alguma lei EM VIGOR do tipo vTipo, entre as UFs origem/destino?
CREATE OR REPLACE FUNCTION db_manaus.legislacao_icms(
  ctx    db_manaus.ctx_calculo_imposto,
  v_tipo text
) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  v_participacao boolean := false;
  v_produto      boolean := false;
  v_emp_uf       text;
  rec            record;
BEGIN
  SELECT uf INTO v_emp_uf FROM db_manaus.dadosempresa LIMIT 1;

  IF (v_tipo = 'CONVENIO') OR (v_tipo = 'PROTOCOLO') THEN
    FOR rec IN
      SELECT picms."LEI_ID" AS lei_id
        FROM db_manaus.cad_legislacao_icmsst picms
        JOIN db_manaus.cad_legislacao_signatario pso ON picms."LEI_ID" = pso."LES_LEI_ID"
        JOIN db_manaus.cad_legislacao_signatario psd ON picms."LEI_ID" = psd."LES_LEI_ID"
       WHERE pso."LES_UF" = ctx.uf_origem AND psd."LES_UF" = ctx.uf_destino
         AND picms."LEI_STATUS" = 'EM VIGOR' AND picms."LEI_TIPO" = v_tipo
       ORDER BY picms."LEI_ID" DESC
    LOOP
      v_participacao := true;
      IF NOT v_produto THEN v_produto := db_manaus.produto_icms(ctx, rec.lei_id); END IF;
    END LOOP;
  ELSIF (v_tipo = 'RESOLUCAO') OR (v_tipo = 'DECRETO') THEN
    FOR rec IN
      SELECT picms."LEI_ID" AS lei_id
        FROM db_manaus.cad_legislacao_icmsst picms
        JOIN db_manaus.cad_legislacao_signatario pso ON picms."LEI_ID" = pso."LES_LEI_ID"
       WHERE pso."LES_UF" = v_emp_uf AND v_emp_uf = ctx.uf_destino
         AND picms."LEI_STATUS" = 'EM VIGOR' AND picms."LEI_TIPO" = v_tipo
       ORDER BY picms."LEI_ID" DESC
    LOOP
      v_participacao := true;
      IF NOT v_produto THEN v_produto := db_manaus.produto_icms(ctx, rec.lei_id); END IF;
    END LOOP;
  END IF;

  RETURN (v_participacao AND v_produto);
END;
$$;

-- VALIDAR_ICMS: alíquota de ICMS. Tradução fiel (CIDADE_Destino.Uf -> ctx.uf_destino;
-- xDadosEmpresa.uf -> ctx.uf_origem, pois em SAIDA origem = empresa).
CREATE OR REPLACE FUNCTION db_manaus.validar_icms(
  ctx            db_manaus.ctx_calculo_imposto,
  insc_estadual  text,
  cfop           text
) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
  xresult numeric;
BEGIN
  IF cfop = '1600' THEN
    xresult := 6.00;
  ELSIF cfop IN ('6915','6916') THEN
    xresult := 0.00;
  ELSIF cfop IN ('5551','6651','1553') THEN
    IF ctx.uf_origem = ctx.uf_destino THEN
      xresult := ctx.uf_orig_icmsinterno;
    ELSE
      IF ctx.prodimportado THEN xresult := 4.00; ELSE xresult := ctx.uf_orig_icmsexterno; END IF;
    END IF;
  ELSIF (insc_estadual = '07') AND (cfop = '1603') THEN
    xresult := 6.00;
  ELSIF (insc_estadual = '07') THEN
    IF ctx.prodimportado THEN xresult := 4.00; ELSE xresult := ctx.uf_orig_icmsexterno; END IF;
  ELSIF ctx.uf_origem = 'RO' AND ctx.dest_codigo = '00169' AND ctx.uf_destino = ctx.uf_origem THEN
    IF ctx.prodimportado THEN xresult := 4.00; ELSE xresult := ctx.uf_orig_icmsinterno; END IF;
  ELSIF db_manaus.legislacao_icms(ctx, 'CONVENIO') THEN
    IF ctx.uf_origem = ctx.uf_destino THEN xresult := 0.00;
    ELSE IF ctx.prodimportado THEN xresult := 4.00; ELSE xresult := ctx.uf_orig_icmsexterno; END IF; END IF;
  ELSIF db_manaus.legislacao_icms(ctx, 'PROTOCOLO') THEN
    IF ctx.uf_origem = ctx.uf_destino THEN xresult := 0.00;
    ELSE IF ctx.prodimportado THEN xresult := 4.00; ELSE xresult := ctx.uf_orig_icmsexterno; END IF; END IF;
  ELSIF db_manaus.legislacao_icms(ctx, 'RESOLUCAO') THEN
    IF ctx.uf_origem = ctx.uf_destino THEN xresult := 0.00;
    ELSE IF ctx.prodimportado THEN xresult := 4.00; ELSE xresult := ctx.uf_orig_icmsexterno; END IF; END IF;
  ELSIF db_manaus.legislacao_icms(ctx, 'DECRETO') THEN
    IF ctx.uf_origem = ctx.uf_destino THEN xresult := 0.00;
    ELSE IF ctx.prodimportado THEN xresult := 4.00; ELSE xresult := ctx.uf_orig_icmsexterno; END IF; END IF;
  ELSIF COALESCE(ctx.ncm_agregado, 0) > 0 THEN
    IF ctx.uf_origem = ctx.uf_destino THEN xresult := 0.00;
    ELSE IF ctx.prodimportado THEN xresult := 4.00; ELSE xresult := ctx.uf_orig_icmsexterno; END IF; END IF;
  ELSIF ctx.uf_origem = ctx.uf_destino THEN
    xresult := ctx.uf_orig_icmsinterno;
  ELSE
    IF ctx.prodimportado THEN xresult := 4.00; ELSE xresult := ctx.uf_orig_icmsexterno; END IF;
  END IF;

  RETURN xresult;
END;
$$;
