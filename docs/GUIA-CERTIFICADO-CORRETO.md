# 🔐 GUIA: CORREÇÃO DEFINITIVA DOS CERTIFICADOS PARA NFC-E

## 📋 DIAGNÓSTICO ATUAL

Os certificados no banco estão **corrompidos**:

- ✅ Formato PEM correto (headers `-----BEGIN-----`)
- ❌ Conteúdo base64 inválido
- ❌ Erro ASN.1 ao tentar usar

## 🛠️ SOLUÇÃO DEFINITIVA

### 📁 PASSO 1: Obter Arquivo .PFX Original

Você precisa do arquivo **.pfx** original do seu certificado ICP-Brasil.

**Onde encontrar:**

1. Pasta de downloads do navegador
2. Email da autoridade certificadora
3. Sistema onde foi instalado o certificado
4. Windows Certificate Store (exportar)

### 🔑 PASSO 2: Extrair Certificado com OpenSSL

**Comandos para Windows:**

```bash
# 1. Instalar OpenSSL (se não tiver):
# Baixar: https://slproweb.com/products/Win32OpenSSL.html

# 2. Extrair certificado (substitua SENHA pela senha do .pfx):
openssl pkcs12 -in "C:\caminho\certificado.pfx" -clcerts -nokeys -out certificado.pem -password pass:SENHA

# 3. Extrair chave privada:
openssl pkcs12 -in "C:\caminho\certificado.pfx" -nocerts -out chave_privada.pem -password pass:SENHA

# 4. Remover senha da chave privada (opcional, mas recomendado):
openssl rsa -in chave_privada.pem -out chave_privada_sem_senha.pem

# 5. Extrair cadeia de certificação (se necessário):
openssl pkcs12 -in "C:\caminho\certificado.pfx" -cacerts -nokeys -out cadeia.pem -password pass:SENHA
```

### 📊 PASSO 3: Verificar se Está Correto

```bash
# Verificar certificado:
openssl x509 -in certificado.pem -text -noout

# Verificar chave privada:
openssl rsa -in chave_privada.pem -check

# Verificar se combinam:
openssl x509 -noout -modulus -in certificado.pem | openssl md5
openssl rsa -noout -modulus -in chave_privada.pem | openssl md5
```

### 💾 PASSO 4: Importar no Banco Corretamente

```javascript
// Script Node.js para importar:
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

async function importarCertificadoCorreto() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Ler arquivos extraídos
    const certificado = fs.readFileSync('certificado.pem', 'utf8');
    const chavePrivada = fs.readFileSync('chave_privada_sem_senha.pem', 'utf8');
    const cadeia = fs.readFileSync('cadeia.pem', 'utf8');

    // Atualizar banco
    await client.query(`
      UPDATE db_manaus.dadosempresa
      SET
        "certificadoCrt" = $1,
        "certificadoKey" = $2,
        "cadeiaCrt" = $3
      WHERE cgc = '18053139000169 '
    `, [certificado, chavePrivada, cadeia]);

    console.log('✅ Certificado importado com sucesso!');

  } finally {
    client.release();
    pool.end();
  }
}

importarCertificadoCorreto();
```

### 🧪 PASSO 5: Testar NFC-E

```bash
# Testar conexão:
node scripts/testar-certificado-sefaz.js

# Emitir NFC-e de teste:
node scripts/emitir-nfce-completa.js 12345
```

## ⚠️ IMPORTANTE

1. **Nunca perca o arquivo .pfx** - é a única fonte confiável
2. **Guarde a senha** - você precisará sempre
3. **Faça backup** - dos arquivos extraídos e do .pfx
4. **Teste primeiro** - na homologação antes de produção

## 🎯 RESULTADO ESPERADO

Após seguir estes passos:

- ✅ Certificado válido no Node.js
- ✅ Conexão HTTPS com SEFAZ-AM
- ✅ NFC-e autorizada com sucesso
- ✅ Sistema pronto para produção

---

**Precisa de ajuda com algum passo específico?**