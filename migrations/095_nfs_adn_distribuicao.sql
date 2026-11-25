-- 095_nfs_adn_distribuicao.sql  (25/11/2026)
-- NFS-e nacional — etapa 3: busca das notas no ADN (Ambiente de Dados Nacional).
-- API: GET https://adn.nfse.gov.br/contribuintes/DFe/{NSU}?cnpjConsulta=...&lote=true (mTLS com
-- o certificado da empresa). Devolve até 50 documentos DEPOIS do NSU informado.
--   nfs_adn_controle  : último NSU lido por CNPJ/ambiente (a próxima busca continua dali)
--   nfs_adn_documento : cada documento baixado (NFS-e ou evento), com o XML original, o papel
--                       da empresa (prestador / tomador / intermediário) e o que foi feito com ele.
-- Idempotente; roda em todos os schemas de filial.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'nfs_nota' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.nfs_adn_controle (
        cnpj            varchar(14) NOT NULL,
        ambiente        varchar(10) NOT NULL,           -- PRODUCAO | RESTRITA
        ultimo_nsu      bigint      NOT NULL DEFAULT 0,
        atualizado_em   timestamptz,
        ultima_situacao varchar(250),
        PRIMARY KEY (cnpj, ambiente)
      )$f$, s);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.nfs_adn_documento (
        id              bigserial PRIMARY KEY,
        cnpj            varchar(14) NOT NULL,           -- CNPJ consultado
        ambiente        varchar(10) NOT NULL,
        nsu             bigint      NOT NULL,
        chave_acesso    varchar(50),
        tipo_documento  varchar(30),                    -- NFSE | EVENTO | ...
        tipo_evento     varchar(60),                    -- CANCELAMENTO | ... (eventos)
        data_geracao    timestamptz,
        xml             text,
        -- resumo lido do XML
        papel           varchar(15),                    -- PRESTADOR | TOMADOR | INTERMEDIARIO | OUTRO
        numero          varchar(15),
        dt_emissao      date,
        competencia     varchar(7),                     -- MM/AAAA
        cnpj_prestador  varchar(14),
        nome_prestador  varchar(150),
        doc_tomador     varchar(14),
        nome_tomador    varchar(150),
        cod_servico     varchar(10),                    -- cTribNac
        descricao       varchar(2000),
        valor_servico   numeric(15,2),
        valor_liquido   numeric(15,2),
        chave_referida  varchar(50),                    -- evento: nota a que se refere
        -- tratamento
        situacao        varchar(15) NOT NULL DEFAULT 'NOVA', -- NOVA | IMPORTADA | IGNORADA | REGISTRADO
        codfat          varchar(8),                     -- nfs_nota gerada na importação
        tratado_em      timestamptz,
        tratado_por     varchar(60),
        criado_em       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT nfs_adn_documento_uk UNIQUE (ambiente, cnpj, nsu)
      )$f$, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_nfs_adn_doc_chave ON %I.nfs_adn_documento (chave_acesso)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_nfs_adn_doc_situacao ON %I.nfs_adn_documento (situacao, papel)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_nfs_nota_chave ON %I.nfs_nota (chave_acesso)', s);

    RAISE NOTICE '%: tabelas do ADN ok', s;
  END LOOP;
END
$mig$;
