-- 040_dbbanco_numero.sql
-- Espelha a tabela Oracle GERAL.DBBANCO_NUMERO — o contador sequencial do NOSSO NÚMERO
-- de boleto, POR BANCO. No Delphi, TCOBRANCA lê/incrementa (FOR UPDATE) essa tabela no
-- faturamento e grava o resultado em dbreceb.nro_banco. O web passa a fazer igual (antes
-- usava cod_receb como nosso número — divergente).
--
-- Códigos de banco (internos do Oracle, iguais a dbreceb.banco):
--   0=Bradesco, 1=Banco do Brasil, 2=Itaú, 3=Rural, 5=Santander, 6=Safra, 7=Citibank, 8=Caixa.
--
-- SEED: valores copiados do Oracle desenv em 2026-08-24. ⚠️ ANTES DE EMITIR BOLETO REAL,
-- confirmar o nro_sequencia contra o Oracle de PRODUÇÃO (se o Delphi ainda emite boletos
-- no mesmo convênio) para não gerar Nosso Número duplicado.

CREATE TABLE IF NOT EXISTS db_manaus.dbbanco_numero (
  banco         varchar(3)  PRIMARY KEY,
  nro_sequencia numeric(15) NOT NULL DEFAULT 0,
  limite        numeric(15) NOT NULL,
  ordem         integer     NOT NULL DEFAULT 1,
  tarifa_npgto  numeric(6,2) NOT NULL DEFAULT 7
);

INSERT INTO db_manaus.dbbanco_numero (banco, nro_sequencia, limite, ordem, tarifa_npgto) VALUES
  ('0', 773444,     9999999999, 1, 7),  -- Bradesco   (nosso número 11 dígitos)
  ('1', 33118,      999999999,  1, 7),  -- Banco do Brasil (10)
  ('2', 795538,     9999999,    1, 7),  -- Itaú (8)
  ('3', 15662,      999999,     1, 7),  -- Rural (7)
  ('5', 305968,     999999,     1, 7),  -- Santander (7)
  ('6', 39024168,   39059999,   1, 7),  -- Safra (8)
  ('7', 2,          9999999999, 1, 7),  -- Citibank (11)
  ('8', 9000045771, 9099999999, 1, 7)   -- Caixa (10)
ON CONFLICT (banco) DO NOTHING;
