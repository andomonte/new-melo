-- Criar tabela para tipos de documento/pagamento
CREATE TABLE IF NOT EXISTS db_manaus.dbtipo_documento (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descricao VARCHAR(100) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela para tipos de fatura
CREATE TABLE IF NOT EXISTS db_manaus.dbtipo_fatura (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descricao VARCHAR(100) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir tipos de documento (formas de pagamento)
INSERT INTO db_manaus.dbtipo_documento (codigo, descricao, ordem) VALUES
  ('$', 'DINHEIRO', 1),
  ('C', 'CARTÃO DE CRÉDITO', 2),
  ('V', 'CARTÃO DE DÉBITO', 3),
  ('W', 'CARTEIRA', 4),
  ('B', 'BOLETO', 5),
  ('P', 'PIX', 6),
  ('O', 'OUTROS', 7)
ON CONFLICT (codigo) DO NOTHING;

-- Inserir tipos de fatura
INSERT INTO db_manaus.dbtipo_fatura (codigo, descricao, ordem) VALUES
  ('B', 'BOLETO', 1),
  ('D', 'DUPLICATA', 2),
  ('C', 'CONTRATO', 3),
  ('O', 'OUTRO', 4)
ON CONFLICT (codigo) DO NOTHING;

-- Comentários nas tabelas
COMMENT ON TABLE db_manaus.dbtipo_documento IS 'Tipos de documento/formas de pagamento disponíveis no sistema';
COMMENT ON TABLE db_manaus.dbtipo_fatura IS 'Tipos de fatura disponíveis no sistema';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_dbtipo_documento_ativo ON db_manaus.dbtipo_documento(ativo);
CREATE INDEX IF NOT EXISTS idx_dbtipo_fatura_ativo ON db_manaus.dbtipo_fatura(ativo);

-- Verificar os dados inseridos
SELECT 'Tipos de Documento:' as tipo;
SELECT * FROM db_manaus.dbtipo_documento ORDER BY ordem;

SELECT 'Tipos de Fatura:' as tipo;
SELECT * FROM db_manaus.dbtipo_fatura ORDER BY ordem;
