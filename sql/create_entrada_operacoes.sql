-- =====================================================
-- TABELAS PARA RECEBIMENTO E ALOCACAO DE ENTRADAS
-- Sistema Melo - Modulos operacionais de estoque
-- =====================================================

-- 1. TABELA PRINCIPAL: Controle de operacoes de entrada
CREATE TABLE IF NOT EXISTS entrada_operacoes (
  id SERIAL PRIMARY KEY,
  entrada_id INTEGER NOT NULL REFERENCES entradas_estoque(id) ON DELETE CASCADE,

  -- Status geral da operacao
  -- AGUARDANDO_RECEBIMENTO, EM_RECEBIMENTO, RECEBIDO,
  -- AGUARDANDO_ALOCACAO, EM_ALOCACAO, ALOCADO
  status VARCHAR(30) NOT NULL DEFAULT 'AGUARDANDO_RECEBIMENTO',

  -- Dados do Recebimento
  recebedor_matricula VARCHAR(20),
  recebedor_nome VARCHAR(100),
  inicio_recebimento TIMESTAMP,
  fim_recebimento TIMESTAMP,
  observacao_recebimento TEXT,

  -- Dados da Alocacao
  alocador_matricula VARCHAR(20),
  alocador_nome VARCHAR(100),
  inicio_alocacao TIMESTAMP,
  fim_alocacao TIMESTAMP,
  arm_id INTEGER REFERENCES cad_armazem(arm_id),
  observacao_alocacao TEXT,

  -- Controle de divergencias (se houve alguma)
  tem_divergencia BOOLEAN DEFAULT FALSE,
  divergencia_resolvida BOOLEAN DEFAULT FALSE,

  -- Observacao geral da operacao
  observacao TEXT,

  -- Auditoria
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraint: uma entrada so pode ter um registro de operacao
  CONSTRAINT uk_entrada_operacoes_entrada UNIQUE (entrada_id)
);

-- 2. TABELA DE ITENS RECEBIDOS: Conferencia item a item
CREATE TABLE IF NOT EXISTS entrada_itens_recebimento (
  id SERIAL PRIMARY KEY,
  entrada_operacao_id INTEGER NOT NULL REFERENCES entrada_operacoes(id) ON DELETE CASCADE,
  entrada_item_id INTEGER NOT NULL REFERENCES entrada_itens(id) ON DELETE CASCADE,

  -- Dados do produto
  produto_cod VARCHAR(20) NOT NULL,

  -- Quantidades
  qtd_esperada NUMERIC(15,4) NOT NULL,
  qtd_recebida NUMERIC(15,4),

  -- Status do item
  -- OK, FALTA, EXCESSO, DANIFICADO, ERRADO, PENDENTE
  status_item VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',

  -- Observacao especifica do item (ex: "Embalagem danificada")
  observacao TEXT,

  -- Data/hora que o item foi conferido
  conferido_em TIMESTAMP,

  -- Auditoria
  recebido_em TIMESTAMP,
  recebido_por VARCHAR(20),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraint: um item de entrada so pode ter um registro de recebimento
  CONSTRAINT uk_entrada_itens_recebimento_item UNIQUE (entrada_item_id)
);

-- 3. INDICES para performance
CREATE INDEX IF NOT EXISTS idx_entrada_op_status ON entrada_operacoes(status);
CREATE INDEX IF NOT EXISTS idx_entrada_op_recebedor ON entrada_operacoes(recebedor_matricula);
CREATE INDEX IF NOT EXISTS idx_entrada_op_alocador ON entrada_operacoes(alocador_matricula);
CREATE INDEX IF NOT EXISTS idx_entrada_op_entrada ON entrada_operacoes(entrada_id);
CREATE INDEX IF NOT EXISTS idx_entrada_op_created ON entrada_operacoes(created_at);

CREATE INDEX IF NOT EXISTS idx_entrada_itens_rec_op ON entrada_itens_recebimento(entrada_operacao_id);
CREATE INDEX IF NOT EXISTS idx_entrada_itens_rec_status ON entrada_itens_recebimento(status_item);
CREATE INDEX IF NOT EXISTS idx_entrada_itens_rec_prod ON entrada_itens_recebimento(produto_cod);

-- 4. TRIGGER para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_entrada_operacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entrada_operacoes_updated ON entrada_operacoes;
CREATE TRIGGER trg_entrada_operacoes_updated
  BEFORE UPDATE ON entrada_operacoes
  FOR EACH ROW
  EXECUTE FUNCTION update_entrada_operacoes_updated_at();

DROP TRIGGER IF EXISTS trg_entrada_itens_recebimento_updated ON entrada_itens_recebimento;
CREATE TRIGGER trg_entrada_itens_recebimento_updated
  BEFORE UPDATE ON entrada_itens_recebimento
  FOR EACH ROW
  EXECUTE FUNCTION update_entrada_operacoes_updated_at();

-- 5. COMENTARIOS nas tabelas
COMMENT ON TABLE entrada_operacoes IS 'Controle de operacoes de recebimento e alocacao de entradas de estoque';
COMMENT ON TABLE entrada_itens_recebimento IS 'Conferencia item a item no recebimento de entradas';

COMMENT ON COLUMN entrada_operacoes.status IS 'Status: AGUARDANDO_RECEBIMENTO, EM_RECEBIMENTO, RECEBIDO, AGUARDANDO_ALOCACAO, EM_ALOCACAO, ALOCADO';
COMMENT ON COLUMN entrada_itens_recebimento.status_item IS 'Status: OK, FALTA, EXCESSO, DANIFICADO, ERRADO, PENDENTE';

-- =====================================================
-- GRANT PERMISSIONS (ajustar conforme necessario)
-- =====================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON entrada_operacoes TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON entrada_itens_recebimento TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE entrada_operacoes_id_seq TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE entrada_itens_recebimento_id_seq TO app_user;
