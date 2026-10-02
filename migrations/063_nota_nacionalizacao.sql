-- 063_nota_nacionalizacao.sql
-- Modelo de dados da NF-e de nacionalização (nota de entrada de importação).
-- Spec: docs/nota-nacionalizacao-web.md  |  Regras: docs/regras-importacao-zfm.md (B10 / seção G)
--
-- Modo padrão POR_DI (= Delphi): 1 NF-e por DI (cabeçalho em dbent_importacao,
-- que JÁ tem dt/nro/chave_nfe_nacionalizacao). Esta migration adiciona:
--   1) campos do GRUPO DI no cabeçalho (xLocDesemb/UFDesemb/dDesemb/tpViaTransp/
--      tpIntermedio/vAFRMM) — editáveis na tela, a maioria vem do XML da DI;
--   2) tabela dbent_importacao_adicao — persiste a ADIÇÃO + EXPORTADOR por DI
--      (grupo DI/adi/II da NF-e; resolve A2/A3 da auditoria).
--
-- Aditivo e idempotente. Roda em cada schema db_* que tenha dbent_importacao
-- (db_manaus, db_rondonia, db_roraima — paridade de schemas).

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

    -- 1) Campos do GRUPO DI no cabeçalho da DI (por-DI, modo POR_DI)
    EXECUTE format($f$
      ALTER TABLE %I.dbent_importacao
        ADD COLUMN IF NOT EXISTS local_desembaraco varchar,
        ADD COLUMN IF NOT EXISTS uf_desembaraco    varchar(2) DEFAULT 'AM',
        ADD COLUMN IF NOT EXISTS data_desembaraco  date,
        ADD COLUMN IF NOT EXISTS via_transporte    integer,   -- tpViaTransp (1 marítima..)
        ADD COLUMN IF NOT EXISTS forma_importacao  integer,   -- tpIntermedio (1 própria/2 c.ordem/3 encomenda)
        ADD COLUMN IF NOT EXISTS valor_afrmm       numeric,   -- vAFRMM (só marítimo)
        ADD COLUMN IF NOT EXISTS modo_emissao_nfe  varchar DEFAULT 'POR_DI';
    $f$, s);

    -- 2) Adição + exportador por DI (grupo DI/adi/II; base p/ emissão e C9)
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.dbent_importacao_adicao (
        id                 bigserial PRIMARY KEY,
        id_importacao      integer NOT NULL,          -- FK dbent_importacao.id
        numero_adicao      integer NOT NULL,          -- nAdicao
        seq_adicao         integer,                   -- nSeqAdic (seq. do item na adição)
        ncm                varchar,                   -- NCM da adição
        cod_exportador     varchar,                   -- cExportador
        exportador_nome    varchar,
        exportador_pais    varchar,                   -- cPais
        exportador_id_estr varchar,                   -- idEstrangeiro
        cod_fabricante     varchar,                   -- cFabricante
        bc_ii              numeric DEFAULT 0,         -- II: vBC
        despesa_aduaneira  numeric DEFAULT 0,         -- II: vDespAdu
        valor_ii           numeric DEFAULT 0,         -- II: vII
        valor_iof          numeric DEFAULT 0,         -- II: vIOF
        vl_desc_di         numeric DEFAULT 0,         -- adi: vDescDI
        n_draw             varchar,                   -- adi: nDraw
        valor_adicao       numeric DEFAULT 0,         -- valorTotalCondicaoVenda (base C9)
        createdat          timestamptz DEFAULT now()
      );
    $f$, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_imp_adicao_imp ON %I.dbent_importacao_adicao(id_importacao);$f$, s);
    EXECUTE format($f$CREATE UNIQUE INDEX IF NOT EXISTS ux_imp_adicao_imp_num ON %I.dbent_importacao_adicao(id_importacao, numero_adicao);$f$, s);

    -- 3) Notas de nacionalização: a tabela dbent_importacao_nfe JÁ EXISTE (registro da NF-e
    --    transmitida: serie, nrodoc_fiscal, chave, status, numprotocolo, xmlremessa/retorno,
    --    ambiente, id_fatura). id_fatura já permite N notas por DI (1 por exportador/fatura).
    --    Aqui só ACRESCENTO as colunas que faltam p/ os dois modos (POR_DI / POR_EXPORTADOR).
    EXECUTE format($f$
      ALTER TABLE %I.dbent_importacao_nfe
        ADD COLUMN IF NOT EXISTS modo           varchar DEFAULT 'POR_DI', -- POR_DI | POR_EXPORTADOR
        ADD COLUMN IF NOT EXISTS cod_exportador varchar,                  -- só no POR_EXPORTADOR
        ADD COLUMN IF NOT EXISTS seq_nota       integer DEFAULT 1,        -- quebra de 990 itens
        ADD COLUMN IF NOT EXISTS cfop_padrao    varchar,                  -- 3.102 etc
        ADD COLUMN IF NOT EXISTS vnf            numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS vprod          numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS vii            numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS vipi           numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS vpis           numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS vcofins        numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS vicms          numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS voutro         numeric DEFAULT 0;
    $f$, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_imp_nfe_imp ON %I.dbent_importacao_nfe(id_importacao);$f$, s);

    -- 4) Vínculo item ⇄ nota (quem entrou em qual NF-e e com qual nº de item)
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.dbent_importacao_nfe_item (
        id          bigserial PRIMARY KEY,
        id_nfe      bigint NOT NULL REFERENCES %I.dbent_importacao_nfe(id) ON DELETE CASCADE,
        id_item     integer NOT NULL,               -- FK dbent_importacao_it_ent.id
        id_adicao   bigint,                          -- FK dbent_importacao_adicao.id
        n_item_nf   integer                          -- nº do item dentro da NF-e (1..990)
      );
    $f$, s, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_imp_nfe_item_nfe ON %I.dbent_importacao_nfe_item(id_nfe);$f$, s);

  END LOOP;
END
$mig$;
