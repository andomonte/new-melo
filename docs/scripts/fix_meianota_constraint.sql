-- Fix constraint: remove quantidade_nf requirement
SET search_path TO db_manaus;

-- Drop old constraint
ALTER TABLE nfe_item_associacao DROP CONSTRAINT IF EXISTS chk_meianota_campos;

-- Create new constraint: only preco_unitario_nf required when meia_nota=true
ALTER TABLE nfe_item_associacao
  ADD CONSTRAINT chk_meianota_campos
  CHECK (
    (meia_nota = false) OR
    (meia_nota = true AND preco_unitario_nf IS NOT NULL AND preco_unitario_nf > 0)
  );

SELECT 'Constraint updated successfully!' as status;
