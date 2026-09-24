-- 056_dbpgto_pag_cof_id_nullable.sql
-- pag_cof_id (Conta Financeira) referencia cad_conta_financeira.cof_id.
-- Era NOT NULL, o que forçava o criar.ts a inventar MAX+1 quando nenhuma conta
-- financeira era selecionada, gerando valores ÓRFÃOS (ex.: 384) que não batem com
-- nenhuma cof_id e apareciam como "CÓD: 384" na edição.
-- Passa a aceitar NULL (conta financeira é opcional) e limpa os órfãos existentes.

ALTER TABLE db_manaus.dbpgto ALTER COLUMN pag_cof_id DROP NOT NULL;

UPDATE db_manaus.dbpgto p
SET pag_cof_id = NULL
WHERE p.pag_cof_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM db_manaus.cad_conta_financeira cf WHERE cf.cof_id = p.pag_cof_id
  );
