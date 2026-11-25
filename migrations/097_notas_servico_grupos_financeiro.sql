-- 097_notas_servico_grupos_financeiro.sql  (25/11/2026)
-- Notas de Serviço (/admin/financeiro/notasServico): acesso também para os grupos
-- "financeiro" e "CONTASAPAGAR" (pedido do usuário). Mesmas permissões que o grupo tem em
-- Contas a Pagar. Só onde a tela e o grupo existem. Idempotente.
-- Depois de aplicar, o usuário precisa RE-LOGAR para ver o menu.

DO $mig$
DECLARE
  s        text;
  v_codigo integer;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'tb_telas' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    EXECUTE format('SELECT "CODIGO_TELA" FROM %I.tb_telas WHERE "PATH_TELA" = %L LIMIT 1',
      s, '/admin/financeiro/notasServico') INTO v_codigo;
    IF v_codigo IS NULL THEN
      RAISE NOTICE '%: tela Notas de Serviço não existe — nada a fazer', s;
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

    EXECUTE format($f$
      INSERT INTO %I."tb_grupo_Permissao" ("grupoId", tela, cadastrar, editar, remover, exportar)
      SELECT gp."grupoId", %L,
             bool_or(gp.cadastrar), bool_or(gp.editar), bool_or(gp.remover), bool_or(gp.exportar)
        FROM %I."tb_grupo_Permissao" gp
        JOIN %I.tb_telas t ON t."CODIGO_TELA" = gp.tela AND t."PATH_TELA" = '/admin/financeiro/contasAPagar'
       WHERE gp."grupoId" IN ('financeiro', 'CONTASAPAGAR')
         AND NOT EXISTS (SELECT 1 FROM %I."tb_grupo_Permissao" x WHERE x."grupoId" = gp."grupoId" AND x.tela = %L)
       GROUP BY gp."grupoId"$f$, s, v_codigo, s, s, s, v_codigo);
    RAISE NOTICE '%: Notas de Serviço liberada para financeiro/CONTASAPAGAR (onde existem)', s;
  END LOOP;
END $mig$;
