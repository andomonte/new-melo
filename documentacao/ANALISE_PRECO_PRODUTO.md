# ANÁLISE: PRECIFICAÇÃO DE PRODUTOS

**Data:** 2026-01-10
**Status:** 🔍 Em Investigação

---

## 📊 RESUMO EXECUTIVO

O sistema possui uma **tabela de formação de preços** (`dbformacaoprvenda`) que calcula o preço de venda baseado em:
- Custo do produto
- Margem líquida desejada
- Impostos (ICMS, IPI, PIS, COFINS)
- Comissão
- Fator de despesas
- Taxa de cartão

Cada produto pode ter **8 tipos de preço diferentes** (TIPOPRECO 0-7), cada um com suas próprias regras.

---

## 🗂️ ESTRUTURA DAS TABELAS

### 1. `dbprod` - Cadastro de Produtos

**Campos de preço:**
- `prvenda` - Preço de venda "padrão"
- `prcompra` - Preço de compra
- `prmedio` - Preço médio
- `primp` - Preço importação
- `prfabr` - Preço fábrica
- `prcustoatual` - Custo atual

**Exemplo (produto 002822):**
```
prcompra: R$ 63.25
prvenda: R$ 101.45
prmedio: R$ 63.25
```

---

### 2. `dbformacaoprvenda` - Formação de Preço de Venda

**Estrutura:**
```
CODPROD         - Código do produto
TIPOPRECO       - Tipo de preço (0-7)
MARGEMLIQUIDA   - Margem líquida %
ICMS            - Alíquota ICMS %
IPI             - Alíquota IPI %
PIS             - Alíquota PIS %
COFINS          - Alíquota COFINS %
COMISSAO        - Comissão %
FATORDESPESAS   - Fator de despesas %
TAXACARTAO      - Taxa cartão %
PRECOVENDA      - **PREÇO CALCULADO** (resultado final)
```

**Exemplo (produto 002822):**

| TIPOPRECO | MARGEMLIQUIDA | ICMS | IPI | COMISSAO | FATORDESPESAS | PRECOVENDA |
|-----------|---------------|------|-----|----------|---------------|------------|
| 0 | 894.77% | 0% | 0% | 4.5% | 95.25% | R$ 660.57 |
| **1** | 59.99% | 0% | 0% | 0% | 99.75% | **R$ 101.45** |
| 2 | 59.17% | 0% | 0% | 4.5% | 95.5% | R$ 105.42 |
| 3 | 59.99% | 12% | 0% | 0% | 88% | R$ 96.64 |
| 4 | 59.99% | 12% | 0% | 0% | 88% | R$ 96.64 |
| 5 | 59.99% | 12% | 5% | 0% | 88% | R$ 96.64 |
| 6 | 68.99% | 12% | 5% | 4.5% | 83.5% | R$ 131.17 |
| 7 | 47.9% | 12% | 0% | 0% | 88% | R$ 106.3 |

**Observação:**
- `dbprod.prvenda` = R$ 101.45
- `dbformacaoprvenda.PRECOVENDA` (tipo 1) = R$ 101.45 ✅ **MATCH**

Isso significa que o campo `prvenda` da tabela `dbprod` corresponde ao **TIPOPRECO 1**.

---

### 3. `dbprecokb` - Preços Kickback

Tabela de descontos especiais (kickback). Se existir desconto, tem **prioridade** sobre a formação de preço.

**Campos:**
```
codprod
dscbalcao      - Desconto balcão
dscbalcao18    - Desconto balcão 18
dscbalcao45    - Desconto balcão 45 (USADO PELO NEXT.JS)
dscrev30       - Desconto revenda 30
dscrev3018     - Desconto revenda 30-18
dscrev3045     - Desconto revenda 30-45
dscbv30        - Desconto bv30
dscbv3018      - Desconto bv3018
dscbv3045      - Desconto bv3045
```

**Produtos testados:** Nenhum registro de kickback para 002822 e 414069.

---

## 🔄 LÓGICA DE PREÇO DO NEXT.JS

### Arquivo: `src/pages/api/dbOracle/produto.ts`

```sql
SELECT
  p.codprod,
  p.descr,
  p.qtest,
  CASE
    WHEN kb.dscbalcao45 IS NOT NULL AND kb.dscbalcao45 > 0
    THEN kb.dscbalcao45    -- PRIORIDADE 1: Kickback
    ELSE fp."PRECOVENDA"   -- PRIORIDADE 2: Tabela de formação
  END AS "PRECOVENDA"
FROM dbprod p
LEFT JOIN dbprecokb kb ON p.codprod = kb.codprod
LEFT JOIN dbformacaoprvenda fp ON p.codprod = fp."CODPROD"
  AND fp."TIPOPRECO" = $1  -- Baseado no cliente
```

### Ordem de Prioridade:

1. **Kickback** (`dbprecokb.dscbalcao45`) - Se existir e > 0
2. **Formação de Preço** (`dbformacaoprvenda.PRECOVENDA`) - Baseado no TIPOPRECO do cliente
3. **Fallback** - Se nenhum dos anteriores existir

---

## ⚠️ **DIVERGÊNCIA ENCONTRADA**

### Produto 414069:

| Fonte | Valor |
|-------|-------|
| `dbprod.prvenda` | R$ 115.33 |
| `dbformacaoprvenda.PRECOVENDA` (tipo 1) | R$ 103.58 |

**Diferença:** R$ 11.75

**Possíveis causas:**
1. O campo `prvenda` está desatualizado
2. O sistema Oracle atualiza apenas a `dbformacaoprvenda`, não o `dbprod.prvenda`
3. Há algum procedimento que deveria sincronizar mas não está rodando

---

## 📝 TIPOS DE PREÇO (TIPOPRECO)

Existem 8 tipos de preço (0-7). Cada tipo parece representar uma categoria diferente de cliente ou condição comercial:

| TIPOPRECO | Possível Significado | Características |
|-----------|---------------------|------------------|
| 0 | ? | Margem alta, comissão, taxas |
| **1** | **Balcão / Padrão** | Sem impostos, sem comissão, alta despesa |
| 2 | Revenda | Sem impostos, com comissão |
| 3 | Com ICMS | ICMS 12%, sem comissão |
| 4 | Com ICMS | ICMS 12%, sem comissão |
| 5 | Com ICMS e IPI | ICMS 12%, IPI 5%, sem comissão |
| 6 | Premium | ICMS 12%, IPI 5%, comissão, margem maior |
| 7 | ? | ICMS 12%, margem menor |

**Nota:** Precisamos confirmar o significado de cada tipo com o cliente ou documentação Oracle.

---

## 🧮 FÓRMULA DE CÁLCULO (Hipótese)

Baseado nos campos da tabela, a fórmula provável é:

```
PRECOVENDA = CustoProduto × (1 + MarkupTotal)

Onde:
  MarkupTotal = (
    MARGEMLIQUIDA +
    ICMS +
    IPI +
    PIS +
    COFINS +
    COMISSAO +
    FATORDESPESAS +
    TAXACARTAO
  ) / (100 - SomaImpostos)
```

**Exemplo simples:**
- Custo: R$ 63.25
- Margem líquida desejada: 59.99%
- Fator despesas: 99.75%
- Sem impostos
- Resultado: R$ 101.45

**Precisamos encontrar o procedimento Oracle que faz esse cálculo!**

---

## 🔍 PRÓXIMOS PASSOS

### 1. Encontrar Procedure Oracle

Procurar por:
- `FORMACAO_PRECO`
- `CALCULO_PRECO_VENDA`
- `ATUALIZAR_PRECO`
- Triggers em `dbformacaoprvenda`

### 2. Verificar TIPOPRECO do Cliente

Verificar onde está armazenado o TIPOPRECO do cliente:
- Campo em `dbclien`?
- Tabela separada?
- Parâmetro da venda?

### 3. Comparar Cálculos

- Implementar a fórmula Oracle no Next.js
- Validar se os valores batem
- Garantir que está usando o TIPOPRECO correto

### 4. Sincronização

Verificar se:
- `dbprod.prvenda` deveria ser atualizado quando `dbformacaoprvenda` muda
- Há algum job/trigger que faz essa sincronização
- Se o Next.js deve usar sempre `dbformacaoprvenda` em vez de `dbprod.prvenda`

---

## 📊 TESTES REALIZADOS

### Script: `investigar-preco-detalhado.ts`

✅ Listou todos os campos de preço da `dbprod`
✅ Mostrou valores para produtos 002822 e 414069

### Script: `investigar-formacao-preco.ts`

✅ Estrutura da `dbformacaoprvenda`
✅ Todos os 21 registros dos 2 produtos (8 tipos × 2 produtos + duplicatas)
✅ Comparação `prvenda` vs `PRECOVENDA`
✅ Verificação de kickback

---

## 🎯 CONCLUSÃO PRELIMINAR

O Next.js **está usando a lógica correta** de buscar preço da tabela `dbformacaoprvenda` baseado no TIPOPRECO.

**O problema pode ser:**
1. **TIPOPRECO errado** - Precisa usar o tipo correto do cliente
2. **Formação desatualizada** - A tabela `dbformacaoprvenda` precisa ser recalculada
3. **Custo base errado** - Se o custo mudou e a formação não foi recalculada

**Próximo passo crítico:**
Verificar qual TIPOPRECO o Delphi está usando para o cliente testado e comparar com o que o Next.js está usando.

---

**Arquivos relacionados:**
- `src/pages/api/dbOracle/produto.ts` - Busca preço do produto
- `src/components/corpo/vendas/novaVenda/index.tsx` - Interface de venda
- `investigar-preco-detalhado.ts` - Script de investigação
- `investigar-formacao-preco.ts` - Script de análise de formação
