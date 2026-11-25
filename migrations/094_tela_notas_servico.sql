-- 094_tela_notas_servico.sql  (25/11/2026)
-- Tela Faturamento → Notas de Serviço (/faturamento/notasServico) — NFS-e prestadas (etapa 2).
-- Permissão copiada da tela irmã "/faturamento/consultaFatura", só para os grupos
-- ADMINISTRAÇÃO e FATURAMENTO (lançar nota gera títulos a receber). Outros grupos: Acessos > Perfis.
-- Idempotente. Depois de aplicar, o usuário precisa RE-LOGAR para ver o menu.

DO $mig$
DECLARE
  s              text;
  v_codigo       integer;
  v_codigos_irma integer[];
  v_path  constant text := '/faturamento/notasServico';
  v_nome  constant text := 'Faturamento - Notas de Serviço';
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'tb_telas' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    EXECUTE format('SELECT array_agg("CODIGO_TELA") FROM %I.tb_telas WHERE "PATH_TELA" = ''/faturamento/consultaFatura''', s)
      INTO v_codigos_irma;
    IF v_codigos_irma IS NULL THEN
      RAISE NOTICE '%: tela Consultar Faturas não existe — Notas de Serviço não registrada', s;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'S' AND n.nspname = s AND c.relname = 'tb_grupo_Permissao_id_seq'
    ) THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id),0) FROM %I."tb_grupo_Permissao"), (SELECT last_value FROM %I."tb_grupo_Permissao_id_seq")), true)',
        s || '."tb_grupo_Permissao_id_seq"', s, s);
    END IF;

    EXECUTE format('SELECT "CODIGO_TELA" FROM %I.tb_telas WHERE "PATH_TELA" = %L LIMIT 1', s, v_path) INTO v_codigo;
    IF v_codigo IS NULL THEN
      EXECUTE format('SELECT COALESCE(MAX("CODIGO_TELA"),0) + 1 FROM %I.tb_telas', s) INTO v_codigo;
      EXECUTE format('INSERT INTO %I.tb_telas ("CODIGO_TELA","NOME_TELA","PATH_TELA") VALUES (%L,%L,%L)',
        s, v_codigo, v_nome, v_path);
      RAISE NOTICE '%: tela % criada (CODIGO_TELA=%)', s, v_path, v_codigo;
    END IF;

    EXECUTE format($f$
      INSERT INTO %I."tb_grupo_Permissao" ("grupoId", tela, cadastrar, editar, remover, exportar)
      SELECT gp."grupoId", %L,
             bool_or(gp.cadastrar), bool_or(gp.editar), bool_or(gp.remover), bool_or(gp.exportar)
        FROM %I."tb_grupo_Permissao" gp
       WHERE gp.tela = ANY(%L::int[])
         AND gp."grupoId" IN ('ADMINISTRAÇÃO', 'FATURAMENTO')
         AND NOT EXISTS (SELECT 1 FROM %I."tb_grupo_Permissao" x WHERE x."grupoId" = gp."grupoId" AND x.tela = %L)
       GROUP BY gp."grupoId"$f$, s, v_codigo, s, v_codigos_irma, s, v_codigo);
  END LOOP;
END $mig$;
