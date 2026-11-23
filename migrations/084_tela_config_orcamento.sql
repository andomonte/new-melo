-- 084 — Tela Configurações → Orçamento (/admin/configuracoes/orcamento), 23/11/2026.
-- Registra a tela em tb_telas e copia a permissão da tela irmã
-- "/admin/configuracoes/vendas" (mesmo padrão da 078), MAS só para o grupo
-- ADMINISTRAÇÃO: a irmã também libera VENDEDOR, e o vendedor não deve mudar o próprio
-- limite de validade do orçamento. Outros grupos: conceder em Acessos > Perfis.
-- Idempotente. Depois de aplicar, o usuário precisa RE-LOGAR para ver o menu.

DO $mig$
DECLARE
  s              text;
  v_codigo       integer;
  v_codigos_irma integer[];
  v_path  constant text := '/admin/configuracoes/orcamento';
  v_nome  constant text := 'Configurações - Orçamento';
BEGIN
  FOR s IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'tb_telas' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;

    -- Sequências podem estar atrás do MAX (dados migrados): realinha antes de inserir.
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'S' AND n.nspname = s AND c.relname = 'tb_grupo_Permissao_id_seq'
    ) THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id),0) FROM %I."tb_grupo_Permissao"), (SELECT last_value FROM %I."tb_grupo_Permissao_id_seq")), true)',
        s || '."tb_grupo_Permissao_id_seq"', s, s);
    END IF;

    EXECUTE format(
      'SELECT "CODIGO_TELA" FROM %I.tb_telas WHERE "PATH_TELA" = %L LIMIT 1', s, v_path)
      INTO v_codigo;

    IF v_codigo IS NULL THEN
      EXECUTE format('SELECT COALESCE(MAX("CODIGO_TELA"),0) + 1 FROM %I.tb_telas', s) INTO v_codigo;
      EXECUTE format(
        'INSERT INTO %I.tb_telas ("CODIGO_TELA","NOME_TELA","PATH_TELA") VALUES (%L,%L,%L)',
        s, v_codigo, v_nome, v_path);
      RAISE NOTICE '  tela % criada (CODIGO_TELA=%)', v_path, v_codigo;
    END IF;

    EXECUTE format(
      'SELECT array_agg("CODIGO_TELA") FROM %I.tb_telas WHERE "PATH_TELA" = ''/admin/configuracoes/vendas''', s)
      INTO v_codigos_irma;

    IF v_codigos_irma IS NOT NULL THEN
      EXECUTE format($f$
        INSERT INTO %I."tb_grupo_Permissao" ("grupoId", tela, cadastrar, editar, remover, exportar)
        SELECT gp."grupoId", %L,
               bool_or(gp.cadastrar), bool_or(gp.editar), bool_or(gp.remover), bool_or(gp.exportar)
        FROM %I."tb_grupo_Permissao" gp
        WHERE gp.tela = ANY(%L::int[])
          AND gp."grupoId" = 'ADMINISTRAÇÃO'
          AND NOT EXISTS (
            SELECT 1 FROM %I."tb_grupo_Permissao" x
            WHERE x."grupoId" = gp."grupoId" AND x.tela = %L
          )
        GROUP BY gp."grupoId"$f$, s, v_codigo, s, v_codigos_irma, s, v_codigo);
    ELSE
      RAISE NOTICE '  tela irmã (configuracoes/vendas) não encontrada em % — conceda a permissão manualmente', s;
    END IF;
  END LOOP;
END $mig$;
