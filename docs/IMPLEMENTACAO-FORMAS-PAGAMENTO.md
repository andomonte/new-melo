# Implementação: Registro de Formas de Pagamento em Contas a Pagar

## 📋 Resumo da Implementação

Implementamos o registro correto de formas de pagamento no sistema de Contas a Pagar, seguindo o modelo do Oracle migrado para PostgreSQL.

## 🏗️ Arquitetura

### Tabelas Envolvidas

#### 1. **DBPGTO** (Conta a Pagar Principal)
- Armazena as contas a pagar principais
- Campos principais: `cod_pgto`, `valor_pgto`, `dt_venc`, `dt_pgto`, `paga`, etc
- **NÃO** possui `cod_fpgto` diretamente

#### 2. **DBFPGTO** (Formas de Pagamento)
- Tabela separada que registra **cada forma de pagamento** usada em uma conta
- Uma conta pode ter **múltiplas formas de pagamento**
- Relacionamento: `dbfpgto.cod_pgto` → `dbpgto.cod_pgto`

### Estrutura DBFPGTO

```sql
CREATE TABLE dbfpgto (
  cod_pgto VARCHAR(9),           -- Relacionamento com DBPGTO
  cod_fpgto VARCHAR(3),          -- Código da forma de pagamento
  fpg_cof_id BIGINT PRIMARY KEY, -- ID único da forma de pagamento
  dt_pgto TIMESTAMP,             -- Data do pagamento
  valor_pgto NUMERIC,            -- Valor pago nesta forma
  tp_pgto VARCHAR(1),            -- Tipo: C=Cheque, D=Dinheiro, P=PIX, T=Transferência
  nro_cheque VARCHAR(15),        -- Número do cheque (se aplicável)
  desconto BIGINT,               -- Valor de desconto
  multa BIGINT,                  -- Valor de multa
  juros BIGINT,                  -- Valor de juros
  cod_conta VARCHAR(4),          -- Conta bancária utilizada
  cancel VARCHAR(1),             -- Cancelado? S/N
  dt_venc TIMESTAMP,             -- Data de vencimento
  dt_emissao TIMESTAMP,          -- Data de emissão
  sf VARCHAR(1),                 -- Sem fundo? S/N
  import VARCHAR(1)              -- Importado? S/N
);
```

## 🔧 Implementação no Backend

### API: `/api/contas-pagar/[id]/marcar-pago.ts`

```typescript
// 1. Atualizar DBPGTO (conta principal)
UPDATE dbpgto
SET paga = 'S',
    dt_pgto = $2,
    valor_pago = $3,
    // ... outros campos
WHERE cod_pgto = $1

// 2. Registrar forma de pagamento em DBFPGTO
INSERT INTO dbfpgto (
  cod_pgto,
  cod_fpgto,        // '001' = Dinheiro, '002' = Cheque, etc
  fpg_cof_id,       // ID único gerado
  dt_pgto,
  valor_pgto,
  tp_pgto,          // 'C', 'D', 'P', 'T', etc
  nro_cheque,       // Se tp_pgto = 'C'
  desconto,
  multa,
  juros,
  // ...
)
```

## 🎨 Implementação no Frontend

### Formas de Pagamento Disponíveis

| Código | Descrição | tp_pgto |
|--------|-----------|---------|
| 001 | Dinheiro | D |
| 002 | Cheque | C |
| 003 | PIX | P |
| 004 | Transferência Bancária | T |
| 005 | Cartão de Crédito | R |
| 006 | Cartão de Débito | E |
| 007 | Boleto | B |

### Campos Adicionados no Modal "Marcar como Paga"

1. **Forma de Pagamento** (obrigatório)
   - Select com as opções acima
   - Armazenado como `cod_fpgto` em DBFPGTO

2. **Número do Cheque** (condicional)
   - Aparece apenas se forma_pgto = '002' (Cheque)
   - Campo de texto, máximo 15 caracteres
   - Obrigatório quando cheque selecionado

### Validações Implementadas

```typescript
// 1. Forma de pagamento obrigatória
if (!formaPgto) {
  toast.error('Selecione a forma de pagamento');
  return;
}

// 2. Número de cheque obrigatório para cheques
if (formaPgto === '002' && !nroCheque) {
  toast.error('Número do cheque é obrigatório');
  return;
}
```

## 📊 Procedures Oracle que Usam DBFPGTO

Com base na investigação Oracle, as seguintes procedures operam com DBFPGTO:

1. **PACKAGE CONTASP** - Principal
   - `Del_FPgto` - Deleta forma de pagamento
   - `Navega_ContasFP` - Navega contas com formas de pagamento
   - `Inc_ContasFP` - Inclui formas de pagamento

2. **PACKAGE CAIXADIARIO / CAIXADIARIO2**
   - Consultas de caixa com formas de pagamento

3. **PACKAGE FATURAMENTOS**
   - Integração com faturamento

4. **PACKAGE TOTVS**
   - Integração com sistema TOTVS

5. **PACKAGE VALE**
   - `PAGAR_TITULOS_VALE` - Pagamento com vale

## 🔍 Como Funciona

### Fluxo de Pagamento

```
1. Usuário marca conta como paga
   ├─ Informa: data, valor, forma de pagamento
   ├─ Se cheque: informa número do cheque
   └─ Opcional: juros, multa, desconto

2. Backend processa
   ├─ UPDATE em DBPGTO (marca paga='S', dt_pgto, valor_pago)
   └─ INSERT em DBFPGTO (registra forma de pagamento)

3. Resultado
   ├─ Conta marcada como paga
   ├─ Forma de pagamento registrada
   └─ Histórico completo mantido
```

### Exemplo de Dados Salvos

**DBPGTO:**
```json
{
  "cod_pgto": "27585",
  "paga": "S",
  "dt_pgto": "2025-11-12",
  "valor_pago": 1000.00,
  "valor_juros": 50.00
}
```

**DBFPGTO:**
```json
{
  "cod_pgto": "27585",
  "cod_fpgto": "002",        // Cheque
  "fpg_cof_id": 12345,
  "tp_pgto": "C",            // Cheque
  "nro_cheque": "000123",
  "valor_pgto": 1000.00,
  "juros": 50,
  "dt_pgto": "2025-11-12"
}
```

## ✅ Benefícios da Implementação

1. **Conformidade com Oracle**: Mantém compatibilidade com sistema legado
2. **Múltiplas Formas de Pagamento**: Suporta pagamentos parciais com formas diferentes
3. **Histórico Completo**: Rastreabilidade total de pagamentos
4. **Flexibilidade**: Fácil adicionar novas formas de pagamento
5. **Relatórios**: Permite análises por forma de pagamento

## 🔄 Migração de Dados

A tabela DBFPGTO já foi migrada do Oracle com:
- **555.408 registros** em DBPGTO (Oracle)
- **200 registros** em DBFPGTO (PostgreSQL - exemplo)
- Formas mais usadas: '001' (Cheque e Dinheiro)

## 📝 Próximos Passos

1. ✅ Implementar cadastro de formas de pagamento
2. ✅ Adicionar relatório por forma de pagamento
3. ✅ Permitir múltiplas formas em um mesmo pagamento
4. ✅ Integração com conciliação bancária

## 🚀 Como Testar

1. Acessar Contas a Pagar
2. Selecionar uma conta pendente
3. Clicar em "Marcar como Paga"
4. Preencher:
   - Data de pagamento
   - Valor pago
   - **Forma de pagamento** (novo campo)
   - Se cheque: número do cheque
5. Salvar

Verificar no banco:
```sql
-- Conta principal
SELECT * FROM db_manaus.dbpgto WHERE cod_pgto = '27585';

-- Forma de pagamento registrada
SELECT * FROM db_manaus.dbfpgto WHERE cod_pgto = '27585';
```

## 📚 Referências

- Tabela Oracle DBFPGTO: 23 colunas
- Procedures Oracle: CONTASP, CAIXADIARIO, FATURAMENTOS
- Investigação: `investigar-dbfpgto-oracle.js`
- Estrutura PG: `investigar-dbfpgto-structure.js`
