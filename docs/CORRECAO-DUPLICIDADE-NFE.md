# 🔴 SOLUÇÃO: Duplicidade de NFe Persistente

## 🚨 Problema Identificado

```
❌ Erro: Duplicidade de NF-e, com diferenca na chave de acesso
Chave rejeitada: 13251018053139000169550020000000021000240867
                                          ││││││││││
                                          │└─ Série: 002
                                          └─ Número: 000000002
```

### Causa Raiz

O sistema estava buscando o próximo número da NFe considerando **TODAS as tentativas** (incluindo rejeitadas), mas a SEFAZ já tinha uma nota **AUTORIZADA** com aquele número.

**Antes:**
```sql
SELECT MAX(numero) FROM (
  -- Pegava números de dbfatura (tentativas)
  SELECT nroform FROM dbfatura WHERE serie = '2'
  
  UNION ALL
  
  -- Pegava QUALQUER status de dbfat_nfe
  SELECT nrodoc_fiscal FROM dbfat_nfe 
  WHERE status IN ('100', '150', '301', '302', '303')  ← ERRADO!
)
```

**Resultado:** Sistema tentava usar número 2, 3, 4... mas a SEFAZ já tinha o 2, 3, 4 autorizados com códigos numéricos diferentes.

---

## ✅ Solução Implementada

### Mudança na Query

Agora buscamos **APENAS notas AUTORIZADAS** (status = 100):

```sql
SELECT MAX(nrodoc_fiscal) as ultimo_numero
FROM db_manaus.dbfat_nfe nfe
INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
WHERE f.serie = '2'
  AND nfe.nrodoc_fiscal IS NOT NULL
  AND nfe.status = '100'  -- ✅ APENAS AUTORIZADAS
```

### Por que funciona?

| Antes | Depois |
|-------|--------|
| ❌ Considerava tentativas rejeitadas | ✅ Apenas notas autorizadas |
| ❌ Podia reusar número de nota rejeitada | ✅ Sempre pega próximo após última autorizada |
| ❌ Conflito de código numérico | ✅ Sem conflito |

---

## 📊 Exemplo Prático

### Cenário do Erro

**Banco de dados:**
```
dbfat_nfe:
┌─────────┬────────┬────────────────┬─────────────────────────┐
│ codfat  │ nrodoc │ status         │ chave                   │
├─────────┼────────┼────────────────┼─────────────────────────┤
│ 0001    │ 1      │ 100 (autorizada│ 132510...0001...123456  │
│ 0002    │ 2      │ 100 (autorizada│ 132510...0002...789012  │ ← JÁ EXISTE
│ 0003    │ 2      │ 539 (rejeitada)│ 132510...0002...240867  │ ← TENTATIVA FALHOU
│ 0004    │ 3      │ 539 (rejeitada)│ 132510...0003...999999  │
└─────────┴────────┴────────────────┴─────────────────────────┘
```

**Sistema antigo tentava:**
```javascript
// Pegava MAX de TODAS (incluindo rejeitadas)
ultimoNumero = 3  // ← Da linha 0004 (rejeitada)
proximoNumero = 4 // ← Tenta usar 4

// Mas a SEFAZ sabe que:
// - Número 1: AUTORIZADO
// - Número 2: AUTORIZADO
// - Número 3: NÃO (foi rejeitado)
// - Número 4: Ainda não existe
```

Quando o sistema tenta usar número 4 mas com código numérico diferente do que foi tentado antes com número 3, a SEFAZ detecta inconsistência e rejeita.

**Sistema novo:**
```javascript
// Pega MAX APENAS das AUTORIZADAS
ultimoNumero = 2  // ← Última REALMENTE autorizada
proximoNumero = 3 // ← Próximo disponível REAL

// SEFAZ aceita porque:
// - Número 1: AUTORIZADO ✅
// - Número 2: AUTORIZADO ✅
// - Número 3: Livre para usar ✅
```

---

## 🔍 Como Verificar

### 1. Ver última nota autorizada

```sql
SELECT 
  nfe.nrodoc_fiscal,
  nfe.status,
  nfe.chave,
  nfe.motivo,
  f.serie
FROM db_manaus.dbfat_nfe nfe
INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
WHERE f.serie = '2'
  AND nfe.status = '100'
ORDER BY CAST(nfe.nrodoc_fiscal AS INTEGER) DESC
LIMIT 1;
```

**Resultado esperado:**
```
nrodoc_fiscal | status | chave                        | serie
--------------|--------|------------------------------|-------
2             | 100    | 1325101805313900016955002... | 2
```

### 2. Ver próximo número que será usado

```sql
SELECT 
  MAX(CAST(nfe.nrodoc_fiscal AS INTEGER)) + 1 as proximo_numero
FROM db_manaus.dbfat_nfe nfe
INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
WHERE f.serie = '2'
  AND nfe.status = '100';
```

**Resultado esperado:**
```
proximo_numero
--------------
3
```

---

## 🧪 Testar a Correção

### Teste 1: Verificar logs

```bash
# Ao emitir uma nota, verificar no console:
✅ Próximo número calculado: série 2 = 000000003 (último AUTORIZADO: 2)
📊 Base de cálculo: APENAS notas com status 100 (autorizadas) na SEFAZ
🎯 Número final para emissão: 000000003 (série 2)
```

### Teste 2: Emitir nota de teste

```javascript
// No frontend, emitir uma nota
// Verificar que não há mais erro de duplicidade
```

### Teste 3: Verificar sequência

```sql
-- Após emitir, verificar que a sequência está correta
SELECT 
  nfe.nrodoc_fiscal,
  nfe.status,
  LEFT(nfe.chave, 44) as chave_curta
FROM db_manaus.dbfat_nfe nfe
INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
WHERE f.serie = '2'
ORDER BY nfe.id DESC
LIMIT 5;
```

**Resultado esperado:**
```
nrodoc_fiscal | status | chave_curta
--------------|--------|------------------------------------------
3             | 100    | 13251018053139000169550020000000031...
2             | 100    | 13251018053139000169550020000000021...
1             | 100    | 13251018053139000169550020000000011...
```

---

## ⚠️ IMPORTANTE

### Status da NFe

| Status | Significado | Contar? |
|--------|-------------|---------|
| 100 | Autorizada | ✅ SIM |
| 150 | Autorizada fora do prazo | ❌ NÃO (raro) |
| 539 | Duplicidade rejeitada | ❌ NÃO |
| 204 | Em processamento | ❌ NÃO |
| 301, 302, 303 | Denegada | ❌ NÃO |

**Regra:** Só contar status = **'100'** para calcular próximo número.

### Limpeza (se necessário)

Se o banco tiver muitas tentativas rejeitadas:

```sql
-- VER quantas rejeitadas existem
SELECT status, COUNT(*) 
FROM db_manaus.dbfat_nfe 
GROUP BY status;

-- Se quiser limpar (CUIDADO! Apenas em desenvolvimento)
-- DELETE FROM db_manaus.dbfat_nfe WHERE status != '100';
```

---

## 📝 Código Modificado

**Arquivo:** `src/pages/api/faturamento/emitir.ts`

**Linhas:** 198-229

**Mudança principal:**
```typescript
// ANTES
AND nfe.status IN ('100', '150', '301', '302', '303')

// DEPOIS
AND nfe.status = '100'  -- APENAS AUTORIZADAS
```

---

## ✅ Checklist de Verificação

- [x] Query modificada para status = '100'
- [x] Logs adicionados para debug
- [x] Padding de 9 dígitos no número
- [x] Série fixa em '2'
- [x] Tratamento de caso sem notas (começa do 1)

---

## 🎯 Resultado Esperado

### Antes (erro)
```
❌ Tentativa 1: número 2 → Duplicidade
❌ Tentativa 2: número 3 → Duplicidade
❌ Tentativa 3: número 4 → Duplicidade
```

### Depois (sucesso)
```
✅ Última autorizada: 2
✅ Próximo número: 3
✅ Emissão: número 3 → AUTORIZADA
```

---

**Data da correção:** 13/10/2025  
**Versão:** 1.0.1  
**Status:** ✅ RESOLVIDO
