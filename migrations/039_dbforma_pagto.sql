-- 039: Espelho da tabela REAL de formas de pagamento do Delphi.
-- A SP FORMA_PAGAMENTO do SysCaixa faz: SELECT * FROM dbforma_pagto ORDER BY codfpgt.
-- Aqui replicamos essa tabela (codfpgt VARCHAR(2), descricao VARCHAR(30)) com os 44
-- códigos reais do Oracle. O combo do recebimento e o dbfreceb.tipo usam esses códigos.

CREATE TABLE IF NOT EXISTS db_manaus.dbforma_pagto (
  codfpgt varchar(2) PRIMARY KEY,
  descricao varchar(30)
);

INSERT INTO db_manaus.dbforma_pagto (codfpgt, descricao) VALUES
  ('01','DINHEIRO'),('02','CHEQUE A VISTA'),('03','CHEQUE PRE-DATADO'),('04','CARTAO'),
  ('05','CREDITO DE DEVOLUCAO MEC/GAR'),('06','TARIFA DINHEIRO'),('07','TARIFA CHEQUE'),
  ('08','TARIFA CARTAO'),('09','DEPOSITO'),('10','COBRANCA BOLETO'),('11','ENCONTRO DE DEBITO'),
  ('12','ACERTO'),('13','DESCONTO COMISSAO'),('14','SANGRIA'),('15','TARIFA BANCARIA EM DEPOSITO'),
  ('16','IMPOSTO RETIDO'),('17','MULTA CONTRATUAL'),('18','JUROS DINHEIRO'),('19','DESCONTO EM FOLHA'),
  ('20','JUROS CHEQUE'),('21','JUROS DEPOSITO'),('22','JUROS ACERTO'),('23','JUROS CARTAO'),
  ('24','BAIXA AUTOMATICA BANCO'),('25','JUROS COBRANCA BOLETO'),('26','JUROS CHEQUE PRE-DATADO'),
  ('27','BONIFICACAO COMERCIAL'),('28','COMPENSACAO DE CHEQUE'),('29','DIVIDA NEGOCIADA'),
  ('30','NAO UTILIZAR'),('31','PERDA'),('32','TARIFA CHEQUE PRE-DATADO'),('33','CARTAO RECEBIDO'),
  ('34','IMPOSTO RETIDO - IR'),('35','IMPOSTO RETIDO - CSLL'),('36','IMPOSTO RETIDO - COFINS'),
  ('37','IMPOSTO RETIDO - PIS'),('38','IMPOSTO RETIDO - ICMS FONTE'),('39','IMPOSTO RETIDO - ISS'),
  ('40','DESCONTO EM FERIAS'),('41','DESCONTO EM RESCISAO'),('42','PIX'),('43','JUROS PIX'),
  ('44','TARIFA PIX')
ON CONFLICT (codfpgt) DO UPDATE SET descricao = EXCLUDED.descricao;

DROP TABLE IF EXISTS db_manaus.cad_forma_pagamento;
