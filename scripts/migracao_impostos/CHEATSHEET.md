# Cheatsheet - Tabelas de Impostos

Guia rápido de referência para uso diário das tabelas migradas.

---

## 🚀 Comandos Rápidos

```bash
# Ver resumo completo
node scripts/migracao_impostos/resumo.js

# Verificar estrutura das tabelas
node scripts/migracao_impostos/debug_tables.js

# Testar consultas
node scripts/migracao_impostos/testar_consultas.js

# Recriar índices
node scripts/migracao_impostos/criar_indices.js

# Re-executar migração completa (⚠️ sobrescreve dados)
node scripts/migracao_impostos/migracao_completa.js
```

---

## 📋 Queries Mais Usadas

### 1. Buscar MVA por NCM

```sql
SELECT
  l."LEI_PROTOCOLO",
  ln."LIN_MVA_ST_ORIGINAL" AS mva_percent,
  l."LEI_MVA_AJUSTADA" AS formula
FROM cad_legislacao_icmsst_ncm ln
JOIN cad_legislacao_icmsst l ON l."LEI_ID" = ln."LIN_LEI_ID"
WHERE ln."LIN_NCM" = '84213920'
  AND ln."LIN_STATUS" = 'REGRA'
  AND l."LEI_STATUS" = 'EM VIGOR';
```

**Resultado esperado:**
```
LEI_PROTOCOLO | mva_percent | formula
--------------|-------------|----------------------------------
36            | 71.780      | ((1 + :MVA_ST_ORIGINAL) * ...)
```

---

### 2. Listar NCMs de um Protocolo

```sql
SELECT
  ln."LIN_NCM",
  ln."LIN_MVA_ST_ORIGINAL"
FROM cad_legislacao_icmsst l
JOIN cad_legislacao_icmsst_ncm ln ON ln."LIN_LEI_ID" = l."LEI_ID"
WHERE l."LEI_PROTOCOLO" = '41'
  AND l."LEI_STATUS" = 'EM VIGOR'
ORDER BY ln."LIN_NCM"
LIMIT 10;
```

---

### 3. Buscar Alíquota por Código

```sql
SELECT * FROM fis_tributo_aliquota WHERE codigo = 'A001';
```

**Resultado:**
```
codigo | n_ne_co | s_se | importado
-------|---------|------|----------
A001   | 5       | 10   | 13
```

---

### 4. Buscar CEST por NCM

```sql
SELECT cest, descricao
FROM dbcest
WHERE ncm = '9032899';
```

---

### 5. Buscar NCM por Prefixo

```sql
SELECT ln."LIN_NCM", ln."LIN_MVA_ST_ORIGINAL"
FROM cad_legislacao_icmsst_ncm ln
WHERE ln."LIN_NCM" LIKE '8421%'
  AND ln."LIN_STATUS" = 'REGRA'
LIMIT 10;
```

---

### 6. Contar Registros

```sql
SELECT
  'cad_legislacao_icmsst' AS tabela,
  COUNT(*) AS total
FROM cad_legislacao_icmsst

UNION ALL

SELECT 'cad_legislacao_icmsst_ncm', COUNT(*)
FROM cad_legislacao_icmsst_ncm

UNION ALL

SELECT 'fis_tributo_aliquota', COUNT(*)
FROM fis_tributo_aliquota

UNION ALL

SELECT 'dbcest', COUNT(*)
FROM dbcest;
```

---

## 🔧 Manutenção

### Verificar Performance de Índice

```sql
EXPLAIN ANALYZE
SELECT * FROM cad_legislacao_icmsst_ncm
WHERE "LIN_NCM" = '84213920';
```

**Esperado:** `Execution Time: < 1ms`

---

### Listar Índices Criados

```sql
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN (
  'cad_legislacao_icmsst',
  'cad_legislacao_icmsst_ncm',
  'fis_tributo_aliquota',
  'dbcest'
)
AND indexname LIKE 'idx_%'
ORDER BY tablename;
```

---

### Verificar Tamanho das Tabelas

```sql
SELECT
  schemaname AS schema,
  tablename AS table,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN (
  'cad_legislacao_icmsst',
  'cad_legislacao_icmsst_ncm',
  'fis_tributo_aliquota',
  'dbcest'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 📊 Estatísticas Rápidas

### Top 5 Protocolos com Mais NCMs

```sql
SELECT
  l."LEI_PROTOCOLO",
  COUNT(ln."LIN_ID") AS total_ncms
FROM cad_legislacao_icmsst l
JOIN cad_legislacao_icmsst_ncm ln ON ln."LIN_LEI_ID" = l."LEI_ID"
WHERE l."LEI_STATUS" = 'EM VIGOR'
GROUP BY l."LEI_PROTOCOLO"
ORDER BY total_ncms DESC
LIMIT 5;
```

---

### NCMs sem MVA Definida

```sql
SELECT "LIN_NCM"
FROM cad_legislacao_icmsst_ncm
WHERE "LIN_MVA_ST_ORIGINAL" IS NULL
  AND "LIN_STATUS" = 'REGRA'
LIMIT 10;
```

---

### Segmentos CEST

```sql
SELECT
  segmento,
  COUNT(*) AS total
FROM dbcest
GROUP BY segmento
ORDER BY total DESC;
```

---

## 💡 Cálculo de ST

### Fórmula Padrão de MVA Ajustada

```javascript
const mvaOriginal = 71.78 / 100;  // 71.78%
const aliqInter = 0.12;            // 12%
const aliqIntra = 0.17;            // 17%

const mvaAjustada = (
  (1 + mvaOriginal) * (1 - aliqInter) / (1 - aliqIntra)
) - 1;

console.log(`MVA Ajustada: ${(mvaAjustada * 100).toFixed(2)}%`);
// Resultado: MVA Ajustada: 76.03%
```

---

### Cálculo Completo de ICMS-ST

```javascript
const valorProduto = 100.00;
const mvaAjustada = 76.03 / 100;
const aliqIntra = 0.17;
const aliqInter = 0.12;

// 1. Base de Cálculo ST
const baseCalcST = valorProduto * (1 + mvaAjustada);
// baseCalcST = 176.03

// 2. ICMS ST
const icmsST = baseCalcST * aliqIntra - valorProduto * aliqInter;
// icmsST = 17.93

console.log(`Valor Produto: R$ ${valorProduto}`);
console.log(`Base Calc ST: R$ ${baseCalcST.toFixed(2)}`);
console.log(`ICMS ST: R$ ${icmsST.toFixed(2)}`);
```

---

## 🎯 Casos de Uso Comuns

### 1. Produto Novo - Verificar se tem ST

```sql
-- Substitua '12345678' pelo NCM do produto
SELECT
  CASE
    WHEN ln."LIN_ID" IS NOT NULL THEN 'TEM ST'
    ELSE 'SEM ST'
  END AS status_st,
  ln."LIN_MVA_ST_ORIGINAL" AS mva
FROM (SELECT '12345678' AS ncm) p
LEFT JOIN cad_legislacao_icmsst_ncm ln
  ON ln."LIN_NCM" = p.ncm
  AND ln."LIN_STATUS" = 'REGRA'
LEFT JOIN cad_legislacao_icmsst l
  ON l."LEI_ID" = ln."LIN_LEI_ID"
  AND l."LEI_STATUS" = 'EM VIGOR';
```

---

### 2. Atualizar MVA de Vários Produtos

```sql
-- Listar produtos que precisam atualização
SELECT
  p.codprod,
  p.ncm,
  ln."LIN_MVA_ST_ORIGINAL" AS mva_novo
FROM produtos p
JOIN cad_legislacao_icmsst_ncm ln ON ln."LIN_NCM" = p.ncm
JOIN cad_legislacao_icmsst l ON l."LEI_ID" = ln."LIN_LEI_ID"
WHERE l."LEI_STATUS" = 'EM VIGOR'
  AND ln."LIN_STATUS" = 'REGRA'
  AND (p.mva_st IS NULL OR p.mva_st <> ln."LIN_MVA_ST_ORIGINAL");
```

---

### 3. Validar NCM de Nota Fiscal

```sql
-- Validar se NCM da NF está sujeito a ST
CREATE OR REPLACE FUNCTION validar_ncm_st(ncm_param VARCHAR)
RETURNS TABLE(
  tem_st BOOLEAN,
  protocolo VARCHAR,
  mva NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ln."LIN_ID" IS NOT NULL AS tem_st,
    l."LEI_PROTOCOLO" AS protocolo,
    ln."LIN_MVA_ST_ORIGINAL" AS mva
  FROM cad_legislacao_icmsst_ncm ln
  JOIN cad_legislacao_icmsst l ON l."LEI_ID" = ln."LIN_LEI_ID"
  WHERE ln."LIN_NCM" = ncm_param
    AND ln."LIN_STATUS" = 'REGRA'
    AND l."LEI_STATUS" = 'EM VIGOR'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Uso:
SELECT * FROM validar_ncm_st('84213920');
```

---

## ⚠️ Atenção

### Aspas Duplas são OBRIGATÓRIAS

```sql
-- ✅ CORRETO
SELECT "LEI_ID" FROM cad_legislacao_icmsst;

-- ❌ ERRADO (vai dar erro)
SELECT lei_id FROM cad_legislacao_icmsst;
```

---

### Sempre Filtrar por Status

```sql
-- ✅ CORRETO - Filtra status
WHERE ln."LIN_STATUS" = 'REGRA'
  AND l."LEI_STATUS" = 'EM VIGOR'

-- ⚠️ ATENÇÃO - Pode trazer dados revogados
WHERE ln."LIN_NCM" = '84213920'
```

---

## 📞 Suporte Rápido

**Erro:** `column "lei_id" does not exist`
**Solução:** Use aspas duplas → `"LEI_ID"`

**Erro:** Query lenta
**Solução:** Verifique se índices estão criados:
```bash
node scripts/migracao_impostos/criar_indices.js
```

**Erro:** Tabela não existe
**Solução:** Execute migração:
```bash
node scripts/migracao_impostos/migracao_completa.js
```

---

## 📚 Documentação Completa

Para informações detalhadas, consulte:
- `README.md` - Guia completo
- `RELATORIO_MIGRACAO.md` - Relatório detalhado
- `exemplo_integracao.ts` - Código TypeScript
- `exemplo_consultas.sql` - 10 exemplos SQL

---

**Quick Links:**
- 📁 Diretório: `E:\src\next\sistemas\clones\melo\site-melo\scripts\migracao_impostos\`
- 🌐 PostgreSQL: `servicos.melopecas.com.br:5432`
- 📊 Total Registros: 3.207
- ⚡ Performance: < 20ms

**Última atualização:** 2026-01-09
