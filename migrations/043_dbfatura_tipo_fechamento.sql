-- 043_dbfatura_tipo_fechamento.sql
--
-- Marcador de "fechamento" na fatura (conceito do WEB — NÃO existe no Oracle/Delphi).
-- Usado para separar as faturas que ficam com a cobrança para o fechamento do período
-- (ex.: fechamento SEMANAL: fatura durante a semana, cobrança agrupada na segunda).
--
-- Migração de dados Oracle: NÃO se aplica — o conceito não existe lá. Todas as faturas
-- migradas/antigas ficam NULL (= sem fechamento); o campo só é preenchido daqui pra frente
-- pelo faturamento web quando a venda vem com prazo 'FECHAMENTO NA SEMANA'.
-- Valores: NULL/'' = normal · 'SEMANAL' (extensível: 'QUINZENAL', 'MENSAL').
ALTER TABLE db_manaus.dbfatura ADD COLUMN IF NOT EXISTS tipo_fechamento varchar(12);
CREATE INDEX IF NOT EXISTS idx_dbfatura_tipo_fechamento
  ON db_manaus.dbfatura (tipo_fechamento) WHERE tipo_fechamento IS NOT NULL;
