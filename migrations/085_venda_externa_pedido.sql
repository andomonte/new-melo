-- 085 — Fila de pedidos da Venda Externa (/externo), 23/11/2026.
-- Cada pedido feito no aparelho (com ou sem internet) chega com um uuid gerado lá.
-- Esta tabela garante que o mesmo pedido NUNCA vire duas vendas (reenvio devolve o
-- resultado do primeiro) e guarda o histórico/pendências. Uma por filial (schema).
-- Idempotente.

DO $mig$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['db_manaus', 'db_roraima', 'db_rondonia'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      CONTINUE;
    END IF;
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.venda_externa_pedido (
        uuid                varchar(40)  PRIMARY KEY,
        login               varchar(60)  NOT NULL,
        codvend             varchar(10),
        numero_local        varchar(40),
        codcli              varchar(10),
        total               numeric(14,2),
        payload             jsonb        NOT NULL,
        status              varchar(20)  NOT NULL,  -- PROCESSANDO | ENVIADO | PENDENCIA | ERRO
        mensagem            text,
        codvenda            varchar(20),
        nrovenda            varchar(20),
        criado_no_aparelho  timestamptz,
        tentativas          integer      NOT NULL DEFAULT 0,
        created_at          timestamptz  NOT NULL DEFAULT now(),
        updated_at          timestamptz  NOT NULL DEFAULT now()
      )$f$, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS venda_externa_pedido_login_idx ON %I.venda_externa_pedido (login, created_at DESC)', s);
    RAISE NOTICE 'venda_externa_pedido ok em %', s;
  END LOOP;
END $mig$;
