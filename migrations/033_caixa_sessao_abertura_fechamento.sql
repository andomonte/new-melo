-- 033_caixa_sessao_abertura_fechamento.sql
-- Estrutura de ABERTURA/FECHAMENTO de caixa (sessão de recebimento).
-- Ver docs/caixa/spec-abertura-fechamento-caixa-melo.md
--
-- ADITIVO: só cria tabelas novas. NÃO altera nada existente (faturamento, dbfreceb,
-- dbreceb, dbconta, tb_user_perfil, receber.ts). Removendo estas 3 tabelas, o sistema
-- volta a funcionar como hoje.
--
-- Criado nos schemas de filial ativos (mesmos da 032): db_manaus, db_rondonia, db_roraima.
-- Idempotente (IF NOT EXISTS). Valores monetários em numeric(15,2) (padrão do schema legado),
-- NÃO centavos-inteiros. Timestamps em timestamptz.

DO $$
DECLARE
  sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['db_manaus','db_rondonia','db_roraima']
  LOOP
    -- 5.1 caixa_sessao ---------------------------------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.caixa_sessao (
        id                        bigserial PRIMARY KEY,
        filial                    varchar      NOT NULL,
        cod_conta                 varchar(4)   NOT NULL,
        operador_abertura         varchar      NOT NULL,
        operador_fechamento       varchar,
        status                    varchar      NOT NULL DEFAULT 'ABERTO'
                                    CHECK (status IN ('ABERTO','EM_FECHAMENTO','FECHADO')),
        aberto_em                 timestamptz  NOT NULL DEFAULT now(),
        fechado_em                timestamptz,
        fundo_troco               numeric(15,2) NOT NULL DEFAULT 0 CHECK (fundo_troco >= 0),
        saldo_esperado_dinheiro   numeric(15,2),
        saldo_informado_dinheiro  numeric(15,2),
        quebra                    numeric(15,2),
        fechamento_forcado        boolean      NOT NULL DEFAULT false,
        observacao_abertura       text,
        observacao_fechamento     text,
        created_at                timestamptz  NOT NULL DEFAULT now(),
        updated_at                timestamptz  NOT NULL DEFAULT now()
      )
    $f$, sch);

    -- índice único parcial: no máx. 1 sessão ABERTO/EM_FECHAMENTO por conta.
    -- Esta constraint é a proteção real contra corrida (2 aberturas simultâneas).
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_caixa_aberto_por_conta '
      || 'ON %I.caixa_sessao (cod_conta) WHERE status IN (''ABERTO'',''EM_FECHAMENTO'')',
      sch);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS ix_caixa_sessao_conta_status '
      || 'ON %I.caixa_sessao (cod_conta, status)', sch);

    -- 5.2 caixa_movimento (livro-razão imutável) ------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.caixa_movimento (
        id               bigserial PRIMARY KEY,
        sessao_id        bigint      NOT NULL REFERENCES %I.caixa_sessao(id),
        tipo             varchar     NOT NULL
                           CHECK (tipo IN ('ABERTURA','RECEBIMENTO','SUPRIMENTO','SANGRIA','ESTORNO')),
        forma_pagamento  varchar     NOT NULL
                           CHECK (forma_pagamento IN ('DINHEIRO','DEBITO','CREDITO','PIX','CHEQUE','OUTRO')),
        valor            numeric(15,2) NOT NULL CHECK (valor > 0),
        sentido          varchar     NOT NULL CHECK (sentido IN ('ENTRADA','SAIDA')),
        referencia       varchar,
        motivo           text,
        operador         varchar     NOT NULL,
        idempotency_key  varchar,
        criado_em        timestamptz NOT NULL DEFAULT now()
      )
    $f$, sch, sch);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS ix_caixa_movimento_sessao '
      || 'ON %I.caixa_movimento (sessao_id)', sch);

    -- idempotência: mesma chave por sessão nunca duplica o movimento
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_caixa_mov_idem '
      || 'ON %I.caixa_movimento (sessao_id, idempotency_key) '
      || 'WHERE idempotency_key IS NOT NULL', sch);

    -- 5.3 caixa_fechamento_forma ----------------------------------------------
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.caixa_fechamento_forma (
        id               bigserial PRIMARY KEY,
        sessao_id        bigint      NOT NULL REFERENCES %I.caixa_sessao(id),
        forma_pagamento  varchar     NOT NULL,
        valor_esperado   numeric(15,2) NOT NULL DEFAULT 0,
        valor_informado  numeric(15,2),
        diferenca        numeric(15,2)
      )
    $f$, sch, sch);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS ix_caixa_fech_forma_sessao '
      || 'ON %I.caixa_fechamento_forma (sessao_id)', sch);

    RAISE NOTICE 'caixa_sessao/movimento/fechamento_forma OK em %', sch;
  END LOOP;
END $$;
