-- 055_cad_forma_pgto.sql
-- Cadastro de Forma de Pagamento (Contas a Pagar) — grava a LETRA em dbfpgto.tp_pgto.
-- Convenção clássica MELO (Delphi): D/C/B/A/F/R/V/N.

CREATE TABLE IF NOT EXISTS db_manaus.cad_forma_pgto (
  fpg_letra     varchar(2)  PRIMARY KEY,
  fpg_descricao varchar(30) NOT NULL,
  fpg_ativo     char(1)     NOT NULL DEFAULT 'S'
);

INSERT INTO db_manaus.cad_forma_pgto (fpg_letra, fpg_descricao, fpg_ativo) VALUES
  ('D', 'DINHEIRO',       'S'),
  ('C', 'CHEQUE',         'S'),
  ('B', 'BALCAO',         'S'),
  ('A', 'DEB.BANCO',      'S'),
  ('F', 'FINANCIAMENTO',  'S'),
  ('R', 'CART.CREDITO',   'S'),
  ('V', 'VALE',           'S'),
  ('N', 'COMPENSACAO',    'S')
ON CONFLICT (fpg_letra) DO NOTHING;
