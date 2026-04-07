# Série Padrão "1" - Documentação

## 📌 Resumo

O sistema utiliza a **série "1"** como padrão fixo para todas as emissões de documentos fiscais (NF-e e NFC-e). Esta série é gerenciada automaticamente pela SEFAZ.

**Por que "1" e não "AA"?**
A SEFAZ exige que a série seja **numérica** e siga o padrão `0|[1-9]{1}[0-9]{0,2}` (ou seja: 0, 1-999). Séries alfanuméricas como "AA" são rejeitadas.

---

## 🎯 Por que Série Fixa?

### Vantagens:
1. **Simplicidade**: Não precisa gerenciar múltiplas séries
2. **Padronização**: Todas as notas seguem o mesmo padrão
3. **Menos erros**: Elimina problemas de série incorreta
4. **SEFAZ gerencia**: A numeração é controlada pela SEFAZ

### Comportamento

```javascript
// SEMPRE usa série "1" (numérica, exigida pela SEFAZ)
const serie = '1'; // Fixo, não vem do banco

// A numeração é sequencial e automática
// Ex: 1-000001, 1-000002, 1-000003...
```

---

## 🔧 Implementação

### NF-e (Nota Fiscal Eletrônica - Modelo 55)

**Arquivo:** `src/pages/api/faturamento/emitir.ts`

```typescript
// Série padrão fixa
const serieEmissao = '1';

// Busca próximo número da série 1
const query = `
  SELECT f.nroform 
  FROM db_manaus.dbfatura f
  WHERE f.serie = '1'
  ORDER BY CAST(f.nroform AS INTEGER) DESC
  LIMIT 1
`;
```

---

### NFC-e (Cupom Fiscal Eletrônico - Modelo 65)

**Arquivo:** `src/pages/api/faturamento/emitir-cupom.ts`

```typescript
// Mesma série "1" para cupons
const serie = '1';
const serieEmissao = '1';
```

---

## 🚨 Erro: "Série já vinculada a outra IE"

### O que significa?
A SEFAZ vincula a combinação:
```
CNPJ + SÉRIE + INSCRIÇÃO ESTADUAL (IE)
```

Se você usou a série "AA" com uma IE e depois tentou usar com outra IE diferente, a SEFAZ rejeita.

### ❌ NÃO é problema da série!
A série "AA" está correta. O problema é a **Inscrição Estadual (IE)**.

### ✅ Como resolver:

#### Passo 1: Consultar IE Correta
```
1. Acesse: https://www.sintegra.gov.br/
2. Informe o CNPJ da empresa
3. Anote a IE exibida
```

#### Passo 2: Verificar IE no Sistema
```sql
-- Ver IE cadastrada
SELECT cgc, inscricaoestadual 
FROM dadosempresa 
WHERE cgc = 'SEU_CNPJ';
```

#### Passo 3: Atualizar se Diferente
```sql
-- Atualizar IE correta
UPDATE dadosempresa 
SET inscricaoestadual = 'IE_CORRETA_DO_SINTEGRA'
WHERE cgc = 'SEU_CNPJ';
```

### 📊 Exemplo Real

**Situação:**
```
SINTEGRA mostra:
  CNPJ: 18.053.139/0001-69
  IE: 053374665

Sistema tem:
  CNPJ: 18.053.139/0001-69  
  IE: 251497846  ← DIFERENTE!
```

**Solução:**
```sql
UPDATE dadosempresa 
SET inscricaoestadual = '053374665'
WHERE cgc = '18053139000169';
```

---

## 🔍 Logs do Sistema

Quando ocorrer erro de série vinculada, você verá:

```text
🚨 ========== ERRO: SÉRIE VINCULADA A OUTRA IE ==========
📌 CNPJ: 18053139000169
📌 Série: "1" (padrão do sistema)
📌 IE atual: "251497846"

❌ PROBLEMA: A série "1" foi usada anteriormente com uma IE diferente!

✅ SOLUÇÃO PRINCIPAL:
   Verificar se a IE no cadastro da empresa está CORRETA:
   1. Acesse: https://www.sintegra.gov.br/
   2. Consulte CNPJ: 18053139000169
   3. Verifique se a IE cadastrada é a mesma da consulta
   4. Se diferente, atualize no banco de dados:
      UPDATE dadosempresa SET inscricaoestadual = 'IE_CORRETA' WHERE cgc = '18053139000169';

⚠️  NOTA: A série "1" é padrão do sistema e gerenciada pela SEFAZ.
    O problema está na IE, não na série.
```

---

## 📚 Referências

- **Erro Série Vinculada:** `docs/erro-serie-vinculada-ie.md`
- **Portal NFe:** http://www.nfe.fazenda.gov.br/
- **SINTEGRA:** https://www.sintegra.gov.br/

---

## ⚙️ Arquivos Modificados

1. `src/pages/api/faturamento/emitir.ts`
   - Série fixada em "AA"
   - Mensagens de erro atualizadas
   - Logs informativos

2. `src/pages/api/faturamento/emitir-cupom.ts`
   - Série fixada em "AA"
   - Mesma lógica da NF-e

3. `src/components/corpo/faturamento/novoFaturamento/modalFaturamentonota/FaturamentoNota.tsx`
   - Mensagens de erro frontend
   - Orientações ao usuário

---

**Última atualização:** 07 de Outubro de 2025
