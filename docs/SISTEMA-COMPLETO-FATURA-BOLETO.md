# 🎯 SISTEMA COMPLETO: Fatura → Boleto → Email

## Fluxo Automático Implementado

```
1. Cliente faz pedido
   ↓
2. Sistema cria fatura (dbfatura)
   ↓
3. Gera boleto automaticamente (Asaas)
   ↓
4. Envia email com boleto em PDF
   ↓
5. Cliente recebe e paga
```

---

## 🚀 Como Funciona

### Opção 1: **Automático** (Recomendado)

Quando você criar uma fatura/cobrança, chame esta API:

**POST** `/api/cobranca/criar-com-boleto`

```json
{
  "codfat": "000002828",
  "valor": 1500.00,
  "vencimento": "2025-02-15",
  "gerarBoleto": true,
  "enviarEmail": true
}
```

**O sistema faz TUDO sozinho:**
- ✅ Gera boleto no Asaas
- ✅ Salva dados na tabela `dbfatura`
- ✅ Baixa PDF do boleto
- ✅ Envia email formatado para o cliente
- ✅ Anexa o PDF no email

---

### Opção 2: **Manual** (Quando precisar)

Se quiser apenas gerar boleto SEM enviar email:

**POST** `/api/boleto/gerar`

```json
{
  "codfat": "000002828",
  "valor": 1500.00,
  "vencimento": "2025-02-15"
}
```

---

## ⚙️ Configuração

### 1. Configure o Asaas

No `.env.local`:

```env
ASAAS_API_KEY=$aact_sua_key_aqui
ASAAS_ENVIRONMENT=sandbox
```

### 2. Configure o Email

**Opção A: Gmail** (Mais fácil)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seuemail@gmail.com
SMTP_PASS=senha_de_app_do_gmail
SMTP_FROM="Minha Empresa <seuemail@gmail.com>"
```

**Como pegar senha de app do Gmail:**
1. https://myaccount.google.com/security
2. Ative "Verificação em duas etapas"
3. https://myaccount.google.com/apppasswords
4. Crie senha para "E-mail"
5. Use essa senha

**Opção B: Outlook/Hotmail**

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seuemail@outlook.com
SMTP_PASS=sua_senha
SMTP_FROM="Minha Empresa <seuemail@outlook.com>"
```

**Opção C: Servidor Próprio**

```env
SMTP_HOST=mail.seudominio.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@seudominio.com
SMTP_PASS=sua_senha
SMTP_FROM="Minha Empresa <noreply@seudominio.com>"
```

### 3. Execute o SQL

```bash
psql $env:DATABASE_URL -f scripts/adicionar-campos-boleto.sql
```

### 4. Instale dependências

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

---

## 📧 Email que o Cliente Recebe

```
┌─────────────────────────────────────┐
│    💰 Boleto de Cobrança           │
├─────────────────────────────────────┤
│                                     │
│  Olá João da Silva,                 │
│                                     │
│  Enviamos o boleto referente à      │
│  Fatura #2828.                      │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ Valor: R$ 1.500,00           │  │
│  │ Vencimento: 15/02/2025       │  │
│  │ Status: Aguardando Pagamento │  │
│  └──────────────────────────────┘  │
│                                     │
│  Linha Digitável:                   │
│  34191.79001 01043.510047...        │
│                                     │
│  [📄 Baixar Boleto PDF]             │
│                                     │
│  ⚠️ Importante:                      │
│  • Pode pagar em qualquer banco     │
│  • Confirmação em até 2 dias        │
│                                     │
└─────────────────────────────────────┘

📎 Anexo: boleto-2828.pdf
```

---

## 💻 Integração no Frontend

### Exemplo 1: Ao Criar Fatura

```typescript
// Quando o usuário criar uma nova fatura
async function criarFaturaComBoleto(dados) {
  try {
    // 1. Criar fatura no banco (seu código existente)
    const fatura = await criarFatura(dados);
    
    // 2. Gerar boleto e enviar email automaticamente
    const response = await axios.post('/api/cobranca/criar-com-boleto', {
      codfat: fatura.codfat,
      valor: fatura.valor,
      vencimento: fatura.vencimento,
      gerarBoleto: true,
      enviarEmail: true,
    });
    
    if (response.data.sucesso) {
      alert('Fatura criada e boleto enviado por email!');
      console.log('Boleto:', response.data.boleto);
    }
  } catch (error) {
    console.error('Erro:', error);
  }
}
```

### Exemplo 2: Reenviar Boleto

```typescript
// Botão para reenviar boleto de uma fatura existente
async function reenviarBoleto(codfat) {
  try {
    const response = await axios.post('/api/cobranca/criar-com-boleto', {
      codfat,
      gerarBoleto: false, // Não gera novo (usa o existente)
      enviarEmail: true,  // Só reenvia o email
    });
    
    alert('Boleto reenviado por email!');
  } catch (error) {
    alert('Erro ao reenviar boleto');
  }
}
```

---

## 🧪 Testar

### 1. Teste Completo (Boleto + Email)

```bash
curl -X POST http://localhost:3000/api/cobranca/criar-com-boleto \
  -H "Content-Type: application/json" \
  -d '{
    "codfat": "000002828",
    "valor": 150.00,
    "vencimento": "2025-02-15",
    "gerarBoleto": true,
    "enviarEmail": true
  }'
```

### 2. Teste Só Boleto (Sem Email)

```bash
curl -X POST http://localhost:3000/api/cobranca/criar-com-boleto \
  -H "Content-Type: application/json" \
  -d '{
    "codfat": "000002828",
    "valor": 150.00,
    "vencimento": "2025-02-15",
    "gerarBoleto": true,
    "enviarEmail": false
  }'
```

---

## ✅ Checklist de Configuração

- [ ] Configurar `ASAAS_API_KEY` no `.env.local`
- [ ] Configurar `SMTP_*` no `.env.local`
- [ ] Executar `scripts/adicionar-campos-boleto.sql`
- [ ] Instalar `nodemailer`
- [ ] Reiniciar servidor (`yarn dev`)
- [ ] Testar geração de boleto
- [ ] Testar envio de email
- [ ] Verificar se email chegou (checar spam)
- [ ] Validar PDF do boleto

---

## 🐛 Troubleshooting

### Email não chega

**1. Verifique SPAM**
- Cheque a pasta de spam/lixo eletrônico

**2. Gmail bloqueou?**
- Acesse: https://myaccount.google.com/lesssecureapps
- Ou use "Senha de app" (recomendado)

**3. Veja os logs**
- `console.log` mostra se email foi enviado
- Verifique erros no terminal

### Boleto não gera

**1. API Key inválida**
- Verifique se copiou certa
- Sandbox vs Produção

**2. Cliente sem email**
- Tabela `dbclien` deve ter email válido

**3. Fatura não existe**
- Verifique se `codfat` está correto

---

## 💡 Dicas

### 1. Personalizar Email

Edite o arquivo: `src/pages/api/cobranca/criar-com-boleto.ts`

Procure por `htmlEmail` e modifique o HTML.

### 2. Adicionar Logo

No HTML do email, adicione:

```html
<img src="https://seusite.com/logo.png" alt="Logo" style="width: 150px;">
```

### 3. Múltiplos Emails

Para enviar cópia para você:

```typescript
cc: 'financeiro@empresa.com',
bcc: 'backup@empresa.com',
```

---

## 📊 Campos no Banco

Após executar o SQL, a tabela `dbfatura` terá:

```sql
asaas_cobranca_id    -- ID do boleto no Asaas
asaas_cliente_id     -- ID do cliente no Asaas
linha_digitavel      -- Linha digitável do boleto
codigo_barras        -- Código de barras
url_boleto           -- Link do PDF
status_boleto        -- PENDING, CONFIRMED, etc
```

---

## 🎯 Próximos Passos

1. **Webhook do Asaas** (próxima feature)
   - Receber notificação automática quando cliente pagar
   - Atualizar status da fatura automaticamente

2. **Relatórios**
   - Ver todos os boletos gerados
   - Filtrar por status (pago, pendente, vencido)

3. **Lembretes Automáticos**
   - Enviar email 3 dias antes do vencimento
   - Enviar email se vencer e não pagar

---

**Está tudo pronto para criar faturas com boleto e envio automático de email! 🚀**
