-- 029_tela_caixa_financeiro.sql
-- Cadastra a tela "Caixa" no controle de acesso e concede permissão a todos os
-- grupos que já enxergam a tela "Contas a Receber" (tela irmã do Financeiro).
--
-- Depois de aplicar: o usuário precisa RE-LOGAR (as permissões carregam no login,
-- não em runtime) e o build com o novo item de menu precisa estar rodando.
--
-- Idempotente: pode rodar mais de uma vez sem duplicar.

DO $$
DECLARE
  v_codigo_novo integer;
  v_codigos_irma integer[];
BEGIN
  -- 1) Garante a tela Caixa em tb_telas (CODIGO_TELA = max+1 se ainda não existe)
  SELECT "CODIGO_TELA" INTO v_codigo_novo
  FROM db_manaus.tb_telas
  WHERE "PATH_TELA" = '/admin/financeiro/caixa'
  LIMIT 1;

  IF v_codigo_novo IS NULL THEN
    SELECT COALESCE(MAX("CODIGO_TELA"), 0) + 1 INTO v_codigo_novo
    FROM db_manaus.tb_telas;

    INSERT INTO db_manaus.tb_telas ("CODIGO_TELA", "NOME_TELA", "PATH_TELA")
    VALUES (v_codigo_novo, 'Caixa', '/admin/financeiro/caixa');

    RAISE NOTICE 'Tela Caixa criada com CODIGO_TELA = %', v_codigo_novo;
  ELSE
    RAISE NOTICE 'Tela Caixa já existe com CODIGO_TELA = %', v_codigo_novo;
  END IF;

  -- 2) Coleta TODOS os códigos da tela irmã (Contas a Receber) — o banco tem
  --    linhas duplicadas em tb_telas com o mesmo PATH (ex.: 51 e 65).
  SELECT array_agg("CODIGO_TELA") INTO v_codigos_irma
  FROM db_manaus.tb_telas
  WHERE "PATH_TELA" = '/admin/financeiro/contasAReceber';

  IF v_codigos_irma IS NULL THEN
    RAISE NOTICE 'Tela irmã (contasAReceber) não encontrada — conceda a permissão manualmente.';
    RETURN;
  END IF;

  -- 3) Espelha a permissão: para cada grupo que tem QUALQUER código da tela irmã
  --    e ainda não tem a tela Caixa, cria a permissão com o OR das flags.
  INSERT INTO db_manaus."tb_grupo_Permissao" ("grupoId", tela, cadastrar, editar, remover, exportar)
  SELECT gp."grupoId", v_codigo_novo,
         bool_or(gp.cadastrar), bool_or(gp.editar), bool_or(gp.remover), bool_or(gp.exportar)
  FROM db_manaus."tb_grupo_Permissao" gp
  WHERE gp.tela = ANY(v_codigos_irma)
    AND NOT EXISTS (
      SELECT 1 FROM db_manaus."tb_grupo_Permissao" x
      WHERE x."grupoId" = gp."grupoId" AND x.tela = v_codigo_novo
    )
  GROUP BY gp."grupoId";

  RAISE NOTICE 'Permissão da tela Caixa concedida aos grupos que possuem contasAReceber.';
END $$;
