-- 092_indices_recebimento_contas_pagar.sql  (24/11/2026)
-- Índices para a situação de RECEBIMENTO FÍSICO no Contas a Pagar
-- (src/lib/contasPagar/situacaoRecebimento.ts):
--   - nota do título → entrada pela chave da NFe (dbent.chave);
--   - título avulso/antigo → entrada do mesmo fornecedor com o nº da NF na chave
--     (mesma expressão usada na consulta: ltrim(substring(chave FROM 26 FOR 9), '0')).
-- Só índices; idempotente.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'dbent' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_dbent_chave ON %I.dbent (chave)', s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_dbent_credor_nf_chave
                       ON %I.dbent (cod_credor, (ltrim(substring(chave FROM 26 FOR 9), '0')))$f$, s);
    RAISE NOTICE '%: índices de recebimento ok', s;
  END LOOP;
END
$mig$;
