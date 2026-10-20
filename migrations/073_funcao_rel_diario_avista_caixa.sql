-- 073_funcao_rel_diario_avista_caixa.sql
-- Cria a FUNÇÃO granular "Relatório Diário à Vista (Caixa)" (sigla REL_DIARIO_AVISTA).
-- Serve para liberar APENAS esse relatório de Contas a Receber ao operador de caixa,
-- SEM dar acesso à tela de Contas a Receber nem aos demais relatórios dela.
--
-- Concede ao perfil ADMINISTRAÇÃO (uso/teste imediato). Os demais perfis — em
-- especial o perfil do operador de caixa — recebem a função pela tela
-- Controle de Acesso → Perfis/Usuários → Selecionar Funções (grupo "Caixa").
--
-- ACL é central (só db_manaus). Idempotente.

DO $mig$
DECLARE
  v_fid bigint;
BEGIN
  SELECT id_functions INTO v_fid
    FROM db_manaus.tb_login_functions WHERE sigla = 'REL_DIARIO_AVISTA';

  IF v_fid IS NULL THEN
    -- id explícito (MAX+1) porque a sequence de tb_login_functions.id_functions
    -- está dessincronizada neste banco (mesmo caso da "tb_grupo_Permissao").
    SELECT COALESCE(MAX(id_functions), 0) + 1 INTO v_fid FROM db_manaus.tb_login_functions;
    INSERT INTO db_manaus.tb_login_functions (id_functions, descricao, sigla, "usadoEm")
    VALUES (v_fid, 'Relatório Diário à Vista (Caixa)', 'REL_DIARIO_AVISTA', 'Caixa');
    RAISE NOTICE 'função criada: id_functions=%', v_fid;
  ELSE
    RAISE NOTICE 'função já existe: id_functions=%', v_fid;
  END IF;

  -- grant ao ADMINISTRAÇÃO (idempotente)
  IF NOT EXISTS (
    SELECT 1 FROM db_manaus.tb_login_access_perfil
    WHERE login_perfil_name = 'ADMINISTRAÇÃO' AND id_functions = v_fid
  ) THEN
    INSERT INTO db_manaus.tb_login_access_perfil (login_perfil_name, id_functions)
    VALUES ('ADMINISTRAÇÃO', v_fid);
    RAISE NOTICE 'função concedida ao perfil ADMINISTRAÇÃO';
  END IF;
END
$mig$;
