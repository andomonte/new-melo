# 💰 Sistema de Pagamentos Parciais - Contas a Pagar

## 📊 Estrutura de Dados

### Tabelas Envolvidas

1. **`dbpgto_ent`** - Tabela principal de contas a pagar
   - `codpgto`: Código único da conta
   - `valor_pgto`: Valor total da conta
   - `paga`: Flag 'S' ou 'N'
   
2. **`dbfpgto`** - Tabela de formas de pagamento (histórico de pagamentos)
   - `cod_pgto`: Referência para dbpgto_ent.codpgto
   - `valor_pgto`: Valor pago neste registro
   - `dt_pgto`: Data do pagamento
   - `cod_fpgto`: Forma de pagamento
   - `nro_cheque`: Número do cheque (se aplicável)
   - `cod_conta`: Conta bancária usada
   - `juros`, `multa`, `desconto`: Encargos/descontos

## 🔄 Lógica de Pagamentos Parciais

### Status da Conta
```
PENDENTE:         total_pago = 0
PAGO_PARCIAL:     0 < total_pago < valor_pgto
PAGO:             total_pago >= valor_pgto
```

### Cálculo do Total Pago
```sql
SELECT 
  p.codpgto,
  p.valor_pgto as valor_total,
  COALESCE(SUM(f.valor_pgto), 0) as total_pago,
  p.valor_pgto - COALESCE(SUM(f.valor_pgto), 0) as saldo_restante,
  COUNT(f.cod_pgto) as qtd_pagamentos
FROM dbpgto_ent p
LEFT JOIN dbfpgto f ON f.cod_pgto = p.codpgto AND f.cancel != 'S'
GROUP BY p.codpgto, p.valor_pgto
```

## 💡 Exemplos de Uso

### Exemplo 1: Conta de R$ 4.000,00 paga em 4x de R$ 1.000,00

**dbpgto_ent:**
| codpgto | valor_pgto | paga |
|---------|------------|------|
| 0001234 | 4000.00    | N    |

**dbfpgto (pagamentos):**
| cod_pgto | dt_pgto    | valor_pgto | cod_fpgto | status   |
|----------|------------|------------|-----------|----------|
| 0001234  | 2025-01-15 | 1000.00    | PIX       | -        |
| 0001234  | 2025-02-15 | 1000.00    | PIX       | -        |
| 0001234  | 2025-03-15 | 1000.00    | PIX       | -        |
| 0001234  | 2025-04-15 | 1000.00    | PIX       | -        |

**Cálculos:**
- Após 1º pagamento: R$ 1.000 pago → **Pago Parcialmente** (25%)
- Após 2º pagamento: R$ 2.000 pago → **Pago Parcialmente** (50%)
- Após 3º pagamento: R$ 3.000 pago → **Pago Parcialmente** (75%)
- Após 4º pagamento: R$ 4.000 pago → **Pago** (100%)

### Exemplo 2: Conta de R$ 500,00 paga à vista

**dbpgto_ent:**
| codpgto | valor_pgto | paga |
|---------|------------|------|
| 0001235 | 500.00     | S    |

**dbfpgto:**
| cod_pgto | dt_pgto    | valor_pgto | cod_fpgto |
|----------|------------|------------|-----------|
| 0001235  | 2025-01-15 | 500.00     | BOLETO    |

**Status:** **Pago** (100%)

## 🎨 UI - Badges de Status

```tsx
// Pendente (amarelo)
<Badge className="bg-yellow-500">Pendente</Badge>

// Pago Parcialmente (azul)
<Badge className="bg-blue-500">Pago Parcialmente</Badge>

// Pago (verde)
<Badge className="bg-green-500">Pago</Badge>

// Cancelado (vermelho)
<Badge className="bg-red-500">Cancelado</Badge>
```

## 📝 Implementação

### 1. Interface TypeScript
```typescript
export interface ContaPagar {
  codpgto: string;
  valor_pgto: number;
  status: 'pendente' | 'pago_parcial' | 'pago' | 'cancelado';
  total_pago_historico?: number;  // Soma de dbfpgto
  qtd_pagamentos?: number;         // Count de dbfpgto
  saldo_restante?: number;         // valor_pgto - total_pago
}
```

### 2. API - Buscar Histórico de Pagamentos
```typescript
// GET /api/contas-pagar/[id]/pagamentos
// Retorna todos os pagamentos de uma conta
```

### 3. Modal de Pagamento Parcial
- Exibir valor total da conta
- Exibir total já pago
- Exibir saldo restante
- Permitir digitar valor parcial
- Validar: valor_digitado <= saldo_restante
- Registrar em dbfpgto
- Atualizar status automaticamente

## ✅ Vantagens

1. **Flexibilidade**: Permite parcelar pagamentos
2. **Rastreabilidade**: Histórico completo em dbfpgto
3. **Controle**: Saldo restante sempre atualizado
4. **Compatibilidade**: Usa estrutura de banco existente

## 🔧 Próximos Passos

- [ ] Criar API de histórico de pagamentos
- [ ] Modificar modal de pagamento para suportar parcial
- [ ] Adicionar visualização de histórico
- [ ] Implementar cálculo automático de status
- [ ] Adicionar filtro por "Pago Parcialmente"
