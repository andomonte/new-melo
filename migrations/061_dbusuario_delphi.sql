-- 061_dbusuario_delphi.sql
-- Espelho de leitura dos usuários do Delphi + view que resolve "quem fez".
--
-- PROBLEMA
-- O dbacao guarda o autor da ação em codusr, mas em dois formatos:
--   177.289 linhas com o código do Delphi (4 dígitos, ex. '0189') — histórico
--        24 linhas com o login do web (ex. 'REGINALDO')          — gravadas aqui
-- Nenhum dos códigos do histórico existe na dbusuario do Postgres (48 linhas,
-- 21 códigos) — o cadastro do Oracle tem 712. Então "quem fez" não resolve para
-- o histórico, e o Delphi resolve justamente por essa tabela.
--
-- POR QUE UMA TABELA NOVA E NÃO POPULAR A dbusuario
-- A dbusuario do Postgres está em uso por 20 arquivos do web, e não só para
-- auditoria: "SELECT codusr FROM dbusuario WHERE nomeusr = ..." aparece na baixa
-- de título, no caixa e na conciliação. Ela não tem PK nem unique e já tem
-- duplicatas (0327, 0341 e 0324 aparecem 4x cada). Carregar 712 usuários ali
-- multiplicaria essas duplicatas e faria aquelas consultas devolverem mais de
-- uma linha. Esta tabela é só espelho de leitura, com PK de verdade.
--
-- COMO USAR
-- A view v_usuario_resolvido devolve (codusr, nome, origem) das duas fontes.
-- Para mostrar o autor de uma ação:
--   SELECT a.*, u.nome FROM dbacao a
--   LEFT JOIN v_usuario_resolvido u ON u.codusr = a.codusr;
--
-- OBS: a parte "web" da view aponta para db_manaus.tb_login_user de propósito —
-- o login é central (verUser.ts usa o pool central; as cópias nos outros schemas
-- são resquício). Mesma limitação da migration 058: vale enquanto os schemas
-- estiverem no mesmo banco.

DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT nspname FROM pg_namespace WHERE nspname LIKE 'db\_%' ORDER BY nspname
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.dbusuario_delphi (
        codusr        varchar(4)  PRIMARY KEY,
        nomeusr       varchar(60),
        filial_origem varchar(30),
        importado_em  timestamp NOT NULL DEFAULT now()
      )$f$, s);

    EXECUTE format($f$
      CREATE OR REPLACE VIEW %I.v_usuario_resolvido AS
        SELECT codusr::text AS codusr,
               COALESCE(NULLIF(btrim(nomeusr), ''), codusr::text) AS nome,
               'DELPHI'::text AS origem
          FROM %I.dbusuario_delphi
        UNION ALL
        SELECT login_user_login::text,
               COALESCE(NULLIF(btrim(login_user_name), ''), login_user_login::text),
               'WEB'::text
          FROM db_manaus.tb_login_user
      $f$, s, s);

    RAISE NOTICE '% : dbusuario_delphi + v_usuario_resolvido prontas', s;
  END LOOP;
END $$;
