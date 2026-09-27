-- 057_comissao_razao.sql
-- Razão (extrato) de comissão do vendedor — modelo de MOVIMENTOS (ledger).
-- Comissão sobre FATURADO. Cada evento é um lançamento com sinal e data:
--   FAT (crédito +) = venda faturada
--   CAN (débito  −) = fatura/NF-e cancelada (venda deixa de existir)
--   DEV (débito  −) = devolução (DI, finNFe=4) — PROPORCIONAL aos itens devolvidos
-- Estorno FINANCEIRO (recebimento/cobrança/conciliação) NÃO entra (não muda o faturado).
-- Mês fechado é imutável: débitos de vendas já pagas caem no mês corrente.

CREATE TABLE IF NOT EXISTS db_manaus.fin_comissao_mov (
  id             bigserial PRIMARY KEY,
  codvend        varchar(5)  NOT NULL,               -- vendedor OU operador (ver tipo_pessoa)
  tipo_pessoa    varchar(1)  NOT NULL DEFAULT 'V',   -- V=vendedor, O=operador
  tipo           varchar(3)  NOT NULL,               -- FAT | CAN | DEV
  codfat         varchar(9),                         -- fatura de origem
  codvenda       varchar(9),
  codprod        varchar(6),
  codfat_dev     varchar(9),                         -- DI de devolução (quando tipo=DEV)
  valor_base     numeric,                            -- valor faturado do item (base do cálculo)
  perc           numeric,                            -- % aplicado
  valor_comissao numeric     NOT NULL,               -- COM SINAL (+ crédito / − débito)
  data_mov       date        NOT NULL,               -- data do EVENTO (competência de pagamento)
  data_origem    date,                               -- data do faturamento original
  status         varchar(1)  NOT NULL DEFAULT 'A',   -- A=aberto, P=pago
  fechamento_id  bigint,
  obs            varchar(200),
  criado_em      timestamp   DEFAULT now()
);

-- Um crédito (FAT) por (fatura, item, vendedor, pessoa). Débitos podem repetir.
CREATE UNIQUE INDEX IF NOT EXISTS ux_fcm_credito
  ON db_manaus.fin_comissao_mov (codfat, codvenda, codprod, codvend, tipo_pessoa)
  WHERE tipo = 'FAT';
CREATE INDEX IF NOT EXISTS idx_fcm_vend_data ON db_manaus.fin_comissao_mov (codvend, data_mov);
CREATE INDEX IF NOT EXISTS idx_fcm_codfat    ON db_manaus.fin_comissao_mov (codfat);
CREATE INDEX IF NOT EXISTS idx_fcm_status    ON db_manaus.fin_comissao_mov (status);

-- Fechamento mensal (lote de pagamento) — trava o mês por vendedor.
CREATE TABLE IF NOT EXISTS db_manaus.fin_comissao_fechamento (
  id          bigserial PRIMARY KEY,
  codvend     varchar(5) NOT NULL,
  ano         int NOT NULL,
  mes         int NOT NULL,
  total       numeric NOT NULL,                      -- Σ dos movimentos abertos do mês
  qtd_mov     int,
  fechado_em  timestamp DEFAULT now(),
  fechado_por varchar(20),
  UNIQUE (codvend, ano, mes)
);
