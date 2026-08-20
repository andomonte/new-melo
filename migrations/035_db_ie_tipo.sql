-- 035_db_ie_tipo.sql
-- Marca cada Inscrição Estadual (db_ie) com seu TIPO, para a emissão derivar a série
-- correta a partir do armazém (armazém → arm_iest → db_ie → tipo → série).
--
-- Tipos (espelham o Oracle dadosempresa.INSCRICAOESTADUAL vs INSCRICAOESTADUAL_07):
--   '04' = IE principal/normal → NF-e mod 55 SÉRIE 1 ; NFC-e mod 65 SÉRIE 3
--   '07' = Inscrição 07        → NF-e mod 55 SÉRIE 2 ; NÃO emite NFC-e
--
-- ⚠️ O número da IE NÃO indica o tipo (041647815 é a '04' apesar do prefixo 04;
--    070000867 é a '07'). Confirmado no Oracle GERAL.DADOSEMPRESA:
--    INSCRICAOESTADUAL=041647815 (04) / INSCRICAOESTADUAL_07=070000867 (07).

ALTER TABLE db_manaus.db_ie
  ADD COLUMN IF NOT EXISTS tipo varchar(2) NOT NULL DEFAULT '04';

COMMENT ON COLUMN db_manaus.db_ie.tipo IS
  '04 = IE principal (NF-e série 1, NFC-e série 3); 07 = Inscrição 07 (NF-e série 2, sem NFC-e)';

-- Seed dos valores conhecidos (Oracle é a fonte da verdade)
UPDATE db_manaus.db_ie SET tipo = '07' WHERE inscricaoestadual = '070000867';
UPDATE db_manaus.db_ie SET tipo = '04' WHERE inscricaoestadual IN ('041647815', '053374665');
