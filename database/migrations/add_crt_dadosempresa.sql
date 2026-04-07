-- Migration: Adicionar campo CRT (Código de Regime Tributário) na tabela dadosempresa
-- Data: 2026-01-08
-- Descrição: Campo para armazenar o regime tributário da empresa (1=Simples Nacional, 2=Simples Nacional excesso, 3=Regime Normal)

-- Adicionar coluna CRT
ALTER TABLE db_manaus.dadosempresa 
ADD COLUMN IF NOT EXISTS crt character varying(1) DEFAULT '1';

-- Comentário explicativo
COMMENT ON COLUMN db_manaus.dadosempresa.crt IS 'Código de Regime Tributário: 1=Simples Nacional, 2=Simples Nacional excesso sublimite, 3=Regime Normal. Deve corresponder ao cadastro na SEFAZ.';

-- Atualizar empresas existentes com valor padrão (Simples Nacional)
UPDATE db_manaus.dadosempresa 
SET crt = '1' 
WHERE crt IS NULL;

-- Verificar resultado
SELECT cgc, nomecontribuinte, inscricaoestadual, crt 
FROM db_manaus.dadosempresa 
LIMIT 5;
