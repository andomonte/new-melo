-- 076_funcao_consulta_fatura_caixa.sql
-- Cria a FUNÇÃO granular "Minhas Faturas (Caixa)" (sigla CONSULTA_FATURA_CAIXA).
-- Libera ao operador de caixa a Consulta de Faturas SÓ das faturas que ele criou
-- (botão "Minhas Faturas" no Caixa), para ver o motivo de uma nota não autorizada e
-- reemitir — sem dar acesso à tela Consulta de Faturas nem às ações dela (cancelar,
-- cobrança, agrupar, alterar). O criador vem de dbacao ('INCLUIR','DBFATURA'), igual ao Delphi.
--
-- Concede ao perfil ADMINISTRAÇÃO (uso/teste imediato). O perfil do operador de caixa
-- recebe pela tela Controle de Acesso → Perfis/Usuários → Selecionar Funções (grupo "Caixa").
--
-- ACL é central (só db_manaus). Idempotente.

DO $mig$
DECLARE
  v_fid bigint;
BEGIN
  SELECT id_functions INTO v_fid
    FROM db_manaus.tb_login_functions WHERE sigla = 'CONSULTA_FATURA_CAIXA';

  IF v_fid IS NULL THEN
    -- id explícito (MAX+1): a sequence de tb_login_functions.id_functions está dessincronizada.
    SELECT COALESCE(MAX(id_functions), 0) + 1 INTO v_fid FROM db_manaus.tb_login_functions;
    INSERT INTO db_manaus.tb_login_functions (id_functions, descricao, sigla, "usadoEm")
    VALUES (v_fid, 'Minhas Faturas (Caixa)', 'CONSULTA_FATURA_CAIXA', 'Caixa');
    RAISE NOTICE 'função criada: id_functions=%', v_fid;
  ELSE
    RAISE NOTICE 'função já existe: id_functions=%', v_fid;
  END IF;

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
