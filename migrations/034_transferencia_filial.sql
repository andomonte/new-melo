-- 034_transferencia_filial.sql
-- Fundação da tela de Transferência entre Filiais (ver docs/transferencia/spec-transferencia-filial.md).
-- ADITIVO: cria dbclien_filial (mapa filial→cliente destino) e adiciona colunas em
-- arm_transferencia/arm_it_transferencia (que já existem, vazias). Não altera nada existente.
-- Idempotente.

-- Mapa das filiais destino (cada filial é um cliente com CNPJ próprio). Espelho enxuto do
-- Oracle GERAL.DBCLIEN_FILIAL. Os clientes em si já estão em dbclien (a venda mira o codcli).
CREATE TABLE IF NOT EXISTS db_manaus.dbclien_filial (
  codcli     varchar(5) PRIMARY KEY,
  nome       varchar(60),
  nomefant   varchar(40),
  cpfcgc     varchar(20),
  tipo       varchar(1),
  ender      varchar(120),
  bairro     varchar(40),
  cidade     varchar(40),
  uf         varchar(2),
  cep        varchar(9),
  iest       varchar(20),
  status     varchar(1),
  sigla      varchar(6)   -- rótulo da filial: MAO/PVH/REC/FLZ/BMO/CSAC/JPS/BVB
);

-- Cabeçalho da transferência: elos com a Entrada de origem, o cliente-filial destino e a fatura/NF gerada.
ALTER TABLE db_manaus.arm_transferencia ADD COLUMN IF NOT EXISTS tra_codent        varchar(9);
ALTER TABLE db_manaus.arm_transferencia ADD COLUMN IF NOT EXISTS tra_codcli_destino varchar(5);
ALTER TABLE db_manaus.arm_transferencia ADD COLUMN IF NOT EXISTS tra_codfat        varchar(9);
ALTER TABLE db_manaus.arm_transferencia ADD COLUMN IF NOT EXISTS tra_vlr_frete     numeric(15,2) DEFAULT 0;
ALTER TABLE db_manaus.arm_transferencia ADD COLUMN IF NOT EXISTS tra_codtptransp   varchar(5);

-- Itens: elo com o item da Entrada + preço unitário.
ALTER TABLE db_manaus.arm_it_transferencia ADD COLUMN IF NOT EXISTS itt_codent  varchar(9);
ALTER TABLE db_manaus.arm_it_transferencia ADD COLUMN IF NOT EXISTS itt_nritem  varchar(5);
ALTER TABLE db_manaus.arm_it_transferencia ADD COLUMN IF NOT EXISTS itt_prunit  numeric(15,2);

CREATE INDEX IF NOT EXISTS ix_arm_transf_codent ON db_manaus.arm_transferencia (tra_codent);
CREATE INDEX IF NOT EXISTS ix_arm_transf_status ON db_manaus.arm_transferencia (tra_status);
