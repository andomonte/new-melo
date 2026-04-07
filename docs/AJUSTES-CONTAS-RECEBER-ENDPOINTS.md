# Ajustes Necessários - Endpoints Contas a Receber
**Data:** 2026-01-06  
**Baseado em:** Estrutura Oracle DBRECEB descoberta via script de análise

---

## 📋 Estrutura Oracle DBRECEB - Campos Críticos

```sql
-- Status Management (campos de controle)
REC CHAR(1)       -- Recebido: 'S'/'N'
CANCEL CHAR(1)    -- Cancelado: 'S'/'N'
BRADESCO CHAR(1)  -- Status banco: 'N' (disponível), 'S' (enviado), 'B' (baixado)

-- Banking Fields
FORMA_FAT NUMBER  -- Forma faturamento: 2 = boleto bancário
BANCO NUMBER      -- Código banco: 0=Bradesco, 1=BB, 2=Itaú, 5=Real, 9=Melo
NRO_DOCBANCO      -- Nosso número (identificação bancária)
NRO_BANCO         -- Número do banco no documento

-- Values
VALOR_PGTO NUMBER -- Valor original do título
VALOR_REC NUMBER  -- Valor já recebido (acumulado)
```

---

## ✅ Endpoints CORRETOS (não precisa ajustar)

### 1. `/api/contas-receber/index.ts` (Listagem)
**Status:** ✅ CORRETO
- Usa todos os campos Oracle corretamente
- Retorna `bradesco`, `forma_fat`, `nro_banco`, `nro_docbanco`
- Lógica de status está correta:
  ```typescript
  CASE
    WHEN r.cancel = 'S' THEN 'cancelado'
    WHEN r.rec = 'S' AND valor_rec >= valor_pgto THEN 'recebido'
    WHEN r.rec = 'S' AND valor_rec > 0 THEN 'recebido_parcial'
    WHEN r.dt_venc < CURRENT_DATE THEN 'vencido'
    ELSE 'pendente'
  END as status
  ```

### 2. `/api/contas-receber/[cod_receb]/index.ts` (Detalhe)
**Status:** ✅ CORRETO
- Retorna todos os campos necessários incluindo `bradesco`, `forma_fat`, `nro_docbanco`
- Join correto com `dbclien` para nome do cliente
- Status calculado corretamente

### 3. `/api/contas-receber/[cod_receb]/editar.ts` (Editar)
**Status:** ✅ CORRETO
- ✅ Impede edição se tem recebimentos: `total_recebido > 0`
- ✅ Impede edição se cancelado: `cancel = 'S'`
- Registra auditoria em `dbusuario_acoes`

---

## ⚠️ Endpoints que PRECISAM DE AJUSTES

### 1. `/api/contas-receber/criar.ts` ⚠️

**Problema:** Não inicializa o campo `BRADESCO` corretamente

**Linha 74 - Query INSERT atual:**
```typescript
INSERT INTO db_manaus.dbreceb (
  codcli, rec_cof_id, dt_venc, dt_emissao, valor_pgto, nro_doc, 
  tipo, forma_fat, banco, obs, rec, cancel, valor_rec
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'N', 'N', 0
)
```

**✅ Correção necessária:**
```typescript
INSERT INTO db_manaus.dbreceb (
  codcli, rec_cof_id, dt_venc, dt_emissao, valor_pgto, nro_doc, 
  tipo, forma_fat, banco, obs, rec, cancel, valor_rec, bradesco
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'N', 'N', 0, 'N'
)
--                                                       ^^^^^ ADICIONAR
```

**Regra:** Todo título novo deve iniciar com `BRADESCO = 'N'` (disponível para envio ao banco)

---

### 2. `/api/contas-receber/cancelar.ts` ⚠️

**Problema Crítico:** Permite cancelar títulos já enviados ao banco (BRADESCO='S' ou 'B')

**Linha 23 - Query de verificação atual:**
```typescript
const verificarQuery = `
  SELECT cod_receb, cancel, rec
  FROM db_manaus.dbreceb
  WHERE cod_receb = $1
`;
```

**✅ Correção necessária (linha 23-28):**
```typescript
const verificarQuery = `
  SELECT 
    cod_receb, 
    cancel,
    rec,
    bradesco  -- ADICIONAR ESTE CAMPO
  FROM db_manaus.dbreceb
  WHERE cod_receb = $1
`;
```

**Linha 42 - Adicionar validação ANTES de cancelar:**
```typescript
if (titulo.rec === 'S') {
  return res.status(400).json({ 
    erro: 'Não é possível cancelar título já recebido. Retire a baixa primeiro.' 
  });
}

// ✅ ADICIONAR ESTA VALIDAÇÃO:
if (titulo.bradesco === 'S' || titulo.bradesco === 'B') {
  return res.status(400).json({ 
    erro: 'Não é possível cancelar título que já foi enviado ao banco.',
    detalhes: titulo.bradesco === 'S' 
      ? 'Título está em remessa bancária' 
      : 'Título já foi baixado pelo banco'
  });
}
```

**Regra Oracle:**
- `BRADESCO='N'` → Pode cancelar (não enviado ao banco)
- `BRADESCO='S'` → **NÃO** pode cancelar (em remessa, aguardando retorno)
- `BRADESCO='B'` → **NÃO** pode cancelar (já baixado pelo banco)

---

### 3. `/api/contas-receber/dar-baixa.ts` ⚠️

**Problema:** Não atualiza o campo `BRADESCO` ao dar baixa manual

**Linha 94 - Query UPDATE atual:**
```typescript
const updateQuery = `
  UPDATE db_manaus.dbreceb
  SET 
    valor_rec = $2,
    rec = $3,
    dt_pgto = COALESCE($4, dt_pgto),
    banco = COALESCE($5, banco),
    cod_conta = COALESCE($6, cod_conta),
    cof_id = COALESCE($7, cof_id),
    forma_fat = COALESCE($8, forma_fat)
  WHERE cod_receb = $1
  RETURNING *
`;
```

**✅ Correção necessária:**
```typescript
const updateQuery = `
  UPDATE db_manaus.dbreceb
  SET 
    valor_rec = $2,
    rec = $3,
    dt_pgto = COALESCE($4, dt_pgto),
    banco = COALESCE($5, banco),
    cod_conta = COALESCE($6, cod_conta),
    cof_id = COALESCE($7, cof_id),
    forma_fat = COALESCE($8, forma_fat),
    bradesco = CASE 
      WHEN $3 = 'S' THEN 'B'  -- Se totalmente recebido, marca como Baixado
      ELSE bradesco           -- Senão mantém status atual
    END
  WHERE cod_receb = $1
  RETURNING *
`;
```

**Regra:** Quando um título é totalmente pago (`rec='S'`), o campo `BRADESCO` deve ser atualizado para `'B'` (baixado/liquidado)

**⚠️ Validação adicional necessária (antes do UPDATE):**

Adicionar após linha 73:
```typescript
// Verificar se título já foi enviado ao banco via remessa
const statusBancoQuery = `
  SELECT bradesco, forma_fat 
  FROM db_manaus.dbreceb 
  WHERE cod_receb = $1
`;
const statusResult = await client.query(statusBancoQuery, [cod_receb]);

if (statusResult.rows[0]?.bradesco === 'S') {
  return res.status(400).json({ 
    erro: 'Título está em remessa bancária. Aguarde retorno do banco ou processe manualmente na tela de retorno.',
    detalhes: 'Use a tela de processamento de retorno para baixar títulos em remessa'
  });
}
```

---

## 📊 Resumo das Mudanças

| Endpoint | Linha | Mudança | Prioridade |
|----------|-------|---------|------------|
| `criar.ts` | 74 | Adicionar `bradesco = 'N'` no INSERT | 🔴 ALTA |
| `cancelar.ts` | 23 | Adicionar campo `bradesco` na query SELECT | 🔴 ALTA |
| `cancelar.ts` | 42 | Validar `bradesco != 'S' AND bradesco != 'B'` | 🔴 ALTA |
| `dar-baixa.ts` | 73 | Validar se `bradesco != 'S'` antes de baixa manual | 🟡 MÉDIA |
| `dar-baixa.ts` | 94 | Atualizar `bradesco = 'B'` quando `rec='S'` | 🔴 ALTA |

---

## 🔄 Integração com Sistema de Remessa

### Fluxo Correto do Campo BRADESCO:

```
1. CRIAÇÃO DO TÍTULO
   BRADESCO = 'N' (disponível)
   ↓

2. GERAÇÃO DA REMESSA (endpoint /api/remessa/remessa.ts)
   BRADESCO = 'S' (enviado ao banco)
   ↓

3a. RETORNO AUTOMÁTICO (liquidação pelo banco)
    BRADESCO = 'B' (baixado)
    REC = 'S'
    DT_PGTO = data do retorno
    ↓

3b. BAIXA MANUAL (recebimento direto sem banco)
    BRADESCO = 'B' (baixado)
    REC = 'S'
    DT_PGTO = data informada
```

### Endpoints de Remessa que JÁ usam BRADESCO corretamente:

✅ `/api/remessa/remessa.ts` (linha 264)
```sql
WHERE r.bradesco = 'N'  -- Busca apenas títulos disponíveis
  AND r.forma_fat = 2    -- Apenas boletos
```

✅ `/api/remessa/retorno/processar.ts` (linhas 649-673)
```sql
UPDATE db_manaus.dbreceb
SET 
  bradesco = 'B',  -- Marca como baixado
  rec = 'S',       -- Marca como recebido
  ...
```

✅ `/api/remessa/rollback.ts` (linha 127)
```sql
UPDATE db_manaus.dbreceb
SET bradesco = 'N'  -- Volta para disponível ao fazer rollback
WHERE cod_borderô = ?
```

---

## 🧪 Casos de Teste Sugeridos

### Teste 1: Criação de título
```bash
POST /api/contas-receber/criar
{
  "codcli": 123,
  "valor_pgto": 100.00,
  "dt_venc": "2026-02-01",
  "forma_fat": 2  # boleto
}

# Verificar no banco:
SELECT bradesco FROM dbreceb WHERE cod_receb = ?
# Deve retornar: 'N'
```

### Teste 2: Cancelamento bloqueado (título em remessa)
```bash
# 1. Criar título
# 2. Enviar para remessa (bradesco vira 'S')
# 3. Tentar cancelar

POST /api/contas-receber/cancelar
{"cod_receb": "..."}

# Deve retornar erro 400:
# "Não é possível cancelar título que já foi enviado ao banco"
```

### Teste 3: Baixa manual atualiza bradesco
```bash
POST /api/contas-receber/dar-baixa
{
  "cod_receb": "...",
  "valor_recebido": 100.00,
  "dt_pgto": "2026-01-06"
}

# Verificar no banco:
SELECT bradesco, rec FROM dbreceb WHERE cod_receb = ?
# Deve retornar: bradesco='B', rec='S'
```

---

## 📝 Notas Técnicas

### Campo BRADESCO - Legado vs Nome
- **Nome do campo:** Apesar de se chamar "BRADESCO", ele é usado para TODOS os bancos
- **Origem:** Sistema legado quando só havia integração com Bradesco
- **Uso atual:** Campo universal de status de remessa bancária
- **Não renomear:** Manter nome por compatibilidade com procedures Oracle

### Multi-Filial
Os endpoints atualmente consultam apenas PostgreSQL (`db_manaus.dbreceb`), que já replica dados do Oracle. As regras do campo BRADESCO se aplicam igualmente para todas as filiais (PVH, REC, FLZ).

### Auditoria
Apenas o endpoint `editar.ts` registra auditoria em `dbusuario_acoes`. Considerar adicionar auditoria em:
- `criar.ts` - ação 'INSERT'
- `cancelar.ts` - ação 'CANCEL'
- `dar-baixa.ts` - ação 'DAR_BAIXA' (já tem no Oracle via procedure)

---

## 🎯 Priorização da Implementação

1. **🔴 URGENTE:** `criar.ts` - Adicionar `bradesco='N'` no INSERT
2. **🔴 URGENTE:** `cancelar.ts` - Validar campo bradesco antes de cancelar
3. **🔴 URGENTE:** `dar-baixa.ts` - Atualizar bradesco='B' ao dar baixa total
4. **🟡 IMPORTANTE:** `dar-baixa.ts` - Validar se título não está em remessa

---

**Responsável pela análise:** GitHub Copilot  
**Base de dados:** Resultado do script `docs/scripts/analisar-contas-receber-oracle.cjs`
