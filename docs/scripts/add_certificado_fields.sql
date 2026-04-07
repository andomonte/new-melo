-- Migração: Adicionar campos de certificado à tabela dadosempresa
-- Data: 22/09/2025
-- Descrição: Adiciona campos para armazenar dados do certificado digital

-- Primeiro, garantir que o campo cgc não tenha valores nulos
-- (Isso pode falhar se houver registros com cgc NULL)
UPDATE dadosempresa SET cgc = '' WHERE cgc IS NULL;

-- Alterar cgc para NOT NULL e adicionar como chave primária
ALTER TABLE dadosempresa
ALTER COLUMN cgc SET NOT NULL;

-- Adicionar constraint de chave primária no campo cgc
-- (Isso pode falhar se houver valores duplicados)
ALTER TABLE dadosempresa
ADD CONSTRAINT dadosempresa_pkey PRIMARY KEY (cgc);

-- Adicionar campos para certificado digital
ALTER TABLE dadosempresa
ADD COLUMN "certificadoKey" TEXT;

ALTER TABLE dadosempresa
ADD COLUMN "certificadoCrt" TEXT;

ALTER TABLE dadosempresa
ADD COLUMN "cadeiaCrt" TEXT;

-- Comentários nos campos para documentação
COMMENT ON COLUMN dadosempresa."certificadoKey" IS 'Chave privada do certificado digital (criptografada)';
COMMENT ON COLUMN dadosempresa."certificadoCrt" IS 'Certificado digital principal (criptografado)';
COMMENT ON COLUMN dadosempresa."cadeiaCrt" IS 'Cadeia de certificação (criptografada)';