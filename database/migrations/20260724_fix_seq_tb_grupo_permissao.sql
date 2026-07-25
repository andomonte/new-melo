-- Corrige a sequence do PK de tb_grupo_Permissao que estava dessincronizada
-- (nextval gerava um id que já existia, causando erro 23505 -
-- "duplicar valor da chave viola a restrição de unicidade tb_grupo_Permissao_pkey"
-- ao salvar/editar perfis em /admin/controleAcesso/perfis).
--
-- Causa: linhas inseridas com id explícito (importação/migração) sem avançar a
-- sequence. Assim, QUALQUER INSERT nessa tabela (inclusive o UPDATE de perfil,
-- que apaga e reinsere as permissões de tela) falhava.
--
-- Idempotente: reposiciona a sequence para MAX(id); o próximo nextval passa a
-- ser MAX(id)+1. Rodar novamente não causa efeito colateral.

SELECT setval(
  'db_manaus."tb_grupo_Permissao_id_seq"',
  (SELECT COALESCE(MAX(id), 0) FROM db_manaus."tb_grupo_Permissao"),
  true
);

-- (Opcional) Verificação:
-- SELECT last_value, is_called FROM db_manaus."tb_grupo_Permissao_id_seq";
-- SELECT COALESCE(MAX(id),0) FROM db_manaus."tb_grupo_Permissao";
