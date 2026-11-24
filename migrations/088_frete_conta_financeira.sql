-- 088_frete_conta_financeira.sql  (24/11/2026)
-- Títulos de frete (tipo 'T', ligados a CT-e em dbconhecimento) gerados por
-- /api/notas-conhecimento (gerar-titulo / marcar-pago) gravavam pag_cof_id = MAX(pag_cof_id)+1
-- (conta financeira errada: JUROS ITAU, PERDAS, CUSTOS…). Corrige para 7 FRETE NACIONAL.
-- Não mexe em título de frete que já está numa conta de frete (7, 8, 108, 162).
-- Cópia do valor antigo em dbpgto_bkp_088. Idempotente.
-- Para desfazer: UPDATE dbpgto p SET pag_cof_id = b.pag_cof_id FROM dbpgto_bkp_088 b WHERE b.cod_pgto = p.cod_pgto;

DO $mig$
DECLARE
  s text;
  n int;
BEGIN
  FOR s IN
    SELECT t.schema FROM (VALUES ('db_manaus'), ('db_roraima'), ('db_boavista'), ('db_rondonia')) t(schema)
     WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'dbconhecimento')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'dbpgto')
  LOOP
    EXECUTE format('SET LOCAL search_path TO %I', s);
    EXECUTE 'CREATE TABLE IF NOT EXISTS dbpgto_bkp_088 (cod_pgto varchar PRIMARY KEY, pag_cof_id numeric, salvo_em timestamptz DEFAULT now())';
    EXECUTE $q$
      INSERT INTO dbpgto_bkp_088 (cod_pgto, pag_cof_id)
      SELECT p.cod_pgto, p.pag_cof_id FROM dbpgto p
       WHERE p.tipo = 'T' AND EXISTS (SELECT 1 FROM dbconhecimento k WHERE k.codpgto = p.cod_pgto)
         AND (p.pag_cof_id IS NULL OR p.pag_cof_id NOT IN (7, 8, 108, 162))
      ON CONFLICT (cod_pgto) DO NOTHING
    $q$;
    EXECUTE $q$
      UPDATE dbpgto p SET pag_cof_id = 7
       WHERE p.tipo = 'T' AND EXISTS (SELECT 1 FROM dbconhecimento k WHERE k.codpgto = p.cod_pgto)
         AND (p.pag_cof_id IS NULL OR p.pag_cof_id NOT IN (7, 8, 108, 162))
    $q$;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '%: % título(s) de frete corrigido(s)', s, n;
  END LOOP;
END
$mig$;
