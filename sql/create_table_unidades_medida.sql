-- Tabela principal de unidades de medida
CREATE TABLE IF NOT EXISTS unidades_medida (
    codigo VARCHAR(2) PRIMARY KEY,
    descricao VARCHAR(50) NOT NULL,
    sigla VARCHAR(10) NOT NULL,
    tipo VARCHAR(20), -- PESO, VOLUME, COMPRIMENTO, AREA, UNIDADE, TEMPO
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de conversão entre unidades
CREATE TABLE IF NOT EXISTS conversao_unidades (
    id SERIAL PRIMARY KEY,
    unidade_origem VARCHAR(2) NOT NULL,
    unidade_destino VARCHAR(2) NOT NULL,
    fator_conversao NUMERIC(15,6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_unidade_origem FOREIGN KEY (unidade_origem) REFERENCES unidades_medida(codigo),
    CONSTRAINT fk_unidade_destino FOREIGN KEY (unidade_destino) REFERENCES unidades_medida(codigo),
    CONSTRAINT uk_conversao UNIQUE (unidade_origem, unidade_destino)
);

-- Tabela de unidades alternativas por produto
CREATE TABLE IF NOT EXISTS produto_unidades_alternativas (
    id SERIAL PRIMARY KEY,
    codprod VARCHAR(6) NOT NULL,
    unidade_medida VARCHAR(2) NOT NULL,
    quantidade_equivalente NUMERIC(10,4) NOT NULL DEFAULT 1,
    codigo_barras_alternativo VARCHAR(15),
    preco_unitario NUMERIC(13,2),
    eh_padrao BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_produto_unidade FOREIGN KEY (unidade_medida) REFERENCES unidades_medida(codigo),
    CONSTRAINT uk_produto_unidade UNIQUE (codprod, unidade_medida)
);

-- Comentários explicativos
COMMENT ON TABLE unidades_medida IS 'Cadastro de unidades de medida disponíveis no sistema';
COMMENT ON TABLE conversao_unidades IS 'Tabela de conversão entre diferentes unidades de medida';
COMMENT ON TABLE produto_unidades_alternativas IS 'Unidades alternativas por produto (ex: venda por caixa ou unidade)';

COMMENT ON COLUMN unidades_medida.codigo IS 'Código da unidade (2 caracteres)';
COMMENT ON COLUMN unidades_medida.descricao IS 'Descrição completa da unidade';
COMMENT ON COLUMN unidades_medida.sigla IS 'Sigla ou abreviação da unidade';
COMMENT ON COLUMN unidades_medida.tipo IS 'Tipo de medida (PESO, VOLUME, COMPRIMENTO, etc)';

COMMENT ON COLUMN conversao_unidades.fator_conversao IS 'Fator para converter unidade_origem em unidade_destino';

COMMENT ON COLUMN produto_unidades_alternativas.codprod IS 'Código do produto (FK para dbprod)';
COMMENT ON COLUMN produto_unidades_alternativas.quantidade_equivalente IS 'Quantidade na unidade principal equivalente (ex: 1 caixa = 12 unidades)';
COMMENT ON COLUMN produto_unidades_alternativas.codigo_barras_alternativo IS 'Código de barras específico para esta unidade';
COMMENT ON COLUMN produto_unidades_alternativas.eh_padrao IS 'Indica se é a unidade padrão de venda';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_produto_unidades_codprod ON produto_unidades_alternativas(codprod);
CREATE INDEX IF NOT EXISTS idx_produto_unidades_ativo ON produto_unidades_alternativas(ativo);
CREATE INDEX IF NOT EXISTS idx_conversao_origem ON conversao_unidades(unidade_origem);
CREATE INDEX IF NOT EXISTS idx_conversao_destino ON conversao_unidades(unidade_destino);

-- Inserir unidades de medida mais comuns
INSERT INTO unidades_medida (codigo, descricao, sigla, tipo) VALUES
('UN', 'Unidade', 'UN', 'UNIDADE'),
('CX', 'Caixa', 'CX', 'UNIDADE'),
('PC', 'Peça', 'PC', 'UNIDADE'),
('KG', 'Quilograma', 'KG', 'PESO'),
('GR', 'Grama', 'G', 'PESO'),
('LT', 'Litro', 'L', 'VOLUME'),
('ML', 'Mililitro', 'ML', 'VOLUME'),
('MT', 'Metro', 'M', 'COMPRIMENTO'),
('CM', 'Centímetro', 'CM', 'COMPRIMENTO'),
('M2', 'Metro Quadrado', 'M²', 'AREA'),
('M3', 'Metro Cúbico', 'M³', 'VOLUME'),
('DZ', 'Dúzia', 'DZ', 'UNIDADE'),
('PR', 'Par', 'PR', 'UNIDADE'),
('FD', 'Fardo', 'FD', 'UNIDADE'),
('SC', 'Saco', 'SC', 'UNIDADE'),
('PT', 'Pacote', 'PT', 'UNIDADE'),
('RL', 'Rolo', 'RL', 'UNIDADE'),
('TB', 'Tubo', 'TB', 'UNIDADE'),
('GL', 'Galão', 'GL', 'VOLUME'),
('BD', 'Balde', 'BD', 'UNIDADE')
ON CONFLICT (codigo) DO NOTHING;

-- Inserir conversões comuns
INSERT INTO conversao_unidades (unidade_origem, unidade_destino, fator_conversao) VALUES
-- Peso
('KG', 'GR', 1000),
('GR', 'KG', 0.001),
-- Volume
('LT', 'ML', 1000),
('ML', 'LT', 0.001),
-- Comprimento
('MT', 'CM', 100),
('CM', 'MT', 0.01),
-- Unidade
('DZ', 'UN', 12),
('UN', 'DZ', 0.083333),
('PR', 'UN', 2),
('UN', 'PR', 0.5)
ON CONFLICT (unidade_origem, unidade_destino) DO NOTHING;
