-- 101_dbfpgto_cancelamento_usuario.sql  (25/11/2026)
-- Estorno de pagamento no Contas a Pagar passa a registrar QUEM cancelou e QUANDO.
-- Antes só marcava cancel='S'; o histórico mostrava o usuário que lançou o pagamento
-- (e o pagamento em lote gravava 'Sistema', porque a tela não enviava o usuário).
-- Idempotente.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'dbfpgto' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    EXECUTE format('ALTER TABLE %I.dbfpgto ADD COLUMN IF NOT EXISTS cancel_username varchar(100)', s);
    EXECUTE format('ALTER TABLE %I.dbfpgto ADD COLUMN IF NOT EXISTS dt_cancel timestamp', s);
  END LOOP;
END
$mig$;
