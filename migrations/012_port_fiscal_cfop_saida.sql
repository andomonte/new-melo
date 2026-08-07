-- FASE 2 · Bloco 3 — port de VALIDAR_CFOP_SAIDA do CALCULO_IMPOSTO (Oracle) para PL/pgSQL.
-- Tradução FIEL. Recebe UF_Iguais/MVA/ValorST (o caller calcula). Usa ctx + legislacao_icms.
-- (Validar_CFOP_Entrada fica p/ FASE 4 — cobertura de entrada.)

CREATE OR REPLACE FUNCTION db_manaus.validar_cfop_saida(
  ctx          db_manaus.ctx_calculo_imposto,
  tipooperacao text,
  uf_iguais    boolean,
  mva          numeric,
  valorst      numeric
) RETURNS varchar
LANGUAGE plpgsql AS $$
DECLARE
  xresult varchar(4) := NULL;
BEGIN
  IF uf_iguais THEN                              -- **** Estados Iguais
    IF tipooperacao = 'VENDA' THEN
      IF ctx.uf_origem = 'RO' AND ctx.dest_codigo = '00169' AND ctx.uf_destino = ctx.uf_origem THEN
        xresult := '5102';
      ELSIF db_manaus.legislacao_icms(ctx, 'CONVENIO')  THEN xresult := '5405';
      ELSIF db_manaus.legislacao_icms(ctx, 'PROTOCOLO') THEN xresult := '5405';
      ELSIF db_manaus.legislacao_icms(ctx, 'RESOLUCAO') THEN xresult := '5405';
      ELSIF db_manaus.legislacao_icms(ctx, 'DECRETO')   THEN xresult := '5405';
      ELSIF COALESCE(ctx.ncm_agregado, 0) > 0 THEN xresult := '5405';
      ELSIF (mva > 0) OR (valorst > 0) THEN xresult := '5403';
      ELSE xresult := '5102';
      END IF;
    ELSIF tipooperacao = 'TRANSFERENCIA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '5409'; ELSE xresult := '5152'; END IF;
    ELSIF tipooperacao = 'DEVOLUCAO_COMPRA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '5411'; ELSE xresult := '5202'; END IF;
    ELSIF tipooperacao = 'DEVOLUCAO_TRANSFERENCIA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '5209'; ELSE xresult := '5209'; END IF;
    ELSIF tipooperacao IN ('REMESSA_GARANTIA_FABRICA','REMESSA_GARANTIA_CLIENTE',
                           'EXTRAVIO_AVARIA_FABRICA','EXTRAVIO_AVARIA_CLIENTE') THEN
      xresult := '5949';
    END IF;
  ELSE                                           -- **** Estados diferentes
    IF tipooperacao = 'VENDA' THEN
      IF ctx.dest_tipodestino = 'F' AND ctx.dest_inscestadual = 'ISENTO' THEN
        xresult := '6108';
      ELSIF (mva > 0) OR (valorst > 0) THEN xresult := '6403';
      ELSE xresult := '6102';
      END IF;
    ELSIF tipooperacao = 'TRANSFERENCIA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '6409'; ELSE xresult := '6152'; END IF;
    ELSIF tipooperacao = 'DEVOLUCAO_COMPRA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '6411'; ELSE xresult := '6202'; END IF;
    ELSIF tipooperacao = 'DEVOLUCAO_TRANSFERENCIA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '6209'; ELSE xresult := '6209'; END IF;
    ELSIF tipooperacao IN ('REMESSA_GARANTIA_FABRICA','REMESSA_GARANTIA_CLIENTE',
                           'EXTRAVIO_AVARIA_FABRICA','EXTRAVIO_AVARIA_CLIENTE') THEN
      xresult := '6949';
    END IF;
  END IF;
  RETURN xresult;
END;
$$;
