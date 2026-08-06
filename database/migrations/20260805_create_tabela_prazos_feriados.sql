-- Tabela de opções de prazo por faixa de valor
CREATE TABLE IF NOT EXISTS db_manaus.tb_tabela_prazos (
  id SERIAL PRIMARY KEY,
  valor_min DECIMAL(12,2) NOT NULL,
  valor_max DECIMAL(12,2), -- NULL = sem limite (ACIMA)
  dias_medio INTEGER NOT NULL, -- pagamento único
  opcoes_prazo TEXT[] NOT NULL, -- array de opções ex: {'21/35', '21/28/35', '7/14/21/28'}
  categoria VARCHAR(100) DEFAULT 'CARRO/MOTO/LUBRIFICANTES',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dados iniciais da tabela de prazos
INSERT INTO db_manaus.tb_tabela_prazos (valor_min, valor_max, dias_medio, opcoes_prazo, categoria) VALUES
  (50.00, 300.00, 15, ARRAY['10/20'], 'CARRO/MOTO/LUBRIFICANTES'),
  (300.00, 800.00, 28, ARRAY['21/35', '21/28/35', '7/14/21/28', '14/28/42'], 'CARRO/MOTO/LUBRIFICANTES'),
  (800.00, 1500.00, 35, ARRAY['28/42', '28/35/42', '20/35/50', '21/28/35/42/49', '14/28/42/56'], 'CARRO/MOTO/LUBRIFICANTES'),
  (1500.00, 3000.00, 42, ARRAY['28/56', '28/42/56', '28/35/42/49/56', '20/35/50/64', '22/42/62', '14/28/42/56/70'], 'CARRO/MOTO/LUBRIFICANTES'),
  (3000.00, NULL, 49, ARRAY['34/64', '35/49/63', '30/45/60', '25/49/73', '20/40/60/80', '30/43/52/60/68', '35/42/49/56/63', '16/32/48/64/80'], 'CARRO/MOTO/LUBRIFICANTES');

-- Tabela de feriados (cache local + manuais)
CREATE TABLE IF NOT EXISTS db_manaus.tb_feriados (
  id SERIAL PRIMARY KEY,
  data DATE NOT NULL,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'NACIONAL', -- NACIONAL, ESTADUAL, MUNICIPAL, MANUAL
  uf VARCHAR(2), -- NULL para nacionais
  municipio VARCHAR(200), -- NULL para nacionais/estaduais
  ano INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(data, tipo, uf)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tb_tabela_prazos_valores ON db_manaus.tb_tabela_prazos (valor_min, valor_max);
CREATE INDEX IF NOT EXISTS idx_tb_feriados_data ON db_manaus.tb_feriados (data);
CREATE INDEX IF NOT EXISTS idx_tb_feriados_ano_uf ON db_manaus.tb_feriados (ano, uf);
