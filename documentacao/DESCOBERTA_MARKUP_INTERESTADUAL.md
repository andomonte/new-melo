# DESCOBERTA: MARKUP INTERESTADUAL DE 17.2%

**Data:** 2026-01-10
**Status:** 🔴 PROBLEMA IDENTIFICADO - MARKUP FALTANDO NO NEXT.JS

---

## 🎯 CASO TESTADO

**Cliente:** 05702 - ATALIBA PNEUS LTDA - EPP
**UF do Cliente:** SP (São Paulo) - **FORA DO ESTADO AM**
**TIPOPRECO:** 5
**Produto:** 414070 - BATERIA MOTO

---

## 💰 COMPARAÇÃO DE PREÇOS

| Sistema | Preço | Cálculo |
|---------|-------|---------|
| **Next.js** | R$ 103,17 | dbformacaoprvenda.PRECOVENDA (TIPOPRECO 5) |
| **Delphi** | R$ 120,92 | 103.17 × 1.172 = 120.92 |
| **Diferença** | +R$ 17,75 | **+17.2% markup** |

---

## 🔍 ANÁLISE

### Cálculo Exato:
```
103.17 × 1.172 = 120.9192 ≈ R$ 120.92
```

**Conclusão:** O Delphi aplica um markup de **17.2%** para vendas **fora do estado** (interestadual).

---

## 📊 DADOS COLETADOS

### TIPOPRECO 5 (usado pelo cliente):
- PRECOVENDA: R$ 103,17
- Margem: 37%
- ICMS: 12%
- IPI: 0%
- PIS: 0%
- COFINS: 0%
- Comissão: 0%
- Fator Despesas: 88%

### Dados de UF (v_uf_icms_flags):

**São Paulo:**
- ICMS intra (dentro do estado): 18%
- ICMS inter (interestadual): 7%
- ICMS corredor: 12%
- Flag ST: S
- Flag ICMS Antecip: N
- Zona Incentivada: N

### Verificado:
- ✅ Sem kickback para este produto
- ✅ Apenas 1 registro por TIPOPRECO (sem duplicatas por UF)
- ✅ Não existe tabela de preço por UF na formação
- ❌ **Markup de 17.2% NÃO está sendo aplicado no Next.js**

---

## 🚨 O PROBLEMA

O Next.js está retornando o preço **direto da tabela `dbformacaoprvenda`** sem aplicar o markup interestadual.

**Lógica atual do Next.js:**
```typescript
// src/pages/api/vendas/dbOracle/produto.ts
SELECT
  p.CODPROD,
  p.DESCR,
  fp.PRECOVENDA  // ← Retorna R$ 103.17 direto
FROM DBPROD p
LEFT JOIN DBFORMACAOPRVENDA fp
  ON fp.CODPROD = p.CODPROD
  AND fp.TIPOPRECO = :TIPO
```

**Falta:** Aplicar markup de 17.2% quando UF do cliente ≠ UF da filial

---

## 💡 POSSÍVEIS ORIGENS DO MARKUP 17.2%

### Hipótese 1: Configuração Global
- Pode existir uma configuração no sistema que define o percentual
- Buscar em tabelas de configuração/parâmetros

### Hipótese 2: Cálculo Baseado em ICMS
- Diferença entre ICMS intra (18%) e ICMS inter (7%) = 11%
- Mas 17.2% não corresponde diretamente a essa diferença
- Pode ser: (1 + margem_adicional) * (1 - icms_inter) / (1 - icms_intra) - 1
- Calculando: (1 + X) * (1 - 0.07) / (1 - 0.18) - 1 = 0.172
- (1 + X) * 0.93 / 0.82 = 1.172
- (1 + X) * 1.134 = 1.172
- 1 + X = 1.033
- X = 0.033 (3.3%)
- **Pode ser uma margem adicional de 3.3% aplicada com ajuste de ICMS!**

### Hipótese 3: Procedure Oracle
- Pode haver um procedure Oracle que calcula esse markup
- Delphi chama essa procedure antes de mostrar o preço
- Next.js não está chamando

### Hipótese 4: Regra Hardcoded no Delphi
- O código Delphi pode ter a lógica embutida
- Verifica se UF cliente ≠ UF filial → aplica 17.2%

---

## 🔧 SOLUÇÃO NECESSÁRIA NO NEXT.JS

### Implementação:

```typescript
// src/pages/api/vendas/dbOracle/produto.ts

// 1. Buscar UF da filial
const filialUF = 'AM'; // ou buscar de configuração

// 2. Buscar UF do cliente
const clienteUF = await buscarUFCliente(codCliente);

// 3. Verificar se é venda interestadual
const isInterestadual = clienteUF !== filialUF;

// 4. Aplicar markup se for interestadual
if (isInterestadual) {
  precovenda = precovenda * 1.172; // 17.2% markup
}
```

---

## 📝 PRÓXIMAS AÇÕES

### 1. URGENTE - Confirmar o percentual exato
- Testar com outros clientes fora do estado
- Verificar se o markup é sempre 17.2% ou varia por UF

### 2. Identificar a origem do markup
- [ ] Procurar em tabela de configuração
- [ ] Verificar procedures Oracle relacionadas a preço
- [ ] Verificar se há fórmula baseada em ICMS
- [ ] Pedir ao cliente documentação sobre regra de markup interestadual

### 3. Implementar no Next.js
- [ ] Criar função que detecta venda interestadual
- [ ] Aplicar markup correto no preço retornado
- [ ] Testar com múltiplos clientes e UFs

### 4. Validar com outros casos
- Testar produtos diferentes
- Testar outros estados (não só SP)
- Confirmar se o markup é fixo ou variável

---

## 🎯 CONCLUSÃO PRELIMINAR

**O Next.js está buscando o preço corretamente da tabela `dbformacaoprvenda`, MAS está faltando aplicar o markup de 17.2% para vendas fora do estado (interestadual).**

**Impacto:**
- Clientes fora do estado estão vendo preços 17.2% MENORES que o Delphi
- Isso pode resultar em vendas com margem incorreta
- Necessita correção URGENTE

**Status:** Aguardando confirmação do percentual exato e regra de aplicação.

---

**Arquivos relacionados:**
- `src/pages/api/vendas/dbOracle/produto.ts` - API que busca produtos (PRECISA CORREÇÃO)
- `investigar-caso-especifico.ts` - Script de investigação
- `investigar-mva-uf.ts` - Script de análise de MVA e UF
