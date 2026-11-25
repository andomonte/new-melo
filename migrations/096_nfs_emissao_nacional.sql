-- 096_nfs_emissao_nacional.sql  (25/11/2026)
-- NFS-e nacional — etapa 4: emissão pela Sefin Nacional (DPS) e cancelamento (evento 101101).
--  1. dbservico_nfs: código de tributação nacional (cTribNac, 6 dígitos = item+subitem+desdobro),
--     código municipal (cTribMun, 3) e NBS (9). O cTribNac é preenchido a partir do item da lista
--     (sen_codigo "14.01" → "140101"); confira no cadastro de serviços.
--  2. nfs_dps_controle: último número de DPS por CNPJ/ambiente/série (com trava na emissão).
--  3. nfs_nota: dados da emissão (id da DPS, ambiente, XML da DPS) e do cancelamento no portal.
-- Idempotente; roda em todos os schemas de filial.

DO $mig$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT table_schema FROM information_schema.tables
     WHERE table_name = 'nfs_nota' AND table_schema LIKE 'db\_%' ORDER BY 1
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'dbservico_nfs') THEN
      EXECUTE format('ALTER TABLE %I.dbservico_nfs ADD COLUMN IF NOT EXISTS sen_ctribnac varchar(6)', s);
      EXECUTE format('ALTER TABLE %I.dbservico_nfs ADD COLUMN IF NOT EXISTS sen_ctribmun varchar(3)', s);
      EXECUTE format('ALTER TABLE %I.dbservico_nfs ADD COLUMN IF NOT EXISTS sen_cnbs varchar(9)', s);
      -- "14.01" / "1 .03" / "01.05" → item(2) + subitem(2) + desdobro "01"
      EXECUTE format($f$
        UPDATE %I.dbservico_nfs
           SET sen_ctribnac = lpad(split_part(replace(sen_codigo,' ',''), '.', 1), 2, '0')
                           || lpad(split_part(replace(sen_codigo,' ',''), '.', 2), 2, '0') || '01'
         WHERE sen_ctribnac IS NULL
           AND replace(sen_codigo,' ','') ~ '^[0-9]{1,2}\.[0-9]{1,2}$'$f$, s);
    END IF;

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.nfs_dps_controle (
        cnpj          varchar(14) NOT NULL,
        ambiente      varchar(10) NOT NULL,          -- PRODUCAO | RESTRITA
        serie         varchar(5)  NOT NULL,
        ultimo_numero bigint      NOT NULL DEFAULT 0,
        atualizado_em timestamptz,
        PRIMARY KEY (cnpj, ambiente, serie)
      )$f$, s);

    EXECUTE format('ALTER TABLE %I.nfs_nota ADD COLUMN IF NOT EXISTS dps_id varchar(45)', s);
    EXECUTE format('ALTER TABLE %I.nfs_nota ADD COLUMN IF NOT EXISTS ambiente_nfse varchar(10)', s);
    EXECUTE format('ALTER TABLE %I.nfs_nota ADD COLUMN IF NOT EXISTS dps_xml text', s);
    EXECUTE format('ALTER TABLE %I.nfs_nota ADD COLUMN IF NOT EXISTS cancel_evento_xml text', s);
    EXECUTE format('ALTER TABLE %I.nfs_nota ADD COLUMN IF NOT EXISTS cancel_motivo varchar(255)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS ix_nfs_nota_dps ON %I.nfs_nota (dps_id)', s);

    RAISE NOTICE '%: emissão NFS-e nacional ok', s;
  END LOOP;
END
$mig$;
