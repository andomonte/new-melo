# 🚨 AÇÃO URGENTE - Duplicidade NFe

**Data:** 13/10/2025  
**Status:** 🔴 CRÍTICO - Sistema impedido de emitir NFes

---

## ⚠️ Problema

A SEFAZ está rejeitando **TODAS as emissões** com erro 539 (Duplicidade) porque os **números 1 e 2 da série 2** já foram autorizados anteriormente, mas **NÃO estão no banco de dados local**.

### Chaves já autorizadas na SEFAZ:
1. **Número 1:** `13251018053139000169550020000000011208942310`
2. **Número 2:** `13251018053139000169550020000000021000240867`

### Impacto:
- ❌ Impossível emitir NFes da série 2
- ❌ Sistema tentando números aleatórios (63615)
- ❌ Histórico de NFes incompleto no banco local
- ❌ Risco de perda de rastreabilidade fiscal

---

## ✅ Correção Aplicada (TEMPORÁRIA)

**Arquivo:** `src/pages/api/faturamento/emitir.ts` (linhas 195-227)

O sistema agora **começa do número 3** ao invés de 1 ou 2:

```typescript
nroformEmissao = '000000003'; // Pula números 1 e 2
```

**Próxima emissão:** Número 3 ✅

---

## 🔧 Ações Necessárias IMEDIATAS

### 1️⃣ Executar Script SQL

Execute o arquivo `scripts/verificar-nfe-numero-1.sql` para verificar se os números 1 e 2 existem no banco:

```bash
psql -d seu_banco -f scripts/verificar-nfe-numero-1.sql
```

Ou copie e execute no pgAdmin/DBeaver.

### 2️⃣ Consultar SEFAZ (Opcional)

Se você tiver acesso ao portal da SEFAZ AM, consulte as chaves:
- `13251018053139000169550020000000011208942310`
- `13251018053139000169550020000000021000240867`

Para obter:
- Protocolo de autorização
- Data/hora de autorização
- Código da fatura (CODFAT)

### 3️⃣ Registrar NFes no Banco

**Depois de confirmar que existem na SEFAZ**, execute o INSERT no banco:

```sql
-- ⚠️ AJUSTE OS VALORES ANTES DE EXECUTAR!
INSERT INTO db_manaus.dbfat_nfe (
  codfat, 
  chave, 
  status, 
  nrodoc_fiscal,
  modelo,
  numprotocolo,
  dthrprotocolo
) VALUES 
  -- NFe Número 1
  (
    'CODFAT_NUMERO_1', -- ← AJUSTAR com CODFAT real
    '13251018053139000169550020000000011208942310',
    '100', -- Autorizada
    '1',
    '55', -- NFe
    'PROTOCOLO_1', -- ← AJUSTAR
    '2025-10-13 00:00:00' -- ← AJUSTAR com data real
  ),
  -- NFe Número 2
  (
    'CODFAT_NUMERO_2', -- ← AJUSTAR com CODFAT real
    '13251018053139000169550020000000021000240867',
    '100', -- Autorizada
    '2',
    '55', -- NFe
    'PROTOCOLO_2', -- ← AJUSTAR
    '2025-10-13 00:00:00' -- ← AJUSTAR com data real
  );
```

### 4️⃣ Verificar Próximo Número

Depois de registrar, execute:

```sql
SELECT MAX(CAST(nrodoc_fiscal AS INTEGER)) 
FROM db_manaus.dbfat_nfe 
WHERE status = '100';
```

**Resultado esperado:** `2`  
**Próximo número:** `3` ✅

---

## 🎯 Teste de Emissão

Após registrar as NFes 1 e 2 no banco:

1. ✅ Tente emitir nova NFe
2. ✅ Sistema deve usar número 3 automaticamente
3. ✅ Não deve mais ocorrer erro 539
4. ✅ Sequência será: 3, 4, 5, 6, etc.

---

## 📊 Situação Atual

| Item | Status |
|------|--------|
| Número 1 na SEFAZ | ✅ Autorizado |
| Número 2 na SEFAZ | ✅ Autorizado |
| Número 1 no banco local | ❌ Ausente |
| Número 2 no banco local | ❌ Ausente |
| Próximo número (código) | ✅ 3 (corrigido) |
| Sistema pode emitir | ⚠️ Sim (mas sem histórico completo) |

---

## 🚨 Importante

**NÃO tente emitir os números 1 ou 2 novamente!** Eles já existem na SEFAZ e causarão erro 539.

O sistema está configurado para pular para o número 3, mas **é essencial registrar as NFes 1 e 2 no banco** para manter o histórico fiscal completo.

---

## 📞 Próximos Passos

1. Execute `verificar-nfe-numero-1.sql`
2. Se as NFes não existirem no banco, consulte a SEFAZ
3. Registre as NFes 1 e 2 no banco com os dados corretos
4. Teste uma nova emissão (deve usar número 3)
5. Monitore os logs para confirmar que não há mais erro 539

---

**Documento criado:** 13/10/2025  
**Criticidade:** 🔴 ALTA  
**Ação requerida:** IMEDIATA
