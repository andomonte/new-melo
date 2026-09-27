-- 054_tela_previsto_recebido.sql
-- Registra a tela "Previsto x Recebido (Atrasados)" (/admin/previstoRecebido) no menu
-- (db_manaus.tb_telas) e concede aos perfis ADMINISTRAÇÃO, FATURAMENTO e financeiro,
-- igual às telas Fluxo de Caixa (97) e Movimento Diário do Caixa (98). Idempotente.

DO $mig$
DECLARE
  v_cod integer;
BEGIN
  -- 1) tela (idempotente por PATH_TELA)
  SELECT "CODIGO_TELA" INTO v_cod FROM db_manaus.tb_telas WHERE "PATH_TELA" = '/admin/previstoRecebido';
  IF v_cod IS NULL THEN
    SELECT COALESCE(MAX("CODIGO_TELA"), 0) + 1 INTO v_cod FROM db_manaus.tb_telas;
    INSERT INTO db_manaus.tb_telas ("CODIGO_TELA", "NOME_TELA", "PATH_TELA")
    VALUES (v_cod, 'Previsto x Recebido (Atrasados)', '/admin/previstoRecebido');
    RAISE NOTICE 'tela criada: CODIGO_TELA=%', v_cod;
  ELSE
    RAISE NOTICE 'tela já existe: CODIGO_TELA=%', v_cod;
  END IF;

  -- 2) grants por perfil (idempotente por grupoId + tela). id explícito (MAX+n) porque a
  -- sequence de "tb_grupo_Permissao".id está dessincronizada (linhas com id manual).
  INSERT INTO db_manaus."tb_grupo_Permissao" (id, editar, cadastrar, remover, exportar, "grupoId", tela)
  SELECT (SELECT COALESCE(MAX(id), 0) FROM db_manaus."tb_grupo_Permissao")
           + row_number() OVER (ORDER BY x.g),
         true, true, true, true, x.g, v_cod
  FROM (VALUES ('ADMINISTRAÇÃO'), ('FATURAMENTO'), ('financeiro')) AS x(g)
  WHERE NOT EXISTS (
    SELECT 1 FROM db_manaus."tb_grupo_Permissao" p WHERE p."grupoId" = x.g AND p.tela = v_cod
  );
END
$mig$;
