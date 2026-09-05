-- 052_garantia_produto.sql
-- Garantia de Produto — porte do TFrmGarantiaProd do Delphi
-- (Formularios/GARANTIA PRODUTO/UniGarantiaProd.pas, package Oracle GARANTIA).
--
-- As duas tabelas do modulo NAO vieram na migracao Oracle->Postgres. Nomes e
-- colunas seguem o que o Delphi consulta em btnFiltrarClick:
--   Select G.CodGar, G.Dt_Gar, G.Status, C.Nome, G.NroDoc, G.Obs
--   From DbGarantiaProd g, DbItGarantiaProd It ... Where g.cancel = 'N'
-- e os parametros de GARANTIA.INC_GARANTIA / INC_AUXITGAR.
--
-- Status (combo do Delphi):
--   P = PROVISORIO   A = ATENDIDO   N = NAO ATENDIDO
--   M = MELO         C = COBRADO DO CLIENTE
-- A inclusao so oferece P e M; os demais entram pela alteracao de situacao.
--
-- Cancelamento e flag (cancel='S'), nao exclusao — o filtro do Delphi usa
-- g.cancel = 'N'.
--
-- Roda em todos os schemas de filial que tenham dbclien. Idempotente.

DO $mig$
DECLARE
  s              text;
  v_tela         record;
  v_codigo       integer;
  v_codigos_irma integer[];
  v_telas text[][] := ARRAY[
    ['/vendas/garantias', 'Garantias de Produtos']
  ];
BEGIN
  FOR s IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'dbclien' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;

    ------------------------------------------------------------------
    -- 1) Cabecalho da garantia
    ------------------------------------------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.dbgarantiaprod (
        codgar     varchar(9)   NOT NULL,
        nrodoc     varchar(15)  NOT NULL,
        codcli     varchar(10)  NOT NULL,
        dt_gar     timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        obs        varchar(60),
        status     varchar(1)   NOT NULL DEFAULT 'P',
        cancel     varchar(1)   NOT NULL DEFAULT 'N',
        codusr     varchar(20),
        created_at timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT dbgarantiaprod_pk PRIMARY KEY (codgar),
        CONSTRAINT dbgarantiaprod_status_ck CHECK (status IN ('P','A','N','M','C')),
        CONSTRAINT dbgarantiaprod_cancel_ck CHECK (cancel IN ('S','N')),
        CONSTRAINT dbgarantiaprod_cli_fk FOREIGN KEY (codcli)
          REFERENCES %I.dbclien (codcli)
      )$f$, s, s);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_dbgarantiaprod_cli ON %I.dbgarantiaprod (codcli)', s);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_dbgarantiaprod_dt ON %I.dbgarantiaprod (dt_gar DESC)', s);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_dbgarantiaprod_status ON %I.dbgarantiaprod (status) WHERE cancel = ''N''', s);

    ------------------------------------------------------------------
    -- 2) Itens
    ------------------------------------------------------------------
    -- O Delphi guarda um item por produto (EXISTE_ITAUXGAR recusa repetido),
    -- por isso a PK composta.
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.dbitgarantiaprod (
        codgar  varchar(9)    NOT NULL,
        codprod varchar(6)    NOT NULL,
        qtde    numeric(12,3) NOT NULL,
        prunit  numeric(14,4) NOT NULL DEFAULT 0,
        arm_id  integer,
        CONSTRAINT dbitgarantiaprod_pk PRIMARY KEY (codgar, codprod),
        CONSTRAINT dbitgarantiaprod_qtde_ck CHECK (qtde > 0),
        CONSTRAINT dbitgarantiaprod_gar_fk FOREIGN KEY (codgar)
          REFERENCES %I.dbgarantiaprod (codgar) ON DELETE CASCADE,
        CONSTRAINT dbitgarantiaprod_prod_fk FOREIGN KEY (codprod)
          REFERENCES %I.dbprod (codprod)
      )$f$, s, s, s);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_dbitgarantiaprod_prod ON %I.dbitgarantiaprod (codprod)', s);

    ------------------------------------------------------------------
    -- 3) Tela + permissoes (so onde existe controle de acesso)
    ------------------------------------------------------------------
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = s AND table_name = 'tb_telas'
    ) THEN
      CONTINUE;
    END IF;

    -- Sequences atrasadas (artefato Oracle->PG): sem isso o nextval devolve
    -- um id ja usado e a insercao viola a PK.
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'S' AND n.nspname = s AND c.relname = 'tb_telas_CODIGO_TELA_seq'
    ) THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST((SELECT COALESCE(MAX("CODIGO_TELA"),0) FROM %I.tb_telas), (SELECT last_value FROM %I."tb_telas_CODIGO_TELA_seq")), true)',
        s || '."tb_telas_CODIGO_TELA_seq"', s, s);
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'S' AND n.nspname = s AND c.relname = 'tb_grupo_Permissao_id_seq'
    ) THEN
      EXECUTE format(
        'SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id),0) FROM %I."tb_grupo_Permissao"), (SELECT last_value FROM %I."tb_grupo_Permissao_id_seq")), true)',
        s || '."tb_grupo_Permissao_id_seq"', s, s);
    END IF;

    -- Espelha a permissao da Central de Vendas (tela irma do mesmo menu).
    EXECUTE format(
      'SELECT array_agg("CODIGO_TELA") FROM %I.tb_telas WHERE "PATH_TELA" IN (''/vendas/centralVendasV2'', ''/vendas/centralVendas'')', s)
      INTO v_codigos_irma;

    FOR v_tela IN SELECT v_telas[i][1] AS path, v_telas[i][2] AS nome
                  FROM generate_subscripts(v_telas, 1) AS i
    LOOP
      EXECUTE format(
        'SELECT "CODIGO_TELA" FROM %I.tb_telas WHERE "PATH_TELA" = %L LIMIT 1', s, v_tela.path)
        INTO v_codigo;

      IF v_codigo IS NULL THEN
        EXECUTE format('SELECT COALESCE(MAX("CODIGO_TELA"),0) + 1 FROM %I.tb_telas', s) INTO v_codigo;
        EXECUTE format(
          'INSERT INTO %I.tb_telas ("CODIGO_TELA","NOME_TELA","PATH_TELA") VALUES (%L,%L,%L)',
          s, v_codigo, v_tela.nome, v_tela.path);
        RAISE NOTICE '  tela % criada (CODIGO_TELA=%)', v_tela.path, v_codigo;
      END IF;

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
        RAISE NOTICE '  tela irma (Central de Vendas) nao encontrada em % — conceda a permissao manualmente', s;
      END IF;
    END LOOP;
  END LOOP;
END $mig$;
