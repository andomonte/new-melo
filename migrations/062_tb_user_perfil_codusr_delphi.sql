-- 062_tb_user_perfil_codusr_delphi.sql
-- Código do usuário no Delphi, por filial, no cadastro de usuário do web.
--
-- PARA QUE SERVE
-- O dbacao guarda o autor da ação. O histórico vindo do ERP guarda o código do
-- Delphi ('0625'); o web grava o login ('CARLA.SILVA'). Para "quem fez", a
-- v_usuario_resolvido (migration 061) já resolve os dois. O que ainda não
-- resolve é CLASSIFICAR: o relatório Títulos Diário à Vista separa Auto Peças
-- de Ferramentas por uma lista de CÓDIGOS do Delphi, e um login nunca casa com
-- essa lista — então toda fatura emitida pelo web cai em Auto Peças.
--
-- Casar por nome não serve: a maior emissora do sistema é 'CARLA.S' (0625,
-- 18.736 faturas em 2026) e o login dela é 'CARLA.SILVA'. E não há caminho
-- automático: dos 712 usuários do Delphi só 39 têm cod_vend preenchido, e
-- nenhum dos oito maiores emissores.
--
-- POR QUE AQUI
-- tb_user_perfil já é a linha (usuário × filial) do cadastro, e já guarda
-- codvend, codcomprador e cod_conta — códigos que também são por filial. O
-- código do Delphi é mais um deles, preenchido na mesma tela, ao lado dos
-- outros, e a linha já diz a qual filial pertence.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'tb_user_perfil' AND table_schema LIKE 'db\_%'
    ORDER BY table_schema
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.tb_user_perfil ADD COLUMN IF NOT EXISTS codusr_delphi varchar(4)', s);
    RAISE NOTICE '% : tb_user_perfil.codusr_delphi pronta', s;
  END LOOP;
END $$;

COMMENT ON COLUMN db_manaus.tb_user_perfil.codusr_delphi IS
  'Código do usuário no Delphi (dbusuario_delphi.codusr) NAQUELA filial. Usado para '
  'classificar a autoria no dbacao — ex.: ramo Auto Peças/Ferramentas do Diário à Vista.';
