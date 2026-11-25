-- 093_nfs_notas_servico.sql  (25/11/2026)
-- Notas Fiscais de Serviço (NFS-e) PRESTADAS — etapa 1 (migração do Delphi).
-- Origem no Oracle (package COBRANCA_NF_SERVICO): DBFATURA_NFS2 (cabeçalho) + DBPRODFAT_NFS2
-- (serviço; 1 por nota) e a tabela antiga DBFATURA_NFS/DBPRODFAT_NFS (2008–2011).
-- Os títulos da nota ficam em dbreceb (tipo = 'S', cod_fat = nfs_nota.codfat), como no Delphi.
-- O cadastro de serviços (dbservico_nfs) já existe (migration 048).
-- Os dados são copiados por docs/scripts/importar-nfse-oracle.cjs (pode ser rodado de novo).
-- Colunas já pensadas para as etapas seguintes (busca no portal nacional e emissão):
-- chave_acesso, xml, origem.
-- Idempotente; roda em todos os schemas de filial.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'dbreceb' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.nfs_nota (
        codfat            varchar(8)  PRIMARY KEY,        -- código da fatura (= dbreceb.cod_fat)
        nroform           varchar(15),                    -- número da NFS-e
        verificacao       varchar(50),                    -- código de verificação
        chave_acesso      varchar(50),                    -- NFS-e nacional (etapas seguintes)
        codcli            varchar(10) NOT NULL,
        dtemissao         date,
        competencia       varchar(7),                     -- MM/AAAA
        data              date,                           -- data do lançamento
        totalnfs          numeric(15,2) NOT NULL DEFAULT 0,
        totalfat          numeric(15,2) NOT NULL DEFAULT 0,
        frmfat            varchar(1),                     -- forma de faturamento (prazo)
        tipofat           varchar(1),
        cod_conta         varchar(4),
        valor_servico     numeric(15,2) DEFAULT 0,
        valor_desconto    numeric(15,2) DEFAULT 0,
        valor_deducoes    numeric(15,2) DEFAULT 0,
        issqn_basecalculo numeric(15,2) DEFAULT 0,
        issqn_aliquota    numeric(7,4)  DEFAULT 0,
        issqn_retido      varchar(1)    DEFAULT 'N',
        issqn_valor       numeric(15,2) DEFAULT 0,
        pis_valor         numeric(15,2) DEFAULT 0,
        cofins_valor      numeric(15,2) DEFAULT 0,
        ir_valor          numeric(15,2) DEFAULT 0,
        inss_valor        numeric(15,2) DEFAULT 0,
        csll_valor        numeric(15,2) DEFAULT 0,
        outros_valor      numeric(15,2) DEFAULT 0,
        aliquota_pis      numeric(7,4)  DEFAULT 0,
        aliquota_cofins   numeric(7,4)  DEFAULT 0,
        aliquota_ir       numeric(7,4)  DEFAULT 0,
        aliquota_inss     numeric(7,4)  DEFAULT 0,
        aliquota_csll     numeric(7,4)  DEFAULT 0,
        cst_pis           varchar(2),
        cst_cofins        varchar(2),
        obs               varchar(255),
        tipo              smallint,                       -- campo TIPO do Delphi (1/2)
        cancel            varchar(1)  NOT NULL DEFAULT 'N',
        origem            varchar(15) NOT NULL DEFAULT 'WEB', -- DELPHI | DELPHI_ANTIGA | WEB | NACIONAL
        xml               text,
        codusr            varchar(4),
        criado_em         timestamptz NOT NULL DEFAULT now(),
        atualizado_em     timestamptz,
        cancelado_em      timestamptz,
        cancelado_por     varchar(60)
      )$f$, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_nfs_nota_cliente ON %I.nfs_nota (codcli)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_nfs_nota_emissao ON %I.nfs_nota (dtemissao)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_nfs_nota_numero ON %I.nfs_nota (nroform, verificacao)', s);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.nfs_nota_servico (
        id        bigserial PRIMARY KEY,
        codfat    varchar(8) NOT NULL REFERENCES %I.nfs_nota (codfat) ON DELETE CASCADE,
        sen_id    varchar(9),                             -- dbservico_nfs.sen_id
        descr     varchar(2000),
        qtde      numeric(15,4) DEFAULT 1,
        prunit    numeric(15,2) DEFAULT 0,
        tiposeq   smallint
      )$f$, s, s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_nfs_nota_servico_fat ON %I.nfs_nota_servico (codfat)', s);

    RAISE NOTICE '%: tabelas de NFS-e ok', s;
  END LOOP;
END
$mig$;
