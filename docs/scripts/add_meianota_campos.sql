-- =====================================================
-- Migration: Adicionar campos de Meia Nota
-- Data: 2025-01-18
-- Descrição: Adiciona campos para armazenar quantidade
--            e preço da nota fiscal quando divergem do pedido
-- =====================================================

-- 1. Adicionar colunas na tabela de associação
ALTER TABLE db_manaus.nfe_item_associacao
  ADD COLUMN IF NOT EXISTS quantidade_nf NUMERIC(15,3),
  ADD COLUMN IF NOT EXISTS preco_unitario_nf NUMERIC(15,4);

-- 2. Comentários para documentação
COMMENT ON COLUMN db_manaus.nfe_item_associacao.quantidade_nf IS
  'Quantidade informada na Nota Fiscal (usado quando diverge do pedido: bonificação, entrega parcial, etc.)';

COMMENT ON COLUMN db_manaus.nfe_item_associacao.preco_unitario_nf IS
  'Preço unitário informado na Nota Fiscal (usado quando diverge do pedido: desconto, negociação, etc.)';

COMMENT ON COLUMN db_manaus.nfe_item_associacao.meia_nota IS
  'Flag indicando divergência entre nota e pedido. Quando TRUE, usar quantidade_nf e preco_unitario_nf para cálculos fiscais';

-- 3. Criar índice para consultas de divergência
CREATE INDEX IF NOT EXISTS idx_nfe_item_assoc_meianota
  ON db_manaus.nfe_item_associacao(meia_nota)
  WHERE meia_nota = true;

-- 4. Constraint: Se meia_nota = true, campos NÃO podem ser NULL
ALTER TABLE db_manaus.nfe_item_associacao
  DROP CONSTRAINT IF EXISTS chk_meianota_campos;

ALTER TABLE db_manaus.nfe_item_associacao
  ADD CONSTRAINT chk_meianota_campos
  CHECK (
    (meia_nota = false) OR
    (meia_nota = true AND quantidade_nf IS NOT NULL AND quantidade_nf > 0 AND preco_unitario_nf IS NOT NULL AND preco_unitario_nf > 0)
  );

-- 5. Criar view para relatório de divergências
CREATE OR REPLACE VIEW db_manaus.vw_divergencias_meianota AS
SELECT
  nia.id,
  nia.nfe_id,
  nia.produto_cod,
  p.descr as produto_descricao,
  nia.quantidade_associada as quantidade_pedido,
  nia.quantidade_nf,
  nia.valor_unitario as preco_pedido,
  nia.preco_unitario_nf as preco_nf,
  nia.preco_real,
  -- Cálculo de divergências
  (nia.quantidade_nf - nia.quantidade_associada) as dif_quantidade,
  ROUND(((nia.quantidade_nf - nia.quantidade_associada) / nia.quantidade_associada * 100), 2) as perc_dif_quantidade,
  (nia.preco_unitario_nf - nia.valor_unitario) as dif_preco,
  ROUND(((nia.preco_unitario_nf - nia.valor_unitario) / nia.valor_unitario * 100), 2) as perc_dif_preco,
  -- Impacto financeiro
  (nia.quantidade_associada * nia.valor_unitario) as valor_pedido,
  (nia.quantidade_nf * nia.preco_unitario_nf) as valor_nf,
  ((nia.quantidade_nf * nia.preco_unitario_nf) - (nia.quantidade_associada * nia.valor_unitario)) as economia_real,
  nia.created_at
FROM db_manaus.nfe_item_associacao nia
INNER JOIN db_manaus.dbprod p ON p.codprod = nia.produto_cod
WHERE nia.meia_nota = true
ORDER BY nia.created_at DESC;

COMMENT ON VIEW db_manaus.vw_divergencias_meianota IS
  'Relatório de divergências entre valores do pedido vs. valores da nota fiscal (Meia Nota)';

-- 6. Função helper para validar divergências críticas
CREATE OR REPLACE FUNCTION db_manaus.fn_validar_divergencia_meianota(
  p_preco_pedido NUMERIC,
  p_preco_nf NUMERIC,
  p_tolerancia_percent NUMERIC DEFAULT 20
)
RETURNS TABLE (
  valido BOOLEAN,
  perc_divergencia NUMERIC,
  nivel_alerta VARCHAR(10)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN ABS((p_preco_nf - p_preco_pedido) / p_preco_pedido * 100) <= p_tolerancia_percent
      THEN true
      ELSE false
    END as valido,
    ROUND(ABS((p_preco_nf - p_preco_pedido) / p_preco_pedido * 100), 2) as perc_divergencia,
    CASE
      WHEN ABS((p_preco_nf - p_preco_pedido) / p_preco_pedido * 100) <= 5 THEN 'BAIXO'
      WHEN ABS((p_preco_nf - p_preco_pedido) / p_preco_pedido * 100) <= 10 THEN 'MEDIO'
      WHEN ABS((p_preco_nf - p_preco_pedido) / p_preco_pedido * 100) <= 20 THEN 'ALTO'
      ELSE 'CRITICO'
    END as nivel_alerta;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Trigger para auditoria de alterações em meia_nota
CREATE TABLE IF NOT EXISTS db_manaus.audit_meianota (
  id SERIAL PRIMARY KEY,
  nfe_item_associacao_id INTEGER,
  action VARCHAR(10),
  old_meia_nota BOOLEAN,
  new_meia_nota BOOLEAN,
  old_quantidade_nf NUMERIC(15,3),
  new_quantidade_nf NUMERIC(15,3),
  old_preco_unitario_nf NUMERIC(15,4),
  new_preco_unitario_nf NUMERIC(15,4),
  changed_by VARCHAR(50),
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION db_manaus.fn_audit_meianota()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.meia_nota != NEW.meia_nota OR
       OLD.quantidade_nf IS DISTINCT FROM NEW.quantidade_nf OR
       OLD.preco_unitario_nf IS DISTINCT FROM NEW.preco_unitario_nf THEN
      INSERT INTO db_manaus.audit_meianota (
        nfe_item_associacao_id,
        action,
        old_meia_nota,
        new_meia_nota,
        old_quantidade_nf,
        new_quantidade_nf,
        old_preco_unitario_nf,
        new_preco_unitario_nf,
        changed_by
      ) VALUES (
        NEW.id,
        'UPDATE',
        OLD.meia_nota,
        NEW.meia_nota,
        OLD.quantidade_nf,
        NEW.quantidade_nf,
        OLD.preco_unitario_nf,
        NEW.preco_unitario_nf,
        current_user
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_meianota ON db_manaus.nfe_item_associacao;
CREATE TRIGGER trg_audit_meianota
  AFTER UPDATE ON db_manaus.nfe_item_associacao
  FOR EACH ROW
  EXECUTE FUNCTION db_manaus.fn_audit_meianota();

-- 8. Migração de dados antigos (se houver)
-- Atualizar registros antigos onde meia_nota = true mas campos estão NULL
UPDATE db_manaus.nfe_item_associacao
SET
  quantidade_nf = quantidade_associada,
  preco_unitario_nf = COALESCE(preco_real, valor_unitario)
WHERE meia_nota = true
  AND (quantidade_nf IS NULL OR preco_unitario_nf IS NULL);

-- 9. Criar query helper para relatórios
COMMENT ON TABLE db_manaus.audit_meianota IS
  'Auditoria de alterações nos campos de Meia Nota (rastreabilidade completa)';

-- Fim da migration
SELECT 'Migration add_meianota_campos.sql executada com sucesso!' as status;
