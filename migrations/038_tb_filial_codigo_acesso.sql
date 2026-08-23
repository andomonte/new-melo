-- 038: Código de acesso por filial (segredo compartilhado do setor).
-- Usado para "destravar" as telas soltas (Separação Estação, Conferência Estação,
-- Monitor TV) ao abrir e ao trocar de filial. NÃO é login pessoal.
-- Se ficar NULL/vazio, a tela abre sem pedir código (gate desativado para a filial).

ALTER TABLE db_manaus.tb_filial
  ADD COLUMN IF NOT EXISTS codigo_acesso varchar(20);
