-- FASE 4 · P2 (A1b) — contexto SAÍDA para as operações especiais que invertem origem/destino.
-- Fiel ao Oracle CALCULO_IMPOSTO.INICIALIZACAO, ramo SAIDA (oracle_calculo_imposto.sql:3149-3230):
--   * DEVOLUCAO_COMPRA / DEVOLUCAO_TRANSFERENCIA / REMESSA_GARANTIA_FABRICA / REMESSA_CONSERTO
--       -> ORIGEM = cliente (Codigo);      DESTINO = MELO
--   * EXTRAVIO_AVARIA_FABRICA
--       -> ORIGEM = cliente (Terceiro);    DESTINO = MELO
--   * EXTRAVIO_AVARIA_CLIENTE
--       -> ORIGEM = MELO;                  DESTINO = cliente (Terceiro)
--   * demais (VENDA/TRANSFERENCIA/remessas comuns/retornos/OUTROS)
--       -> ORIGEM = MELO;                  DESTINO = cliente (Terceiro||Codigo)  [ramo original, inalterado]
-- MELO como parte fiscal: SETDADOS('...','000','MELO DISTRIBUIDORA','R','N','2','MELO')
--   -> dest_codigo='000', dest_tipodestino='R', dest_inscestadual='MELO', dest_regimetributario='2'.
-- Entry-point passa codterceiro=NULL (web só tem codcli); COALESCE(terceiro,codigo) mantém funcional.
-- Mantém o RAISE de ENTRADA/ENTRADA_COMPRAS (= A2, próximo passo).

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
  v_orig_cli text;   -- cliente quando ORIGEM=cliente (NULL => origem=MELO)
  v_dest_cli text;   -- cliente quando DESTINO=cliente (NULL => destino=MELO)
BEGIN
  IF p_tipo_mov <> 'SAIDA' THEN
    RAISE EXCEPTION 'contexto p/ tipo_movimentacao=% ainda nao portado (FASE 4)', p_tipo_mov;
  END IF;

  SELECT uf, municipio INTO v_emp_uf, v_emp_mun FROM db_manaus.dadosempresa LIMIT 1;

  -- quem é origem e quem é destino, por operação
  IF p_tipo_op IN ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA',
                   'REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO') THEN
    v_orig_cli := p_codigo;                                              -- ORIGEM=cliente, DESTINO=MELO
    v_dest_cli := NULL;
  ELSIF p_tipo_op = 'EXTRAVIO_AVARIA_FABRICA' THEN
    v_orig_cli := COALESCE(NULLIF(trim(p_codterceiro), ''), p_codigo);   -- ORIGEM=terceiro, DESTINO=MELO
    v_dest_cli := NULL;
  ELSIF p_tipo_op = 'EXTRAVIO_AVARIA_CLIENTE' THEN
    v_orig_cli := NULL;                                                  -- ORIGEM=MELO, DESTINO=terceiro
    v_dest_cli := COALESCE(NULLIF(trim(p_codterceiro), ''), p_codigo);
  ELSE
    v_orig_cli := NULL;                                                  -- ORIGEM=MELO, DESTINO=cliente
    v_dest_cli := COALESCE(NULLIF(trim(p_codterceiro), ''), p_codigo);
  END IF;

  -- ===== ORIGEM =====
  IF v_orig_cli IS NULL THEN                    -- MELO
    ctx.uf_origem := v_emp_uf;
    SELECT "ICMSINTERNO", "ICMSEXTERNO" INTO ctx.uf_orig_icmsinterno, ctx.uf_orig_icmsexterno
      FROM db_manaus.dbuf_n WHERE "UF" = v_emp_uf;
    ctx.cidade_orig_codmun := (SELECT m.codmunicipio FROM db_manaus.dbmunicipio m
                                WHERE m.descricao = v_emp_mun AND m.uf = v_emp_uf LIMIT 1);
  ELSE                                          -- cliente
    SELECT c.uf, c.codmunicipio INTO ctx.uf_origem, ctx.cidade_orig_codmun
      FROM db_manaus.dbclien c WHERE c.codcli = v_orig_cli;
    SELECT "ICMSINTERNO", "ICMSEXTERNO" INTO ctx.uf_orig_icmsinterno, ctx.uf_orig_icmsexterno
      FROM db_manaus.dbuf_n WHERE "UF" = ctx.uf_origem;
  END IF;

  -- ===== DESTINO =====
  IF v_dest_cli IS NULL THEN                    -- MELO
    ctx.uf_destino := v_emp_uf;
    SELECT "ICMSINTERNO", "ICMSEXTERNO", "ZONA_ISENTIVADA"
      INTO ctx.uf_dest_icmsinterno, ctx.uf_dest_icmsexterno, ctx.uf_dest_zona_isentivada
      FROM db_manaus.dbuf_n WHERE "UF" = v_emp_uf;
    ctx.cidade_dest_codmun := (SELECT m.codmunicipio FROM db_manaus.dbmunicipio m
                                WHERE m.descricao = v_emp_mun AND m.uf = v_emp_uf LIMIT 1);
    ctx.dest_codigo           := '000';
    ctx.dest_tipodestino      := 'R';
    ctx.dest_inscestadual     := 'MELO';
    ctx.dest_regimetributario := '2';
  ELSE                                          -- cliente
    SELECT c.uf, c.tipocliente, COALESCE(c.iest, 'ISENTO'), c.sit_tributaria, c.codmunicipio, c.codcli
      INTO ctx.uf_destino, ctx.dest_tipodestino, ctx.dest_inscestadual, ctx.dest_regimetributario,
           ctx.cidade_dest_codmun, ctx.dest_codigo
      FROM db_manaus.dbclien c WHERE c.codcli = v_dest_cli;
    SELECT "ICMSINTERNO", "ICMSEXTERNO", "ZONA_ISENTIVADA"
      INTO ctx.uf_dest_icmsinterno, ctx.uf_dest_icmsexterno, ctx.uf_dest_zona_isentivada
      FROM db_manaus.dbuf_n WHERE "UF" = ctx.uf_destino;
  END IF;

  -- ===== produto / NCM / flags (comum, independente de origem/destino) =====
  SELECT p.strib, p.isentoipi, COALESCE(p.ipi,0), COALESCE(p.percsubst,0), p.clasfiscal, p.pis, p.cofins
    INTO ctx.prod_strib, ctx.prod_isentoipi, ctx.prod_ipi, ctx.prod_percsubst, ctx.prod_clasfiscal,
         ctx.prod_pis, ctx.prod_cofins
    FROM db_manaus.dbprod p WHERE p.codprod = p_codprod;

  ctx.ncm_ipi        := COALESCE(ctx.prod_ipi, 0);
  ctx.ncm_agregado   := COALESCE(ctx.prod_percsubst, 0);
  ctx.ncm_pis        := ctx.prod_pis;
  ctx.ncm_cofins     := ctx.prod_cofins;
  ctx.ncm_clasfiscal := substr(ctx.prod_clasfiscal, 1, 8);
  ctx.prodimportado  := substr(ctx.prod_strib, 1, 1) IN ('1','2','3','8');
  ctx.basereduzida   := false;
  ctx.regra_cobrar_ipi_import := NULL;  -- só ENTRADA (origem=fornecedor); A2

  RETURN ctx;
END;
$$;
