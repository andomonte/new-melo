# RESUMO DA INVESTIGAÇÃO: PREÇOS DELPHI vs NEXT.JS

**Data:** 2026-01-10
**Status:** ✅ ANÁLISE COMPLETA - AGUARDANDO TESTE NO DELPHI

---

## 🎯 OBJETIVO

Investigar por que os preços dos produtos não batem entre o sistema Delphi e o Next.js durante o processo de venda.

---

## 📊 DESCOBERTAS PRINCIPAIS

### 1. Sistema de Precificação

O sistema usa uma tabela **`dbformacaoprvenda`** que armazena **8 tipos de preço** (TIPOPRECO 0-7) para cada produto.

**Cada TIPOPRECO tem:**
- Margem líquida diferente
- Impostos (ICMS, IPI, PIS, COFINS)
- Comissão
- Fator de despesas
- Taxa de cartão
- **PRECOVENDA** (preço final calculado)

### 2. Como o Cliente Determina o Preço

- Cada cliente tem um campo `prvenda` na tabela `dbclien`
- Este campo armazena o **TIPOPRECO** que o cliente usa
- O Next.js busca o preço da `dbformacaoprvenda` baseado neste TIPOPRECO

### 3. Distribuição de TIPOPRECO

**Pessoa Física (PF):**
- 96.11% (20.679 clientes) → TIPOPRECO = 0
- 3.15% (678 clientes) → TIPOPRECO = 1
- Outros: < 1%

**Pessoa Jurídica (PJ):**
- 52.09% (7.141 clientes) → TIPOPRECO = 1
- 16.77% (2.299 clientes) → TIPOPRECO = 2
- 11.92% (1.635 clientes) → TIPOPRECO = 5
- Outros: < 20%

### 4. Diferença de Preços entre Tipos

Análise de 208.602 produtos mostrou:
- **TIPOPRECO 0:** Preço médio R$ 445.94 | Margem 375.62%
- **TIPOPRECO 1:** Preço médio R$ 360.49 | Margem 367.16%
- **Diferença:** TIPOPRECO 0 é **23.86% mais caro** que TIPOPRECO 1

**Interpretação:**
- TIPOPRECO 0 = Varejo/Balcão (usado por 96% dos PF)
- TIPOPRECO 1 = Atacado/Revenda (usado por 52% dos PJ)

---

## 🔍 CASO DE TESTE: CLIENTE 18786

### Dados do Cliente

```
Código: 18786
Nome: LEANDRO VIEIRA DE VASCONCELO
Tipo: F (Pessoa Física)
TIPOPRECO: 0
```

### Comparação de Preços

#### Produto 002822 (BICO INJETOR DE FURO)

| Fonte | Valor |
|-------|-------|
| `dbprod.prvenda` | R$ 101.45 |
| `dbformacaoprvenda` (TIPO 0) | **R$ 660.57** |
| `dbformacaoprvenda` (TIPO 1) | R$ 101.45 |

**Observação:** `dbprod.prvenda` corresponde ao TIPOPRECO 1, não ao 0!

#### Produto 414069 (BATERIA MOTO)

| Fonte | Valor |
|-------|-------|
| `dbprod.prvenda` | R$ 115.33 |
| `dbformacaoprvenda` (TIPO 0) | **R$ 145.32** |
| `dbformacaoprvenda` (TIPO 1) | R$ 103.58 |

**Diferenças:**
- TIPO 0 vs dbprod.prvenda: +R$ 29.99 (+26%)
- TIPO 0 vs TIPO 1: +R$ 41.74 (+40%)

---

## 💡 LÓGICA ATUAL DO NEXT.JS

### Arquivo: `src/pages/api/vendas/dbOracle/produto.ts`

```typescript
// Recebe PRVENDA do cliente no body da requisição
const { PRVENDA } = req.body;
const tipoCliente = PRVENDA != null ? String(PRVENDA) : '0';

// Query na tabela de formação de preço
SELECT
  p.CODPROD,
  p.DESCR,
  fp.PRECOVENDA  -- Preço baseado no TIPOPRECO
FROM DBPROD p
LEFT JOIN DBFORMACAOPRVENDA fp
  ON fp.CODPROD = p.CODPROD
  AND fp.TIPOPRECO = :TIPO  -- Usa o PRVENDA do cliente
WHERE ...
```

### Ordem de Prioridade (se implementado kickback):

1. **Kickback** (`dbprecokb.dscbalcao45`) - se existir e > 0
2. **Formação de Preço** (`dbformacaoprvenda.PRECOVENDA`) - baseado no TIPOPRECO
3. **Fallback** - se nenhum dos anteriores

---

## ✅ O NEXT.JS ESTÁ CORRETO?

**SIM, tecnicamente o Next.js está fazendo o correto:**

1. ✅ Busca o TIPOPRECO do cliente (`dbclien.prvenda`)
2. ✅ Usa este TIPOPRECO para buscar o preço em `dbformacaoprvenda`
3. ✅ Retorna o `PRECOVENDA` correspondente

**Mas há uma discrepância:**

O cliente 18786 (PF) tem TIPOPRECO = 0, que resulta em preços muito mais altos. Isso pode ser:

### Cenário A: Next.js está correto, preços são realmente mais altos para PF
- Cliente PF (varejo) paga mais que PJ (atacado)
- TIPOPRECO 0 é o correto para este cliente
- **Ação:** Confirmar se o Delphi mostra os mesmos preços altos

### Cenário B: Delphi faz override do TIPOPRECO
- Delphi pode ter lógica que ignora o `prvenda` do cliente
- Pode usar sempre TIPOPRECO 1 para clientes PF
- Pode determinar o TIPOPRECO baseado em outras regras
- **Ação:** Procurar procedures Oracle que determinam TIPOPRECO dinamicamente

### Cenário C: Cliente cadastrado incorretamente
- Cliente 18786 deveria ter TIPOPRECO = 1, não 0
- Erro de cadastro
- **Ação:** Verificar outros clientes PF e ver se há padrão

---

## 🚨 TESTE NECESSÁRIO NO DELPHI

Para identificar qual cenário é o correto, precisa testar no Delphi:

### Passo a Passo:

1. Abrir o sistema Delphi
2. Criar/abrir uma venda para o cliente **18786**
3. Adicionar os produtos:
   - **002822** (BICO INJETOR DE FURO)
   - **414069** (BATERIA MOTO)
4. **ANOTAR OS PREÇOS EXATOS** que aparecem

### Análise dos Resultados:

#### Se o Delphi mostrar para produto 002822:

- **R$ 660.57** → Delphi usa TIPOPRECO 0 ✅ **Next.js está CORRETO**
- **R$ 101.45** → Delphi usa TIPOPRECO 1 ⚠️ **Há lógica de override**
- **Outro valor** → Pode ter desconto/acréscimo adicional 🔍 **Investigar mais**

#### Se o Delphi mostrar para produto 414069:

- **R$ 145.32** → Delphi usa TIPOPRECO 0 ✅ **Next.js está CORRETO**
- **R$ 103.58** → Delphi usa TIPOPRECO 1 ⚠️ **Há lógica de override**
- **R$ 115.33** → Delphi usa dbprod.prvenda ⚠️ **Ignora formação de preço**
- **Outro valor** → Pode ter desconto/acréscimo adicional 🔍 **Investigar mais**

---

## 📝 PRÓXIMAS AÇÕES

### ⚡ URGENTE - Teste no Delphi

1. Realizar o teste descrito acima
2. Anotar os preços EXATOS
3. Retornar com os resultados

### 🔍 Se houver divergência (Delphi mostra preços diferentes):

1. **Procurar procedures Oracle** que determinam o TIPOPRECO:
   - `OBTER_TIPO_PRECO`
   - `CALCULAR_PRECO_VENDA`
   - `DETERMINAR_TABELA_PRECO`
   - Verificar triggers em vendas

2. **Verificar código Delphi** (se disponível):
   - Como o TIPOPRECO é definido ao abrir venda
   - Se há override baseado em tipo de cliente (F/J)
   - Configurações globais

3. **Implementar a mesma lógica no Next.js**

### ✅ Se NÃO houver divergência (preços batem):

1. Confirmar com o cliente: os preços para PF são realmente mais altos?
2. Verificar se há algum desconto que deveria ser aplicado
3. Confirmar que o sistema está funcionando corretamente

---

## 📁 ARQUIVOS CRIADOS NESTA INVESTIGAÇÃO

### Scripts de Análise:
- `verificar-tipopreco-cliente.ts` - Verifica TIPOPRECO do cliente
- `comparar-precos-delphi-nextjs.ts` - Compara preços entre sistemas
- `analisar-padrao-tipopreco.ts` - Analisa distribuição de TIPOPRECO

### Documentação:
- `ANALISE_PRECO_PRODUTO.md` - Análise da estrutura de preços
- `DIAGNOSTICO_TIPOPRECO.md` - Diagnóstico detalhado do problema
- `RESUMO_INVESTIGACAO_PRECOS.md` - Este arquivo

### Código Next.js:
- `src/pages/api/vendas/dbOracle/produto.ts` - API que busca produtos
- `src/pages/api/formacao-preco/index.ts` - API de formação de preço

---

## 🎯 CONCLUSÃO

O Next.js está **tecnicamente correto** ao buscar o preço da `dbformacaoprvenda` baseado no TIPOPRECO do cliente.

**O problema identificado:**
- Cliente 18786 tem TIPOPRECO = 0 (padrão para 96% dos clientes PF)
- TIPOPRECO 0 tem preços 23.86% mais altos que TIPOPRECO 1
- Precisa confirmar se o Delphi usa o mesmo TIPOPRECO

**Aguardando:**
- Teste no Delphi com cliente 18786 e produtos 002822 e 414069
- Comparação dos preços retornados
- Decisão sobre qual lógica deve ser implementada no Next.js

---

**Última atualização:** 2026-01-10
