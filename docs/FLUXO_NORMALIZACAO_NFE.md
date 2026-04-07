# Fluxo de Normalização e Associação de NFe

## 🎯 Entendendo o Processo de "Normalização"

Quando você disse "salada de normalização", está correto! O processo de associação de NFe é realmente um **processo de normalização de dados** em múltiplas etapas.

---

## 📊 Visão Geral do Fluxo

```
XML da NFe (dados brutos, não normalizados)
              ↓
     [NORMALIZAÇÃO ETAPA 1]
              ↓
    Tabelas: nfe_entrada + nfe_itens
              ↓
     [NORMALIZAÇÃO ETAPA 2]
              ↓
    Associação: nfe_itens → dbprod (catálogo)
              ↓
    Tabela: nfe_item_associacao (junção 1:1)
              ↓
     [NORMALIZAÇÃO ETAPA 3]
              ↓
    Associação: produto → OCs (múltiplas)
              ↓
    Tabela: nfe_item_pedido_associacao (junção N:M)
              ↓
     [ATUALIZAÇÃO DE ESTOQUE]
              ↓
    Atualização: cmp_it_requisicao.itr_quantidade_atendida
```

---

## 🔄 Detalhamento Passo a Passo

### **ETAPA 1: Importação do XML (Dados Brutos)**

**Entrada:** Arquivo XML da NFe

**Exemplo de XML:**
```xml
<NFe>
  <infNFe>
    <ide>
      <nNF>12345</nNF>
      <serie>1</serie>
    </ide>
    <emit>
      <CNPJ>12345678000190</CNPJ>
      <xNome>FORNECEDOR LTDA</xNome>
    </emit>
    <det nItem="1">
      <prod>
        <cProd>ABC123</cProd>
        <xProd>ROLAMENTO TIMKEN 30205</xProd>
        <qCom>10</qCom>
        <vUnCom>45.00</vUnCom>
        <cEAN>7898765432109</cEAN>
      </prod>
    </det>
  </infNFe>
</NFe>
```

**Saída:** Tabelas PostgreSQL

**Tabela: `nfe_entrada`**
```
id | numero_nf | serie | fornecedor_id      | valor_total | status
1  | 12345     | 1     | 12345678000190     | 450.00      | RECEBIDA
```

**Tabela: `nfe_itens`**
```
id | nfe_id | codigo_produto_nfe | descricao              | quantidade | valor_unitario | codigo_barras
1  | 1      | ABC123             | ROLAMENTO TIMKEN 30205 | 10         | 45.00          | 7898765432109
```

**✅ Resultado da Etapa 1:**
- XML "plano" → estrutura relacional (normalizado)
- Dados brutos armazenados sem relacionamento com catálogo

---

### **ETAPA 2: Associação Item NFe → Produto do Catálogo**

**Problema a resolver:**
- Item da NFe usa código/descrição do **fornecedor** (ABC123, "ROLAMENTO TIMKEN 30205")
- Catálogo interno usa código **próprio** (347790, "ROL 30205 MAK B0386")
- **Precisamos fazer o "de-para"** (mapeamento)

**Processo:**

1. **Usuário busca produto por:**
   - Código de barras: `7898765432109`
   - Ou descrição: "ROLAMENTO 30205"

2. **Sistema consulta `dbprod`:**
```sql
SELECT codprod, descr, codbar
FROM dbprod
WHERE codbar = '7898765432109'
   OR LOWER(descr) LIKE '%rolamento%' AND LOWER(descr) LIKE '%30205%';
```

**Resultado:**
```
codprod | descr               | codbar
347790  | ROL 30205 MAK B0386 | 7898765432109
```

3. **Usuário confirma: "Sim, este é o produto correto!"**

4. **Sistema cria associação na tabela `nfe_item_associacao`:**

**Tabela: `nfe_item_associacao`**
```
id | nfe_id | nfe_item_id | produto_cod | quantidade_associada | valor_unitario | status
1  | 1      | 1           | 347790      | 10                   | 45.00          | ASSOCIADO
```

**✅ Resultado da Etapa 2:**
- Item da NFe agora "conhece" o produto do catálogo
- Relacionamento **1:1** estabelecido: `nfe_itens → dbprod`

---

### **ETAPA 3: Associação Produto → Ordens de Compra (N:M)**

**Problema a resolver:**
- NFe traz 10 unidades do produto 347790
- Mas temos **múltiplas Ordens de Compra (OCs)** aguardando entrega:
  - OC 10001: aguardando 5 unidades
  - OC 10002: aguardando 5 unidades
  - OC 10003: aguardando 20 unidades (não vamos usar)
- **Precisamos distribuir a quantidade entre OCs** (relacionamento N:M)

**Processo:**

1. **Sistema busca OCs disponíveis para o produto 347790:**

```sql
SELECT
  o.orc_id,
  ri.itr_quantidade,
  COALESCE(ri.itr_quantidade_atendida, 0) as atendida,
  (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) as disponivel
FROM cmp_ordem_compra o
INNER JOIN cmp_requisicao r ON o.orc_req_id = r.req_id
INNER JOIN cmp_it_requisicao ri ON r.req_id = ri.itr_req_id AND ri.itr_codprod = '347790'
WHERE o.orc_status = 'A'  -- Apenas ativas
  AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0;
```

**Resultado:**
```
orc_id | itr_quantidade | atendida | disponivel
10001  | 100            | 95       | 5         ← pode receber até 5
10002  | 50             | 45       | 5         ← pode receber até 5
10003  | 30             | 10       | 20        ← pode receber até 20
```

2. **Usuário distribui a quantidade (10 unidades da NFe):**

```
┌─────────────────────────────────────────┐
│ Ordem Compra | Disponível | Associar   │
├─────────────────────────────────────────┤
│ 10001        | 5          | [5] ←      │
│ 10002        | 5          | [5] ←      │
│ 10003        | 20         | [0]        │
└─────────────────────────────────────────┘
Total: 10 ✅ (igual à NFe)
```

3. **Sistema cria múltiplas associações em `nfe_item_pedido_associacao`:**

**Tabela: `nfe_item_pedido_associacao`**
```
id | nfe_associacao_id | nfe_id | req_id | quantidade | valor_unitario
1  | 1                 | 1      | 10001  | 5          | 45.00
2  | 1                 | 1      | 10002  | 5          | 45.00
```

**✅ Resultado da Etapa 3:**
- Produto agora está "amarrado" às OCs correspondentes
- Relacionamento **N:M** estabelecido: `produto → OCs` (uma NFe pode ter múltiplos produtos, cada produto pode ir para múltiplas OCs)

---

### **ETAPA 4: Atualização de Quantidade Atendida**

**Problema a resolver:**
- OCs precisam saber quanto já foi recebido
- Campo `itr_quantidade_atendida` controla isso

**Processo:**

Para cada associação criada, sistema atualiza:

```sql
-- Para OC 10001:
UPDATE cmp_it_requisicao
SET itr_quantidade_atendida = COALESCE(itr_quantidade_atendida, 0) + 5
WHERE itr_req_id = 10001 AND itr_codprod = '347790';

-- Para OC 10002:
UPDATE cmp_it_requisicao
SET itr_quantidade_atendida = COALESCE(itr_quantidade_atendida, 0) + 5
WHERE itr_req_id = 10002 AND itr_codprod = '347790';
```

**Antes:**
```
itr_req_id | itr_codprod | itr_quantidade | itr_quantidade_atendida | disponivel
10001      | 347790      | 100            | 95                      | 5
10002      | 347790      | 50             | 45                      | 5
```

**Depois:**
```
itr_req_id | itr_codprod | itr_quantidade | itr_quantidade_atendida | disponivel
10001      | 347790      | 100            | 100 ← COMPLETO!         | 0
10002      | 347790      | 50             | 50  ← COMPLETO!         | 0
```

**✅ Resultado da Etapa 4:**
- Requisições sabem que já receberam os produtos
- Próxima NFe não poderá usar essas OCs (disponível = 0)

---

## 🗂️ Diagrama de Relacionamentos Completo

```
┌─────────────────┐
│   nfe_entrada   │ ← Cabeçalho da NFe (1 registro por XML)
│ id: 1           │
│ numero_nf: 12345│
└────────┬────────┘
         │ 1:N (uma NFe tem vários itens)
         ↓
┌─────────────────┐
│    nfe_itens    │ ← Itens do XML (vários por NFe)
│ id: 1           │
│ nfe_id: 1       │
│ codigo: ABC123  │
│ descr: ROLAM... │
└────────┬────────┘
         │ 1:1 (cada item associa com 1 produto)
         ↓
┌──────────────────────┐      ┌─────────────────┐
│ nfe_item_associacao  │ ───→ │     dbprod      │ ← Catálogo
│ id: 1                │ 1:1  │ codprod: 347790 │
│ nfe_item_id: 1       │      │ descr: ROL...   │
│ produto_cod: 347790  │      └─────────────────┘
└──────────┬───────────┘
           │ 1:N (um produto pode ir para várias OCs)
           ↓
┌────────────────────────────┐
│ nfe_item_pedido_associacao │ ← Tabela N:M
│ id: 1                      │
│ nfe_associacao_id: 1       │
│ req_id: 10001              │───┐
│ quantidade: 5              │   │
├────────────────────────────┤   │
│ id: 2                      │   │
│ nfe_associacao_id: 1       │   │
│ req_id: 10002              │───┤
│ quantidade: 5              │   │
└────────────────────────────┘   │
                                 │ N:M
         ┌───────────────────────┴─────────────────────┐
         ↓                                             ↓
┌──────────────────────┐                  ┌──────────────────────┐
│ cmp_ordem_compra     │                  │ cmp_ordem_compra     │
│ orc_id: 10001        │                  │ orc_id: 10002        │
│ orc_req_id: 5001     │                  │ orc_req_id: 5002     │
└──────────┬───────────┘                  └──────────┬───────────┘
           │                                         │
           ↓                                         ↓
┌──────────────────────┐                  ┌──────────────────────┐
│ cmp_it_requisicao    │                  │ cmp_it_requisicao    │
│ itr_req_id: 5001     │                  │ itr_req_id: 5002     │
│ itr_codprod: 347790  │                  │ itr_codprod: 347790  │
│ itr_qtd: 100         │                  │ itr_qtd: 50          │
│ itr_qtd_atend: 100 ✅│                  │ itr_qtd_atend: 50 ✅ │
└──────────────────────┘                  └──────────────────────┘
```

---

## 📝 Por Que Este Processo é "Normalização"?

### **Definição de Normalização em BD:**
> Processo de organizar dados em tabelas relacionais para eliminar redundância e garantir integridade.

### **O que estamos fazendo:**

1. **Desnormalização inicial:**
   - XML da NFe é um arquivo "plano" (não normalizado)
   - Tudo está misturado: fornecedor, itens, valores...

2. **Normalização em 3 etapas:**
   - **1ª Forma Normal (1FN):** Separar NFe em tabelas (cabeçalho + itens)
   - **2ª Forma Normal (2FN):** Criar chave estrangeira item → produto
   - **3ª Forma Normal (3FN):** Resolver dependência transitiva item → produto → OCs

3. **Resultado:**
   - Dados organizados em múltiplas tabelas relacionais
   - Sem redundância (produto cadastrado 1x, reutilizado N vezes)
   - Integridade referencial garantida por FKs

---

## ⚠️ Problemas Comuns (O que pode dar errado)

### **1. Item da NFe não encontra produto no catálogo**
```
❌ Erro: Produto "ROLAMENTO TIMKEN 30205" não existe no dbprod
```

**Solução:** Usuário precisa:
- Buscar manualmente por código similar ("30205")
- Ou cadastrar produto antes de associar

---

### **2. Quantidade da NFe > Quantidade disponível nas OCs**
```
❌ Erro: NFe tem 20 unidades, mas OCs só aguardam 10
```

**Solução:** Usuário precisa:
- Criar nova requisição/OC para receber o excedente
- Ou fazer entrada parcial (apenas 10 unidades)

---

### **3. Fornecedor da NFe ≠ Fornecedor da OC**
```
❌ Erro: NFe do fornecedor A, mas OC é do fornecedor B
```

**Solução:**
- Sistema bloqueia automaticamente
- Usuário precisa verificar se está associando com a OC correta

---

### **4. Divergência de preço > 20%**
```
❌ Erro: Preço NFe = R$ 55, Preço OC = R$ 45 (22% diferença)
```

**Solução:**
- Sistema bloqueia automaticamente
- Usuário precisa contatar fornecedor ou comprador

---

## 🎯 Conclusão

**Sim, é uma "salada de normalização"!** Mas uma salada bem organizada:

1. **XML bruto** → `nfe_entrada` + `nfe_itens` (parsing)
2. **Item da NFe** → `dbprod` (mapeamento de-para)
3. **Produto** → `cmp_ordem_compra` (distribuição N:M)
4. **Atualização** → `cmp_it_requisicao.itr_quantidade_atendida` (controle)

**Cada etapa resolve um problema específico de normalização:**
- Etapa 1: Estruturar dados planos
- Etapa 2: Relacionar com entidades existentes
- Etapa 3: Resolver relacionamento N:M
- Etapa 4: Manter consistência transacional

---

**Última Atualização:** 2025-01-28
**Versão:** 1.0
