# 🎫 Integração com Asaas - Geração de Boletos

Integração completa para gerar boletos bancários usando a API do Asaas.

## 📋 Pré-requisitos

1. **Conta no Asaas**
   - Crie uma conta gratuita em: https://www.asaas.com
   - Acesse: Menu > Configurações > Integrações > API
   - Copie sua **API Key**

2. **Banco de Dados**
   - Execute o script SQL: `scripts/adicionar-campos-boleto.sql`
   - Isso adiciona os campos necessários na tabela `dbfatura`

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione no seu arquivo `.env.local`:

```env
# Ambiente de testes (Sandbox)
ASAAS_API_KEY=$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwODk4NTA6OiRhYWNoX2Y1YTc5MGQzLTIyNjUtNDc1Yi1hMDNkLWQ3NDI3ZjY2YTQxZg==
ASAAS_ENVIRONMENT=sandbox

# OU para produção
# ASAAS_API_KEY=sua_api_key_de_producao
# ASAAS_ENVIRONMENT=production
```

### 2. Executar Script SQL

```bash
# Conecte ao banco e execute:
psql $DATABASE_URL -f scripts/adicionar-campos-boleto.sql
```

## 🚀 Como Usar

### API Endpoint

**POST** `/api/boleto/gerar`

**Body:**
```json
{
  "codfat": "000002828",
  "valor": 1500.00,
  "vencimento": "2025-01-15",
  "descricao": "Fatura #2828 - Produtos diversos"
}
```

**Resposta de Sucesso (200):**
```json
{
  "sucesso": true,
  "boleto": {
    "cobrancaId": "pay_123456789",
    "clienteId": "cus_123456789",
    "linhaDigitavel": "34191.79001 01043.510047 91020.150008 1 84230000014000",
    "codigoBarras": "34191842300000140001790010104351004910201500",
    "urlBoleto": "https://sandbox.asaas.com/b/pdf/123456789",
    "urlFatura": "https://sandbox.asaas.com/i/123456789",
    "vencimento": "2025-01-15",
    "valor": 1500.00,
    "status": "PENDING"
  }
}
```

### Exemplo de Integração no Frontend

```typescript
// Gerar boleto
const gerarBoleto = async (codfat: string, valor: number) => {
  try {
    const response = await axios.post('/api/boleto/gerar', {
      codfat,
      valor,
      vencimento: '2025-01-15', // YYYY-MM-DD
      descricao: `Fatura #${codfat}`,
    });

    const { boleto } = response.data;
    
    // Exibir linha digitável para o cliente
    alert(`Linha digitável: ${boleto.linhaDigitavel}`);
    
    // Abrir boleto em nova aba
    window.open(boleto.urlBoleto, '_blank');
    
    return boleto;
  } catch (error) {
    console.error('Erro ao gerar boleto:', error);
    throw error;
  }
};
```

## 📊 Status da Cobrança

| Status | Descrição |
|--------|-----------|
| `PENDING` | Aguardando pagamento |
| `RECEIVED` | Pagamento recebido (não confirmado) |
| `CONFIRMED` | Pagamento confirmado |
| `OVERDUE` | Vencido |
| `REFUNDED` | Estornado |
| `RECEIVED_IN_CASH` | Recebido em dinheiro |

## 🔔 Webhook (Notificações Automáticas)

Para receber notificações automáticas quando um boleto for pago:

1. Acesse: Asaas > Configurações > Webhooks
2. Adicione a URL: `https://seudominio.com/api/boleto/webhook`
3. Marque os eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`

## 💰 Taxas

- **Boleto:** R$ 0,99 a R$ 1,99 por boleto **pago**
- **Sem mensalidade**
- **Só cobra se o cliente pagar**

## 🧪 Ambiente de Testes (Sandbox)

No ambiente sandbox:
- ✅ Não há cobranças reais
- ✅ Pode testar boletos ilimitadamente
- ✅ Simular pagamentos manualmente
- ⚠️ Boletos não funcionam em bancos reais

Para simular pagamento no sandbox:
1. Gere o boleto
2. Acesse: https://sandbox.asaas.com/receivableAnticipation
3. Encontre a cobrança e marque como "Paga"

## 📝 Campos Adicionados no Banco

```sql
dbfatura.asaas_cobranca_id    -- ID da cobrança no Asaas
dbfatura.asaas_cliente_id     -- ID do cliente no Asaas  
dbfatura.linha_digitavel      -- Linha digitável
dbfatura.codigo_barras        -- Código de barras
dbfatura.url_boleto           -- URL do PDF do boleto
dbfatura.status_boleto        -- Status: PENDING, CONFIRMED, etc
```

## 🐛 Troubleshooting

### Erro: "ASAAS_API_KEY não configurada"
- Verifique se adicionou a variável no `.env.local`
- Reinicie o servidor: `yarn dev`

### Erro: "Cliente não encontrado"
- Certifique-se que o `codfat` existe na tabela `dbfatura`
- Verifique se tem o `codcli` vinculado

### Boleto não aparece
- Verifique se está usando `ASAAS_ENVIRONMENT=sandbox`
- API Key deve ser do ambiente correto (sandbox vs produção)

## 📚 Documentação Oficial

- [Asaas - Documentação API](https://docs.asaas.com)
- [Criar Cobrança](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Webhooks](https://docs.asaas.com/docs/webhooks)

## ✅ Checklist de Implementação

- [x] Cliente Asaas criado (`src/lib/asaas.ts`)
- [x] API de geração criada (`src/pages/api/boleto/gerar.ts`)
- [x] Script SQL para campos do banco
- [x] Documentação completa
- [ ] Adicionar API Key no `.env.local`
- [ ] Executar script SQL no banco
- [ ] Testar geração de boleto
- [ ] Implementar webhook (opcional)
- [ ] Migrar para produção

## 🎯 Próximos Passos

1. **Teste no Sandbox**
   ```bash
   # Gere um boleto de teste
   curl -X POST http://localhost:3000/api/boleto/gerar \
     -H "Content-Type: application/json" \
     -d '{"codfat":"000002828","valor":100,"vencimento":"2025-01-30"}'
   ```

2. **Implemente no Frontend**
   - Adicione botão "Gerar Boleto" na tela de faturas
   - Exiba a linha digitável
   - Link para download do PDF

3. **Configure Webhook** (opcional)
   - Receba notificação automática de pagamentos
   - Atualize status da fatura automaticamente

4. **Migre para Produção**
   - Troque `ASAAS_ENVIRONMENT=production`
   - Use API Key de produção
   - Configure domínio do webhook
