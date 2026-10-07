-- 070_importacao_fornecedor_principal.sql
-- Fornecedor PRINCIPAL (destinatário da Nota de Nacionalização) escolhido
-- manualmente pelo usuário. Quando NULL, vale a regra fornecedor_principal_regra
-- (ADICAO_001 = fornecedor da menor adição | MAIOR_FOB).
--
-- Aditivo e idempotente; roda em cada schema db_*.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'dbent_importacao' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    EXECUTE format($f$
      ALTER TABLE %I.dbent_importacao
        ADD COLUMN IF NOT EXISTS fornecedor_principal varchar;  -- nome (DIe) do fornecedor principal
    $f$, s);
  END LOOP;
END
$mig$;
