-- BLOCO B — Catálogo de movimentação + operação fiscal (fonte canônica para UI/validação).
-- IMPORTANTE: controla EXPOSIÇÃO/rótulo/ordem/ativo na tela; NÃO define a lógica fiscal
-- (o motor calcular_imposto_item tem a regra por operação hardcoded). Só operações que o
-- motor conhece devem ficar ativas.

-- 1) Movimentação (enums do motor: SAIDA | ENTRADA | ENTRADA_COMPRAS) — tabela de referência.
CREATE TABLE IF NOT EXISTS db_manaus.cad_tipo_movimentacao (
  codigo     varchar(20) PRIMARY KEY,
  descricao  varchar(60) NOT NULL,
  ordem      int         NOT NULL DEFAULT 0,
  ativo      boolean     NOT NULL DEFAULT true
);

INSERT INTO db_manaus.cad_tipo_movimentacao (codigo, descricao, ordem) VALUES
  ('SAIDA',           'Saída',            1),
  ('ENTRADA',         'Entrada',          2),
  ('ENTRADA_COMPRAS', 'Entrada (Compras)',3)
ON CONFLICT (codigo) DO NOTHING;

-- 2) Operação fiscal (por movimentação).
CREATE TABLE IF NOT EXISTS db_manaus.cad_tipo_operacao_fiscal (
  id                serial      PRIMARY KEY,
  codigo            varchar(40) NOT NULL,
  descricao         varchar(80) NOT NULL,
  tipo_movimentacao varchar(20) NOT NULL REFERENCES db_manaus.cad_tipo_movimentacao(codigo),
  ordem             int         NOT NULL DEFAULT 0,
  ativo             boolean     NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_movimentacao, codigo)
);

-- 3) Seed — SAÍDA (17)
INSERT INTO db_manaus.cad_tipo_operacao_fiscal (tipo_movimentacao, codigo, descricao, ordem) VALUES
  ('SAIDA','VENDA',                    'Venda',                        1),
  ('SAIDA','TRANSFERENCIA',            'Transferência',                2),
  ('SAIDA','DEVOLUCAO_COMPRA',         'Dev. de Compras',              3),
  ('SAIDA','DEVOLUCAO_TRANSFERENCIA',  'Dev. de Transferência',        4),
  ('SAIDA','REMESSA_BONIFICACAO',      'Rem. Bonific./Doação/Brinde',  5),
  ('SAIDA','REMESSA_EXPOSICAO',        'Rem. p/ Exposição',            6),
  ('SAIDA','REMESSA_DEMOSTRACAO',      'Rem. p/ Demonstração',         7),
  ('SAIDA','REMESSA_ARMAZEM',          'Rem. p/ Armazém Geral',        8),
  ('SAIDA','REMESSA_GARANTIA_FABRICA', 'Rem. em Garantia Fábrica',     9),
  ('SAIDA','REMESSA_CONSERTO',         'Rem. p/ Conserto',             10),
  ('SAIDA','SIMPLES_REMESSA',          'Simples Remessa',              11),
  ('SAIDA','REMESSA_GARANTIA_CLIENTE', 'Rem. em Garantia Cliente',     12),
  ('SAIDA','EXTRAVIO_AVARIA_FABRICA',  'Extravio e Avaria Fábrica',    13),
  ('SAIDA','EXTRAVIO_AVARIA_CLIENTE',  'Extravio e Avaria Cliente',    14),
  ('SAIDA','RETORNO_REMESSA_GARANTIA', 'Retorno Remessa em Garantia',  15),
  ('SAIDA','RETORNO_REMESSA_CONSERTO', 'Retorno Remessa em Conserto',  16),
  ('SAIDA','OUTROS',                   'Escolher Outros',              17)
ON CONFLICT (tipo_movimentacao, codigo) DO NOTHING;

-- 4) Seed — ENTRADA (12)
INSERT INTO db_manaus.cad_tipo_operacao_fiscal (tipo_movimentacao, codigo, descricao, ordem) VALUES
  ('ENTRADA','COMPRA',                  'Compra',                     1),
  ('ENTRADA','TRANSFERENCIA',           'Transferência',              2),
  ('ENTRADA','DEVOLUCAO_VENDA',         'Dev. de Venda',              3),
  ('ENTRADA','DEVOLUCAO_TRANSFERENCIA', 'Dev. de Transferência',      4),
  ('ENTRADA','ENTRADA_BONIFICACAO',     'Entrada de Bonificação',     5),
  ('ENTRADA','RETORNO_EXPOSICAO',       'Retorno de Exposição',       6),
  ('ENTRADA','ENTRADA_DEMOSTRACAO',     'Entrada de Demonstração',    7),
  ('ENTRADA','ENTRADA_ARMAZEM',         'Entrada para Armazém',       8),
  ('ENTRADA','RETORNO_GARANTIA_CLIENTE','Retorno de Garantia Cliente',9),
  ('ENTRADA','RETORNO_GARANTIA_FABRICA','Retorno de Garantia Fábrica',10),
  ('ENTRADA','RETORNO_CONSERTO',        'Retorno de Conserto',        11),
  ('ENTRADA','OUTROS',                  'Outros',                     12)
ON CONFLICT (tipo_movimentacao, codigo) DO NOTHING;
