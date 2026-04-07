# 🎫 INTEGRAÇÃO ASAAS - GUIA RÁPIDO

## ✅ Arquivos Criados

1. **`src/lib/asaas.ts`** - Cliente da API Asaas
2. **`src/pages/api/boleto/gerar.ts`** - API para gerar boletos
3. **`src/components/boleto/GerarBoletoButton.tsx`** - Componente React
4. **`scripts/adicionar-campos-boleto.sql`** - Script SQL
5. **`README-BOLETO-ASAAS.md`** - Documentação completa

## 🚀 PASSO A PASSO PARA COMEÇAR

### 1️⃣ Criar Conta no Asaas (5 minutos)

1. Acesse: https://www.asaas.com
2. Clique em "Criar conta grátis"
3. Preencha os dados da empresa
4. Confirme o email

### 2️⃣ Pegar a API Key (2 minutos)

1. Faça login no Asaas
2. Menu lateral > **Configurações** > **Integrações** > **API**
3. **IMPORTANTE**: Use o ambiente **Sandbox** para testes
4. Copie a **API Key** (começa com `$aact_...`)

### 3️⃣ Configurar o Projeto (3 minutos)

**Adicione no arquivo `.env.local`:**

```env
# ASAAS - Boletos
ASAAS_API_KEY=$aact_SUA_API_KEY_AQUI
ASAAS_ENVIRONMENT=sandbox
```

**Execute o script SQL no banco:**

```bash
psql $env:DATABASE_URL -f scripts/adicionar-campos-boleto.sql
```

**Reinicie o servidor:**

```bash
yarn dev
```

### 4️⃣ Testar (2 minutos)

**Teste via curl ou Postman:**

```bash
curl -X POST http://localhost:3000/api/boleto/gerar \
  -H "Content-Type: application/json" \
  -d '{
    "codfat": "000002828",
    "valor": 100.00,
    "vencimento": "2025-02-15",
    "descricao": "Teste de boleto"
  }'
```

**OU use o componente React:**

```tsx
import { GerarBoletoButton } from '@/components/boleto/GerarBoletoButton';

// Na sua página de faturamento:
<GerarBoletoButton
  codfat="000002828"
  valor={1500.00}
  vencimento="2025-02-15"
  onSucesso={(boleto) => {
    console.log('Boleto gerado!', boleto);
  }}
/>
```

## 💡 DICAS IMPORTANTES

### ✅ Ambiente Sandbox (Testes)
- **NÃO cobra dinheiro real**
- Boletos de teste ilimitados
- Não funciona em caixas eletrônicos
- Perfeito para desenvolvimento

### ⚠️ Ambiente Produção
- **Cobra taxa por boleto pago**: R$ 0,99 a R$ 1,99
- Boletos reais que funcionam em bancos
- Só mude quando estiver tudo testado
- Troque: `ASAAS_ENVIRONMENT=production`

### 🔐 Segurança
- **NUNCA** commite a API Key no Git
- Use `.env.local` (já está no `.gitignore`)
- API Key diferente para Sandbox e Produção

## 📊 CUSTOS

| Item | Valor |
|------|-------|
| **Mensalidade** | R$ 0,00 (Grátis!) |
| **Boleto gerado** | R$ 0,00 |
| **Boleto PAGO** | R$ 0,99 a R$ 1,99 |
| **Taxa de saque** | R$ 0,00 (acima de R$ 100) |

**Ou seja:** Só paga se o cliente pagar! 💰

## 🎯 PRÓXIMOS PASSOS

1. **Integre no Frontend**
   - Adicione botão "Gerar Boleto" na tela de faturas
   - Use o componente `GerarBoletoButton`

2. **Configure Webhook** (opcional)
   - Receba notificação automática quando cliente pagar
   - Atualize status da fatura automaticamente

3. **Adicione PIX** (próxima feature)
   - Asaas também gera PIX
   - Taxa: R$ 0,99 por transação
   - Pagamento instantâneo

## 📚 DOCUMENTAÇÃO

- **README Completo**: `README-BOLETO-ASAAS.md`
- **Docs Asaas**: https://docs.asaas.com
- **Painel Sandbox**: https://sandbox.asaas.com

## ❓ DÚVIDAS COMUNS

**P: Quanto tempo leva para receber o dinheiro?**
R: Depois que o cliente paga, o dinheiro cai em 1 dia útil (D+1).

**P: Posso personalizar o boleto?**
R: Sim! No painel do Asaas você adiciona logo, dados bancários, etc.

**P: Tem limite de boletos?**
R: Não! Gere quantos quiser.

**P: Funciona com PIX?**
R: Sim! Mesma API, só muda o `billingType` para `PIX`.

**P: E se o cliente não pagar?**
R: Você não paga nada. Taxa só é cobrada em boletos pagos.

## 🐛 TROUBLESHOOTING

**Erro: "ASAAS_API_KEY não configurada"**
- Verifique o `.env.local`
- Reinicie o servidor (`yarn dev`)

**Erro: "Cliente não encontrado"**
- Verifique se o `codfat` existe
- Verifique se tem cliente vinculado (`codcli`)

**Boleto não abre**
- Verifique se está em `sandbox`
- API Key deve ser do ambiente correto

---

## ✅ CHECKLIST

- [ ] Criar conta no Asaas
- [ ] Pegar API Key (Sandbox)
- [ ] Adicionar no `.env.local`
- [ ] Executar script SQL
- [ ] Reiniciar servidor
- [ ] Testar geração de boleto
- [ ] Integrar no frontend
- [ ] (Opcional) Configurar webhook
- [ ] Migrar para produção quando pronto

---

**Está tudo pronto para gerar boletos! 🎉**

Qualquer dúvida, consulte: `README-BOLETO-ASAAS.md`
