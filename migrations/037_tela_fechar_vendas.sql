-- 037_tela_fechar_vendas.sql
-- Registra a tela "Fechar Vendas" (Faturamento) e concede permissão aos mesmos
-- grupos que já têm a "Consultar Faturas" (tela 24). O menu (padrao.tsx) só mostra
-- itens cujo PATH_TELA está nas permissões do grupo do usuário.

-- 0. Corrige sequences atrasadas (artefato da migração Oracle→Postgres): senão o
--    nextval devolve um CODIGO_TELA/id já usado e viola a PK.
SELECT setval('db_manaus."tb_telas_CODIGO_TELA_seq"', GREATEST(
  (SELECT COALESCE(MAX("CODIGO_TELA"), 0) FROM db_manaus.tb_telas),
  (SELECT last_value FROM db_manaus."tb_telas_CODIGO_TELA_seq")
), true);
SELECT setval('db_manaus."tb_grupo_Permissao_id_seq"', GREATEST(
  (SELECT COALESCE(MAX(id), 0) FROM db_manaus."tb_grupo_Permissao"),
  (SELECT last_value FROM db_manaus."tb_grupo_Permissao_id_seq")
), true);

-- 1. Tela (CODIGO_TELA é auto-incremento; idempotente por PATH_TELA).
INSERT INTO db_manaus.tb_telas ("NOME_TELA", "PATH_TELA")
SELECT 'Fechar Vendas', '/faturamento/FecharVendas'
WHERE NOT EXISTS (
  SELECT 1 FROM db_manaus.tb_telas WHERE "PATH_TELA" = '/faturamento/FecharVendas'
);

-- 2. Permissões: concede aos mesmos grupos que têm a Consultar Faturas (tela 24).
INSERT INTO db_manaus."tb_grupo_Permissao" (editar, cadastrar, remover, exportar, "grupoId", tela)
SELECT gp.editar, gp.cadastrar, gp.remover, gp.exportar, gp."grupoId",
       (SELECT "CODIGO_TELA" FROM db_manaus.tb_telas WHERE "PATH_TELA" = '/faturamento/FecharVendas')
FROM db_manaus."tb_grupo_Permissao" gp
WHERE gp.tela = 24
  AND NOT EXISTS (
    SELECT 1 FROM db_manaus."tb_grupo_Permissao" x
    WHERE x."grupoId" = gp."grupoId"
      AND x.tela = (SELECT "CODIGO_TELA" FROM db_manaus.tb_telas WHERE "PATH_TELA" = '/faturamento/FecharVendas')
  );
