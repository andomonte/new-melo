-- 087_compras_renumera_duplicatas.sql  (24/11/2026)
-- Renumera a duplicata (dbpgto.nro_dup) dos títulos ANTIGOS do Compras que ainda NÃO foram
-- pagos, para o padrão novo (decisões D2/D3 do roteiro
-- docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md):
--   títulos da ordem de compra (antecipado/parcelas): OC{nº da ordem}/{parcela}/{total}
--       antes: OC27915/01            → OC12026110045/1/1
--   títulos do restante da NF:                        {nº da NF}/{parcela}/{total}
--       antes: OC27908/01, OC27908/02 → 24421/1/2, 24421/2/2
--     (a duplicata do XML desses títulos é só a sequência "001"…, então vai o nº da NF)
-- Ficam como estão: pagos (total ou parcial), cancelados e os que já foram para remessa
-- de pagamento (SISPAG). A posição/total contam todos os títulos não cancelados do grupo.
-- Cópia do valor antigo em dbpgto_bkp_087 (para desfazer). Idempotente.
-- Para desfazer em um schema:
--   UPDATE dbpgto p SET nro_dup = b.nro_dup FROM dbpgto_bkp_087 b WHERE b.cod_pgto = p.cod_pgto;

DO $mig$
DECLARE
  s text;
  n int;
  tem_sispag boolean;
  tem_arq    boolean;
BEGIN
  FOR s IN
    SELECT t.schema FROM (VALUES ('db_manaus'), ('db_roraima'), ('db_boavista'), ('db_rondonia')) t(schema)
     WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'ordem_pagamento_conta')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'dbnfe_ent')
  LOOP
    EXECUTE format('SET LOCAL search_path TO %I', s);
    tem_sispag := EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'dbpgto_sispag');
    tem_arq    := EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'pgt_arquivo_sispag');

    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS tmp_087 (cod_pgto varchar PRIMARY KEY, nro_dup_novo varchar) ON COMMIT DROP';
    TRUNCATE tmp_087;

    EXECUTE format($q$
      INSERT INTO tmp_087 (cod_pgto, nro_dup_novo)
      WITH oc AS (            -- títulos gerados ao configurar o pagamento da ORDEM
        SELECT p.cod_pgto, p.paga, p.valor_pago, opc.orc_id,
               ROW_NUMBER() OVER (PARTITION BY opc.orc_id ORDER BY opc.numero_parcela, p.cod_pgto) AS pos,
               COUNT(*)     OVER (PARTITION BY opc.orc_id) AS tot
          FROM dbpgto p
          JOIN ordem_pagamento_conta opc ON opc.cod_pgto = p.cod_pgto
         WHERE p.obs ILIKE 'Pagamento ref. Ordem de Compra%%'
           AND COALESCE(p.cancel,'N') <> 'S'
      ), nf AS (              -- títulos do restante da NF (configurar pagamento da NFe)
        SELECT DISTINCT ON (p.cod_pgto) p.cod_pgto, p.paga, p.valor_pgto, p.valor_pago,
               COALESCE(NULLIF(btrim(n.nnf::text),''), ltrim(p.nro_nf,'0')) AS nnf,
               p.nro_nf, p.cod_credor, p.dt_venc, p.nro_dup
          FROM dbpgto p
          LEFT JOIN dbnfe_ent n ON n.codnfe_ent = p.nro_nf
         WHERE p.obs ILIKE 'Pagamento ref. NFe%%'
           AND COALESCE(p.cancel,'N') <> 'S'
      ), nf2 AS (
        SELECT nf.*,
               ROW_NUMBER() OVER (PARTITION BY nf.nro_nf, nf.cod_credor ORDER BY nf.nro_dup, nf.dt_venc, nf.cod_pgto) AS pos,
               COUNT(*)     OVER (PARTITION BY nf.nro_nf, nf.cod_credor) AS tot
          FROM nf
      ), novos AS (
        SELECT cod_pgto, paga, valor_pago, left('OC' || orc_id || '/' || pos || '/' || tot, 20) AS nro_dup_novo FROM oc
        UNION ALL
        SELECT cod_pgto, paga, valor_pago,
               left(nnf, 20 - length('/' || pos || '/' || tot)) || '/' || pos || '/' || tot FROM nf2
      )
      SELECT DISTINCT ON (x.cod_pgto) x.cod_pgto, x.nro_dup_novo
        FROM novos x JOIN dbpgto p ON p.cod_pgto = x.cod_pgto
       WHERE COALESCE(x.paga,'N') <> 'S' AND COALESCE(x.valor_pago,0) = 0
         AND p.nro_dup IS DISTINCT FROM x.nro_dup_novo
         %s %s
       ORDER BY x.cod_pgto
    $q$,
      CASE WHEN tem_sispag THEN 'AND NOT EXISTS (SELECT 1 FROM dbpgto_sispag sp WHERE sp.spg_cod_pgto = x.cod_pgto)' ELSE '' END,
      CASE WHEN tem_arq    THEN 'AND NOT EXISTS (SELECT 1 FROM pgt_arquivo_sispag aq WHERE aq.aqs_cod_pgto = x.cod_pgto)' ELSE '' END);

    EXECUTE 'CREATE TABLE IF NOT EXISTS dbpgto_bkp_087 (cod_pgto varchar PRIMARY KEY, nro_dup varchar, salvo_em timestamptz DEFAULT now())';
    EXECUTE $q$
      INSERT INTO dbpgto_bkp_087 (cod_pgto, nro_dup)
      SELECT p.cod_pgto, p.nro_dup FROM dbpgto p JOIN tmp_087 t ON t.cod_pgto = p.cod_pgto
      ON CONFLICT (cod_pgto) DO NOTHING
    $q$;
    EXECUTE 'UPDATE dbpgto p SET nro_dup = t.nro_dup_novo FROM tmp_087 t WHERE t.cod_pgto = p.cod_pgto';
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '%: % duplicata(s) renumerada(s)', s, n;
  END LOOP;
END
$mig$;
