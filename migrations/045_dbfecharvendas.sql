-- 045_dbfecharvendas.sql
-- Espelha a tabela DBFECHARVENDAS do Oracle (usada por VENDAS_OPERACOES.Fechar_Venda /
-- Voltar_Venda). Registra o FECHAMENTO ADMINISTRATIVO de uma venda (status dbvenda='F'),
-- permitindo depois DESFAZER (Voltar_Venda → status volta para 'I').
--   codvenda → dbvenda.codvenda | codfat → dbfatura.codfat (NULL no fechamento admin)
--   data     → quando fechou     | status → status ANTERIOR da venda (antes de virar 'F')
-- NÃO havia backfill do Oracle: tabela nova, começa vazia (fechamentos novos do web).

CREATE TABLE IF NOT EXISTS db_manaus.dbfecharvendas (
  codvenda varchar(9) NOT NULL,
  codfat   varchar(9),
  data     timestamp,
  status   varchar(1)
);

CREATE INDEX IF NOT EXISTS idx_dbfecharvendas_codvenda ON db_manaus.dbfecharvendas (codvenda);
CREATE INDEX IF NOT EXISTS idx_dbfecharvendas_codfat   ON db_manaus.dbfecharvendas (codfat);
