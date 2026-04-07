# DIAGNÓSTICO: DIVERGÊNCIA DE PREÇOS - PROBLEMA DO TIPOPRECO

**Data:** 2026-01-10
**Status:** 🔴 PROBLEMA IDENTIFICADO

---

## 🎯 DESCOBERTA CRÍTICA

O campo `dbclien.prvenda` armazena o **TIPOPRECO** do cliente, que determina qual tabela de preços usar.

### Cliente de Teste: 18786

```
Nome: LEANDRO VIEIRA DE VASCONCELO
Tipo: F (Pessoa Física)
TIPOPRECO: 0
```

---

## 💥 O PROBLEMA

O cliente tem **TIPOPRECO = 0**, mas o TIPOPRECO 0 tem preços **MUITO MAIS ALTOS** que os esperados:

### Produto 002822 (BICO INJETOR DE FURO)

| Fonte | Valor |
|-------|-------|
| `dbprod.prvenda` | R$ 101.45 |
| `dbformacaoprvenda` (TIPOPRECO 0) | **R$ 660.57** ⚠️ |
| `dbformacaoprvenda` (TIPOPRECO 1) | R$ 101.45 ✅ |

**Diferença TIPOPRECO 0 vs dbprod:** R$ 559.12 (550% mais caro!)

### Produto 414069 (BATERIA MOTO)

| Fonte | Valor |
|-------|-------|
| `dbprod.prvenda` | R$ 115.33 |
| `dbformacaoprvenda` (TIPOPRECO 0) | **R$ 145.32** ⚠️ |
| `dbformacaoprvenda` (TIPOPRECO 1) | R$ 103.58 |

**Diferença TIPOPRECO 0 vs dbprod:** R$ 29.99 (26% mais caro)

---

## 🔍 ANÁLISE

### TIPOPRECO 0 - Características:

**Produto 002822:**
- Margem Líquida: **894.77%** (margem altíssima!)
- Comissão: 4.5%
- Fator Despesas: 95.25%
- Taxa Cartão: 0.25%
- Todos impostos: 0%

**Produto 414069:**
- Margem Líquida: **90%**
- Comissão: 4.5%
- Fator Despesas: 95.25%
- Taxa Cartão: 0.25%
- Todos impostos: 0%

### TIPOPRECO 1 - Características:

**Produto 002822:**
- Margem Líquida: 59.99%
- Comissão: 0%
- Fator Despesas: 99.75%
- Taxa Cartão: 0%
- Todos impostos: 0%
- **PRECOVENDA = R$ 101.45** (IGUAL ao dbprod.prvenda!)

### Conclusão:

O campo `dbprod.prvenda` **corresponde ao TIPOPRECO 1**, NÃO ao TIPOPRECO 0!

---

## 🤔 POSSÍVEIS CAUSAS

### 1. Cliente com TIPOPRECO Errado

O cliente 18786 está cadastrado com `prvenda = 0`, mas deveria ser `prvenda = 1`.

**Ação:** Verificar se outros clientes também têm `prvenda = 0` e se isso está correto.

### 2. Delphi Sobrescreve o TIPOPRECO

O sistema Delphi pode ter uma lógica que **ignora** o `dbclien.prvenda` e determina o TIPOPRECO baseado em outras regras:

- Tipo de cliente (F/J)
- Tipo de operação
- Região/UF
- Vendedor
- Outros fatores

**Ação:** Procurar procedures Oracle que determinam TIPOPRECO dinamicamente.

### 3. TIPOPRECO 0 é "Especial"

TIPOPRECO 0 pode ser usado para casos especiais (atacado, distribuidor, etc.) e não para vendas normais.

**Ação:** Verificar a documentação ou regras de negócio sobre os tipos de preço.

---

## 📊 LÓGICA ATUAL DO NEXT.JS

### Arquivo: `src/pages/api/vendas/dbOracle/produto.ts`

```typescript
// Linha 68-90
const { descricao, PRVENDA, armId, arm_id } = req.body;

// TIPOPRECO obrigatório
const tipoCliente = PRVENDA != null ? String(PRVENDA) : '0';
```

```sql
-- Linhas 125-134
fp_collapse AS (
  SELECT
    CODPROD,
    TIPOPRECO,
    MAX(PRECOVENDA) AS PRECOVENDA
  FROM DBFORMACAOPRVENDA
  WHERE TIPOPRECO = :TIPO  -- Usa o PRVENDA enviado
    AND PRECOVENDA > 0
  GROUP BY CODPROD, TIPOPRECO
)
```

### Fluxo:

1. Frontend envia `PRVENDA` do cliente no body da requisição
2. API usa `PRVENDA` como `TIPOPRECO` na query
3. Retorna `PRECOVENDA` da tabela `dbformacaoprvenda` para aquele TIPOPRECO
4. Se houver kickback, kickback tem prioridade

### O Next.js está fazendo CERTO!

A lógica está correta: busca o preço baseado no TIPOPRECO do cliente. O problema é **qual TIPOPRECO está sendo usado**.

---

## 🔎 INVESTIGAÇÃO NECESSÁRIA

### 1. Verificar no Delphi

**Teste prático:**
- Abrir venda no Delphi com cliente 18786
- Adicionar produtos 002822 e 414069
- Verificar qual preço aparece
- Comparar com os valores encontrados

**Esperado se usar TIPOPRECO 0:**
- 002822: R$ 660.57
- 414069: R$ 145.32

**Esperado se usar TIPOPRECO 1:**
- 002822: R$ 101.45
- 414069: R$ 103.58

### 2. Buscar Procedures Oracle

Procurar por procedures/functions que:
- Determinam qual TIPOPRECO usar em uma venda
- Fazem override do `dbclien.prvenda`
- Calculam preço baseado em regras de negócio

**Possíveis nomes:**
- `OBTER_TIPO_PRECO`
- `CALCULAR_PRECO_VENDA`
- `DETERMINAR_TABELA_PRECO`
- `GET_PRICE_TYPE`

### 3. Verificar Código Delphi

Se tiver acesso ao código Delphi, procurar por:
- Como o TIPOPRECO é determinado ao abrir uma venda
- Se há alguma lógica especial para Pessoa Física
- Configurações globais que afetam o preço

---

## 💡 POSSÍVEL SOLUÇÃO

### Hipótese: Pessoa Física sempre usa TIPOPRECO 1

Se a regra de negócio for:
- **Pessoa Física (tipo='F')** → sempre usa **TIPOPRECO = 1**
- **Pessoa Jurídica (tipo='J')** → usa o `dbclien.prvenda`

**Implementação no Next.js:**

```typescript
// src/pages/api/vendas/dbOracle/produto.ts

// Buscar tipo do cliente
const clienteResult = await client.query(
  'SELECT tipo, prvenda FROM dbclien WHERE codcli = $1',
  [codCliente]
);

const cliente = clienteResult.rows[0];

// Determinar TIPOPRECO
let tipoPreco;
if (cliente.tipo === 'F') {
  // Pessoa Física sempre usa TIPOPRECO 1
  tipoPreco = '1';
} else {
  // Pessoa Jurídica usa o prvenda do cliente
  tipoPreco = String(cliente.prvenda || '0');
}
```

**Mas isso é apenas uma hipótese!** Precisa confirmar com o cliente ou análise do Delphi.

---

## ✅ ANÁLISE DE PADRÃO - DADOS ESTATÍSTICOS

### Distribuição de TIPOPRECO por Tipo de Cliente:

**Pessoa Física (PF):**
- **96.11%** (20.679) têm TIPOPRECO = 0
- 3.15% (678) têm TIPOPRECO = 1
- 0.52% (112) têm TIPOPRECO = 2
- 0.19% (41) têm TIPOPRECO = 7
- Outros: < 0.03%

**Pessoa Jurídica (PJ):**
- 11.72% (1.607) têm TIPOPRECO = 0
- **52.09%** (7.141) têm TIPOPRECO = 1
- 16.77% (2.299) têm TIPOPRECO = 2
- 11.92% (1.635) têm TIPOPRECO = 5
- 4.81% (659) têm TIPOPRECO = 7
- Outros: < 3%

### Comparação de Preços (208.602 produtos analisados):

| Métrica | TIPOPRECO 0 | TIPOPRECO 1 | Diferença |
|---------|-------------|-------------|-----------|
| Preço médio | R$ 445.94 | R$ 360.49 | **+23.86%** |
| Margem média | 375.62% | 367.16% | +8.46% |

**Conclusão:** TIPOPRECO 0 cobra preços **23.86% mais caros** que TIPOPRECO 1!

### Interpretação:

- **TIPOPRECO 0** = Varejo/Balcão (usado por 96% dos clientes PF)
- **TIPOPRECO 1** = Atacado/Revenda (usado por 52% dos clientes PJ)
- A diferença de preço de 23.86% é **intencional** e reflete a estratégia comercial

### Implicações:

1. O Next.js está **tecnicamente CORRETO** ao usar TIPOPRECO 0 para cliente 18786 (PF)
2. Se o Delphi mostra preços diferentes, pode estar:
   - Usando outro TIPOPRECO (como 1)
   - Aplicando desconto adicional
   - Usando kickback
   - Tendo lógica de override não documentada

---

## 📝 PRÓXIMAS AÇÕES

1. **[URGENTE]** Pedir ao cliente para testar no Delphi:
   - Cliente 18786 (Pessoa Física)
   - Produtos 002822 e 414069
   - **Anotar qual preço aparece EXATAMENTE**

2. **[URGENTE]** Comparar o preço do Delphi com nossa análise:

   **Produto 002822:**
   - Se Delphi mostra R$ 660.57 → Usando TIPOPRECO 0 ✅ (Next.js correto)
   - Se Delphi mostra R$ 101.45 → Usando TIPOPRECO 1 ⚠️ (há override)

   **Produto 414069:**
   - Se Delphi mostra R$ 145.32 → Usando TIPOPRECO 0 ✅ (Next.js correto)
   - Se Delphi mostra R$ 115.33 → Usando dbprod.prvenda ⚠️ (ignora formação)
   - Se Delphi mostra R$ 103.58 → Usando TIPOPRECO 1 ⚠️ (há override)

3. **Se houver override:** Procurar procedures Oracle que determinam TIPOPRECO dinamicamente

4. **Se não houver override:** Verificar se há desconto aplicado automaticamente

5. Confirmar com o cliente: qual é a regra de negócio para determinar preço de PF vs PJ?

---

## 🎯 CONCLUSÃO PRELIMINAR

O Next.js está **tecnicamente correto** ao buscar o preço da `dbformacaoprvenda` baseado no TIPOPRECO do cliente.

O problema é que:
- O cliente tem `prvenda = 0` no banco
- TIPOPRECO 0 tem preços muito diferentes do esperado
- Pode haver uma regra de negócio não implementada que determina o TIPOPRECO correto

**Precisa investigar:**
- Qual TIPOPRECO o Delphi realmente usa para este cliente
- Se há lógica de override baseada em tipo de cliente (F/J)
- Se o cadastro do cliente está incorreto

---

**Arquivos relacionados:**
- `src/pages/api/vendas/dbOracle/produto.ts` - API que busca produtos para venda
- `comparar-precos-delphi-nextjs.ts` - Script de comparação
- `ANALISE_PRECO_PRODUTO.md` - Análise anterior da estrutura de preços
