-- 102_devolucao_entrada.sql  (26/11/2026)
-- Devolução de compra no modelo do Delphi (Financeiro › Faturamento › Devolução,
-- package FATURAMENTOS: FAT_DEVOLUCAO / FAT_IT_DEVOLUCAO / FAT_DEVOLUCAO_REGISTRO).
--
-- Fluxo no web: a alocação grava a quantidade da NOTA (como o romaneio do Delphi exige).
-- O que veio a menos, danificado ou errado vai para o armazém virtual 1004 e nasce uma
-- devolução aberta (status 'A') com um pré-pedido para o fornecedor, que segura a reserva.
-- A emissão da NF de devolução fica para uma fase seguinte.
--
-- Tabelas com as colunas do Oracle (o histórico é importado de lá) e algumas a mais,
-- só do web (dev_origem, dev_matricula, dev_devolucao_receb_id, itd_motivo, itd_prunit).
-- Idempotente.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'dbent' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    -- Cabeçalho da devolução
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.fat_devolucao (
        dev_id              bigint PRIMARY KEY,
        dev_osuser          varchar(100),
        dev_ip              varchar(100),
        dev_host            varchar(100),
        dev_program         varchar(100),
        dev_data            timestamp NOT NULL DEFAULT now(),
        dev_user            varchar(100),
        dev_codusr          varchar(4),
        dev_nomeusr         varchar(20),
        dev_tipodoc         varchar(10) NOT NULL,          -- ENTRADA | FATURA
        dev_coddoc          varchar(9)  NOT NULL,          -- codent | codfat de origem
        dev_cfop            numeric,
        dev_coddest         varchar(10),                   -- cliente destinatário (fornecedor como cliente)
        dev_codfat          varchar(9),                    -- fatura emitida (NF de devolução)
        dev_cancel          varchar(1)  NOT NULL DEFAULT 'N',
        dev_arm_id          numeric,
        dev_pedido          varchar(30),
        dev_obs             varchar(100),
        dev_transp          varchar(5),
        dev_codmsg          varchar(100),
        dev_frete           varchar(1),
        dev_nomeusr_cancel  varchar(20),
        dev_codnfe_ent      varchar(9),
        dev_insc07          varchar(1),
        dev_destino         varchar(15),                   -- FORNECEDOR | MELO | TRANSPORTADORA | TERCEIRO | CLIENTE
        dev_procedente      varchar(1),
        dev_status          varchar(1)  NOT NULL DEFAULT 'A', -- A aberta | F finalizada | E (Delphi)
        dev_quantidade      varchar(50),
        dev_especie         varchar(50),
        dev_marca           varchar(50),
        dev_numero          varchar(50),
        dev_pesobruto       varchar(50),
        dev_pesoliquido     varchar(50),
        dev_valorfrete      numeric,
        dev_totalprod       numeric,
        dev_totalnf         numeric,
        -- só do web
        dev_origem          varchar(10) NOT NULL DEFAULT 'WEB', -- WEB | ORACLE (histórico importado)
        dev_matricula       varchar(20),
        dev_devolucao_receb_id integer,                    -- devolucoes.id (registro do recebimento)
        dev_dt_cancel       timestamp
      )$f$, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_fat_devolucao_doc ON %I.fat_devolucao (dev_tipodoc, dev_coddoc)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_fat_devolucao_status ON %I.fat_devolucao (dev_status, dev_cancel)', s);

    -- Itens da devolução
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.fat_it_devolucao (
        itd_dev_id            bigint NOT NULL,
        itd_id                varchar(3) NOT NULL,
        itd_codreq            varchar(12),
        itd_codvenda          varchar(9),
        itd_codint            varchar(9),
        itd_codprod           varchar(9) NOT NULL,
        itd_arm_id            numeric,
        itd_quant_original    numeric,
        itd_quant_disponivel  numeric,
        itd_quant_devolvida   numeric,
        itd_percentual        numeric,
        itd_totalipi          numeric,
        itd_codvenda2         varchar(9),                  -- pré-pedido que segura o item
        itd_codint2           varchar(9),
        itd_nrequis           varchar(15),
        itd_nritem            varchar(6),
        -- só do web
        itd_motivo            varchar(15),                 -- FALTA | DANIFICADO | ERRADO
        itd_prunit            numeric,                     -- preço unitário da NF de entrada
        PRIMARY KEY (itd_dev_id, itd_id)
      )$f$, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_fat_it_devolucao_req ON %I.fat_it_devolucao (itd_codreq, itd_codprod)', s);

    -- Documentos gerados pela devolução (VENDA = pré-pedido, FATURA, RECEB, ...).
    -- A tabela existia sem a coluna da devolução.
    EXECUTE format('ALTER TABLE %I.fat_devolucao_registro ADD COLUMN IF NOT EXISTS der_dev_id bigint', s);
    -- no Oracle der_codigo é varchar2(20): códigos de baixa ("102048181.001") não cabiam em 9
    EXECUTE format('ALTER TABLE %I.fat_devolucao_registro ALTER COLUMN der_codigo TYPE varchar(20)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_fat_devolucao_registro_dev ON %I.fat_devolucao_registro (der_dev_id)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_fat_devolucao_registro_cod ON %I.fat_devolucao_registro (der_documento, der_codigo)', s);

    -- Armazém virtual: guarda o que veio a menos/danificado/errado até a devolução.
    -- Status 'V' o tira das listas de escolha (todas filtram arm_status = 'A').
    EXECUTE format($f$
      INSERT INTO %I.cad_armazem (arm_id, arm_descricao, arm_status)
      VALUES (1004, 'DEVOLUCAO/FALTA', 'V')
      ON CONFLICT (arm_id) DO NOTHING$f$, s);
  END LOOP;
END
$mig$;
