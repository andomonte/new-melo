-- 077_entrada_operacoes_log_entrada_id_nulo.sql
-- O recebimento passou a usar dbent (codent), mas entrada_operacoes_log.entrada_id ainda
-- era obrigatória e aponta para o modelo antigo (entradas_estoque). O INSERT do log grava
-- só codent, então o erro 23502 desfazia a transação e nenhum recebimento finalizava.
--
-- entrada_id passa a aceitar nulo; a FK continua valendo para registros antigos.
-- Idempotente. Aplicar uma vez: a tabela existe por filial (db_manaus, db_roraima, db_rondonia).

DO $mig$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT table_schema
      FROM information_schema.columns
     WHERE table_name = 'entrada_operacoes_log'
       AND column_name = 'entrada_id'
       AND is_nullable = 'NO'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.entrada_operacoes_log ALTER COLUMN entrada_id DROP NOT NULL',
      v_schema
    );
    RAISE NOTICE 'entrada_id agora aceita nulo em %', v_schema;
  END LOOP;
END
$mig$;
