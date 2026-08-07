-- FASE 2 · Bloco 7 — port de CALCULAR_IBS_CBS (Reforma Tributária) como FUNÇÃO ISOLADA.
-- Tradução FIEL. Hoje INFORMATIVO (transição). Ponto de plugue quando a reforma entrar em vigor.
-- Retorna os campos essenciais (armazenados em dbitvenda/dbprodfat) + os do regime tributável.
-- Depende de dbuf_n.ibs e dbmunicipio.ibs (migration 018).
--
-- NOTA DE FIDELIDADE (bug preservado): no ramo CST '000' o Oracle faz
--   gibscbs_vibs := round(gibscbs_gibsuf_vibsuf + gibscbs_gibsmun_PIBSMUN, 2)
-- somando o VALOR do IBS-UF com a ALÍQUOTA do IBS-MUN (provável erro). Como a regra é
-- "traduzir, não melhorar", replico exatamente. (Com dbmunicipio.ibs=0 hoje o efeito é nulo.)

CREATE OR REPLACE FUNCTION db_manaus.calcular_ibs_cbs(
  ctx           db_manaus.ctx_calculo_imposto,
  tipooperacao  text,
  cfop          text,
  total_produto numeric,
  OUT ibscbs_cst            text,
  OUT ibscbs_cclasstrib     text,
  OUT gibscbs_vbc           numeric,
  OUT gibsuf_pibsuf         numeric,
  OUT gibsuf_vibsuf         numeric,
  OUT gibsmun_pibsmun       numeric,
  OUT gibsmun_vibsmun       numeric,
  OUT gibscbs_vibs          numeric,
  OUT gcbs_pcbs             numeric,
  OUT gcbs_vcbs             numeric,
  OUT tribreg_vibsuf        numeric,
  OUT tribreg_vibsmun       numeric,
  OUT tribreg_vcbs          numeric
)
LANGUAGE plpgsql AS $$
DECLARE
  xibsuf  numeric;
  xibsmun numeric;
  xcbs    numeric;
  alc integer[] := ARRAY[1100106,1200104,1200203,1200252,1304062,1400100,1400159,1400456,1600303,1600600];
BEGIN
  xibsuf  := round((SELECT ibs FROM db_manaus.dbuf_n WHERE "UF" = ctx.uf_destino), 4);
  xibsmun := round(COALESCE((SELECT ibs FROM db_manaus.dbmunicipio WHERE codmunicipio = ctx.cidade_dest_codmun::text), 0), 4);
  xcbs    := round(0.9, 4);

  IF tipooperacao = 'TRANSFERENCIA' THEN
    ibscbs_cst := '410'; ibscbs_cclasstrib := '410002';
  ELSIF substr(cfop, 1, 1) IN ('7') THEN
    ibscbs_cst := '410'; ibscbs_cclasstrib := '410004';
  ELSIF tipooperacao IN ('REMESSA_CONSERTO','RETORNO_CONSERTO') THEN
    ibscbs_cst := '410'; ibscbs_cclasstrib := '410999';
  ELSIF (ctx.cidade_orig_codmun <> ALL(alc)) AND (ctx.cidade_dest_codmun = ANY(alc)) THEN
    ibscbs_cst := '200'; ibscbs_cclasstrib := '200024';
    gibscbs_vbc := total_produto;
    gibsuf_pibsuf := 0.0000; gibsuf_vibsuf := 0.00;
    gibsmun_pibsmun := 0.0000; gibsmun_vibsmun := 0.00;
    gibscbs_vibs := 0.00;
    gcbs_pcbs := 0; gcbs_vcbs := 0.00;
    tribreg_vibsuf := round(gibscbs_vbc * xibsuf / 100, 2);
    tribreg_vibsmun := round(gibscbs_vbc * xibsmun / 100, 2);
    tribreg_vcbs := round(gibscbs_vbc * xcbs / 100, 2);
  ELSIF (ctx.cidade_orig_codmun <> ALL(ARRAY[9999999,1302603,1303569,1303536]))
        AND (ctx.cidade_dest_codmun = ANY(ARRAY[1302603,1303569,1303536])) THEN
    ibscbs_cst := '200'; ibscbs_cclasstrib := '200022';
    gibscbs_vbc := total_produto;
    gibsuf_pibsuf := 0.0000; gibsuf_vibsuf := 0.00;
    gibsmun_pibsmun := 0.0000; gibsmun_vibsmun := 0.00;
    gibscbs_vibs := 0.00;
    gcbs_pcbs := 0.0000; gcbs_vcbs := 0.00;
    tribreg_vibsuf := round(gibscbs_vbc * xibsuf / 100, 2);
    tribreg_vibsmun := round(gibscbs_vbc * xibsmun / 100, 2);
    tribreg_vcbs := round(gibscbs_vbc * xcbs / 100, 2);
  ELSE
    ibscbs_cst := '000'; ibscbs_cclasstrib := '000001';
    gibscbs_vbc := total_produto;
    gibsuf_pibsuf := xibsuf;
    gibsuf_vibsuf := round(gibscbs_vbc * xibsuf / 100, 2);
    gibsmun_pibsmun := xibsmun;
    gibsmun_vibsmun := round(gibscbs_vbc * xibsmun / 100, 2);
    -- FIEL ao Oracle: valor_uf + ALÍQUOTA_mun (ver nota de fidelidade acima)
    gibscbs_vibs := round(gibsuf_vibsuf + gibsmun_pibsmun, 2);
    gcbs_pcbs := xcbs;
    gcbs_vcbs := round(gibscbs_vbc * xcbs / 100, 2);
  END IF;
END;
$$;
