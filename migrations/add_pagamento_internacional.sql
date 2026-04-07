-- Migration: Adicionar suporte para pagamentos internacionais
-- Data: 2025-11-25
-- Descrição: Adiciona colunas para pagamentos em moeda estrangeira nas tabelas dbpgto e dbfpgto

-- ==========================================
-- 1. Adicionar colunas na tabela dbpgto
-- ==========================================

-- Flag para identificar se é pagamento internacional
ALTER TABLE db_manaus.dbpgto 
ADD COLUMN IF NOT EXISTS eh_internacional CHAR(1) DEFAULT 'N';

COMMENT ON COLUMN db_manaus.dbpgto.eh_internacional IS 'S = Pagamento Internacional, N = Nacional';

-- Moeda estrangeira (ISO 4217: EUR, USD, GBP, etc)
ALTER TABLE db_manaus.dbpgto 
ADD COLUMN IF NOT EXISTS moeda VARCHAR(3);

COMMENT ON COLUMN db_manaus.dbpgto.moeda IS 'Código da moeda estrangeira (ISO 4217): EUR, USD, GBP, etc';

-- Taxa de conversão (convenção)
ALTER TABLE db_manaus.dbpgto 
ADD COLUMN IF NOT EXISTS taxa_conversao NUMERIC(10, 4);

COMMENT ON COLUMN db_manaus.dbpgto.taxa_conversao IS 'Taxa de câmbio usada na conversão (ex: 6.3000 para EUR)';

-- Valor na moeda estrangeira
ALTER TABLE db_manaus.dbpgto 
ADD COLUMN IF NOT EXISTS valor_moeda NUMERIC(15, 2);

COMMENT ON COLUMN db_manaus.dbpgto.valor_moeda IS 'Valor original na moeda estrangeira (ex: 30000.00 EUR)';

-- Número da Invoice (substituir NF para internacional)
ALTER TABLE db_manaus.dbpgto 
ADD COLUMN IF NOT EXISTS nro_invoice VARCHAR(30);

COMMENT ON COLUMN db_manaus.dbpgto.nro_invoice IS 'Número da Invoice para pagamentos internacionais';

-- Número do Contrato Internacional
ALTER TABLE db_manaus.dbpgto 
ADD COLUMN IF NOT EXISTS nro_contrato VARCHAR(30);

COMMENT ON COLUMN db_manaus.dbpgto.nro_contrato IS 'Número do contrato internacional';


-- ==========================================
-- 2. Adicionar colunas na tabela dbfpgto (histórico de pagamentos)
-- ==========================================

-- Flag para identificar se é pagamento internacional
ALTER TABLE db_manaus.dbfpgto 
ADD COLUMN IF NOT EXISTS eh_internacional CHAR(1) DEFAULT 'N';

COMMENT ON COLUMN db_manaus.dbfpgto.eh_internacional IS 'S = Pagamento Internacional, N = Nacional';

-- Moeda estrangeira
ALTER TABLE db_manaus.dbfpgto 
ADD COLUMN IF NOT EXISTS moeda VARCHAR(3);

COMMENT ON COLUMN db_manaus.dbfpgto.moeda IS 'Código da moeda estrangeira (ISO 4217)';

-- Taxa de conversão
ALTER TABLE db_manaus.dbfpgto 
ADD COLUMN IF NOT EXISTS taxa_conversao NUMERIC(10, 4);

COMMENT ON COLUMN db_manaus.dbfpgto.taxa_conversao IS 'Taxa de câmbio usada na conversão';

-- Valor na moeda estrangeira
ALTER TABLE db_manaus.dbfpgto 
ADD COLUMN IF NOT EXISTS valor_moeda NUMERIC(15, 2);

COMMENT ON COLUMN db_manaus.dbfpgto.valor_moeda IS 'Valor pago na moeda estrangeira';

-- Número da Invoice
ALTER TABLE db_manaus.dbfpgto 
ADD COLUMN IF NOT EXISTS nro_invoice VARCHAR(30);

COMMENT ON COLUMN db_manaus.dbfpgto.nro_invoice IS 'Número da Invoice para pagamentos internacionais';

-- Número do Contrato
ALTER TABLE db_manaus.dbfpgto 
ADD COLUMN IF NOT EXISTS nro_contrato VARCHAR(30);

COMMENT ON COLUMN db_manaus.dbfpgto.nro_contrato IS 'Número do contrato internacional';


-- ==========================================
-- 3. Criar índices para otimização
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_dbpgto_eh_internacional 
ON db_manaus.dbpgto(eh_internacional);

CREATE INDEX IF NOT EXISTS idx_dbpgto_moeda 
ON db_manaus.dbpgto(moeda) 
WHERE moeda IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dbfpgto_eh_internacional 
ON db_manaus.dbfpgto(eh_internacional);


-- ==========================================
-- 4. Validações (constraints)
-- ==========================================

-- Garantir que eh_internacional é 'S' ou 'N'
ALTER TABLE db_manaus.dbpgto 
ADD CONSTRAINT chk_dbpgto_eh_internacional 
CHECK (eh_internacional IN ('S', 'N'));

ALTER TABLE db_manaus.dbfpgto 
ADD CONSTRAINT chk_dbfpgto_eh_internacional 
CHECK (eh_internacional IN ('S', 'N'));

-- Se eh_internacional = 'S', então moeda, taxa_conversao e valor_moeda devem estar preenchidos
-- (Essa validação será feita no código da aplicação para maior flexibilidade)


-- ==========================================
-- 5. Atualizar registros existentes
-- ==========================================

-- Marcar todos os registros existentes como nacionais
UPDATE db_manaus.dbpgto 
SET eh_internacional = 'N' 
WHERE eh_internacional IS NULL;

UPDATE db_manaus.dbfpgto 
SET eh_internacional = 'N' 
WHERE eh_internacional IS NULL;


COMMIT;

-- ==========================================
-- Verificação
-- ==========================================
SELECT 'Migration concluída com sucesso!' as status;
