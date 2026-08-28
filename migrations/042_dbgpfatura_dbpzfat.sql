-- 042_dbgpfatura_dbpzfat.sql
--
-- Tabelas do modelo de GP (grupo de pagamento) do Delphi que NÃO tinham sido migradas
-- pro PG. Necessárias para o "agrupar + gerar cobrança" ficar fiel ao Oracle:
--   - dbgpfatura: cabeçalho do grupo (usado por RESUMO_GP/NAVEGA_GP/DADOS_GP).
--   - dbpzfat:    prazos das parcelas por fatura/grupo (RETORNA_PRAZO_GP lê daqui).
-- Espelham GERAL.DBGPFATURA e GERAL.DBPZFAT do Oracle.

CREATE TABLE IF NOT EXISTS db_manaus.dbgpfatura (
  codgp          numeric        NOT NULL,
  codcli         varchar(5),
  dtagrupamento  timestamp,
  dtatualizacao  timestamp,
  CONSTRAINT pk_dbgpfatura PRIMARY KEY (codgp)
);

CREATE TABLE IF NOT EXISTS db_manaus.dbpzfat (
  codfat  varchar(9)  NOT NULL,
  prazo   varchar(3)  NOT NULL,
  codgp   numeric
);
CREATE INDEX IF NOT EXISTS idx_dbpzfat_codfat ON db_manaus.dbpzfat (codfat);
CREATE INDEX IF NOT EXISTS idx_dbpzfat_codgp  ON db_manaus.dbpzfat (codgp);
