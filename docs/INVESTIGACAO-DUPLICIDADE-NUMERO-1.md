# 🔍 Investigação: Duplicidade NFe Números 1 e 2

## 📋 Problema CRÍTICO

A SEFAZ está rejeitando emissões dos **números 1 E 2, série 2** com erro **539 (Duplicidade)**, informando que já existem NFes autorizadas:

**Chaves já autorizadas na SEFAZ:**
1. **Número 1:** `13251018053139000169550020000000011208942310`
2. **Número 2:** `13251018053139000169550020000000021000240867`

**Tentativas rejeitadas:**
- Número 1 com cNF diferentes (3 tentativas)
- Número 2 com cNF diferentes (múltiplas tentativas)
- Sistema tentando número 63615 ❌ (completamente errado)

### Análise da Chave

```
Posição 1-2:   13 (UF Amazonas)
Posição 3-8:   2510 (Out/2025)
Posição 9-22:  18053139000169 (CNPJ)
Posição 23-24: 55 (NFe)
Posição 25-27: 002 (série 2) ✅
Posição 28-36: 000000001 (número 1) ✅
Posição 37:    1 (emissão normal)
Posição 38-45: 20894231 (cNF da autorizada)
Posição 46:    0 (dígito verificador)
```

## 🔍 Hipóteses

### 1. NFe foi autorizada mas não está no banco local
- **Possível:** Emissão anterior que não foi salva corretamente
- **Solução:** Consultar status na SEFAZ antes de emitir

### 2. NFe está em outra tabela ou foi apagada
- **Possível:** Limpeza de dados ou migração
- **Solução:** Buscar em backup ou logs

### 3. Problema de sincronização série
- **Possível:** Série alfabética vs numérica
- **Solução:** Padronizar sempre como '2' (não 'B', 'A', etc)

### 4. Ambiente de homologação vs produção
- **Possível:** Teste em homologação afetou produção
- **Verificar:** tpAmb no XML (1=produção, 2=homologação)

## ✅ Ações Necessárias

### Passo 1: Verificar banco de dados local
Execute: `scripts/verificar-nfe-numero-1.sql`

```sql
-- Buscar NFe número 1 em todas as tabelas
SELECT * FROM db_manaus.dbfat_nfe 
WHERE chave LIKE '%550020000000011%'
   OR chave = '13251018053139000169550020000000011208942310';
```

### Passo 2: Consultar status na SEFAZ
Criar endpoint `/api/sefaz/consultar-chave` para verificar:
- Status da chave `13251018053139000169550020000000011208942310`
- Protocolo de autorização
- Data/hora de autorização

### Passo 3: Salvar NFe autorizada no banco
Se a consulta SEFAZ confirmar autorização:
```sql
INSERT INTO db_manaus.dbfat_nfe (
  codfat, 
  chave, 
  status, 
  numprotocolo, 
  dthrprotocolo,
  nrodoc_fiscal
) VALUES (
  'CODFAT_A_DESCOBRIR',
  '13251018053139000169550020000000011208942310',
  '100',
  'PROTOCOLO_A_DESCOBRIR',
  'DATA_A_DESCOBRIR',
  '1'
);
```

### Passo 4: Avançar para próximo número
Depois de registrar o número 1:
```sql
SELECT MAX(CAST(nrodoc_fiscal AS INTEGER)) 
FROM db_manaus.dbfat_nfe 
WHERE status = '100';
-- Deve retornar: 1
-- Próximo número: 2
```

## 🔧 Correção Temporária

**Opção 1: Pular para número 2**
```typescript
// Em emitir.ts, linha ~218
if (proximoNumeroQuery.rows.length > 0 && proximoNumeroQuery.rows[0].ultimo_numero !== null) {
  const ultimoNumero = parseInt(proximoNumeroQuery.rows[0].ultimo_numero, 10);
  nroformEmissao = String(ultimoNumero + 1).padStart(9, '0');
} else {
  // ⚠️ CORREÇÃO TEMPORÁRIA: Começar do 2 ao invés do 1
  nroformEmissao = '000000002'; // ← MUDANÇA AQUI
  console.log(`⚠️ TEMPORÁRIO: Começando do número 2 (número 1 já existe na SEFAZ)`);
}
```

**Opção 2: Consultar SEFAZ antes de emitir**
```typescript
// Adicionar verificação antes de emitir
const consultaResult = await consultarStatusChaveSEFAZ(chaveAcesso);
if (consultaResult.status === '100') {
  // NFe já autorizada, incrementar número
  nroformEmissao = String(parseInt(nroformEmissao) + 1).padStart(9, '0');
}
```

## 📊 Verificação Final

Depois das correções, verificar:
- [ ] Query retorna último número correto
- [ ] Próxima emissão usa número 2 (ou superior)
- [ ] Não há mais erro 539
- [ ] NFes são salvas no banco após autorização

## 🚨 Importante

**NÃO tente emitir número 1 novamente!** A SEFAZ já tem esse número autorizado. Você precisa:
1. Encontrar/registrar essa NFe no seu banco
2. Pular para o próximo número disponível (2 ou superior)

---

**Data:** 13/10/2025  
**Status:** 🔴 BLOQUEIO - Número 1 já autorizado na SEFAZ  
**Próxima ação:** Executar `verificar-nfe-numero-1.sql` e consultar SEFAZ
