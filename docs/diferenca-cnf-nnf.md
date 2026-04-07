# Diferença entre cNF e nNF - Campos da NFe

## 📊 Visão Geral

A NFe possui DOIS números diferentes que causam muita confusão:

| Campo | Nome | Tamanho | Tipo | Onde salvar | Exemplo |
|-------|------|---------|------|-------------|---------|
| **nNF** | Número da NFe | 1-9 dígitos | Sequencial | `dbfatura.nroform` | 33516 |
| **cNF** | Código Numérico | 8 dígitos | Aleatório | `dbfat_nfe.nrodoc_fiscal` | 00016156 |

---

## 🎯 Função de Cada Campo

### nNF (Número da NFe)
- **Sequencial** por série
- **Controlado** pelo emissor
- **Visível** para o cliente
- **Usado** para identificação humana
- **Exemplo**: NFe 33516, 33517, 33518...

### cNF (Código Numérico)
- **Aleatório** de 8 dígitos
- **Único** para cada tentativa
- **Invisível** para o cliente (só na chave)
- **Usado** para compor a chave de acesso
- **Exemplo**: 00016156, 00016157, 00016158...

---

## 📋 Estrutura do XML

```xml
<NFe>
  <infNFe Id="NFe44250107522002000104550010000335161001615610">
    <ide>
      <serie>AA</serie>           <!-- Série alfanumérica -->
      <nNF>33516</nNF>            <!-- ← NÚMERO DA NFE (sequencial) -->
      <cNF>00016156</cNF>         <!-- ← CÓDIGO NUMÉRICO (8 dígitos aleatórios) -->
    </ide>
  </infNFe>
</NFe>
```

---

## 🔑 Chave de Acesso (44 dígitos)

```
44 2501 07522002000104 55 001 000033516 1 00016156 10
│  │    │              │  │   │         │ │        │
│  │    │              │  │   │         │ │        └─ DV (dígito verificador)
│  │    │              │  │   │         │ └─────────── cNF (8 dígitos)
│  │    │              │  │   │         └──────────── Tipo emissão
│  │    │              │  │   └────────────────────── nNF (9 dígitos com zeros)
│  │    │              │  └────────────────────────── Série (3 dígitos numéricos)
│  │    │              └───────────────────────────── Modelo (55 = NFe)
│  │    └──────────────────────────────────────────── CNPJ do emissor
│  └───────────────────────────────────────────────── AAMM (ano e mês)
└──────────────────────────────────────────────────── UF (44 = SC)
```

**Importante:** 
- Na chave, série deve ser numérica (001), mesmo que no XML seja "AA"
- nNF é formatado com 9 dígitos (zeros à esquerda)
- cNF é sempre 8 dígitos

---

## 🗄️ Salvamento no Banco de Dados

### Tabela: dbfatura
```sql
CREATE TABLE dbfatura (
  codfat SERIAL PRIMARY KEY,
  serie VARCHAR(3),        -- ✅ Série: AA, AB, 1, 2...
  nroform VARCHAR(20),     -- ✅ Número da NFe (nNF): 33516
  ...
);
```

### Tabela: dbfat_nfe
```sql
CREATE TABLE dbfat_nfe (
  id SERIAL PRIMARY KEY,
  codfat INTEGER,          -- FK para dbfatura
  nrodoc_fiscal VARCHAR(20), -- ✅ Código Numérico (cNF): 00016156
  chave VARCHAR(44),       -- Chave completa
  ...
);
```

**❌ ERRO COMUM:**
```typescript
// ERRADO - salvar nNF no nrodoc_fiscal
const nrodoc_fiscal = numeroNFe; // numeroNFe = nNF (33516)
```

**✅ CORRETO:**
```typescript
// CERTO - salvar cNF no nrodoc_fiscal
const codnumerico = dados?.ide?.cNF || gerarCNF8Digitos();
const nrodoc_fiscal = codnumerico; // cNF (00016156)
```

---

## 🔄 Fluxo Completo

### 1. Geração (gerarXml.ts)
```typescript
const numeroNF = parseInt(nroform, 10);     // nNF: 33516
const cNF = gerarCodigo8Digitos();          // cNF: 00016156

// XML gerado:
<nNF>33516</nNF>
<cNF>00016156</cNF>
```

### 2. Envio (emitir.ts)
```typescript
// Extrair do XML
const numeroNFe = extrairTag('nNF');        // 33516
const codnumerico = dados?.ide?.cNF;        // 00016156

// Salvar no banco
await db.query(`
  INSERT INTO dbfat_nfe (codfat, nrodoc_fiscal, chave)
  VALUES ($1, $2, $3)
`, [codfat, codnumerico, chave]);  // ✅ codnumerico no nrodoc_fiscal
```

### 3. Consulta (obter-proximo-numero-nfe.ts)
```typescript
// Buscar último nNF (não cNF!)
const result = await db.query(`
  SELECT MAX(nroform::integer) 
  FROM dbfatura 
  WHERE serie = $1
`, [serie]);

const proximoNumero = result.rows[0].max + 1; // 33517
```

---

## ⚠️ IMPORTANTE

### Duplicidade SEFAZ
A SEFAZ identifica duplicidade por:
- UF + AAMM + CNPJ + Modelo + **SÉRIE** + **NÚMERO (nNF)**

**O cNF NÃO afeta duplicidade!**

Você pode ter:
- NFe 33516 com cNF 00016156 ✅
- NFe 33516 com cNF 00016157 ✅ (retry da mesma NFe)
- NFe 33517 com cNF 00016156 ✅ (pode repetir cNF em NFe diferente)

Mas NÃO pode ter:
- Série AA, nNF 33516 (primeira tentativa) ✅
- Série AA, nNF 33516 (segunda tentativa) ❌ **ERRO 539 - DUPLICIDADE**

---

## 🎯 Resumo

1. **nNF** = Número sequencial da NFe (33516, 33517...)
   - Salvar em: `dbfatura.nroform`
   - Buscar próximo: `MAX(nroform) + 1`
   - Controla duplicidade

2. **cNF** = Código numérico aleatório (00016156, 00016157...)
   - Salvar em: `dbfat_nfe.nrodoc_fiscal`
   - Gerar novo: a cada tentativa
   - NÃO controla duplicidade

3. **Série** = Identificador da série (AA, AB, 1...)
   - Salvar em: `dbfatura.serie`
   - Pode ser alfanumérica no XML
   - Deve ser numérica na chave (conversão)

**Nunca confunda nNF com cNF!** 🚨
