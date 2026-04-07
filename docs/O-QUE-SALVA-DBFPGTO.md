# 📝 O QUE É SALVO NA TABELA DBFPGTO

## Quando você marca uma conta como paga, são salvos **16 campos** na tabela DBFPGTO:

---

### ✅ EXEMPLO PRÁTICO

**Cenário:** Você marca a conta **27585** como paga com as seguintes informações:

```
📅 Data do Pagamento: 12/11/2025
💰 Valor Pago: R$ 1.500,00
💳 Forma de Pagamento: 002 - Cheque
📄 Número do Cheque: 000456
🏦 Banco: 001
⚖️ Juros: R$ 50,00
📊 Desconto: R$ 20,00
📌 Multa: R$ 10,00
```

---

## 🗄️ DADOS SALVOS NA TABELA `DBFPGTO`:

```sql
INSERT INTO dbfpgto (
  cod_pgto,      -- Código da conta (relacionamento com DBPGTO)
  cod_fpgto,     -- Código da forma de pagamento
  fpg_cof_id,    -- ID único gerado automaticamente
  dt_pgto,       -- Data do pagamento
  valor_pgto,    -- Valor pago nesta forma
  tp_pgto,       -- Tipo de pagamento (C/D/P/T/R/E/B)
  nro_cheque,    -- Número do cheque (se aplicável)
  cancel,        -- Cancelado? (S/N)
  desconto,      -- Valor do desconto
  multa,         -- Valor da multa
  juros,         -- Valor dos juros
  cod_conta,     -- Código da conta bancária
  dt_venc,       -- Data de vencimento (da conta original)
  dt_emissao,    -- Data de emissão (da conta original)
  sf,            -- Sem fundo? (S/N)
  import         -- Importado? (S/N)
) VALUES (
  '27585',       -- ✅ cod_pgto: Vem do ID da conta que você está pagando
  '002',         -- ✅ cod_fpgto: Você selecionou "002 - Cheque"
  12345,         -- ✅ fpg_cof_id: Gerado automaticamente (próximo ID disponível)
  '2025-11-12',  -- ✅ dt_pgto: Data que você informou no formulário
  1500.00,       -- ✅ valor_pgto: Valor que você informou (R$ 1.500,00)
  'C',           -- ✅ tp_pgto: 'C' porque é Cheque (mapeamento automático)
  '000456',      -- ✅ nro_cheque: Número do cheque que você digitou
  'N',           -- ✅ cancel: Sempre 'N' (não cancelado) ao criar
  20.00,         -- ✅ desconto: R$ 20,00 (se você informou)
  10.00,         -- ✅ multa: R$ 10,00 (se você informou)
  50.00,         -- ✅ juros: R$ 50,00 (calculado ou informado)
  '001',         -- ✅ cod_conta: Código do banco que você selecionou
  '2025-11-17',  -- ✅ dt_venc: Copiado da conta original (DBPGTO)
  '2025-11-12',  -- ✅ dt_emissao: Copiado da conta original (DBPGTO)
  'N',           -- ✅ sf: Sempre 'N' (sem fundo = não) ao criar
  'N'            -- ✅ import: Sempre 'N' (não importado) ao criar
);
```

---

## 📊 MAPEAMENTO DE CAMPOS

### De onde vem cada campo:

| Campo | Origem | Exemplo |
|-------|--------|---------|
| `cod_pgto` | ID da conta que você está pagando | '27585' |
| `cod_fpgto` | Selecionado por você no formulário | '001', '002', '003'... |
| `fpg_cof_id` | Gerado automaticamente pelo sistema | 12345 |
| `dt_pgto` | Informado por você | '2025-11-12' |
| `valor_pgto` | Informado por você | 1500.00 |
| `tp_pgto` | Mapeamento automático do cod_fpgto | 'C', 'D', 'P', 'T'... |
| `nro_cheque` | Informado por você (só se for cheque) | '000456' ou NULL |
| `cancel` | Sistema (padrão 'N') | 'N' |
| `desconto` | Informado por você (opcional) | 20.00 ou 0 |
| `multa` | Informado por você (opcional) | 10.00 ou 0 |
| `juros` | Calculado ou informado | 50.00 |
| `cod_conta` | Selecionado por você ou da conta original | '001' |
| `dt_venc` | Copiado da DBPGTO | '2025-11-17' |
| `dt_emissao` | Copiado da DBPGTO | '2025-11-12' |
| `sf` | Sistema (padrão 'N') | 'N' |
| `import` | Sistema (padrão 'N') | 'N' |

---

## 🔄 MAPEAMENTO AUTOMÁTICO tp_pgto:

O sistema converte automaticamente o `cod_fpgto` para `tp_pgto`:

```javascript
const tipoPgtoMap = {
  '001': 'D',  // Dinheiro
  '002': 'C',  // Cheque
  '003': 'P',  // PIX
  '004': 'T',  // Transferência
  '005': 'R',  // Cartão Crédito (cRedit)
  '006': 'E',  // Cartão Débito (dEbit)
  '007': 'B',  // Boleto
};
```

---

## 💡 EXEMPLO REAL - DIFERENTES FORMAS DE PAGAMENTO

### 1️⃣ Pagamento em DINHEIRO:
```sql
cod_fpgto = '001'
tp_pgto = 'D'
nro_cheque = NULL
```

### 2️⃣ Pagamento em CHEQUE:
```sql
cod_fpgto = '002'
tp_pgto = 'C'
nro_cheque = '000456'  -- Obrigatório!
```

### 3️⃣ Pagamento via PIX:
```sql
cod_fpgto = '003'
tp_pgto = 'P'
nro_cheque = NULL
```

### 4️⃣ Pagamento via TRANSFERÊNCIA:
```sql
cod_fpgto = '004'
tp_pgto = 'T'
nro_cheque = NULL
```

---

## ⚠️ VALIDAÇÕES IMPORTANTES

1. **Forma de pagamento é OBRIGATÓRIA**
   - Se não informar, o registro em DBFPGTO não é criado

2. **Número de cheque é OBRIGATÓRIO para cheques**
   - Se `cod_fpgto = '002'` e não informar número, dá erro

3. **FPG_COF_ID é único**
   - Cada pagamento tem um ID único, mesmo que seja da mesma conta

---

## 🔍 COMO CONSULTAR O QUE FOI SALVO

```sql
-- Ver a forma de pagamento registrada
SELECT 
  cod_pgto,
  cod_fpgto,
  fpg_cof_id,
  dt_pgto,
  valor_pgto,
  tp_pgto,
  nro_cheque,
  juros,
  desconto,
  multa
FROM db_manaus.dbfpgto
WHERE cod_pgto = '27585';
```

**Resultado esperado:**
```
cod_pgto | cod_fpgto | fpg_cof_id |  dt_pgto   | valor_pgto | tp_pgto | nro_cheque | juros | desconto | multa
---------|-----------|------------|------------|------------|---------|------------|-------|----------|-------
27585    | 002       | 12345      | 2025-11-12 | 1500.00    | C       | 000456     | 50.00 | 20.00    | 10.00
```

---

## 📝 RESUMO

**O que é salvo na DBFPGTO:**
- ✅ Relacionamento com a conta (cod_pgto)
- ✅ Qual forma de pagamento foi usada (cod_fpgto + tp_pgto)
- ✅ Quando foi pago (dt_pgto)
- ✅ Quanto foi pago (valor_pgto)
- ✅ Informações adicionais (cheque, juros, multa, desconto)
- ✅ Dados copiados da conta original (dt_venc, dt_emissao)
- ✅ Flags de controle (cancel, sf, import)

**Total:** 16 campos salvos por pagamento! 🎯
