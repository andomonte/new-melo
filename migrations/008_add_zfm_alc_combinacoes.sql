-- Migração 008: tabelas de combinações ZFM (Zona Franca de Manaus) e ALC
-- (Áreas de Livre Comércio) — dependências do CALCULO_IMPOSTO (Oracle) que
-- FALTAVAM no Postgres. São a base da lógica Suframa/ZFM (isenção ICMS/PIS/COFINS
-- por par de municípios emitente×destinatário, códigos IBGE de 7 dígitos).
-- Estrutura e dados espelhados do Oracle DEV (zfm_combinacoes=9, alc_combinacoes=16).

CREATE TABLE IF NOT EXISTS db_manaus.zfm_combinacoes (
  municipio_emitente     integer,
  municipio_destinatario integer
);
CREATE TABLE IF NOT EXISTS db_manaus.alc_combinacoes (
  municipio_emitente     integer,
  municipio_destinatario integer
);

-- Popular apenas se vazias (idempotente)
INSERT INTO db_manaus.zfm_combinacoes (municipio_emitente, municipio_destinatario)
SELECT * FROM (VALUES
  (1302603,1302603),(1302603,1303569),(1302603,1303536),
  (1303569,1302603),(1303569,1303569),(1303569,1303536),
  (1303536,1302603),(1303536,1303569),(1303536,1303536)
) v(e,d)
WHERE NOT EXISTS (SELECT 1 FROM db_manaus.zfm_combinacoes);

INSERT INTO db_manaus.alc_combinacoes (municipio_emitente, municipio_destinatario)
SELECT * FROM (VALUES
  (1304062,1304062),
  (1600303,1600303),(1600303,1600600),(1600600,1600303),(1600600,1600600),
  (1100106,1100106),
  (1400100,1400100),(1400100,1400456),(1400456,1400100),(1400456,1400456),
  (1400159,1400159),
  (1200104,1200104),(1200104,1200252),(1200252,1200104),(1200252,1200252),
  (1200203,1200203)
) v(e,d)
WHERE NOT EXISTS (SELECT 1 FROM db_manaus.alc_combinacoes);
