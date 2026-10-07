-- 069_importacao_adicao_hierarquia.sql
-- Fase A da hierarquia Fornecedor → Adição → Item e do vínculo fornecedor↔cliente.
--
--  dbent_importacao_it_ent.num_item  : nSeqAdic (numItem da DIe) — ordena os itens na adição/nota
--  dbent_importacao_adicao.*         : passa a guardar fornecedor + totais da adição (FOB/frete/PIS-COFINS/ICMS)
--  dbent_importacao.fornecedor_principal_regra : ADICAO_001 (padrão) | MAIOR_FOB
--  dbent_importacao_fornecedor_cliente : vínculo reutilizável nome(DIe normalizado) → código do cliente (tipo X)
--
-- Aditivo e idempotente; roda em cada schema db_*.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'dbent_importacao' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;

    EXECUTE format($f$
      ALTER TABLE %I.dbent_importacao_it_ent
        ADD COLUMN IF NOT EXISTS num_item integer;   -- nSeqAdic
    $f$, s);

    EXECUTE format($f$
      ALTER TABLE %I.dbent_importacao_adicao
        ADD COLUMN IF NOT EXISTS fornecedor_nome varchar,
        ADD COLUMN IF NOT EXISTS vl_fob        numeric,  -- FOB da adição (US$)
        ADD COLUMN IF NOT EXISTS vl_frete      numeric,  -- frete da adição (US$)
        ADD COLUMN IF NOT EXISTS vl_pis_cofins numeric,  -- PIS/COFINS da adição (R$)
        ADD COLUMN IF NOT EXISTS vl_icms       numeric;  -- ICMS da adição (R$)
    $f$, s);

    EXECUTE format($f$
      ALTER TABLE %I.dbent_importacao
        ADD COLUMN IF NOT EXISTS fornecedor_principal_regra varchar DEFAULT 'ADICAO_001';
    $f$, s);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.dbent_importacao_fornecedor_cliente (
        nome_norm   varchar(60) PRIMARY KEY,  -- nome da DIe normalizado (maiúsc/sem pontuação)
        cod_cliente varchar NOT NULL,         -- dbclien.codcli (tipo X)
        nome_die    varchar,                  -- nome original como veio na DIe
        created_at  timestamptz DEFAULT now()
      );
    $f$, s);
  END LOOP;
END
$mig$;
