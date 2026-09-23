-- 053_saldo_credor_fornecedor.sql
-- Saldo credor / adiantamento a fornecedor.
-- Spec: docs/saldo-fornecedor/spec-saldo-credor-fornecedor.md
--
-- Cria o modelo de crédito a favor da empresa junto ao fornecedor:
--   fn_grupo_credor  -> agrupa matriz+filiais do fornecedor pela raiz do CNPJ (8 díg)
--   credor_grupo     -> override do agrupamento (opcional)
--   credor_credito   -> a origem de cada saldo (excedente de antecipado > NF)
--   credor_credito_uso -> abatimento (consumo) de crédito contra título (uso futuro: tela Saldos)
--   vw_credor_saldo / vw_credor_credito_aberto -> consultas
--   forma 'ABATIMENTO DE SALDO' em dbforma_pagto (não-caixa) — usada no abatimento
--
-- Escopo POR FILIAL (decisão 10): roda em cada schema db_* que tenha dbcredor
-- (db_boavista, db_manaus, db_rondonia, db_roraima). Idempotente.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
    WHERE table_name = 'dbcredor' AND table_schema LIKE 'db\_%'
    ORDER BY 1
  LOOP
    RAISE NOTICE '--- schema % ---', s;

    -- 1) Função de agrupamento (raiz CNPJ p/ PJ; documento inteiro p/ PF/estrangeiro)
    EXECUTE format($f$
      CREATE OR REPLACE FUNCTION %I.fn_grupo_credor(p_doc text)
      RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
        SELECT CASE
          WHEN length(regexp_replace(coalesce(p_doc,''),'\D','','g')) = 14
            THEN left(regexp_replace(p_doc,'\D','','g'), 8)
          ELSE nullif(regexp_replace(coalesce(p_doc,''),'\D','','g'), '')
        END;
      $fn$;
    $f$, s);

    -- 2) Override do agrupamento (força um cod_credor num grupo específico)
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.credor_grupo (
        cod_credor varchar PRIMARY KEY,
        grupo_key  varchar NOT NULL,
        obs        varchar,
        username   varchar,
        createdat  timestamptz DEFAULT now()
      );
    $f$, s);

    -- 3) Origem do saldo (crédito)
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.credor_credito (
        id               bigserial PRIMARY KEY,
        grupo_key        varchar NOT NULL,           -- dono do saldo (raiz CNPJ ou override)
        cod_credor       varchar NOT NULL,           -- filial (cod_credor) que gerou
        origem           varchar NOT NULL,           -- SOBRA_PAGAMENTO | AJUSTE | DEVOLUCAO
        cod_pgto         varchar,                    -- título antecipado (parcela 0) que originou
        codent           varchar,                    -- entrada, quando gerada
        nfe_id           varchar,                    -- dbnfe_ent.codnfe_ent que apurou o excedente
        valor_original   numeric(15,2) NOT NULL CHECK (valor_original > 0),
        valor_disponivel numeric(15,2) NOT NULL CHECK (valor_disponivel >= 0),
        status           varchar NOT NULL DEFAULT 'ABERTO', -- ABERTO|PARCIAL|CONSUMIDO|CANCELADO
        dt_credito       timestamptz NOT NULL DEFAULT now(),
        obs              varchar,
        username         varchar,
        createdat        timestamptz DEFAULT now(),
        updatedat        timestamptz
      );
    $f$, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_credor_credito_grupo  ON %I.credor_credito(grupo_key, status);$f$, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_credor_credito_credor ON %I.credor_credito(cod_credor);$f$, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_credor_credito_pgto   ON %I.credor_credito(cod_pgto);$f$, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_credor_credito_nfe    ON %I.credor_credito(nfe_id);$f$, s);

    -- 4) Abatimento (consumo) — uso futuro (tela Saldos de Fornecedor)
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.credor_credito_uso (
        id                 bigserial PRIMARY KEY,
        credito_id         bigint NOT NULL REFERENCES %I.credor_credito(id),
        cod_pgto_abatido   varchar NOT NULL,         -- título que recebeu o abatimento
        cod_credor_abatido varchar NOT NULL,         -- filial do título (pode diferir → uso cruzado)
        valor_usado        numeric(15,2) NOT NULL CHECK (valor_usado > 0),
        dt_uso             timestamptz NOT NULL DEFAULT now(),
        motivo             varchar,
        username           varchar,
        createdat          timestamptz DEFAULT now()
      );
    $f$, s, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_credor_uso_credito ON %I.credor_credito_uso(credito_id);$f$, s);
    EXECUTE format($f$CREATE INDEX IF NOT EXISTS ix_credor_uso_pgto    ON %I.credor_credito_uso(cod_pgto_abatido);$f$, s);

    -- 5) Views
    EXECUTE format($f$
      CREATE OR REPLACE VIEW %I.vw_credor_saldo AS
      SELECT grupo_key, cod_credor,
             SUM(valor_disponivel) AS saldo_filial,
             SUM(SUM(valor_disponivel)) OVER (PARTITION BY grupo_key) AS saldo_grupo
      FROM %I.credor_credito
      WHERE status IN ('ABERTO','PARCIAL')
      GROUP BY grupo_key, cod_credor;
    $f$, s, s);

    EXECUTE format($f$
      CREATE OR REPLACE VIEW %I.vw_credor_credito_aberto AS
      SELECT c.grupo_key, c.cod_credor, cr.nome, c.origem, c.cod_pgto, c.codent, c.nfe_id,
             c.valor_original, c.valor_disponivel, c.dt_credito,
             (current_date - c.dt_credito::date) AS dias_em_aberto
      FROM %I.credor_credito c
      LEFT JOIN %I.dbcredor cr ON cr.cod_credor = c.cod_credor
      WHERE c.status IN ('ABERTO','PARCIAL')
      ORDER BY c.dt_credito;
    $f$, s, s, s);

    -- 6) Forma "ABATIMENTO DE SALDO" (não-caixa) — só onde existe dbforma_pagto
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = s AND table_name = 'dbforma_pagto'
    ) THEN
      EXECUTE format($f$
        INSERT INTO %I.dbforma_pagto (codfpgt, descricao) VALUES ('45','ABATIMENTO DE SALDO')
        ON CONFLICT (codfpgt) DO UPDATE SET descricao = EXCLUDED.descricao;
      $f$, s);
    END IF;

  END LOOP;
END
$mig$;
