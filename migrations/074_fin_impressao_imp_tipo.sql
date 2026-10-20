-- 074_fin_impressao_imp_tipo.sql
-- Adiciona imp_tipo na fila de impressão (fin_impressao) para o Robô distinguir
-- DANFE (imp_aut_id = codfat da nota) de COMPROVANTE (imp_aut_id = aut_id do
-- comprovante / fin_autenticacao). Fiel ao Delphi: ao finalizar o recebimento, se o
-- operador pede, a autenticação é enfileirada para impressão (CAIXA.INSERIR_IMPRESSAO).
--
-- Aditivo e idempotente. Default 'DANFE' mantém as linhas/fluxo atuais intactos.
-- Roda em todos os schemas db_* que possuem fin_impressao (a fila é por filial).

DO $mig$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema
      FROM information_schema.tables
     WHERE table_name = 'fin_impressao'
       AND table_schema LIKE 'db\_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.fin_impressao ADD COLUMN IF NOT EXISTS imp_tipo varchar(20) DEFAULT ''DANFE''',
      r.table_schema
    );
    -- Backfill: linhas antigas sem tipo viram DANFE (comportamento atual do robô).
    EXECUTE format(
      'UPDATE %I.fin_impressao SET imp_tipo = ''DANFE'' WHERE imp_tipo IS NULL',
      r.table_schema
    );
    RAISE NOTICE 'imp_tipo garantido em %.fin_impressao', r.table_schema;
  END LOOP;
END
$mig$;
