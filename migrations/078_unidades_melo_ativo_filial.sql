-- 078_unidades_melo_ativo_filial.sql
-- Cadastro de Unidades Melo (cad_unidade_melo) — usado em "Entrega em" e
-- "Destinado para" da Requisição e da Ordem de Compra.
--
-- O que este script faz (em TODOS os schemas db_* que tenham cad_unidade_melo):
--   1) unm_ativo (S/N, padrão 'S'): as listas da requisição mostram só as ativas.
--      Não há exclusão — requisições/ordens antigas apontam para a unidade (FK).
--   2) unm_codigo_filial: ligação opcional com a filial do sistema
--      (tb_filial.codigo_filial). Define a unidade padrão da filial logada.
--      Fica vazia: o usuário liga na tela de cadastro.
--   3) Registra a tela /compras/unidades em tb_telas e copia a permissão da tela
--      irmã "/compras/requisicoes-compra" para os grupos que já a têm.
--
-- Idempotente. Depois de aplicar, o usuário precisa RE-LOGAR para ver o menu.

DO $mig$
DECLARE
  s              text;
  v_codigo       integer;
  v_codigos_irma integer[];
  v_path  constant text := '/compras/unidades';
  v_nome  constant text := 'Compras - Unidades Melo';
BEGIN
  FOR s IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'cad_unidade_melo' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;

    EXECUTE format(
      'ALTER TABLE %I.cad_unidade_melo ADD COLUMN IF NOT EXISTS unm_ativo varchar(1) NOT NULL DEFAULT ''S''', s);
    EXECUTE format(
      'ALTER TABLE %I.cad_unidade_melo ADD COLUMN IF NOT EXISTS unm_codigo_filial bigint', s);

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'tb_telas'
    ) THEN
      CONTINUE;
    END IF;

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
      'SELECT array_agg("CODIGO_TELA") FROM %I.tb_telas WHERE "PATH_TELA" = ''/compras/requisicoes-compra''', s)
      INTO v_codigos_irma;

    IF v_codigos_irma IS NOT NULL THEN
      EXECUTE format($f$
        INSERT INTO %I."tb_grupo_Permissao" ("grupoId", tela, cadastrar, editar, remover, exportar)
        SELECT gp."grupoId", %L,
               bool_or(gp.cadastrar), bool_or(gp.editar), bool_or(gp.remover), bool_or(gp.exportar)
        FROM %I."tb_grupo_Permissao" gp
        WHERE gp.tela = ANY(%L::int[])
          AND NOT EXISTS (
            SELECT 1 FROM %I."tb_grupo_Permissao" x
            WHERE x."grupoId" = gp."grupoId" AND x.tela = %L
          )
        GROUP BY gp."grupoId"$f$, s, v_codigo, s, v_codigos_irma, s, v_codigo);
    ELSE
      RAISE NOTICE '  tela irmã (requisicoes-compra) não encontrada em % — conceda a permissão manualmente', s;
    END IF;
  END LOOP;
END $mig$;
