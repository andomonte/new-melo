-- 049: conciliação bancária — lotes de importação + linhas do extrato.
-- Aditivo. Idempotência por hash (arquivo e linha).

CREATE TABLE IF NOT EXISTS db_manaus.conc_lote (
  lot_id           bigserial PRIMARY KEY,
  lot_hash_arquivo text NOT NULL,
  lot_banco        varchar(40),
  lot_agencia      varchar(20),
  lot_conta        varchar(30),
  lot_cod_conta    varchar(10),          -- dbconta (conta do sistema) mapeada
  lot_arquivo_nome varchar(255),
  lot_usuario      varchar(60),
  lot_data         timestamp DEFAULT now(),
  lot_qtd_linhas   int DEFAULT 0,
  lot_qtd_receb    int DEFAULT 0,
  lot_status       varchar(20) DEFAULT 'importado'
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_conc_lote_hash ON db_manaus.conc_lote (lot_hash_arquivo);

CREATE TABLE IF NOT EXISTS db_manaus.conc_linha (
  lin_id            bigserial PRIMARY KEY,
  lin_lote_id       bigint NOT NULL REFERENCES db_manaus.conc_lote(lot_id) ON DELETE CASCADE,
  lin_idx           int,
  lin_hash          text NOT NULL,
  lin_data          date,
  lin_historico     text,
  lin_documento     varchar(40),
  lin_valor_cent    bigint,              -- centavos, com sinal
  lin_saldo_cent    bigint,
  lin_tipo          varchar(30),
  lin_categoria     varchar(20),         -- recebimento | descarte | a_identificar
  lin_pagador_doc   varchar(20),
  lin_pagador_tipo  varchar(4),          -- cpf | cnpj
  lin_pagador_nome  varchar(120),
  lin_codcli        varchar(15),
  lin_cli_via       varchar(10),         -- cpfcgc | nome
  lin_status        varchar(20) DEFAULT 'pendente', -- pendente | conciliado | descartado | duplicado | a_identificar
  lin_titulo        varchar(15),         -- cod_receb baixado (quando conciliado)
  lin_sugestoes     jsonb,
  lin_aut_id        numeric              -- comprovante gerado na baixa
);
CREATE INDEX IF NOT EXISTS ix_conc_linha_lote ON db_manaus.conc_linha (lin_lote_id);
CREATE INDEX IF NOT EXISTS ix_conc_linha_hash ON db_manaus.conc_linha (lin_hash);
CREATE INDEX IF NOT EXISTS ix_conc_linha_status ON db_manaus.conc_linha (lin_status);
