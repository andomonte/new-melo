-- 075_funcoes_clientes.sql
-- Funções granulares da tela de Clientes, fiéis ao Delphi (UniFormConsultaCliente):
--   CLI_FIN      → financeiro COMPLETO: mudar classe de pgto, alterar banco e exportar
--                  (equivale à flag Cli_fin='S')
--   CLI_FIN_RES  → financeiro RESTRITO: mudar classe e alterar banco, SEM exportar
--                  (equivale à flag cli_fin_res='S')
-- Sem nenhuma das duas = comprador/consulta (só Zoom, Status, Intervalo, Filtrar),
-- como no Delphi (Cli_com='S' desabilita as ações financeiras).
--
-- Concede ao perfil ADMINISTRAÇÃO (uso/teste imediato). Os demais perfis/usuários
-- recebem pela tela Controle de Acesso → Perfis/Usuários → Selecionar Funções
-- (grupo "Clientes"). ACL é central (só db_manaus). Idempotente.

DO $mig$
DECLARE
  v_fid bigint;
BEGIN
  -- CLI_FIN -----------------------------------------------------------------
  SELECT id_functions INTO v_fid
    FROM db_manaus.tb_login_functions WHERE sigla = 'CLI_FIN';
  IF v_fid IS NULL THEN
    -- id explícito (MAX+1): a sequence de tb_login_functions.id_functions está
    -- dessincronizada neste banco.
    SELECT COALESCE(MAX(id_functions), 0) + 1 INTO v_fid FROM db_manaus.tb_login_functions;
    INSERT INTO db_manaus.tb_login_functions (id_functions, descricao, sigla, "usadoEm")
    VALUES (v_fid, 'Cliente - Financeiro (classe, banco, exportar)', 'CLI_FIN', 'Clientes');
    RAISE NOTICE 'função CLI_FIN criada: id=%', v_fid;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM db_manaus.tb_login_access_perfil
    WHERE login_perfil_name = 'ADMINISTRAÇÃO' AND id_functions = v_fid
  ) THEN
    INSERT INTO db_manaus.tb_login_access_perfil (login_perfil_name, id_functions)
    VALUES ('ADMINISTRAÇÃO', v_fid);
  END IF;

  -- CLI_FIN_RES -------------------------------------------------------------
  SELECT id_functions INTO v_fid
    FROM db_manaus.tb_login_functions WHERE sigla = 'CLI_FIN_RES';
  IF v_fid IS NULL THEN
    SELECT COALESCE(MAX(id_functions), 0) + 1 INTO v_fid FROM db_manaus.tb_login_functions;
    INSERT INTO db_manaus.tb_login_functions (id_functions, descricao, sigla, "usadoEm")
    VALUES (v_fid, 'Cliente - Financeiro Restrito (classe, banco)', 'CLI_FIN_RES', 'Clientes');
    RAISE NOTICE 'função CLI_FIN_RES criada: id=%', v_fid;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM db_manaus.tb_login_access_perfil
    WHERE login_perfil_name = 'ADMINISTRAÇÃO' AND id_functions = v_fid
  ) THEN
    INSERT INTO db_manaus.tb_login_access_perfil (login_perfil_name, id_functions)
    VALUES ('ADMINISTRAÇÃO', v_fid);
  END IF;
END
$mig$;
