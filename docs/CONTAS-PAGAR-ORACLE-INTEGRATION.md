# 🔧 Sistema de Contas a Pagar com Integração Oracle

## 📋 Visão Geral

O sistema de Contas a Pagar foi integrado com o banco de dados Oracle legado, utilizando as procedures existentes para cálculo de juros, registro de pagamentos e sincronização de títulos.

---

## 🚀 Funcionalidades Implementadas

### 1. **Cálculo Automático de Juros**

Quando você abre o modal "Marcar como Pago", o sistema:
- ✅ Calcula automaticamente os juros baseado no vencimento
- ✅ Usa a fórmula Oracle: `(8% / 3000) * valor * dias_atraso`
- ✅ Mostra notificação com os dias de atraso
- ✅ Permite recalcular manualmente com o botão "🧮 Calcular"

**Taxa de Juros Padrão:** 8% ao mês = 0.00266% ao dia

### 2. **Integração com Oracle**

O sistema agora:
- ✅ Atualiza automaticamente a tabela `DBRECEB` no Oracle
- ✅ Registra movimentos em `DBFRECEB`
- ✅ Registra juros separadamente (tipo '02')
- ✅ Mantém auditoria com `Usuario.inc_acao_usr`
- ✅ Funciona mesmo se Oracle estiver offline (fallback para PostgreSQL)

### 3. **Campos de Pagamento**

O formulário "Marcar como Pago" inclui:
- ✅ Data do Pagamento
- ✅ Valor Pago
- ✅ Juros/Multa (calculado automaticamente)
- ✅ Forma de Pagamento (Dinheiro, PIX, Transferência, etc.)
- ✅ Banco
- ✅ Nº Comprovante/Doc
- ✅ Centro de Custo
- ✅ Conta Bancária
- ✅ Observações

---

## 🔌 APIs Criadas

### 1. **Calcular Juros**
```bash
POST /api/contas-pagar/calcular-juros

Body:
{
  "valor_pgto": 1000.00,
  "dt_venc": "2025-10-01",
  "taxa_juros": 8
}

Response:
{
  "sucesso": true,
  "valor_original": 1000,
  "dt_venc": "2025-10-01",
  "taxa_juros_mensal": 8,
  "taxa_juros_diaria": 0.00266,
  "dias_atraso": 41,
  "valor_juros": 109.20,
  "valor_total": 1109.20,
  "atrasado": true
}
```

### 2. **Marcar como Pago (Atualizado)**
```bash
PUT /api/contas-pagar/[id]/marcar-pago

Body:
{
  "dt_pgto": "2025-11-11",
  "valor_pago": 1000.00,
  "valor_juros": 109.20,
  "banco": "Banco do Brasil",
  "forma_pgto": "pix",
  "comprovante": "PIX12345",
  "cod_ccusto": "001",
  "cod_conta": "0007",
  "obs": "Pagamento via PIX",
  "username": "ADMIN"
}

Response:
{
  "sucesso": true,
  "mensagem": "Conta marcada como paga com sucesso.",
  "conta": { ... },
  "jurosCalculados": 109.20,
  "diasAtraso": 41,
  "oracleAtualizado": true,
  "oracleInfo": {
    "sucesso": true,
    "totalmentePago": "S",
    "valorTotalRecebido": 1109.20
  }
}
```

### 3. **Consultar Títulos do Cliente**
```bash
GET /api/contas-pagar/titulos-cliente?codcli=123&tipo=1&taxa_juros=8

Tipos disponíveis:
- tipo=1 : Títulos Atrasados com juros
- tipo=2 : Títulos em Dia
- tipo=3 : Vencimentos agrupados por mês
- tipo=4 : Histórico de vendas (últimos 3 meses)
- tipo=5 : Histórico de prazo médio
- tipo=6 : Títulos a vencer

Response (tipo=1):
{
  "sucesso": true,
  "tipo": "1",
  "tipo_descricao": "Títulos Atrasados",
  "codcli": "123",
  "taxa_juros": 8,
  "total_registros": 5,
  "titulos": [
    {
      "nro_doc": "001",
      "cod_receb": "REC001",
      "dt_venc": "2025-10-01",
      "valor_pgto": 1000,
      "valor_rec": 0,
      "valor_aberto": 1109.20,
      "dias": 41,
      "valor_juros": 109.20,
      "nome_cli": "Cliente Exemplo"
    }
  ]
}
```

---

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:
1. **`src/lib/oracleService.ts`**
   - Serviço de integração com Oracle
   - Funções: `calcularJurosTitulo`, `marcarTituloPagoOracle`, `consultarTitulosCliente`, etc.
   - Pool de conexões Oracle configurado

2. **`src/pages/api/contas-pagar/calcular-juros.ts`**
   - API para calcular juros de títulos

3. **`src/pages/api/contas-pagar/titulos-cliente.ts`**
   - API para consultar títulos de clientes no Oracle

### Arquivos Modificados:
1. **`src/pages/api/contas-pagar/[id]/marcar-pago.ts`**
   - Integração com Oracle adicionada
   - Cálculo automático de juros
   - Registro de movimentos em DBFRECEB

2. **`src/components/corpo/contas-pagar/ContasAPagar.tsx`**
   - Modal com cálculo automático de juros
   - Botão "🧮 Calcular" para recalcular juros
   - Notificação de dias de atraso

---

## 🔧 Configuração

### Variáveis de Ambiente (`.env`)

```env
# Oracle Database
ORACLE_USER=GERAL
ORACLE_PASSWORD=123
ORACLE_HOST=201.64.221.132
ORACLE_PORT=1524
ORACLE_SERVICE="desenv.mns.melopecas.com.br"
```

### Oracle Instant Client

O sistema requer o Oracle Instant Client instalado em:
```
C:\oracle\instantclient_23_8
```

Se estiver em outro caminho, atualize em `src/lib/oracleService.ts`:
```typescript
const instantClientPath = 'C:\\oracle\\instantclient_23_8';
```

---

## 💡 Como Usar

### 1. Marcar Conta como Paga

1. Acesse "Contas a Pagar"
2. Clique no ícone ✓ na linha da conta
3. O sistema calculará os juros automaticamente
4. Verifique:
   - Data de Pagamento (preenchida com hoje)
   - Valor Pago (valor da conta)
   - Juros/Multa (calculado automaticamente se atrasado)
5. Preencha os campos adicionais:
   - Forma de Pagamento
   - Banco
   - Nº Comprovante
   - Observações
6. Clique em "Confirmar Pagamento"

### 2. Recalcular Juros

Se precisar recalcular os juros:
1. No campo "Juros/Multa", clique no botão "🧮 Calcular"
2. O sistema buscará o vencimento e recalculará
3. Uma notificação mostrará o valor e dias de atraso

### 3. Consultar Títulos de Cliente (API)

Use a API para consultar títulos:

```javascript
// Títulos atrasados
const response = await fetch('/api/contas-pagar/titulos-cliente?codcli=123&tipo=1');
const data = await response.json();
console.log('Títulos atrasados:', data.titulos);

// Títulos a vencer
const response2 = await fetch('/api/contas-pagar/titulos-cliente?codcli=123&tipo=6');
const data2 = await response2.json();
console.log('Títulos a vencer:', data2.titulos);
```

---

## 📊 Mapeamento de Bancos

O sistema mapeia códigos de conta para bancos automaticamente:

| Código Conta | Banco            | Código |
|--------------|------------------|--------|
| 0003, 0006   | Bradesco         | 2      |
| 0007, 0008   | Banco do Brasil  | 1      |
| 0104, 0106   | Itaú             | 3      |
| 0124         | Rural            | 5      |
| 0133         | Real             | 4      |

Função disponível:
```typescript
import { mapearContaParaBanco, obterNomeBanco } from '@/lib/oracleService';

const codigoBanco = mapearContaParaBanco('0007'); // 1
const nomeBanco = obterNomeBanco(1); // "Banco do Brasil"
```

---

## 🎯 Procedures Oracle Utilizadas

### 1. **CLIENTE_TITULO**
- Consulta títulos de cliente com cálculo de juros
- Suporta 6 tipos de filtro
- Usa tabela auxiliar `DBRECEBAUX` para cálculos

### 2. **RECEB_TOTAL_TITULO**
- Calcula total recebido de um título até data
- Soma valores de `DBFRECEB`

### 3. **CARREGA_TITULOS**
- Carrega títulos de uma fatura
- Retorna dados completos do título

### 4. **LIBERA_TITULOS**
- Libera títulos bloqueados
- Reseta campo `BRADESCO`

---

## 🔍 Lógica de Juros

### Fórmula Oracle:
```sql
juros = (8 / 3000) * valor_pgto * dias_atraso
```

### Implementação TypeScript:
```typescript
function calcularJurosTitulo(valorPgto: number, dtVenc: Date, txJuros: number = 8) {
  const hoje = new Date();
  const dias = dtVenc < hoje 
    ? Math.floor((hoje.getTime() - dtVenc.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  const txDia = txJuros / 3000;
  const juros = dias > 0 ? valorPgto * dias * txDia : 0;
  
  return { dias, juros: Math.round(juros * 100) / 100 };
}
```

### Exemplos:
- **Título de R$ 1.000,00, 30 dias de atraso:**
  ```
  Juros = (8 / 3000) * 1000 * 30 = R$ 80,00
  Total = R$ 1.080,00
  ```

- **Título de R$ 500,00, 15 dias de atraso:**
  ```
  Juros = (8 / 3000) * 500 * 15 = R$ 20,00
  Total = R$ 520,00
  ```

---

## 🐛 Tratamento de Erros

O sistema tem fallback automático:

1. **Oracle Offline:** O sistema salva apenas no PostgreSQL e registra warning no console
2. **Cálculo de Juros Falha:** Define juros como 0 e continua
3. **Título não encontrado no Oracle:** Atualiza apenas PostgreSQL

### Logs:
```
✅ Título atualizado no Oracle: { sucesso: true, ... }
⚠️ Erro ao atualizar Oracle (continuando com PostgreSQL): Connection refused
❌ Erro ao marcar conta como paga: [detalhes do erro]
```

---

## 📝 Auditoria

Toda operação de pagamento é auditada:

### No Oracle:
```sql
Usuario.inc_acao_usr(
  codusr,
  'MARCAR_PAGO',
  'DBRECEB',
  'COD:REC001 VALOR:1000.00'
);
```

### Tabelas Afetadas:
- `DBRECEB` - Atualizado com dt_pgto, valor_rec, rec='S'
- `DBFRECEB` - Inserido movimento tipo '01' (pagamento)
- `DBFRECEB` - Inserido movimento tipo '02' (juros, se houver)
- `DBUSUARIO` - Registro de auditoria

---

## 🧪 Testes

### Testar Cálculo de Juros:
```bash
curl -X POST http://localhost:3000/api/contas-pagar/calcular-juros \
  -H "Content-Type: application/json" \
  -d '{
    "valor_pgto": 1000,
    "dt_venc": "2025-10-01",
    "taxa_juros": 8
  }'
```

### Testar Consulta de Títulos:
```bash
curl http://localhost:3000/api/contas-pagar/titulos-cliente?codcli=123&tipo=1
```

---

## 📚 Documentação Adicional

- **Procedures Oracle completas:** `docs/oracle-procedures-titulos.txt`
- **Guia de integração:** `docs/INTEGRACAO-ORACLE-TITULOS.md`
- **Scripts de consulta:** `scripts/consultar-procedures-titulos.js`

---

## ✅ Checklist de Implementação

- ✅ Serviço Oracle criado (`oracleService.ts`)
- ✅ Pool de conexões Oracle configurado
- ✅ Função de cálculo de juros implementada
- ✅ API de cálculo de juros criada
- ✅ API de marcar como pago atualizada
- ✅ API de consulta de títulos criada
- ✅ Componente com cálculo automático de juros
- ✅ Botão de recalcular juros adicionado
- ✅ Notificações de dias de atraso
- ✅ Integração com DBRECEB/DBFRECEB
- ✅ Auditoria com Usuario.inc_acao_usr
- ✅ Fallback para PostgreSQL
- ✅ Tratamento de erros robusto
- ✅ Documentação completa

---

## 🚀 Próximos Passos Sugeridos

1. **Dashboard de Títulos:**
   - Criar página mostrando títulos atrasados
   - Gráfico de vencimentos por mês
   - Histórico de prazo médio

2. **Relatórios:**
   - Relatório de contas pagas no período
   - Relatório de juros pagos
   - Relatório por credor

3. **Notificações:**
   - Email de títulos vencendo
   - Alerta de títulos atrasados
   - Resumo diário de pagamentos

4. **Sincronização:**
   - Job para sincronizar PostgreSQL ↔ Oracle
   - Validação de integridade de dados
   - Reconciliação automática

---

## 🆘 Suporte

Para problemas ou dúvidas:
1. Verificar logs do console (F12)
2. Verificar conexão com Oracle
3. Conferir variáveis de ambiente
4. Consultar documentação em `docs/`

**Desenvolvido por:** Sistema Melo  
**Data:** Novembro 2025  
**Versão:** 1.0.0
