-- 086_compras_conta_financeira_titulos.sql  (24/11/2026)
-- Corrige os títulos a pagar (dbpgto) gerados pelo Compras.
-- Roteiro: docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md (etapa 1, decisão D1).
--
-- Antes, o Compras gravava pag_cof_id = MAX(pag_cof_id)+1 (uma "sequência"), então o título
-- caía em conta financeira errada (JUROS SANTANDER, ARMAZENAGEM…) ou inexistente.
-- Corrige para:
--   antecipado (parcela 0 da OC)        → 4  ADIANTAMENTO A FORNECEDOR
--   parcelas da OC e parcelas da NFe    → 1  INTERNACIONAL (importação / exterior)
--                                         3  FORA DO ESTADO (UF do fornecedor ≠ UF da filial)
--                                         2  FORNECEDOR LOCAL (demais)
-- E também:
--   banco gravado pelo nome ("MELO COMERCIO")  → código de dbbanco (0062)
--   cod_conta/cod_ccusto fixos '0001'/'0001' em título NÃO pago → vazios (Financeiro escolhe ao pagar)
--
-- Cópia dos valores antigos em dbpgto_bkp_086 (para desfazer). Idempotente: rodar de novo
-- não muda nada (só pega o que ainda está diferente) e não duplica o backup.
-- Para desfazer em um schema:
--   UPDATE dbpgto p SET pag_cof_id=b.pag_cof_id, banco=b.banco, cod_conta=b.cod_conta, cod_ccusto=b.cod_ccusto
--     FROM dbpgto_bkp_086 b WHERE b.cod_pgto = p.cod_pgto;

DO $mig$
DECLARE
  s   text;
  uf  text;
  n   int;
BEGIN
  FOR s, uf IN
    SELECT t.schema, t.uf FROM (VALUES ('db_manaus','AM'), ('db_roraima','RR'), ('db_boavista','RR'), ('db_rondonia','RO')) t(schema, uf)
     WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'dbpgto')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'ordem_pagamento_conta')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'cad_conta_financeira')
  LOOP
    EXECUTE format('SET LOCAL search_path TO %I', s);

    EXECUTE $q$
      CREATE TEMP TABLE IF NOT EXISTS tmp_086 (
        cod_pgto varchar PRIMARY KEY, cof_novo numeric, banco_novo varchar, limpa_conta boolean
      ) ON COMMIT DROP
    $q$;
    TRUNCATE tmp_086;

    EXECUTE format($q$
      INSERT INTO tmp_086 (cod_pgto, cof_novo, banco_novo, limpa_conta)
      WITH titulos AS (
        SELECT p.cod_pgto, MIN(opc.numero_parcela) AS numero_parcela
          FROM dbpgto p JOIN ordem_pagamento_conta opc ON opc.cod_pgto = p.cod_pgto
         GROUP BY p.cod_pgto
        UNION
        SELECT p.cod_pgto, NULL::int FROM dbpgto p
         WHERE p.obs ILIKE 'Pagamento ref. NFe%%'
           AND NOT EXISTS (SELECT 1 FROM ordem_pagamento_conta o WHERE o.cod_pgto = p.cod_pgto)
      ), base AS (
        SELECT DISTINCT ON (p.cod_pgto)
               p.cod_pgto, p.pag_cof_id, p.banco, p.cod_conta, p.cod_ccusto, p.paga,
               (t.numero_parcela = 0) AS antecipado,
               upper(btrim(COALESCE(c.uf::text,''))) AS uf,
               btrim(COALESCE(c.codpais::text,'')) AS codpais,
               upper(COALESCE(c.tipo::text,'')) AS tipo_credor,
               COALESCE(n.natop = 'ENTRADA_IMPORTACAO', false) AS importacao
          FROM titulos t
          JOIN dbpgto p ON p.cod_pgto = t.cod_pgto
          LEFT JOIN dbcredor c ON c.cod_credor = p.cod_credor
          LEFT JOIN dbnfe_ent n ON n.codnfe_ent = p.nro_nf
         ORDER BY p.cod_pgto, t.numero_parcela NULLS LAST
      ), calc AS (
        SELECT b.*,
               CASE WHEN b.antecipado THEN 4
                    WHEN b.importacao OR b.uf = 'EX' OR b.tipo_credor = 'X' OR (b.codpais <> '' AND b.codpais <> '1058') THEN 1
                    WHEN b.uf ~ '^[A-Z]{2}$' AND b.uf <> %L THEN 3
                    ELSE 2 END AS cof_novo,
               CASE WHEN COALESCE(b.banco,'') ~ '^[0-9]{4}$' OR COALESCE(btrim(b.banco),'') = '' THEN NULL
                    ELSE (SELECT bb.cod_banco FROM dbbanco bb
                           WHERE upper(btrim(bb.nome)) LIKE upper(btrim(b.banco)) || '%%'
                           ORDER BY (upper(btrim(bb.nome)) = upper(btrim(b.banco))) DESC, bb.cod_banco LIMIT 1) END AS banco_novo,
               (b.cod_conta = '0001' AND b.cod_ccusto = '0001' AND COALESCE(b.paga,'N') <> 'S') AS limpa_conta
          FROM base b
      )
      SELECT cod_pgto, cof_novo, banco_novo, limpa_conta FROM calc
       WHERE pag_cof_id IS DISTINCT FROM cof_novo OR banco_novo IS NOT NULL OR limpa_conta
    $q$, uf);

    -- backup (só a 1ª vez de cada título)
    EXECUTE $q$
      CREATE TABLE IF NOT EXISTS dbpgto_bkp_086 (
        cod_pgto varchar PRIMARY KEY, pag_cof_id numeric, banco varchar, cod_conta varchar, cod_ccusto varchar,
        salvo_em timestamptz DEFAULT now()
      )
    $q$;
    EXECUTE $q$
      INSERT INTO dbpgto_bkp_086 (cod_pgto, pag_cof_id, banco, cod_conta, cod_ccusto)
      SELECT p.cod_pgto, p.pag_cof_id, p.banco, p.cod_conta, p.cod_ccusto
        FROM dbpgto p JOIN tmp_086 t ON t.cod_pgto = p.cod_pgto
      ON CONFLICT (cod_pgto) DO NOTHING
    $q$;

    EXECUTE $q$
      UPDATE dbpgto p SET
        pag_cof_id = t.cof_novo,
        banco      = COALESCE(t.banco_novo, p.banco),
        cod_conta  = CASE WHEN t.limpa_conta THEN NULL ELSE p.cod_conta END,
        cod_ccusto = CASE WHEN t.limpa_conta THEN NULL ELSE p.cod_ccusto END
      FROM tmp_086 t WHERE t.cod_pgto = p.cod_pgto
    $q$;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '% (UF %): % título(s) corrigido(s)', s, uf, n;
  END LOOP;
END
$mig$;
