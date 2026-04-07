# 📧 Configuração SMTP - Sistema de Faturamento

## 🎯 O que foi implementado:

A tela de configuração SMTP agora está **100% funcional** com banco de dados PostgreSQL. Todas as configurações são salvas no banco e carregadas automaticamente ao enviar emails.

---

## 📋 Arquivos Criados/Modificados:

### 1. **Migration do Banco de Dados**
**Arquivo:** `prisma/migrations/20260105000000_create_smtp_config/migration.sql`
- Criada tabela `smtp_config` para armazenar configurações SMTP
- Senhas criptografadas com AES-256-CBC
- Suporte a múltiplas configurações (apenas uma ativa por vez)

### 2. **API Backend**
**Arquivo:** `src/pages/api/smtp/config.ts`
- **GET**: Busca configuração ativa
- **POST**: Cria nova configuração
- **PUT**: Atualiza configuração existente
- **DELETE**: Remove configuração

### 3. **Helper de Configuração**
**Arquivo:** `src/lib/smtpConfig.ts`
- `getActiveSmtpConfig()`: Busca config do banco
- `getSmtpConfigWithFallback()`: Busca do banco ou fallback para .env

### 4. **Frontend Atualizado**
**Arquivo:** `src/components/corpo/admin/smtp/index.tsx`
- Carrega configuração existente automaticamente
- Botão "Salvar Configuração" persiste no banco
- Indicador visual quando configurado
- Campos controlados com estado React

### 5. **Serviço de Email Atualizado**
**Arquivo:** `src/lib/nfeEmailService.ts`
- Usa configuração do banco ao invés de variáveis de ambiente
- Cria transporter dinâmico a cada envio

---

## 🚀 Como Usar:

### **1. Rodar a Migration**

```bash
# No terminal do projeto
cd c:\Users\lucas\Sistema-Melo\site-melo

# Aplicar migration
npx prisma migrate dev --name create_smtp_config
```

Ou execute manualmente o SQL no DBeaver:

```sql
-- Arquivo: prisma/migrations/20260105000000_create_smtp_config/migration.sql
CREATE TABLE IF NOT EXISTS smtp_config (
    id SERIAL PRIMARY KEY,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 587,
    secure BOOLEAN NOT NULL DEFAULT false,
    username VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255) NOT NULL DEFAULT 'Sistema NFe',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_smtp_config_ativo ON smtp_config(ativo);
```

### **2. Configurar no Sistema**

1. Acesse a tela de configuração SMTP no menu Admin
2. Preencha os campos:
   - **Servidor SMTP**: `smtp.gmail.com` (para Gmail)
   - **Porta**: `587` (TLS) ou `465` (SSL)
   - **Email de usuário**: Seu email completo
   - **Senha de App**: Senha de 16 caracteres do Gmail (gere em: https://myaccount.google.com/apppasswords)
   - **Email remetente**: Email que aparecerá no "De:"
   - **Nome do remetente**: Nome da empresa/sistema
3. Marque "Conexão segura" apenas para porta **465**
4. Clique em **"💾 Salvar Configuração"**
5. Clique em **"🧪 Testar Configuração"** para verificar

### **3. Verificar no Banco**

```sql
-- Ver configurações salvas
SELECT id, host, port, secure, username, from_email, from_name, ativo, created_at 
FROM smtp_config 
ORDER BY updated_at DESC;

-- Ver configuração ativa
SELECT * FROM smtp_config WHERE ativo = true;
```

---

## 🔐 Segurança:

### **Criptografia de Senhas**

As senhas SMTP são criptografadas usando **AES-256-CBC** antes de serem salvas no banco.

**Chave de Criptografia (IMPORTANTE):**

No arquivo `.env`, adicione:

```env
# Chave de 32 caracteres para criptografia SMTP
SMTP_ENCRYPTION_KEY=sua-chave-secreta-de-32-chars!!
```

⚠️ **ATENÇÃO:** 
- Nunca commite a chave no Git
- Use uma chave única e segura para produção
- Se perder a chave, as senhas não poderão ser descriptografadas

---

## 🎨 Funcionalidades da Tela:

✅ **Carregamento automático** da configuração existente  
✅ **Salvamento** no banco de dados PostgreSQL  
✅ **Teste de conexão** SMTP antes de usar  
✅ **Indicador visual** de status (configurado/não configurado)  
✅ **Criptografia** automática de senhas  
✅ **Fallback** para variáveis de ambiente se banco estiver vazio  
✅ **Suporte** a Gmail, Outlook, Yahoo e outros provedores  
✅ **Dicas de configuração** inline para cada provedor  

---

## 📊 Fluxo de Envio de Email:

```
1. Sistema precisa enviar NFe por email
2. nfeEmailService.ts chama getSmtpConfigWithFallback()
3. smtpConfig.ts busca configuração ativa no banco
4. Senha é descriptografada
5. Transporter Nodemailer é criado dinamicamente
6. Email é enviado usando configuração do banco
```

---

## 🔧 Providers Suportados:

### **Gmail**
- Host: `smtp.gmail.com`
- Porta: `587` (TLS)
- Secure: `false`
- Senha: Gere uma "Senha de app" em https://myaccount.google.com/apppasswords

### **Outlook/Hotmail**
- Host: `smtp.office365.com`
- Porta: `587` (TLS)
- Secure: `false`

### **Yahoo**
- Host: `smtp.mail.yahoo.com`
- Porta: `587` (TLS)
- Secure: `false`

### **Outros (SMTP genérico)**
- Porta 587: TLS → Secure = `false`
- Porta 465: SSL → Secure = `true`

---

## 🐛 Troubleshooting:

### **Erro: "Senha incorreta" ou "Autenticação falhou"**
- Verifique se está usando "Senha de app" e não a senha da conta
- Gmail requer senha de app gerada em: https://myaccount.google.com/apppasswords

### **Erro: "Connection timeout"**
- Verifique se a porta está correta (587 ou 465)
- Verifique se o firewall não está bloqueando

### **Erro: "self signed certificate"**
- Ajuste `tls.rejectUnauthorized` para `false` (já configurado)

### **Configuração não carrega ao abrir a tela**
- Verifique se a migration foi executada
- Verifique se há registros na tabela `smtp_config`
- Veja o console do navegador (F12) para erros

### **Email não envia após salvar**
- Clique em "Testar Configuração" primeiro
- Verifique os logs do servidor (console do terminal Next.js)
- Confirme que a configuração está marcada como `ativo = true`

---

## 📝 Variáveis de Ambiente (Fallback):

Se o banco estiver vazio, o sistema usa as variáveis de ambiente:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app-16-caracteres
EMAIL_FROM=nfe@empresa.com
EMAIL_FROM_NAME=Empresa - NFe
SMTP_ENCRYPTION_KEY=sua-chave-secreta-de-32-chars!!
```

---

## ✅ Checklist de Implementação:

- [x] Tabela `smtp_config` criada
- [x] API CRUD completa (`/api/smtp/config`)
- [x] Criptografia AES-256 para senhas
- [x] Frontend carrega configuração do banco
- [x] Frontend salva configuração no banco
- [x] Serviço de email usa configuração do banco
- [x] Fallback para variáveis de ambiente
- [x] Teste de conexão SMTP funcional
- [x] Indicadores visuais de status
- [x] Dicas de configuração por provedor
- [x] Documentação completa

---

## 🎉 Resultado Final:

Agora você tem uma **configuração SMTP 100% funcional** que:
- ✅ Persiste no banco de dados
- ✅ Não depende mais de variáveis de ambiente hardcoded
- ✅ Pode ser alterada pelo usuário via interface
- ✅ É segura (senhas criptografadas)
- ✅ Tem fallback para .env se necessário
- ✅ Funciona com Gmail, Outlook, Yahoo e outros

**Nenhum mock restante - tudo real!** 🚀
