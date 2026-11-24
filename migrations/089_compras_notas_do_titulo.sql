-- 089_compras_notas_do_titulo.sql  (24/11/2026)
-- Fase 2 do roteiro docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md (etapas 3 e 4):
--  1. dbpgto.nro_nf passa de 20 para 200 caracteres (várias notas separadas por "/").
--  2. Tabela dbpgto_nota ("notas do título"): cada NF que um título atendeu, com valor da nota
--     e quanto o título cobriu nela. Vale para o ADIANTAMENTO (parcela 0 da ordem) e para as
--     PARCELAS geradas pela NF. É de onde sai o modal da coluna NF no Contas a Pagar.
--  3. Correção dos títulos existentes:
--     - parcelas da NF ("Pagamento ref. NFe …") gravavam em nro_nf o CÓDIGO INTERNO da nota
--       (000049641); passam a ter o NÚMERO real (78239) e o vínculo vai para dbpgto_nota;
--     - adiantamentos não cancelados de ordens cuja NF já teve o pagamento configurado passam a
--       ter nro_nf = nº da(s) nota(s), tem_nota = 'S' e o vínculo em dbpgto_nota.
-- Cópia do nro_nf/tem_nota antigos em dbpgto_bkp_089. Idempotente.
-- Para desfazer em um schema:
--   UPDATE dbpgto p SET nro_nf = b.nro_nf, tem_nota = b.tem_nota FROM dbpgto_bkp_089 b WHERE b.cod_pgto = p.cod_pgto;
--   DROP TABLE dbpgto_nota;   (o campo pode ficar com 200)

DO $mig$
DECLARE
  s text;
  n int;
BEGIN
  FOR s IN
    SELECT t.schema FROM (VALUES ('db_manaus'), ('db_roraima'), ('db_boavista'), ('db_rondonia')) t(schema)
     WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = t.schema AND table_name = 'dbpgto')
  LOOP
    EXECUTE format('SET LOCAL search_path TO %I', s);

    -- 1. campo NF maior
    IF (SELECT character_maximum_length FROM information_schema.columns
         WHERE table_schema = s AND table_name = 'dbpgto' AND column_name = 'nro_nf') < 200 THEN
      EXECUTE 'ALTER TABLE dbpgto ALTER COLUMN nro_nf TYPE varchar(200)';
    END IF;

    -- 2. notas do título
    EXECUTE $q$
      CREATE TABLE IF NOT EXISTS dbpgto_nota (
        id             bigserial PRIMARY KEY,
        cod_pgto       varchar(9)  NOT NULL,
        codnfe_ent     varchar(9)  NOT NULL,
        nnf            varchar(20),
        serie          varchar(5),
        chave          varchar(50),
        tipo           varchar(15) NOT NULL DEFAULT 'PARCELA',   -- ADIANTAMENTO | PARCELA
        valor_nf       numeric(15,2),
        valor_atendido numeric(15,2) NOT NULL DEFAULT 0,
        criado_em      timestamptz NOT NULL DEFAULT now(),
        usuario        varchar(60),
        CONSTRAINT dbpgto_nota_uk UNIQUE (cod_pgto, codnfe_ent)
      )$q$;
    EXECUTE 'CREATE INDEX IF NOT EXISTS dbpgto_nota_nfe_idx ON dbpgto_nota (codnfe_ent)';

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'dbnfe_ent') THEN
      CONTINUE;
    END IF;

    EXECUTE 'CREATE TABLE IF NOT EXISTS dbpgto_bkp_089 (cod_pgto varchar PRIMARY KEY, nro_nf varchar, tem_nota varchar, salvo_em timestamptz DEFAULT now())';

    -- 3a. parcelas da NF: vínculo + número real
    EXECUTE $q$
      INSERT INTO dbpgto_nota (cod_pgto, codnfe_ent, nnf, serie, chave, tipo, valor_nf, valor_atendido, criado_em, usuario)
      SELECT p.cod_pgto, n.codnfe_ent, n.nnf::text, n.serie::text, n.chave, 'PARCELA', n.vnf, p.valor_pgto,
             COALESCE(p.dt_emissao, now()), 'MIGRACAO_089'
        FROM dbpgto p JOIN dbnfe_ent n ON n.codnfe_ent = p.nro_nf
       WHERE p.obs ILIKE 'Pagamento ref. NFe%' AND COALESCE(p.cancel,'N') <> 'S'
      ON CONFLICT (cod_pgto, codnfe_ent) DO NOTHING
    $q$;
    EXECUTE $q$
      INSERT INTO dbpgto_bkp_089 (cod_pgto, nro_nf, tem_nota)
      SELECT p.cod_pgto, p.nro_nf, p.tem_nota FROM dbpgto p JOIN dbnfe_ent n ON n.codnfe_ent = p.nro_nf
       WHERE p.obs ILIKE 'Pagamento ref. NFe%' AND COALESCE(p.cancel,'N') <> 'S' AND n.nnf IS NOT NULL
      ON CONFLICT (cod_pgto) DO NOTHING
    $q$;
    EXECUTE $q$
      UPDATE dbpgto p SET nro_nf = n.nnf::text, tem_nota = 'S'
        FROM dbnfe_ent n
       WHERE n.codnfe_ent = p.nro_nf AND n.nnf IS NOT NULL
         AND p.obs ILIKE 'Pagamento ref. NFe%' AND COALESCE(p.cancel,'N') <> 'S'
    $q$;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '%: % parcela(s) de NF com o número real da nota', s, n;

    -- 3b. adiantamentos (parcela 0) de ordens cuja NF já teve o pagamento configurado.
    --     Valor atendido: o adiantamento vai cobrindo as notas pela ordem de entrada, até o
    --     menor entre o que sobra do adiantamento e o valor da nota.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'ordem_pagamento_conta')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'nfe_item_pedido_associacao') THEN
      EXECUTE $q$
        INSERT INTO dbpgto_nota (cod_pgto, codnfe_ent, nnf, serie, chave, tipo, valor_nf, valor_atendido, criado_em, usuario)
        WITH pares AS (
          SELECT DISTINCT p.cod_pgto, p.valor_pgto, n.codnfe_ent, n.nnf, n.serie, n.chave, n.vnf, n.demi
            FROM dbpgto p
            JOIN ordem_pagamento_conta opc ON opc.cod_pgto = p.cod_pgto AND opc.numero_parcela = 0
            JOIN nfe_item_pedido_associacao nipa ON nipa.req_id::bigint = opc.orc_id
            JOIN dbnfe_ent n ON n.codnfe_ent = nipa.nfe_id
           WHERE COALESCE(p.cancel,'N') <> 'S' AND n.pagamento_configurado IS TRUE
        ), acum AS (
          SELECT pares.*,
                 COALESCE(SUM(vnf) OVER (PARTITION BY cod_pgto ORDER BY demi, codnfe_ent
                                         ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS antes
            FROM pares
        )
        SELECT cod_pgto, codnfe_ent, nnf::text, serie::text, chave, 'ADIANTAMENTO', vnf,
               GREATEST(0, LEAST(vnf, valor_pgto - antes)), COALESCE(demi, now()), 'MIGRACAO_089'
          FROM acum
        ON CONFLICT (cod_pgto, codnfe_ent) DO NOTHING
      $q$;
      EXECUTE $q$
        INSERT INTO dbpgto_bkp_089 (cod_pgto, nro_nf, tem_nota)
        SELECT p.cod_pgto, p.nro_nf, p.tem_nota FROM dbpgto p
         WHERE EXISTS (SELECT 1 FROM dbpgto_nota t WHERE t.cod_pgto = p.cod_pgto AND t.tipo = 'ADIANTAMENTO')
        ON CONFLICT (cod_pgto) DO NOTHING
      $q$;
      EXECUTE $q$
        UPDATE dbpgto p
           SET nro_nf = x.notas, tem_nota = 'S'
          FROM (SELECT cod_pgto, left(string_agg(nnf, '/' ORDER BY criado_em, id), 200) AS notas
                  FROM dbpgto_nota WHERE tipo = 'ADIANTAMENTO' GROUP BY cod_pgto) x
         WHERE x.cod_pgto = p.cod_pgto AND p.nro_nf IS DISTINCT FROM x.notas
      $q$;
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE '%: % adiantamento(s) com a(s) nota(s) associada(s)', s, n;
    END IF;
  END LOOP;
END
$mig$;
