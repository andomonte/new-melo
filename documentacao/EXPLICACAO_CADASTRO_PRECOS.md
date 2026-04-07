# 💰 EXPLICAÇÃO: Cadastro de Preços - Delphi vs Next.js

## Data: 11 de Janeiro de 2026

---

## 🎯 Resposta Direta

### NO DELPHI:
✅ **Os campos de preço ESTÃO dentro do cadastro de produto**
- Campos: `prvenda`, `primp`, `impfat`, `impfab`, `concor`, `txdolarvenda`
- Esses são os **preços base** do produto

❗ **MAS também existe uma tabela separada para preços por categoria de cliente:**
- Tabela: `DBFORMACAOPRVENDA`
- Contém 8 tipos de preço (TIPOPRECO 0-7) para cada produto
- É **RECALCULADA AUTOMATICAMENTE** quando salva o produto

### NO NEXT.JS:
✅ **Os campos de preço também ESTÃO no cadastro de produto**
- Mesmos campos do Delphi já implementados
- Localização: Aba "Dados de Custos" no formulário

❌ **MAS não tem a lógica de recalcular DBFORMACAOPRVENDA automaticamente**
- A tabela `dbformacaoprvenda` existe no PostgreSQL
- Mas não é atualizada quando cadastra/edita produto

---

## 📊 Como Funciona no Delphi

### 1. Campos de Preço no Cadastro de Produto

**Aba "Dados de Custos" no UNIPRODUTO.PAS:**

```delphi
// PREÇOS BASE (salvos na tabela PRODUTO)
EdtPrVenda        → prvenda       // Preço Venda
EdtPrImp          → primp         // Preço Importação
EdtImpFat         → impfat        // Importação Fatura
EdtImpFab         → impfab        // Importação Fábrica
EdtConcor         → concor        // Preço Concorrência
EdtTxDolarVenda   → txdolarvenda  // Taxa Dólar Venda
```

### 2. Procedure spInc_Produto (Inserir)

Quando você **cadastra um produto** no Delphi:

```sql
-- 1. Insere o produto com preços base
INSERT INTO PRODUTO (
  CODPROD, REF, DESCR,
  PRVENDA, PRIMP, IMPFAT, ... -- Preços base
) VALUES (...);

-- 2. RECALCULA preços por categoria na DBFORMACAOPRVENDA
FOR i IN 0..7 LOOP
  INSERT INTO DBFORMACAOPRVENDA (
    CODPROD,
    TIPOPRECO,    -- 0 a 7 (categoria do cliente)
    PRECOVENDA    -- Preço calculado baseado no prvenda + margem
  ) VALUES (
    vCodProd,
    i,
    fnCalculaPreco(vCodProd, i, vPrVenda, vMargem, ...)
  );
END LOOP;

COMMIT;
```

### 3. Procedure spAlt_Produto (Editar)

Quando você **edita um produto** no Delphi:

```sql
-- 1. Atualiza produto
UPDATE PRODUTO SET
  PRVENDA = vPrVenda,
  PRIMP = vPrImp,
  ...
WHERE CODPROD = vCodProd;

-- 2. RECALCULA preços automaticamente
FOR i IN 0..7 LOOP
  UPDATE DBFORMACAOPRVENDA
  SET PRECOVENDA = fnCalculaPreco(vCodProd, i, ...)
  WHERE CODPROD = vCodProd AND TIPOPRECO = i;
END LOOP;

COMMIT;
```

**Localização:** `PROCEDURES_ORACLE_PRODUTOS_FALTANTES.md` (linhas 213-218)

---

## 📊 Como Funciona no Next.js (ATUAL)

### 1. Campos de Preço no Cadastro

**Arquivo:** `src/components/corpo/admin/cadastro/produtos/_forms/DadosCustos.tsx`

```typescript
// PREÇOS BASE (mesmos do Delphi)
<FormInput name="prvenda" label="Preço Venda" ... />
<FormInput name="primp" label="Preço Importação" ... />
<FormInput name="impfat" label="Preço Importação Fatura" ... />
<FormInput name="impfab" label="Preço Importação Fábrica" ... />
<FormInput name="concor" label="Preço Concorrência" ... />
<FormInput name="txdolarvenda" label="Taxa Dólar" ... />
```

✅ **Status:** IMPLEMENTADO

### 2. API de Inserção

**Arquivo:** `src/pages/api/produtos/add.ts`

```typescript
// Insere produto no PostgreSQL
const query = `
  INSERT INTO db_manaus.dbprod (
    codprod, ref, descr,
    prvenda, primp, impfat, ...  -- Preços base
  ) VALUES ($1, $2, $3, $4, $5, $6, ...)
`;

await pool.query(query, [
  data.codprod, data.ref, data.descr,
  data.prvenda, data.primp, data.impfat, ...
]);
```

❌ **Problema:** NÃO recalcula `dbformacaoprvenda` automaticamente!

### 3. API de Edição

**Arquivo:** `src/pages/api/produtos/edit.ts`

```typescript
// Atualiza produto
const query = `
  UPDATE db_manaus.dbprod SET
    prvenda = $1,
    primp = $2,
    ...
  WHERE codprod = $X
`;

await pool.query(query, [
  data.prvenda, data.primp, ...
]);
```

❌ **Problema:** NÃO recalcula `dbformacaoprvenda` automaticamente!

---

## 🔍 O que é DBFORMACAOPRVENDA?

### Estrutura da Tabela

```sql
CREATE TABLE dbformacaoprvenda (
  codprod VARCHAR(6),      -- Código do produto
  tipopreco INTEGER,        -- 0 a 7 (categoria do cliente)
  precovenda NUMERIC,       -- Preço calculado para essa categoria
  margem NUMERIC,           -- Margem aplicada
  ...
);
```

### Os 8 Tipos de Preço (TIPOPRECO)

| TIPOPRECO | Categoria Cliente | Descrição |
|-----------|-------------------|-----------|
| 0 | Balcão | Cliente comum, preço padrão |
| 1 | Especial | Cliente especial, desconto médio |
| 2 | Distribuidor | Distribuidor, desconto maior |
| 3 | Filial | Venda para filial |
| 4 | Importação | Preço de importação |
| 5 | Zona Franca (ZFM) | Cliente Zona Franca Manaus |
| 6 | Fora do Estado | Cliente de outro estado |
| 7 | Promoção | Preço promocional |

### Cálculo do Preço

```sql
PRECOVENDA = PRVENDA * (1 + MARGEM/100)
```

Exemplo:
- `prvenda` = R$ 100,00
- Margem para cliente Balcão (TIPOPRECO 0) = 20%
- `precovenda` = R$ 100,00 * 1,20 = R$ 120,00

---

## ❌ Problema Atual no Next.js

### Quando você cadastra/edita um produto:

1. ✅ Salva os preços base na tabela `dbprod`
2. ❌ **NÃO atualiza** a tabela `dbformacaoprvenda`
3. ❌ Preços por categoria de cliente ficam **DESATUALIZADOS**

### Consequência:

- Sistema de vendas consulta `dbformacaoprvenda` para pegar preço por categoria
- Se tabela não for atualizada, mostra preços errados ou desatualizados

---

## ✅ Solução Necessária

### Opção 1: Replicar Lógica do Delphi (RECOMENDADO)

Modificar as APIs do Next.js para recalcular preços automaticamente:

**`src/pages/api/produtos/add.ts`:**
```typescript
// 1. Insere produto
await pool.query('INSERT INTO dbprod ...');

// 2. Recalcula preços por categoria
for (let tipopreco = 0; tipopreco <= 7; tipopreco++) {
  const precocalculado = calcularPreco(
    data.prvenda,
    margemPorTipo[tipopreco]
  );

  await pool.query(`
    INSERT INTO dbformacaoprvenda (codprod, tipopreco, precovenda)
    VALUES ($1, $2, $3)
  `, [data.codprod, tipopreco, precocalculado]);
}
```

### Opção 2: Criar Tela Separada (Trabalhoso)

Criar uma tela específica para gerenciar preços por categoria:
- `/admin/cadastro/produtos/precos`
- Permite editar manualmente cada TIPOPRECO

**Não recomendado:** Trabalhoso e perde automação do Delphi

---

## 📋 Resumo Final

| Aspecto | Delphi | Next.js |
|---------|--------|---------|
| **Campos de preço no cadastro** | ✅ SIM (aba custos) | ✅ SIM (aba custos) |
| **Tabela DBFORMACAOPRVENDA** | ✅ Recalcula automaticamente | ❌ NÃO recalcula |
| **Tela separada de preços** | ❌ NÃO tem | ❌ NÃO tem |
| **Preços por categoria** | ✅ Automático | ❌ Manual (se houver) |

---

## 🎯 Conclusão

**Respondendo sua pergunta:**

1. ✅ Os campos de preço **ESTÃO** no cadastro de produto do Delphi
2. ✅ Esses campos **FORAM** incluídos no Next.js
3. ❌ Mas falta a lógica de **recalcular** `dbformacaoprvenda` automaticamente
4. ❌ Não tem tela separada nem no Delphi nem no Next.js - tudo está no cadastro de produto

**Problema:** Next.js salva preços base mas não atualiza preços por categoria de cliente.

**Solução:** Implementar lógica de recálculo automático nas APIs add.ts e edit.ts.
