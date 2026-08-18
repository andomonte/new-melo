-- 011_criar_fat_cce.sql
-- Carta de Correção Eletrônica (CC-e) — evento NF-e 110110.
-- Guarda cada CC-e enviada à SEFAZ para uma fatura (NF-e mod. 55). A SEFAZ trata a
-- CC-e como cumulativa: cada nova carta contém as anteriores + a nova, e o nSeqEvento
-- incrementa (1..20). Aqui registramos o histórico completo por fatura.

CREATE TABLE IF NOT EXISTS db_manaus.fat_cce (
  id          serial PRIMARY KEY,
  codfat      varchar(20)  NOT NULL,
  chave       varchar(44)  NOT NULL,
  nseqevento  integer      NOT NULL,          -- sequência do evento (1..20)
  xcorrecao   text         NOT NULL,          -- texto CUMULATIVO enviado (15..1000)
  correcao_nova text,                         -- só o trecho novo desta carta (histórico)
  protocolo   varchar(30),                    -- nProt do evento registrado
  status      varchar(4),                     -- cStat da SEFAZ (135 = registrado)
  motivo      varchar(255),                   -- xMotivo da SEFAZ
  xml_envio   text,
  xml_retorno text,
  data        timestamptz  NOT NULL DEFAULT now(),
  usuario     varchar(60)
);

CREATE INDEX IF NOT EXISTS idx_fat_cce_codfat ON db_manaus.fat_cce (codfat);
