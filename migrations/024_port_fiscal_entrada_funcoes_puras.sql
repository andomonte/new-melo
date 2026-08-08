-- FASE 4 · P3 (A2, parte 1/2) — funções PURAS do ramo ENTRADA (sem alterar o tipo ctx).
-- Tradução FIEL do Oracle CALCULO_IMPOSTO:
--   * Tipo_Operacao_Entrada   (oracle_calculo_imposto.sql:2037-2188)
--   * Validar_CFOP_Entrada     (oracle_calculo_imposto.sql:2364-2493)
--   * VALIDA_CFOP_USUCONSUMO    (oracle_calculo_imposto.sql:3452-3465)
-- Ainda NÃO ligadas na orquestração — isso vem na parte 2/2 (contexto ENTRADA + PIS/COFINS
-- compra + branch de entrada), que exige estender o ctx (regime do fornecedor, tipo do
-- produto, flags de RowRegraCredor).

-- Tipo_Operacao_Entrada: CFOP fixo (1xxx/2xxx) + flag Pode_ST por operação de entrada.
CREATE OR REPLACE FUNCTION db_manaus.tipo_operacao_entrada(
  ctx          db_manaus.ctx_calculo_imposto,
  tipooperacao text,
  OUT uf_iguais boolean,
  OUT pode_st   boolean,
  OUT cfop      text
)
LANGUAGE plpgsql AS $$
BEGIN
  uf_iguais := (ctx.uf_origem = ctx.uf_destino);
  cfop      := NULL;

  IF tipooperacao IN ('COMPRA','TRANSFERENCIA','DEVOLUCAO_VENDA','DEVOLUCAO_TRANSFERENCIA',
                      'RETORNO_GARANTIA_FABRICA','RETORNO_GARANTIA_CLIENTE') THEN
    pode_st := true;  cfop := NULL;
  ELSIF tipooperacao = 'ENTRADA_BONIFICACAO' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '1910' ELSE '2910' END;
  ELSIF tipooperacao = 'RETORNO_EXPOSICAO' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '1914' ELSE '2914' END;
  ELSIF tipooperacao = 'ENTRADA_DEMOSTRACAO' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '1912' ELSE '2912' END;
  ELSIF tipooperacao = 'ENTRADA_ARMAZEM' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '1905' ELSE '2905' END;
  ELSIF tipooperacao = 'RETORNO_CONSERTO' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '1916' ELSE '2916' END;
  ELSE
    pode_st := false; cfop := NULL;   -- OUTROS / não mapeado
  END IF;
END;
$$;

-- Validar_CFOP_Entrada: escolhe CFOP de entrada conforme UF + ST (MVA/ValorST).
-- DEVOLUCAO_VENDA interna reusa derivado_petroleo/legislacao_icms/ncm_agregado (idem SAÍDA VENDA).
CREATE OR REPLACE FUNCTION db_manaus.validar_cfop_entrada(
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
    IF tipooperacao = 'COMPRA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '1403'; ELSE xresult := '1102'; END IF;
    ELSIF tipooperacao = 'TRANSFERENCIA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '1409'; ELSE xresult := '1152'; END IF;
    ELSIF tipooperacao = 'DEVOLUCAO_VENDA' THEN
      IF (mva > 0) OR (valorst > 0) THEN
        xresult := '1411';
      ELSIF (db_manaus.derivado_petroleo(ctx)
             OR db_manaus.legislacao_icms(ctx, 'PROTOCOLO')
             OR db_manaus.legislacao_icms(ctx, 'CONVENIO')
             OR db_manaus.legislacao_icms(ctx, 'RESOLUCAO')
             OR db_manaus.legislacao_icms(ctx, 'DECRETO')
             OR ((COALESCE(ctx.ncm_agregado, 0) > 0) AND (ctx.uf_origem = ctx.uf_destino))) THEN
        xresult := '1411';
      ELSE
        xresult := '1202';
      END IF;
    ELSIF tipooperacao = 'DEVOLUCAO_TRANSFERENCIA' THEN
      xresult := '1209';
    ELSIF tipooperacao IN ('RETORNO_GARANTIA_FABRICA','RETORNO_GARANTIA_CLIENTE') THEN
      xresult := '1949';
    END IF;
  ELSE                                           -- **** Estados diferentes
    IF tipooperacao = 'COMPRA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '2403'; ELSE xresult := '2102'; END IF;
    ELSIF tipooperacao = 'TRANSFERENCIA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '2409'; ELSE xresult := '2152'; END IF;
    ELSIF tipooperacao = 'DEVOLUCAO_VENDA' THEN
      IF (mva > 0) OR (valorst > 0) THEN xresult := '2411'; ELSE xresult := '2202'; END IF;
    ELSIF tipooperacao = 'DEVOLUCAO_TRANSFERENCIA' THEN
      xresult := '2209';
    ELSIF tipooperacao IN ('RETORNO_GARANTIA_FABRICA','RETORNO_GARANTIA_CLIENTE') THEN
      xresult := '2949';
    END IF;
  END IF;
  RETURN xresult;
END;
$$;

-- VALIDA_CFOP_USUCONSUMO: CFOP de uso/consumo (produto tipo 'MC') em ENTRADA_COMPRAS.
CREATE OR REPLACE FUNCTION db_manaus.valida_cfop_usoconsumo(
  ctx       db_manaus.ctx_calculo_imposto,
  uf_iguais boolean
) RETURNS varchar
LANGUAGE plpgsql AS $$
BEGIN
  IF uf_iguais THEN
    RETURN '1556';
  ELSIF ctx.uf_destino = 'EX' THEN
    RETURN '3556';
  ELSE
    RETURN '2556';
  END IF;
END;
$$;
