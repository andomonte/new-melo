-- FASE 4 · P2 (A1a) — port FIEL de CALCULO_IMPOSTO.Tipo_Operacao_Saida (Oracle).
-- Substitui o STUB da migration 017 (que assumia sempre pode_st=true / cfop=null).
--
-- Fiel ao Oracle (oracle_calculo_imposto.sql:1815-2035):
--   * VENDA, TRANSFERENCIA, DEVOLUCAO_COMPRA, DEVOLUCAO_TRANSFERENCIA,
--     REMESSA_GARANTIA_FABRICA, REMESSA_GARANTIA_CLIENTE, EXTRAVIO_AVARIA_FABRICA,
--     EXTRAVIO_AVARIA_CLIENTE  -> Pode_ST=True, CFOP=null (idêntico ao stub → VENDA sem regressão).
--   * Remessas (BONIFICACAO/EXPOSICAO/DEMOSTRACAO/ARMAZEM/CONSERTO/SIMPLES_REMESSA e
--     RETORNO_REMESSA_*)      -> Pode_ST=False, CFOP fixo (591x/691x/59xx).
--   * else (OUTROS/não mapeado) -> Pode_ST=False, CFOP=null.
--
-- Nota de fidelidade: o Oracle tem ainda um ramo `elsif CFOP = '6119'` (Pode_ST=True) que
-- depende do CFOP manual de ENTRADA na tela; como esta função não recebe o CFOP manual
-- (fluxo OUTROS/UI), esse ramo cai no else. Não afeta nenhuma das operações nomeadas.
-- Assinatura preservada (ctx, tipooperacao) → nenhum call-site muda.

CREATE OR REPLACE FUNCTION db_manaus.tipo_operacao_saida(
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

  IF tipooperacao IN ('VENDA','TRANSFERENCIA','DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA',
                      'REMESSA_GARANTIA_FABRICA','REMESSA_GARANTIA_CLIENTE',
                      'EXTRAVIO_AVARIA_FABRICA','EXTRAVIO_AVARIA_CLIENTE') THEN
    pode_st := true;  cfop := NULL;

  ELSIF tipooperacao = 'REMESSA_BONIFICACAO' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '5910' ELSE '6910' END;
  ELSIF tipooperacao = 'REMESSA_EXPOSICAO' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '5914' ELSE '6914' END;
  ELSIF tipooperacao = 'REMESSA_DEMOSTRACAO' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '5912' ELSE '6912' END;
  ELSIF tipooperacao = 'REMESSA_ARMAZEM' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '5905' ELSE '6905' END;
  ELSIF tipooperacao = 'REMESSA_CONSERTO' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '5915' ELSE '6915' END;
  ELSIF tipooperacao = 'SIMPLES_REMESSA' THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '5949' ELSE '6949' END;
  ELSIF tipooperacao IN ('RETORNO_REMESSA_GARANTIA','RETORNO_REMESSA_CONSERTO') THEN
    pode_st := false; cfop := CASE WHEN uf_iguais THEN '5949' ELSE '6949' END;

  ELSE
    -- OUTROS / não mapeado (inclui o ramo Oracle CFOP='6119' quando há CFOP manual)
    pode_st := false; cfop := NULL;
  END IF;
END;
$$;
