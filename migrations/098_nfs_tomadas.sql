-- 098_nfs_tomadas.sql  (25/11/2026)
-- Notas de Serviço TOMADAS (serviços contratados pela empresa), como no Delphi
-- (Nota Fiscal de Serviço > Tomado), mas SEM lançamento manual: as notas vêm do portal nacional
-- (ADN, papel TOMADOR — já baixadas pela busca, migration 095) e daqui se gera, manualmente,
-- o título a pagar.
--   1. nfs_tomada_titulo: títulos (dbpgto) gerados para cada nota tomada.
--   2. Tela /admin/financeiro/notasServicoTomadas, com as mesmas permissões da tela de
--      Notas de Serviço (prestadas); esta passa a se chamar "Notas de Serviço - Prestadas".
-- As tomadas antigas do Delphi (DBENTRADA_NFS2, 2014–2015) ficam de fora (decisão do usuário).
-- Idempotente. Depois de aplicar, RE-LOGAR para ver o menu.

DO $mig$
DECLARE
  s        text;
  v_prest  integer;
  v_codigo integer;
  v_path   constant text := '/admin/financeiro/notasServicoTomadas';
  v_nome   constant text := 'Financeiro - Notas de Serviço - Tomadas';
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'nfs_adn_documento' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.nfs_tomada_titulo (
        id        bigserial PRIMARY KEY,
        doc_id    bigint      NOT NULL,                 -- nfs_adn_documento.id
        cod_pgto  varchar(9)  NOT NULL,                 -- dbpgto.cod_pgto
        criado_em timestamptz NOT NULL DEFAULT now(),
        usuario   varchar(60),
        CONSTRAINT nfs_tomada_titulo_uk UNIQUE (doc_id, cod_pgto)
      )$f$, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_nfs_tomada_titulo_pgto ON %I.nfs_tomada_titulo (cod_pgto)', s);
  END LOOP;

  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'tb_telas' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    EXECUTE format('SELECT "CODIGO_TELA" FROM %I.tb_telas WHERE "PATH_TELA" = %L LIMIT 1',
      s, '/admin/financeiro/notasServico') INTO v_prest;
    IF v_prest IS NULL THEN
      RAISE NOTICE '%: tela de Notas de Serviço não existe — Tomadas não registrada', s;
      CONTINUE;
    END IF;
    EXECUTE format('UPDATE %I.tb_telas SET "NOME_TELA" = %L WHERE "CODIGO_TELA" = %L',
      s, 'Financeiro - Notas de Serviço - Prestadas', v_prest);

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
      SELECT gp."grupoId", %L, bool_or(gp.cadastrar), bool_or(gp.editar), bool_or(gp.remover), bool_or(gp.exportar)
        FROM %I."tb_grupo_Permissao" gp
       WHERE gp.tela = %L
         AND NOT EXISTS (SELECT 1 FROM %I."tb_grupo_Permissao" x WHERE x."grupoId" = gp."grupoId" AND x.tela = %L)
       GROUP BY gp."grupoId"$f$, s, v_codigo, s, v_prest, s, v_codigo);
  END LOOP;
END $mig$;
