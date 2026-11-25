-- 100_indice_itvenda_codvenda.sql  (25/11/2026)
-- Índice de itens por venda: dbitvenda só tinha a PK (codprod, codvenda), então juntar itens a
-- vendas (relatórios de venda, telas de venda) varria a tabela inteira (650 mil linhas em Manaus).
-- Junto com ANALYZE (as tabelas nunca tinham estatística), evita que o planejador escolha laço
-- aninhado sobre estimativas erradas — ver src/lib/relatorios (SET LOCAL enable_nestloop = off).
--
-- Em produção, prefira criar SEM travar a tabela, fora de transação, um schema por vez:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_dbitvenda_codvenda ON db_manaus.dbitvenda (codvenda);
--   ANALYZE db_manaus.dbitvenda;  (idem dbvenda, dbprod, dbfatura...)
-- O bloco abaixo (com trava curta) é para ambientes onde a migration roda inteira de uma vez.
-- Idempotente.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'dbitvenda' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_dbitvenda_codvenda ON %I.dbitvenda (codvenda)', s);
    RAISE NOTICE '%: índice ix_dbitvenda_codvenda ok', s;
  END LOOP;
END
$mig$;
