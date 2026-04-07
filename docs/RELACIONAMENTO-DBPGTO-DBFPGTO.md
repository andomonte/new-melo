# 🔗 RELACIONAMENTO ENTRE DBPGTO E DBFPGTO

## 📊 Tipo de Relacionamento: **Um-para-Muitos (1:N)**

```
DBPGTO (Tabela Principal - Contas a Pagar)
    |
    | cod_pgto (Chave de Relacionamento)
    |
    ↓
DBFPGTO (Tabela Dependente - Formas de Pagamento)
```

---

## 📋 Estrutura das Tabelas

### DBPGTO - Contas a Pagar (Tabela Principal)
- **Registros:** 617.975 contas
- **Chave Primária:** cod_pgto
- **Descrição:** Armazena as contas a pagar da empresa

### DBFPGTO - Formas de Pagamento (Tabela Dependente)
- **Registros:** 585.722 formas de pagamento
- **Chave Primária:** (cod_pgto + cod_fpgto)
- **Chave Estrangeira:** cod_pgto → DBPGTO.cod_pgto
- **Descrição:** Armazena como cada conta foi paga (forma de pagamento)

---

## 🔑 Relacionamento

### Regra de Negócio
- **Uma conta** em DBPGTO pode ter:
  - **ZERO** formas de pagamento (conta ainda não paga)
  - **UMA** forma de pagamento (pagamento simples)
  - **MÚLTIPLAS** formas de pagamento (pagamento parcial com diferentes métodos)

- **Cada forma de pagamento** em DBFPGTO:
  - Pertence a **EXATAMENTE UMA** conta em DBPGTO
  - É vinculada pela coluna `cod_pgto`

### Estatísticas do Relacionamento
```
Total de contas em DBPGTO:                617.975
Total de formas de pagamento em DBFPGTO:  585.722
Contas com pagamento registrado:          581.581
Contas sem pagamento:                      36.394
Média de formas de pagamento por conta:    1.01
```

---

## 💡 Exemplos Práticos

### Exemplo 1: Pagamento Simples (1 forma de pagamento)
```
DBPGTO:
┌─────────────┬────────────┬───────────┬──────────┐
│  cod_pgto   │ dt_emissao │  dt_venc  │  valor   │
├─────────────┼────────────┼───────────┼──────────┤
│ 000000456   │ 01/09/1998 │ 14/09/1998│ 1.431,28 │
└─────────────┴────────────┴───────────┴──────────┘
         ↓ (cod_pgto)
DBFPGTO:
┌─────────────┬────────────┬─────────┬────────────┬───────────┬────────────┐
│  cod_pgto   │ cod_fpgto  │ tp_pgto │ valor_pgto │  dt_pgto  │ nro_cheque │
├─────────────┼────────────┼─────────┼────────────┼───────────┼────────────┤
│ 000000456   │    001     │    C    │  1.431,28  │14/09/1998 │   008926   │
└─────────────┴────────────┴─────────┴────────────┴───────────┴────────────┘
```
**Descrição:** Conta paga integralmente com 1 cheque.

---

### Exemplo 2: Pagamento Múltiplo (várias formas de pagamento)
```
DBPGTO:
┌─────────────┬────────────┬───────────┬──────────┐
│  cod_pgto   │ dt_emissao │  dt_venc  │  valor   │
├─────────────┼────────────┼───────────┼──────────┤
│ 000123456   │ 10/11/2025 │ 20/11/2025│ 5.000,00 │
└─────────────┴────────────┴───────────┴──────────┘
         ↓ (cod_pgto)
DBFPGTO:
┌─────────────┬────────────┬─────────┬────────────┬───────────┬────────────┐
│  cod_pgto   │ cod_fpgto  │ tp_pgto │ valor_pgto │  dt_pgto  │ nro_cheque │
├─────────────┼────────────┼─────────┼────────────┼───────────┼────────────┤
│ 000123456   │    001     │    D    │  2.000,00  │20/11/2025 │    null    │ Dinheiro
│ 000123456   │    003     │    P    │  1.500,00  │20/11/2025 │    null    │ PIX
│ 000123456   │    005     │    R    │  1.500,00  │20/11/2025 │    null    │ Cartão
└─────────────┴────────────┴─────────┴────────────┴───────────┴────────────┘
                                        ═════════════
                                        Total: 5.000,00
```
**Descrição:** Conta paga com 3 formas de pagamento diferentes.

---

## 📊 Distribuição de Formas de Pagamento

### Top 5 Mais Utilizadas
| cod_fpgto | tp_pgto | Descrição Provável | Quantidade | % |
|-----------|---------|-------------------|------------|---|
| 001 | A | Tipo A (Antigo?) | 332.534 | 56.77% |
| 001 | D | Dinheiro | 109.625 | 18.72% |
| 001 | C | Cheque | 88.406 | 15.09% |
| 001 | E | Débito | 21.526 | 3.68% |
| 001 | B | Boleto | 19.368 | 3.31% |

### Observações Importantes
1. **cod_fpgto = 001** domina com 93%+ dos registros
2. Existem múltiplos **tp_pgto** (A, D, C, E, B, N, R, F, S, V)
3. Alguns registros têm **tp_pgto = null** (35 registros)
4. Códigos 002-011 são menos utilizados

---

## 🔍 Consulta SQL - Como Juntar as Tabelas

### Buscar Conta com Formas de Pagamento
```sql
SELECT 
    p.cod_pgto,
    p.dt_emissao,
    p.dt_venc,
    p.vlr_pgto as valor_conta,
    p.paga,
    f.cod_fpgto,
    f.tp_pgto,
    f.valor_pgto,
    f.dt_pgto,
    f.nro_cheque
FROM DBPGTO p
LEFT JOIN DBFPGTO f ON p.cod_pgto = f.cod_pgto
WHERE p.cod_pgto = '000123456'
ORDER BY f.dt_pgto;
```

### Buscar Contas SEM Forma de Pagamento Registrada
```sql
SELECT 
    p.cod_pgto,
    p.dt_emissao,
    p.dt_venc,
    p.vlr_pgto,
    p.paga
FROM DBPGTO p
LEFT JOIN DBFPGTO f ON p.cod_pgto = f.cod_pgto
WHERE f.cod_pgto IS NULL
  AND p.paga = 'S';  -- Contas marcadas como pagas mas sem registro de pagamento
```

### Buscar Contas com Múltiplas Formas de Pagamento
```sql
SELECT 
    p.cod_pgto,
    COUNT(*) as qtd_formas_pagamento,
    SUM(f.valor_pgto) as total_pago
FROM DBPGTO p
INNER JOIN DBFPGTO f ON p.cod_pgto = f.cod_pgto
GROUP BY p.cod_pgto
HAVING COUNT(*) > 1
ORDER BY qtd_formas_pagamento DESC;
```

---

## ⚙️ Como Funciona no Sistema

### Processo de Pagamento

1. **Criar Conta a Pagar**
   ```sql
   INSERT INTO DBPGTO (cod_pgto, dt_emissao, dt_venc, vlr_pgto, paga)
   VALUES ('000123456', SYSDATE, SYSDATE+30, 1000.00, 'N');
   ```

2. **Marcar como Paga (sem forma de pagamento)**
   ```sql
   UPDATE DBPGTO 
   SET paga = 'S', dt_pgto = SYSDATE
   WHERE cod_pgto = '000123456';
   ```

3. **Registrar Forma de Pagamento**
   ```sql
   INSERT INTO DBFPGTO (
       cod_pgto, cod_fpgto, fpg_cof_id, tp_pgto, 
       valor_pgto, dt_pgto, nro_cheque
   ) VALUES (
       '000123456',  -- cod_pgto (FK para DBPGTO)
       '001',        -- cod_fpgto (Dinheiro)
       1,            -- fpg_cof_id (auto-incremento)
       'D',          -- tp_pgto (Dinheiro)
       1000.00,      -- valor_pgto
       SYSDATE,      -- dt_pgto
       NULL          -- nro_cheque (null para dinheiro)
   );
   ```

4. **Pagamento Múltiplo (Parcial)**
   ```sql
   -- Primeira forma: R$ 600 em Dinheiro
   INSERT INTO DBFPGTO (cod_pgto, cod_fpgto, fpg_cof_id, tp_pgto, valor_pgto, dt_pgto)
   VALUES ('000123456', '001', 1, 'D', 600.00, SYSDATE);
   
   -- Segunda forma: R$ 400 em PIX
   INSERT INTO DBFPGTO (cod_pgto, cod_fpgto, fpg_cof_id, tp_pgto, valor_pgto, dt_pgto)
   VALUES ('000123456', '003', 2, 'P', 400.00, SYSDATE);
   ```

---

## 🎯 Implementação no Sistema Atual

### API: `/api/contas-pagar/[id]/marcar-pago.ts`

Quando marca uma conta como paga:

```typescript
// 1. Atualiza DBPGTO (marca como paga)
UPDATE db_manaus.dbpgto 
SET paga = 'S', dt_pgto = $1 
WHERE cod_pgto = $2

// 2. Insere em DBFPGTO (registra forma de pagamento)
INSERT INTO db_manaus.dbfpgto (
    cod_pgto, cod_fpgto, fpg_cof_id, dt_pgto, valor_pgto,
    tp_pgto, nro_cheque, cancel, desconto, multa, juros,
    cod_conta, dt_venc, dt_emissao, sf, import
) VALUES (
    $1,  -- cod_pgto (da conta)
    $2,  -- cod_fpgto (selecionado pelo usuário)
    $3,  -- fpg_cof_id (MAX + 1)
    $4,  -- dt_pgto (data atual)
    $5,  -- valor_pgto (copiado de vlr_pgto)
    $6,  -- tp_pgto (mapeado de cod_fpgto)
    $7,  -- nro_cheque (se cheque)
    'N', -- cancel
    $8,  -- desconto
    $9,  -- multa
    $10, -- juros
    $11, -- cod_conta
    $12, -- dt_venc
    $13, -- dt_emissao
    $14, -- sf
    'N'  -- import
)
```

### Campos Importantes

| Campo | Origem | Descrição |
|-------|--------|-----------|
| `cod_pgto` | DBPGTO | Chave estrangeira - liga à conta |
| `cod_fpgto` | Usuário | Forma de pagamento (001-007) |
| `fpg_cof_id` | Auto | ID único da forma de pagamento |
| `tp_pgto` | Mapeado | Tipo de pagamento (D, C, P, T, R, E, B) |
| `valor_pgto` | DBPGTO.vlr_pgto | Valor pago |
| `dt_pgto` | Usuário | Data do pagamento |
| `nro_cheque` | Usuário | Número do cheque (se cod_fpgto=002) |

---

## 🚨 Importantes Observações

### ✅ Permitido
- Uma conta com múltiplas formas de pagamento
- Pagamentos parciais (soma de valor_pgto pode ser < vlr_pgto)
- Mesma forma de pagamento múltiplas vezes (ex: 2 cheques)

### ⚠️ Atenção
- **36.394 contas** marcadas como pagas (`paga='S'`) mas **SEM registro em DBFPGTO**
- Isso significa que contas antigas foram pagas antes do sistema registrar formas de pagamento
- Sistema novo SEMPRE deve inserir em DBFPGTO quando marcar como paga

### ❌ Inconsistências Encontradas
- Não há **Foreign Key** explícita no Oracle (relacionamento por convenção)
- Alguns registros têm `tp_pgto = null`
- Código `cod_fpgto=001` usado para múltiplos tipos (`tp_pgto`: A, D, C, E, B)

---

## 📈 Diagrama ER (Entity-Relationship)

```
┌─────────────────────────────────────┐
│            DBPGTO                   │
│  (Contas a Pagar - Principal)       │
├─────────────────────────────────────┤
│ 🔑 cod_pgto        VARCHAR          │ ◄──┐
│    dt_emissao      DATE             │    │
│    dt_venc         DATE             │    │
│    vlr_pgto        NUMBER           │    │
│    paga            CHAR(1)          │    │ Relacionamento
│    dt_pgto         DATE             │    │ 1:N
│    cod_conta       VARCHAR          │    │
│    sf              VARCHAR          │    │
│    ... (outros campos)              │    │
└─────────────────────────────────────┘    │
                                           │
                                           │
┌─────────────────────────────────────┐    │
│           DBFPGTO                   │    │
│  (Formas de Pagamento - Dependente) │    │
├─────────────────────────────────────┤    │
│ 🔑 cod_pgto        VARCHAR          │ ───┘ (FK)
│ 🔑 cod_fpgto       VARCHAR          │
│ 🔑 fpg_cof_id      NUMBER           │
│    tp_pgto         VARCHAR          │
│    valor_pgto      NUMBER           │
│    dt_pgto         DATE             │
│    nro_cheque      VARCHAR          │
│    desconto        NUMBER           │
│    multa           NUMBER           │
│    juros           NUMBER           │
│    cancel          CHAR(1)          │
│    ... (outros campos)              │
└─────────────────────────────────────┘
```

---

## 🎓 Resumo Executivo

**Relacionamento:** DBPGTO ──(1:N)──> DBFPGTO

**Chave de Ligação:** `cod_pgto`

**Propósito:** Permitir que uma conta seja paga com uma ou múltiplas formas de pagamento

**Cardinalidade:**
- 1 conta em DBPGTO = 0 a N formas de pagamento em DBFPGTO
- 1 forma de pagamento em DBFPGTO = exatamente 1 conta em DBPGTO

**Estado Atual:**
- 617.975 contas cadastradas
- 585.722 formas de pagamento registradas
- 581.581 contas com pelo menos 1 forma de pagamento
- 1,01 formas de pagamento por conta (em média)
