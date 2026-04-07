# Diagnóstico: Erro "Série já vinculada a outra IE"

## 🔍 Investigação do Problema

### Situação Relatada pelo Cliente

> "Meu cliente tem várias NFes com série AA e nunca deu esse problema antes"

Isso **descarta** a hipótese de que a série AA está vinculada a outra IE!

Se a série AA já funcionou antes, o problema está em **algo que mudou** na emissão atual.

---

## 🎯 Causa Provável: IE Vazia ou NULL

### Por que isso acontece?

A SEFAZ mantém vínculo:
```
CNPJ + SÉRIE + IE
```

**Cenário que causa o erro:**

| Tentativa | CNPJ | Série | IE | Resultado |
|-----------|------|-------|-----|-----------|
| NFe anterior (funcionou) | 07522002000104 | AA | **251497846** | ✅ Autorizada |
| NFe atual (erro) | 07522002000104 | AA | **(vazio)** | ❌ Rejeição |

**Por quê?**
- SEFAZ: "Série AA já está vinculada à IE 251497846"
- Sistema envia: IE vazia
- SEFAZ: "IE diferente! Rejeito!"

---

## 🔧 Onde está o Problema?

### Fluxo de Dados da IE

```
1. Banco de Dados (dadosempresa)
   ↓
   Campo: inscricaoestadual
   
2. Backend (emitir.ts linha 161)
   ↓
   ie: emitenteRaw.inscricaoestadual || ''
   
3. Normalização (normalizarPayloadNFe.ts)
   ↓
   emitente: { ie: ... }
   
4. Geração XML (gerarXml.ts linha 248)
   ↓
   IE: emitente?.ie?.replace(/\D/g, '') ?? ''
   
5. XML Final
   ↓
   <emit><IE>251497846</IE></emit>
```

**Pontos de falha:**
- ❌ `inscricaoestadual` NULL no banco
- ❌ `inscricaoestadual` com valor vazio ''
- ❌ `inscricaoestadual` com espaços '   '
- ❌ Campo não existe na tabela

---

## 🚨 Logs de Diagnóstico Adicionados

### 1. No emitir.ts (após buscar emitente)

```typescript
🔍 ========== DADOS DO EMITENTE (dadosempresa) ==========
📌 CNPJ: 07522002000104
📌 Nome: NOME DA EMPRESA
📌 IE (inscricaoestadual): "251497846" (tipo: string)
📌 UF: AM
📌 Município: Manaus
🔍 ===================================================
```

**Se aparecer:**
```
📌 IE (inscricaoestadual): "" (tipo: string)
🚨 ALERTA: Inscrição Estadual está VAZIA na tabela dadosempresa!
```
**Então esse é o problema!**

---

### 2. No gerarXml.ts (antes de gerar XML)

```typescript
🔍 ========== VERIFICAÇÃO CRÍTICA SEFAZ ==========
📌 CNPJ: 07522002000104
📌 Série sendo enviada: "AA"
📌 IE (Inscrição Estadual): 251497846
📌 IE original (antes de limpar): 251.497.846
📌 UF: AM
⚠️  ATENÇÃO: SEFAZ vincula CNPJ + SÉRIE + IE
⚠️  Se a IE estiver vazia ou diferente, haverá rejeição!
🔍 ================================================
```

**Se aparecer:**
```
📌 IE (Inscrição Estadual): ⚠️  VAZIA/INVÁLIDA!
```
**Confirmado: IE está vazia!**

---

## ✅ Como Corrigir

### Passo 1: Verificar IE no Banco

```sql
SELECT 
  cgc as cnpj,
  nomecontribuinte as nome,
  inscricaoestadual as ie,
  uf,
  LENGTH(inscricaoestadual) as tamanho_ie,
  inscricaoestadual IS NULL as ie_null,
  inscricaoestadual = '' as ie_vazia
FROM dadosempresa
WHERE cgc LIKE '%07522002%';
```

**Resultado esperado:**
```
cnpj              | nome           | ie        | uf | tamanho_ie | ie_null | ie_vazia
------------------|----------------|-----------|----|-----------:|---------|----------
07.522.002/0001-04| EMPRESA LTDA   | 251497846 | AM |         9  | false   | false
```

**Se aparecer:**
```
ie        | tamanho_ie | ie_null | ie_vazia
----------|------------|---------|----------
          |            | true    | false     ← IE é NULL
          |          0 | false   | true      ← IE é string vazia
```
**Problema confirmado!**

---

### Passo 2: Consultar IE Correta no SINTEGRA

1. Acessar: https://www.sintegra.gov.br/
2. Selecionar estado (AM - Amazonas)
3. Informar CNPJ: 07.522.002/0001-04
4. Anotar a IE correta

---

### Passo 3: Atualizar IE no Banco

```sql
UPDATE dadosempresa 
SET inscricaoestadual = '251497846'  -- IE correta do SINTEGRA
WHERE cgc = '07.522.002/0001-04';

-- Verificar
SELECT cgc, inscricaoestadual 
FROM dadosempresa 
WHERE cgc = '07.522.002/0001-04';
```

---

### Passo 4: Testar Nova Emissão

1. Tentar emitir NFe novamente
2. Verificar logs:
   ```
   📌 IE (Inscrição Estadual): 251497846 ✅
   ```
3. NFe deve ser autorizada!

---

## 🔍 Outras Causas Possíveis

### 1. Múltiplas Empresas no Banco

Se você tem matriz e filiais:

```sql
SELECT cgc, nomecontribuinte, inscricaoestadual, uf
FROM dadosempresa
WHERE cgc LIKE '%07522002%'
ORDER BY cgc;
```

**Possível resultado:**
```
cgc                | inscricaoestadual | uf
-------------------|-------------------|----
07.522.002/0001-04 | 251497846         | AM (Matriz)
07.522.002/0002-93 | 251497847         | AM (Filial)
```

**Problema:** Sistema pegou certificado da matriz, mas IE da filial!

**Solução:** Garantir que usa sempre a mesma empresa (mesmo CNPJ = mesma IE).

---

### 2. IE com Formatação Inválida

```sql
-- Verificar se IE tem caracteres especiais
SELECT 
  cgc,
  inscricaoestadual,
  inscricaoestadual ~ '^[0-9]+$' as ie_somente_numeros
FROM dadosempresa
WHERE cgc LIKE '%07522002%';
```

**Se `ie_somente_numeros = false`:**
```
inscricaoestadual = "251.497.846" (com pontos)
```

**Correção:**
```sql
UPDATE dadosempresa
SET inscricaoestadual = REGEXP_REPLACE(inscricaoestadual, '[^0-9]', '', 'g')
WHERE cgc = '07.522.002/0001-04';
```

---

### 3. Campo Não Existe na Tabela

```sql
-- Verificar se coluna existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'dadosempresa' 
  AND column_name = 'inscricaoestadual';
```

**Se retornar vazio:** Campo não existe!

**Solução:** Criar campo
```sql
ALTER TABLE dadosempresa 
ADD COLUMN inscricaoestadual VARCHAR(20);

UPDATE dadosempresa 
SET inscricaoestadual = '251497846'
WHERE cgc = '07.522.002/0001-04';
```

---

## 📊 Checklist de Diagnóstico

- [ ] Executar NFe e verificar logs do emitir.ts
- [ ] Verificar se IE aparece nos logs ou está vazia
- [ ] Consultar banco: `SELECT inscricaoestadual FROM dadosempresa WHERE cgc = '...'`
- [ ] Verificar se IE é NULL, vazia ou com formatação errada
- [ ] Consultar IE correta no SINTEGRA
- [ ] Atualizar IE no banco
- [ ] Testar nova emissão
- [ ] Verificar logs novamente
- [ ] NFe autorizada ✅

---

## 🎯 Resumo

**Se série AA já funcionou antes:**
- ✅ Série está OK (não precisa mudar)
- ❌ Problema está na IE sendo enviada AGORA
- 🔍 IE provavelmente está vazia/NULL no banco
- ✅ Solução: Atualizar campo `inscricaoestadual` na tabela `dadosempresa`

**Execute os logs e veja o que aparece!** 📋
