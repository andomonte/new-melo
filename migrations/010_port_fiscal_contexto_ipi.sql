-- FASE 2 · Bloco 2a — port do CONTEXTO (INICIALIZACAO/ORIGEM_DESTINO/CARREGAR_NCM)
-- e de VALIDAR_IPI, do CALCULO_IMPOSTO (Oracle) para PL/pgSQL.
-- Tradução FIEL. O estado de package do Oracle vira um RECORD de contexto explícito.
-- ADAPTAÇÕES registradas em docs/divergencias-traducao.md.

-- Tipo de contexto (equivale às variáveis públicas RowUF_*, CIDADE_*, RowProd, RowNCM,
-- DadosDestino, ProdImportado, BaseReduzida do package Oracle).
DROP TYPE IF EXISTS db_manaus.ctx_calculo_imposto CASCADE;
CREATE TYPE db_manaus.ctx_calculo_imposto AS (
  uf_origem                text,
  uf_destino               text,
  uf_orig_icmsinterno      numeric,
  uf_orig_icmsexterno      numeric,
  uf_dest_icmsinterno      numeric,
  uf_dest_icmsexterno      numeric,
  uf_dest_zona_isentivada  text,
  cidade_orig_codmun       integer,
  cidade_dest_codmun       integer,
  prod_strib               text,
  prod_isentoipi           text,
  prod_ipi                 numeric,
  prod_percsubst           numeric,
  prod_clasfiscal          text,
  prod_pis                 numeric,
  prod_cofins              numeric,
  ncm_ipi                  numeric,
  ncm_agregado             numeric,
  ncm_pis                  numeric,
  ncm_cofins               numeric,
  ncm_clasfiscal           text,
  prodimportado            boolean,
  basereduzida             boolean,
  dest_codigo              text,
  dest_tipodestino         text,
  dest_inscestadual        text,
  dest_regimetributario    text,
  regra_cobrar_ipi_import  numeric
);

-- _inicializar_contexto: só o caminho SAIDA (else = venda normal) está portado.
-- ENTRADA/ENTRADA_COMPRAS e operações especiais (devolução/garantia/extravio):
-- NÃO portados ainda (FASE 4) — levanta exceção explícita (nunca resultado silencioso errado).
CREATE OR REPLACE FUNCTION db_manaus._inicializar_contexto(
  p_tipo_mov      text,
  p_tipo_op       text,
  p_codprod       text,
  p_codigo        text,
  p_codterceiro   text
) RETURNS db_manaus.ctx_calculo_imposto
LANGUAGE plpgsql AS $$
DECLARE
  ctx      db_manaus.ctx_calculo_imposto;
  v_emp_uf text;
  v_emp_mun text;
  v_cli    text;
BEGIN
  IF p_tipo_mov <> 'SAIDA' THEN
    RAISE EXCEPTION 'contexto p/ tipo_movimentacao=% ainda nao portado (FASE 4)', p_tipo_mov;
  END IF;
  IF p_tipo_op IN ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA',
                   'REMESSA_CONSERTO','EXTRAVIO_AVARIA_FABRICA','EXTRAVIO_AVARIA_CLIENTE') THEN
    RAISE EXCEPTION 'contexto SAIDA p/ operacao=% ainda nao portado (FASE 4)', p_tipo_op;
  END IF;

  -- SAIDA (else): ORIGEM = empresa (MELO); DESTINO = cliente (terceiro se houver, senao Codigo)
  SELECT uf, municipio INTO v_emp_uf, v_emp_mun FROM db_manaus.dadosempresa LIMIT 1;
  ctx.uf_origem := v_emp_uf;
  SELECT "ICMSINTERNO", "ICMSEXTERNO" INTO ctx.uf_orig_icmsinterno, ctx.uf_orig_icmsexterno
    FROM db_manaus.dbuf_n WHERE "UF" = v_emp_uf;
  ctx.cidade_orig_codmun := (SELECT m.codmunicipio FROM db_manaus.dbmunicipio m
                              WHERE m.descricao = v_emp_mun AND m.uf = v_emp_uf LIMIT 1);

  v_cli := COALESCE(NULLIF(trim(p_codterceiro), ''), p_codigo);
  SELECT c.uf, c.tipocliente, COALESCE(c.iest, 'ISENTO'), c.sit_tributaria, c.codmunicipio, c.codcli
    INTO ctx.uf_destino, ctx.dest_tipodestino, ctx.dest_inscestadual, ctx.dest_regimetributario,
         ctx.cidade_dest_codmun, ctx.dest_codigo
    FROM db_manaus.dbclien c WHERE c.codcli = v_cli;
  SELECT "ICMSINTERNO", "ICMSEXTERNO", "ZONA_ISENTIVADA"
    INTO ctx.uf_dest_icmsinterno, ctx.uf_dest_icmsexterno, ctx.uf_dest_zona_isentivada
    FROM db_manaus.dbuf_n WHERE "UF" = ctx.uf_destino;

  -- produto (RowProd)
  SELECT p.strib, p.isentoipi, COALESCE(p.ipi,0), COALESCE(p.percsubst,0), p.clasfiscal, p.pis, p.cofins
    INTO ctx.prod_strib, ctx.prod_isentoipi, ctx.prod_ipi, ctx.prod_percsubst, ctx.prod_clasfiscal,
         ctx.prod_pis, ctx.prod_cofins
    FROM db_manaus.dbprod p WHERE p.codprod = p_codprod;

  -- CARREGAR_NCM (RowNCM vem do proprio dbprod: ipi, percsubst=agregado, pis, cofins, clasfiscal8)
  ctx.ncm_ipi        := COALESCE(ctx.prod_ipi, 0);
  ctx.ncm_agregado   := COALESCE(ctx.prod_percsubst, 0);
  ctx.ncm_pis        := ctx.prod_pis;
  ctx.ncm_cofins     := ctx.prod_cofins;
  ctx.ncm_clasfiscal := substr(ctx.prod_clasfiscal, 1, 8);

  -- ProdImportado: primeiro digito de strib em (1,2,3,8)
  ctx.prodimportado := substr(ctx.prod_strib, 1, 1) IN ('1','2','3','8');
  -- BaseReduzida: só usado no ICMS (bloco 2b) — deixado false aqui.
  ctx.basereduzida := false;
  -- RowRegraCredor: só em ENTRADA (origem=fornecedor); em SAIDA fica nulo.
  ctx.regra_cobrar_ipi_import := NULL;

  RETURN ctx;
END;
$$;

-- validar_ipi: tradução fiel de CALCULO_IMPOSTO.Validar_IPI (todos os ramos).
CREATE OR REPLACE FUNCTION db_manaus.validar_ipi(
  ctx        db_manaus.ctx_calculo_imposto,
  p_tipo_mov text,
  p_tipo_op  text
) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
  xresult numeric;
BEGIN
  IF p_tipo_mov = 'ENTRADA_COMPRAS' THEN
    IF ((ctx.prod_isentoipi = 'C') AND (ctx.uf_origem <> ctx.uf_destino) AND (p_tipo_op IN ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA','TRANSFERENCIA')))
       OR ((ctx.prod_isentoipi = 'C') AND (p_tipo_op NOT IN ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA','TRANSFERENCIA')))
       OR ((ctx.prod_isentoipi = 'P') AND (p_tipo_op NOT IN ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA','TRANSFERENCIA')))
       OR ((ctx.prod_isentoipi = 'S') AND (ctx.uf_dest_zona_isentivada = 'N'))
    THEN
      IF (substr(ctx.prod_strib, 1, 1) IN ('1','2','3')) AND (ctx.regra_cobrar_ipi_import = 0) THEN
        xresult := 0.00;
      ELSE
        xresult := COALESCE(ctx.prod_ipi, 0.00);
      END IF;
    ELSE
      xresult := 0.00;
    END IF;
  ELSIF p_tipo_mov = 'ENTRADA' THEN
    IF ((ctx.prod_isentoipi = 'C') AND (ctx.uf_origem <> ctx.uf_destino) AND (p_tipo_op IN ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA')))
       OR ((ctx.prod_isentoipi = 'C') AND (p_tipo_op NOT IN ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA')))
       OR ((ctx.prod_isentoipi = 'P') AND (p_tipo_op NOT IN ('DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA')))
       OR ((ctx.prod_isentoipi = 'S') AND (ctx.uf_dest_zona_isentivada = 'N'))
    THEN
      xresult := COALESCE(ctx.prod_ipi, 0.00);
    ELSE
      xresult := 0.00;
    END IF;
  ELSIF p_tipo_mov = 'SAIDA' THEN
    IF ((ctx.prod_isentoipi = 'C') AND (ctx.uf_origem <> ctx.uf_destino) AND (p_tipo_op NOT IN ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO')))
       OR (ctx.prod_isentoipi IN ('I','T'))
       OR ((ctx.prod_isentoipi = 'C') AND (ctx.uf_origem <> ctx.uf_destino) AND (p_tipo_op IN ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO')))
       OR ((ctx.prod_isentoipi = 'P') AND (ctx.uf_origem <> ctx.uf_destino) AND (p_tipo_op IN ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO')))
       OR ((ctx.prod_isentoipi = 'S') AND (ctx.uf_dest_zona_isentivada = 'N'))
    THEN
      xresult := COALESCE(ctx.ncm_ipi, 0.00);
    ELSE
      xresult := 0.00;
    END IF;
  END IF;

  IF ctx.dest_tipodestino = 'F' THEN
    xresult := 0.00;
  END IF;

  RETURN xresult;
END;
$$;
