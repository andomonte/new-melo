-- 048_financeiro_arquivos.sql
-- Menu "Financeiro > Arquivos" — espelha 1:1 o menu do Delphi (UniPrincipal.dfm):
--   Compradores | Centro de Custos | CFOP | UF | --- | Bancos Centrais |
--   Agencias | Contas Bancarias | Operador Caixa | Servicos
--
-- O que este script faz:
--   1) Cria dbbancocentral. Essa tabela NAO existia no Postgres (so no Oracle),
--      apesar de dbbanco.cod_bc ja apontar para ela. Semeia com os codigos de
--      Banco Central em uso + nomes FEBRABAN conhecidos.
--   2) Cria dbservico_nfs (cadastro de Servicos da NFS-e, colunas SEN_* do
--      package Oracle COBRANCA_NF_SERVICO).
--   3) Registra as 9 telas em tb_telas e espelha a permissao da tela irma
--      "/admin/financeiro/contasAReceber" para os grupos que ja a possuem.
--
-- Roda em TODOS os schemas de filial que tenham tb_telas. Idempotente.
--
-- Depois de aplicar: o usuario precisa RE-LOGAR (as permissoes sao carregadas
-- no login, nao em runtime).

DO $mig$
DECLARE
  s              text;
  v_tela         record;
  v_codigo       integer;
  v_codigos_irma integer[];
  -- (path, nome) na mesma ordem do menu do Delphi
  v_telas text[][] := ARRAY[
    ['/financeiro/arquivos/compradores',     'Arquivos - Compradores'],
    ['/financeiro/arquivos/centrosCusto',    'Arquivos - Centro de Custos'],
    ['/financeiro/arquivos/cfop',            'Arquivos - CFOP'],
    ['/financeiro/arquivos/uf',              'Arquivos - UF'],
    ['/financeiro/arquivos/bancosCentrais',  'Arquivos - Bancos Centrais'],
    ['/financeiro/arquivos/agencias',        'Arquivos - Agencias'],
    ['/financeiro/arquivos/contasBancarias', 'Arquivos - Contas Bancarias'],
    ['/financeiro/arquivos/operadorCaixa',   'Arquivos - Operador Caixa'],
    ['/financeiro/arquivos/servicos',        'Arquivos - Servicos']
  ];
BEGIN
  FOR s IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'tb_telas' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;

    ------------------------------------------------------------------
    -- 1) dbbancocentral (Bancos Centrais)
    ------------------------------------------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.dbbancocentral (
        codbc varchar(4)  NOT NULL,
        descr varchar(60),
        CONSTRAINT dbbancocentral_pk PRIMARY KEY (codbc)
      )$f$, s);

    -- Semeia os codigos de Banco Central ja referenciados por dbbanco.
    -- Nome vem da lista FEBRABAN quando conhecido; senao fica 'BANCO <cod>'
    -- para o usuario renomear na tela nova.
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = s AND table_name = 'dbbanco'
    ) THEN
      EXECUTE format($f$
        INSERT INTO %I.dbbancocentral (codbc, descr)
        SELECT b.cod, COALESCE(f.nome, 'BANCO ' || b.cod)
        FROM (
          SELECT DISTINCT lpad(trim(cod_bc), 3, '0') AS cod
          FROM %I.dbbanco
          WHERE cod_bc IS NOT NULL AND trim(cod_bc) <> ''
        ) b
        LEFT JOIN (VALUES
          ('001','BANCO DO BRASIL'),      ('003','BANCO DA AMAZONIA'),
          ('004','BANCO DO NORDESTE'),    ('021','BANESTES'),
          ('033','SANTANDER'),            ('037','BANPARA'),
          ('041','BANRISUL'),             ('070','BRB'),
          ('077','BANCO INTER'),          ('104','CAIXA ECONOMICA FEDERAL'),
          ('208','BTG PACTUAL'),          ('212','BANCO ORIGINAL'),
          ('218','BANCO BS2'),            ('237','BRADESCO'),
          ('246','BANCO ABC BRASIL'),     ('260','NU PAGAMENTOS'),
          ('318','BANCO BMG'),            ('320','CHINA CONSTRUCTION BANK'),
          ('341','ITAU UNIBANCO'),        ('356','BANCO REAL'),
          ('389','BANCO MERCANTIL'),      ('399','HSBC'),
          ('422','BANCO SAFRA'),          ('453','BANCO RURAL'),
          ('633','BANCO RENDIMENTO'),     ('637','BANCO SOFISA'),
          ('652','ITAU UNIBANCO HOLDING'),('655','BANCO VOTORANTIM'),
          ('707','BANCO DAYCOVAL'),       ('712','BANCO OURINVEST'),
          ('735','BANCO NEON'),           ('745','CITIBANK'),
          ('746','BANCO MODAL'),          ('748','SICREDI'),
          ('756','SICOOB'),               ('000','SEM BANCO')
        ) AS f(cod, nome) ON f.cod = b.cod
        WHERE NOT EXISTS (
          SELECT 1 FROM %I.dbbancocentral x WHERE x.codbc = b.cod
        )$f$, s, s, s);
    END IF;

    ------------------------------------------------------------------
    -- 2) dbservico_nfs (Servicos / NFS-e) — colunas SEN_* do Delphi
    ------------------------------------------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.dbservico_nfs (
        sen_id        varchar(9)   NOT NULL,
        sen_codigo    varchar(5)   NOT NULL,
        sen_cnae      varchar(9)   NOT NULL,
        sen_codunico  varchar(20)  NOT NULL,
        sen_atividade varchar(150) NOT NULL,
        sen_issqn     numeric(5,2) DEFAULT 0,
        sen_codgpc    varchar(4),
        sen_excluido  numeric      DEFAULT 0,
        codusr        varchar(4),
        CONSTRAINT dbservico_nfs_pk PRIMARY KEY (sen_id),
        CONSTRAINT dbservico_nfs_codunico_uk UNIQUE (sen_codunico)
      )$f$, s);

    ------------------------------------------------------------------
    -- 3) Telas + permissoes
    ------------------------------------------------------------------
    -- Corrige as sequences atrasadas (artefato da migracao Oracle->PG): sem
    -- isso o nextval devolve um id ja usado e a insercao viola a PK.
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

    -- Codigos da tela irma (Contas a Receber) — o banco tem PATHs duplicados.
    EXECUTE format(
      'SELECT array_agg("CODIGO_TELA") FROM %I.tb_telas WHERE "PATH_TELA" = ''/admin/financeiro/contasAReceber''', s)
      INTO v_codigos_irma;

    FOR v_tela IN SELECT v_telas[i][1] AS path, v_telas[i][2] AS nome
                  FROM generate_subscripts(v_telas, 1) AS i
    LOOP
      EXECUTE format(
        'SELECT "CODIGO_TELA" FROM %I.tb_telas WHERE "PATH_TELA" = %L LIMIT 1', s, v_tela.path)
        INTO v_codigo;

      IF v_codigo IS NULL THEN
        EXECUTE format(
          'SELECT COALESCE(MAX("CODIGO_TELA"),0) + 1 FROM %I.tb_telas', s) INTO v_codigo;
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
        RAISE NOTICE '  tela irma (contasAReceber) nao encontrada em % — conceda a permissao manualmente', s;
      END IF;
    END LOOP;
  END LOOP;
END $mig$;
