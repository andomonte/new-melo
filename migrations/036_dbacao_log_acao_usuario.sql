-- 036_dbacao_log_acao_usuario.sql
-- Tabela de log de ações do usuário — espelha a DBACAO do Oracle/Delphi
-- (pacote USUARIO.Inc_Acao_Usr: Insert Into DbAcao(codusr,acao,tabela,obs,data)).
-- Uso inicial: histórico de CANCELAMENTO DE COBRANÇA (acao='CANCEL.TITULO',
-- tabela='DBRECEB', obs='COD:<codfat> | MOTIVO: <motivo>'), capturando quem,
-- quando e o motivo. Serve como log geral de ações para outros fluxos depois.

CREATE TABLE IF NOT EXISTS db_manaus.dbacao (
  cod_acao bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codusr   varchar(60),          -- quem (login do usuário)
  acao     varchar(30),          -- ex.: 'CANCEL.TITULO'
  tabela   varchar(30),          -- ex.: 'DBRECEB'
  obs      varchar(255),         -- ex.: 'COD:001027720 | MOTIVO: ...'
  data     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dbacao_tabela_acao ON db_manaus.dbacao (tabela, acao);
CREATE INDEX IF NOT EXISTS idx_dbacao_data ON db_manaus.dbacao (data);
