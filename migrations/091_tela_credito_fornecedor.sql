-- 091_tela_credito_fornecedor.sql  (24/11/2026)
-- Fase 4 do roteiro docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md (etapa 6):
-- tela Financeiro → Crédito de Fornecedor (/admin/financeiro/creditoFornecedor).
--  1. Forma de pagamento "Z – ABATIMENTO DE SALDO" em cad_forma_pgto, INATIVA: não aparece no
--     "Pagar" do Contas a Pagar; só a tela de crédito grava com ela (conta 0128 CRÉDITO\ACERTO,
--     sem caixa/banco). O histórico do título mostra o nome pela letra.
--  2. credor_credito_uso.fpg_cof_id: o lançamento em dbfpgto gerado pela baixa com crédito
--     (para o estorno do uso cancelar o mesmo lançamento).
--  3. Tela em tb_telas com a mesma permissão da tela Contas a Pagar (todos os grupos que a têm).
-- Idempotente. Depois de aplicar, o usuário precisa RE-LOGAR para ver o menu.

DO $mig$
DECLARE
  s              text;
  v_codigo       integer;
  v_codigos_irma integer[];
  v_path  constant text := '/admin/financeiro/creditoFornecedor';
  v_nome  constant text := 'Financeiro - Crédito de Fornecedor';
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'credor_credito_uso' AND table_schema LIKE 'db\_%'
     ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;

    -- 1. forma de pagamento do abatimento
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'cad_forma_pgto') THEN
      EXECUTE format($f$
        INSERT INTO %I.cad_forma_pgto (fpg_letra, fpg_descricao, fpg_ativo)
        SELECT 'Z', 'ABATIMENTO DE SALDO', 'N'
         WHERE NOT EXISTS (SELECT 1 FROM %I.cad_forma_pgto WHERE fpg_letra = 'Z')$f$, s, s);
    END IF;

    -- 2. vínculo do uso com o lançamento da baixa
    EXECUTE format('ALTER TABLE %I.credor_credito_uso ADD COLUMN IF NOT EXISTS fpg_cof_id bigint', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_credor_uso_fpg ON %I.credor_credito_uso (fpg_cof_id)', s);

    -- 3. tela + permissão (copiada de Contas a Pagar)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'tb_telas') THEN
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

    EXECUTE format('SELECT array_agg("CODIGO_TELA") FROM %I.tb_telas WHERE "PATH_TELA" = ''/admin/financeiro/contasAPagar''', s)
      INTO v_codigos_irma;
    IF v_codigos_irma IS NULL THEN
      RAISE NOTICE '  tela Contas a Pagar não existe em % — tela de crédito não registrada', s;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT "CODIGO_TELA" FROM %I.tb_telas WHERE "PATH_TELA" = %L LIMIT 1', s, v_path) INTO v_codigo;
    IF v_codigo IS NULL THEN
      EXECUTE format('SELECT COALESCE(MAX("CODIGO_TELA"),0) + 1 FROM %I.tb_telas', s) INTO v_codigo;
      EXECUTE format('INSERT INTO %I.tb_telas ("CODIGO_TELA","NOME_TELA","PATH_TELA") VALUES (%L,%L,%L)',
        s, v_codigo, v_nome, v_path);
      RAISE NOTICE '  tela % criada (CODIGO_TELA=%)', v_path, v_codigo;
    END IF;

    IF v_codigos_irma IS NOT NULL THEN
      EXECUTE format($f$
        INSERT INTO %I."tb_grupo_Permissao" ("grupoId", tela, cadastrar, editar, remover, exportar)
        SELECT gp."grupoId", %L,
               bool_or(gp.cadastrar), bool_or(gp.editar), bool_or(gp.remover), bool_or(gp.exportar)
          FROM %I."tb_grupo_Permissao" gp
         WHERE gp.tela = ANY(%L::int[])
           AND NOT EXISTS (SELECT 1 FROM %I."tb_grupo_Permissao" x WHERE x."grupoId" = gp."grupoId" AND x.tela = %L)
         GROUP BY gp."grupoId"$f$, s, v_codigo, s, v_codigos_irma, s, v_codigo);
    ELSE
      RAISE NOTICE '  tela Contas a Pagar não encontrada em % — conceda a permissão manualmente', s;
    END IF;
  END LOOP;
END $mig$;
