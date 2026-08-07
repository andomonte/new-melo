-- FASE 2 · Bloco 4a — port de DERIVADO_PETROLEO e CALCULAR_ICMS (base/valor do ICMS).
-- Tradução FIEL do caminho SAIDA. Os ramos ENTRADA_COMPRAS de base reduzida
-- (RowRegraCredor.desc_icms_sufra_base/importado_base) são escopo ENTRADA → FASE 4.

CREATE OR REPLACE FUNCTION db_manaus.derivado_petroleo(
  ctx db_manaus.ctx_calculo_imposto
) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  RETURN substr(ctx.ncm_clasfiscal, 1, 7) = '2710193';
END;
$$;

CREATE OR REPLACE FUNCTION db_manaus.calcular_icms(
  ctx            db_manaus.ctx_calculo_imposto,
  p_tipo_mov     text,
  cfop           text,
  aliquota_icms  numeric,
  total_produto  numeric,
  OUT base_calc_icms numeric,
  OUT valor_icms     numeric
)
LANGUAGE plpgsql AS $$
DECLARE
  xbasealterada numeric;
BEGIN
  IF aliquota_icms > 0 THEN
    -- (ramos ENTRADA_COMPRAS de base reduzida omitidos — escopo ENTRADA/FASE 4;
    --  em SAIDA RowRegraCredor é nulo e a condição ENTRADA_COMPRAS é falsa)
    xbasealterada := total_produto;
    IF cfop IN ('5551','6651','1553') THEN
      base_calc_icms := round(xbasealterada * 0.20, 2);
    ELSE
      base_calc_icms := round(xbasealterada, 2);
    END IF;
  ELSE
    base_calc_icms := 0.00;
  END IF;

  -- Valor do ICMS
  IF ctx.basereduzida AND (aliquota_icms > 0) THEN
    valor_icms := round(base_calc_icms * (7.00 / 100), 2);
    base_calc_icms := round(valor_icms * 100 / aliquota_icms, 2);
  ELSE
    valor_icms := round(base_calc_icms * (aliquota_icms / 100), 2);
  END IF;
END;
$$;
