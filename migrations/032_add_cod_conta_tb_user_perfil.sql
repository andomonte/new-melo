-- 032_add_cod_conta_tb_user_perfil.sql
-- Adiciona cod_conta (conta do operador de caixa) em tb_user_perfil, seguindo o mesmo
-- padrão de codvend/codcomprador (amarração usuário + filial → papel). É o equivalente web
-- do cad_usuario_caixa do Delphi (login do operador de caixa deriva a conta daqui).
-- tb_user_perfil existe por filial (um schema por filial). Idempotente.

ALTER TABLE db_manaus.tb_user_perfil  ADD COLUMN IF NOT EXISTS cod_conta varchar;
ALTER TABLE db_roraima.tb_user_perfil ADD COLUMN IF NOT EXISTS cod_conta varchar;
ALTER TABLE db_rondonia.tb_user_perfil ADD COLUMN IF NOT EXISTS cod_conta varchar;
