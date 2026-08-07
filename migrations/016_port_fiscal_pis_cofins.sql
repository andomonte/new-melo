-- FASE 2 · Bloco 5 — port de NCM_MONOFASICO e CALCULAR_PIS_COFINS_SAIDA. Tradução FIEL.
-- (Calcular_PIS_COFINS_Compra e PIS_COFINS_VENDA = escopo ENTRADA/auxiliar → FASE 4.)

-- NCM no cadastro monofásico? (DBCLASSIFICACAO_PISCOFINS, NCM cheio depois 7,6,5,4,3)
CREATE OR REPLACE FUNCTION db_manaus.ncm_monofasico(
  ctx db_manaus.ctx_calculo_imposto
) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  xencontrou integer;
  v_len      integer;
BEGIN
  SELECT COUNT(*) INTO xencontrou FROM db_manaus.dbclassificacao_piscofins
   WHERE "NCM" = ctx.ncm_clasfiscal;
  IF xencontrou > 0 THEN RETURN true; END IF;
  FOREACH v_len IN ARRAY ARRAY[7,6,5,4,3] LOOP
    SELECT COUNT(*) INTO xencontrou FROM db_manaus.dbclassificacao_piscofins
     WHERE "NCM" = substr(ctx.ncm_clasfiscal,1,v_len) AND length("NCM") = v_len;
    IF xencontrou > 0 THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION db_manaus.calcular_pis_cofins_saida(
  ctx           db_manaus.ctx_calculo_imposto,
  tipooperacao  text,
  base_produto  numeric,
  OUT aliquota_pis    numeric,
  OUT aliquota_cofins numeric,
  OUT base_pis        numeric,
  OUT base_cofins     numeric,
  OUT valor_pis       numeric,
  OUT valor_cofins    numeric,
  OUT cstpis          text,
  OUT cstcofins       text
)
LANGUAGE plpgsql AS $$
DECLARE
  v_cidade_dest text;
BEGIN
  v_cidade_dest := (SELECT descricao FROM db_manaus.dbmunicipio
                     WHERE codmunicipio = ctx.cidade_dest_codmun::text);

  IF ctx.uf_destino = 'EX' THEN
    cstpis := '08'; aliquota_pis := 0.00; base_pis := 0.00; valor_pis := 0.00;
    cstcofins := '08'; aliquota_cofins := 0.00; base_cofins := 0.00; valor_cofins := 0.00;
  ELSIF db_manaus.ncm_monofasico(ctx) AND (tipooperacao IN ('VENDA')) THEN
    cstpis := '04'; aliquota_pis := 0.00; base_pis := 0.00; base_cofins := 0.00; valor_pis := 0.00;
    cstcofins := '04'; aliquota_cofins := 0.00; valor_cofins := 0.00;
  ELSIF (((COALESCE(ctx.prod_pis,0) + COALESCE(ctx.prod_cofins,0)) = 13.10)
      OR ((COALESCE(ctx.prod_pis,0) + COALESCE(ctx.prod_cofins,0)) = 11.50))
      AND (tipooperacao IN ('VENDA')) THEN
    cstpis := '04'; aliquota_pis := 0.00; base_pis := 0.00; valor_pis := 0.00;
    cstcofins := '04'; aliquota_cofins := 0.00; base_cofins := 0.00; valor_cofins := 0.00;
  ELSIF (tipooperacao IN ('VENDA'))
      AND (v_cidade_dest IN ('MANAUS','BRASILEIA','MACAPA','SANTANA','TABATINGA','BOA VISTA','BONFIM','GUAJARA-MIRIM'))
      AND (ctx.uf_origem = 'AM') THEN
    cstpis := '06'; aliquota_pis := 0.00; base_pis := 0.00; base_cofins := 0.00; valor_pis := 0.00;
    cstcofins := '06'; aliquota_cofins := 0.00; valor_cofins := 0.00;
  ELSIF (tipooperacao IN ('VENDA')) THEN
    cstpis := '01'; aliquota_pis := 1.65; base_pis := base_produto; valor_pis := round((base_produto * 0.0165), 2);
    cstcofins := '01'; aliquota_cofins := 7.60; base_cofins := base_produto; valor_cofins := round((base_produto * 0.076), 2);
  ELSE
    cstpis := '49'; aliquota_pis := 0.00; base_pis := 0.00; base_cofins := 0.00; valor_pis := 0.00;
    cstcofins := '49'; aliquota_cofins := 0.00; valor_cofins := 0.00;
  END IF;
END;
$$;
