-- 090_credito_pagamento_sem_nf.sql  (24/11/2026)
-- Fase 3 do roteiro docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md (etapa 5):
-- o crédito do fornecedor passa a nascer NO PAGAMENTO de um título sem NF:
--   - conta financeira 4 (ADIANTAMENTO A FORNECEDOR), ou
--   - conta financeira 2 (FORNECEDOR LOCAL) em título AVULSO (fora do Compras) — decisão D4.
-- A NF, quando é associada, CONSOME o crédito (credor_credito_uso com nfe_id).
-- Rotina no código: src/lib/compras/creditoFornecedor.ts (sincronizarCreditoTitulo).
--
--  1. credor_credito_uso: uso por NF (nfe_id; sem título abatido) e estorno do uso.
--  2. Um crédito "PAGAMENTO_SEM_NF" por título (índice único).
--  3. D6: créditos dos títulos JÁ pagos sem NF (valor pago = histórico dbfpgto não cancelado,
--     sem a forma 45 ABATIMENTO DE SALDO; sem histórico, dbpgto.valor_pago).
-- Idempotente. Para desfazer o passo 3 num schema:
--   DELETE FROM credor_credito c WHERE c.origem = 'PAGAMENTO_SEM_NF' AND c.username = 'MIGRACAO_090'
--     AND NOT EXISTS (SELECT 1 FROM credor_credito_uso u WHERE u.credito_id = c.id);

DO $mig$
DECLARE
  s text;
  n int;
BEGIN
  FOR s IN
    SELECT t.schema FROM (VALUES ('db_manaus'), ('db_roraima'), ('db_boavista'), ('db_rondonia')) t(schema)
     WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'credor_credito')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'dbpgto')
  LOOP
    EXECUTE format('SET LOCAL search_path TO %I', s);

    -- 1. uso por NF + estorno do uso
    EXECUTE 'ALTER TABLE credor_credito_uso ADD COLUMN IF NOT EXISTS nfe_id varchar(9)';
    EXECUTE 'ALTER TABLE credor_credito_uso ADD COLUMN IF NOT EXISTS estornado_em timestamptz';
    EXECUTE 'ALTER TABLE credor_credito_uso ADD COLUMN IF NOT EXISTS estornado_por varchar(60)';
    EXECUTE 'ALTER TABLE credor_credito_uso ADD COLUMN IF NOT EXISTS motivo_estorno varchar(250)';
    EXECUTE 'ALTER TABLE credor_credito_uso ALTER COLUMN cod_pgto_abatido DROP NOT NULL';
    EXECUTE 'ALTER TABLE credor_credito_uso ALTER COLUMN cod_credor_abatido DROP NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS ix_credor_uso_nfe ON credor_credito_uso (nfe_id)';

    -- 2. um crédito de pagamento por título
    EXECUTE $q$CREATE UNIQUE INDEX IF NOT EXISTS ux_credor_credito_pgto_sem_nf
               ON credor_credito (cod_pgto) WHERE origem = 'PAGAMENTO_SEM_NF'$q$;

    -- 3. D6: títulos já pagos sem NF
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'ordem_pagamento_conta')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'dbfpgto') THEN
      EXECUTE $q$
        INSERT INTO credor_credito
          (grupo_key, cod_credor, origem, cod_pgto, valor_original, valor_disponivel, status, dt_credito, obs, username)
        SELECT COALESCE(g.grupo_key, fn_grupo_credor(c.cpf_cgc), p.cod_credor), p.cod_credor, 'PAGAMENTO_SEM_NF', p.cod_pgto,
               x.pago, x.pago, 'ABERTO', COALESCE(p.dt_pgto, now()),
               CASE WHEN p.pag_cof_id = 4 THEN 'Adiantamento pago sem NF' ELSE 'Título avulso pago sem NF' END
                 || COALESCE(' — ' || p.nro_dup, ''),
               'MIGRACAO_090'
          FROM dbpgto p
          JOIN dbcredor c ON c.cod_credor = p.cod_credor
          LEFT JOIN credor_grupo g ON g.cod_credor = p.cod_credor
          CROSS JOIN LATERAL (
            SELECT CASE WHEN EXISTS (SELECT 1 FROM dbfpgto f WHERE f.cod_pgto = p.cod_pgto)
                        THEN (SELECT COALESCE(SUM(f.valor_pgto),0) FROM dbfpgto f
                               WHERE f.cod_pgto = p.cod_pgto AND COALESCE(f.cancel,'N') <> 'S'
                                 AND COALESCE(btrim(f.cod_fpgto),'') <> '45')
                        ELSE COALESCE(p.valor_pago,0) END AS pago
          ) x
         WHERE p.tipo = 'F' AND COALESCE(p.cancel,'N') <> 'S'
           AND (p.pag_cof_id = 4
                OR (p.pag_cof_id = 2
                    AND NOT EXISTS (SELECT 1 FROM ordem_pagamento_conta o WHERE o.cod_pgto = p.cod_pgto)
                    AND COALESCE(p.obs,'') NOT ILIKE 'Pagamento ref. NFe%'))
           AND COALESCE(btrim(p.nro_nf),'') = '' AND COALESCE(p.tem_nota,'N') <> 'S'
           AND NOT EXISTS (SELECT 1 FROM dbpgto_nota t WHERE t.cod_pgto = p.cod_pgto)
           AND x.pago > 0.005
        ON CONFLICT (cod_pgto) WHERE origem = 'PAGAMENTO_SEM_NF' DO NOTHING
      $q$;
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE '%: % crédito(s) de título já pago sem NF', s, n;
    END IF;
  END LOOP;
END
$mig$;
