# 🚀 Deploy Next.js para Railway

Este guia mostra como fazer o deploy da aplicação Next.js na Railway.

## 📋 Pré-requisitos

1. Conta na [Railway](https://railway.app/)
2. Banco de dados PostgreSQL (pode ser criado na própria Railway)
3. Variáveis de ambiente configuradas

## 🔧 Configuração

### 1. Criar Projeto na Railway

```bash
# Via CLI (opcional)
npm i -g @railway/cli
railway login
railway init
```

Ou pela interface web:
1. Acesse [railway.app](https://railway.app/)
2. Conecte sua conta GitHub
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo"
5. Escolha o repositório `melo_deploy`

### 2. Adicionar Banco de Dados PostgreSQL

Na Railway:
1. Clique em "New" → "Database" → "Add PostgreSQL"
2. Copie a `DATABASE_URL` gerada
3. Cole nas variáveis de ambiente do serviço Next.js

### 3. Configurar Variáveis de Ambiente

No dashboard da Railway, adicione as seguintes variáveis:

#### 🔐 Banco de Dados
```bash
DATABASE_URL=postgresql://user:password@host:port/database
DATABASE_URL2=oracle://user:password@host:port/sid  # Se usar Oracle
```

#### 🌐 URLs da Aplicação
```bash
NEXTAUTH_URL=${{RAILWAY_PUBLIC_DOMAIN}}  # URL pública do Railway
NEXT_PUBLIC_BASE_URL=${{RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_REST_API_ENDPOINT=${{RAILWAY_PUBLIC_DOMAIN}}/api
NEXT_PUBLIC_SHOP_URL=${{RAILWAY_PUBLIC_DOMAIN}}
```

#### 📧 Email (NFe)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
EMAIL_FROM=nfe@suaempresa.com
EMAIL_FROM_NAME=Sua Empresa - NFe
```

#### ⚙️ Outras
```bash
APPLICATION_MODE=production
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
```

### 4. Deploy Automático

A Railway detectará o `Dockerfile` e fará o build automaticamente:

```bash
git add .
git commit -m "feat: configuração para Railway"
git push origin main
```

### 5. Executar Migrations do Prisma

Após o primeiro deploy, execute as migrations:

1. No dashboard da Railway, abra o terminal do serviço
2. Execute:
```bash
npx prisma migrate deploy
npx prisma generate
```

Ou configure um script de deploy:

```json
// package.json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

## 🎯 Verificação do Deploy

1. **Health Check**: Acesse `https://seu-app.railway.app/api/health`
2. **Logs**: Monitore no dashboard Railway
3. **Domínio**: Configure domínio customizado se necessário

## 🔄 CI/CD

A Railway oferece deploy automático:
- ✅ Push na branch `main` → Deploy automático
- ✅ Pull Request → Preview deploy
- ✅ Rollback com 1 clique

## 📊 Monitoramento

No dashboard da Railway você pode ver:
- 📈 Uso de CPU e memória
- 📝 Logs em tempo real
- 🔄 Status do deploy
- 💰 Custos

## 🐛 Troubleshooting

### Build falha
```bash
# Verificar logs de build na Railway
railway logs --deployment
```

### Erro de conexão com banco
- Verifique se `DATABASE_URL` está correta
- Confirme que o PostgreSQL está rodando
- Teste conexão local primeiro

### Erro no Prisma
```bash
# Regenerar Prisma Client
railway run npx prisma generate
railway run npx prisma migrate deploy
```

### Timeout no deploy
- Aumente recursos no plano da Railway
- Otimize dependências no `package.json`
- Use cache do Docker

## 💡 Dicas

1. **Use variáveis do Railway**: `${{RAILWAY_PUBLIC_DOMAIN}}` para URLs dinâmicas
2. **Configure alertas**: Monitore downtime e erros
3. **Backup do banco**: Configure backups automáticos
4. **Staging environment**: Crie ambiente de teste separado
5. **Secrets**: Nunca commite `.env` no git

## 📚 Recursos

- [Railway Docs](https://docs.railway.app/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Railway Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-railway)

## ⚡ Deploy Rápido

```bash
# 1. Login
railway login

# 2. Criar projeto
railway init

# 3. Link ao projeto
railway link

# 4. Adicionar PostgreSQL
railway add --database postgres

# 5. Deploy
railway up
```

## 🎉 Pronto!

Sua aplicação estará disponível em: `https://seu-app.railway.app`
