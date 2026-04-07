-- ================================================================
-- CONFIGURAÇÃO CSC PARA NFC-e (Cupom Fiscal Eletrônico)
-- ================================================================
-- CSC (Código de Segurança do Contribuinte) é obrigatório para NFC-e
-- Obtido no portal: https://sistemas.sefaz.am.gov.br/nfce/contribuinte
-- ================================================================

-- 1️⃣ Adicionar colunas na tabela dadosempresa (se não existirem)
ALTER TABLE db_manaus.dadosempresa 
ADD COLUMN IF NOT EXISTS csc_nfce_id VARCHAR(10),
ADD COLUMN IF NOT EXISTS csc_nfce_homologacao TEXT,
ADD COLUMN IF NOT EXISTS csc_nfce_producao TEXT;

-- 2️⃣ Comentários nas colunas
COMMENT ON COLUMN db_manaus.dadosempresa.csc_nfce_id IS 'ID do Token CSC da NFC-e (ex: 000001)';
COMMENT ON COLUMN db_manaus.dadosempresa.csc_nfce_homologacao IS 'CSC da NFC-e Homologação (criptografado)';
COMMENT ON COLUMN db_manaus.dadosempresa.csc_nfce_producao IS 'CSC da NFC-e Produção (criptografado)';

-- 3️⃣ Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'db_manaus' 
  AND table_name = 'dadosempresa' 
  AND column_name LIKE '%csc%';

-- 4️⃣ INSERIR CSC - Execute este comando no sistema (NÃO no banco diretamente)
-- O sistema usa criptografia AES-256-CBC própria, então o CSC deve ser inserido via código Node.js

-- COMANDO PARA EXECUTAR NO TERMINAL (dentro da pasta do projeto):
-- node -e "
--   const { encrypt } = require('./src/utils/crypto.ts');
--   const { getPgPool } = require('./src/lib/pg.ts');
--   
--   (async () => {
--     const cscCriptografado = await encrypt('074b1eae0862fd5a');
--     const pool = getPgPool();
--     const client = await pool.connect();
--     
--     await client.query(`
--       UPDATE db_manaus.dadosempresa 
--       SET csc_nfce_id = $1, csc_nfce_homologacao = $2
--       WHERE codigoemp = '1'
--     `, ['000001', cscCriptografado]);
--     
--     console.log('✅ CSC inserido com sucesso!');
--     client.release();
--     process.exit(0);
--   })();
-- "

-- OU APENAS CRIE AS COLUNAS AQUI E INSIRA O CSC VIA INTERFACE WEB (RECOMENDADO)

-- 5️⃣ Verificar se foi inserido (após executar o UPDATE)
/*
SELECT 
  csc_nfce_id,
  CASE 
    WHEN csc_nfce_homologacao IS NOT NULL THEN 'CSC Homologação: ✅ Configurado'
    ELSE 'CSC Homologação: ❌ Não configurado'
  END as status_homologacao,
  CASE 
    WHEN csc_nfce_producao IS NOT NULL THEN 'CSC Produção: ✅ Configurado'
    ELSE 'CSC Produção: ❌ Não configurado'
  END as status_producao
FROM db_manaus.dadosempresa;
*/

SELECT '✅ Colunas CSC criadas! Agora descomente e execute o UPDATE com sua chave de criptografia.' as status;
