# 📊 SISTEMA DE PARCELAMENTO - CONTAS A PAGAR

## ✅ IMPLEMENTAÇÃO COMPLETA

Data: 12 de Novembro de 2025

---

## 🎯 Como Funciona

O sistema de parcelamento permite que uma conta a pagar seja dividida em **múltiplas parcelas** com vencimentos escalonados.

### Arquitetura

**Não existe tabela separada de parcelas!**  
Cada parcela = **1 registro individual em DBPGTO**

```
Conta Parcelada (3x de R$ 300,00 = R$ 900,00)
   ↓
DBPGTO:
- Registro 1: cod_pgto=000001, nro_dup=DUP12345/01, venc=01/12, valor=300,00
- Registro 2: cod_pgto=000002, nro_dup=DUP12345/02, venc=31/12, valor=300,00
- Registro 3: cod_pgto=000003, nro_dup=DUP12345/03, venc=30/01, valor=300,00
```

---

## 🔧 Implementação Frontend

### Arquivo: `src/components/corpo/contas-pagar/ContasAPagar.tsx`

#### Estados Adicionados

```typescript
const [novaContaDados, setNovaContaDados] = useState({
  // ... campos existentes
  parcelado: false,        // Checkbox para ativar parcelamento
  num_parcelas: 1,         // Número de parcelas (1-360)
  intervalo_dias: 30,      // Dias entre cada vencimento
});
```

#### Interface do Usuário

**Checkbox "Parcelar Conta"**
- Quando marcado, exibe campos adicionais
- Visual com borda azul para destacar

**Campos Condicionais:**
1. **Número de Parcelas** (1-360)
   - Input numérico
   - Mostra quantos registros serão criados

2. **Intervalo em Dias** (1-365)
   - Dias entre cada vencimento
   - Padrão: 30 dias (mensal)

**Resumo Visual:**
```
┌─────────────────────────────────────────┐
│ Resumo do Parcelamento:                 │
│ • 3x de R$ 300,00                       │
│ • Vencimentos a cada 30 dias            │
│ • Primeiro vencimento: 01/12/2025       │
└─────────────────────────────────────────┘
```

---

## 🔧 Implementação Backend

### Arquivo: `src/pages/api/contas-pagar/criar.ts`

#### Parâmetros Adicionais

```typescript
const {
  // ... parâmetros existentes
  parcelado = false,       // Se a conta será parcelada
  num_parcelas = 1,        // Número de parcelas
  intervalo_dias = 30,     // Intervalo entre vencimentos
} = req.body;
```

#### Lógica de Parcelamento

```typescript
// 1. Determinar quantas parcelas criar
const totalParcelas = parcelado && num_parcelas > 1 ? num_parcelas : 1;

// 2. Calcular valor de cada parcela
const valorParcela = parseFloat(valor_pgto) / totalParcelas;
const valorParcelaFormatado = Math.floor(valorParcela * 100) / 100;

// 3. Distribuir centavos restantes na última parcela
const restocentavos = parseFloat(valor_pgto) - (valorParcelaFormatado * totalParcelas);

// 4. Gerar base do nro_dup
let baseDup = nro_dup || nro_nf || `DUP${Date.now().toString().slice(-8)}`;

// 5. Loop para criar cada parcela
for (let i = 0; i < totalParcelas; i++) {
  // a) Gerar cod_pgto único
  const nextCodPgto = (MAX(cod_pgto) + 1).toString().padStart(9, '0');
  
  // b) Calcular data de vencimento
  const dataVenc = new Date(dt_venc);
  dataVenc.setDate(dataVenc.getDate() + (i * intervalo_dias));
  
  // c) Calcular valor (última parcela recebe centavos restantes)
  const valorDestaParcela = i === totalParcelas - 1 
    ? valorParcelaFormatado + restocentavos
    : valorParcelaFormatado;
  
  // d) Gerar nro_dup no formato base/XX
  const nroDupParcela = `${baseDup}/${String(i + 1).padStart(2, '0')}`;
  
  // e) Inserir parcela em DBPGTO
  INSERT INTO dbpgto (...) VALUES (...);
}
```

---

## 📋 Formato do nro_dup

### Padrão Implementado

```
Base/Parcela

Exemplos:
- NF12345/01
- NF12345/02
- NF12345/03

Ou com base auto-gerada:
- DUP87654321/01
- DUP87654321/02
```

### Regras

1. **Se usuário fornece nro_dup:** usa como base
2. **Se tem nro_nf:** usa nro_nf como base
3. **Se não tem nenhum:** gera `DUP{timestamp}`

---

## 💡 Exemplos Práticos

### Exemplo 1: Nota Fiscal em 3x

**Entrada:**
```json
{
  "tipo": "F",
  "cod_credor": "00123",
  "valor_pgto": 900.00,
  "dt_venc": "2025-12-01",
  "nro_nf": "NF12345",
  "parcelado": true,
  "num_parcelas": 3,
  "intervalo_dias": 30
}
```

**Resultado em DBPGTO:**
```sql
-- Parcela 1/3
cod_pgto='000618506', nro_dup='NF12345/01', dt_venc='2025-12-01', valor_pgto=300.00

-- Parcela 2/3
cod_pgto='000618507', nro_dup='NF12345/02', dt_venc='2025-12-31', valor_pgto=300.00

-- Parcela 3/3
cod_pgto='000618508', nro_dup='NF12345/03', dt_venc='2026-01-30', valor_pgto=300.00
```

---

### Exemplo 2: Parcelamento com Centavos

**Entrada:**
```json
{
  "valor_pgto": 1000.00,
  "num_parcelas": 3,
  "intervalo_dias": 30
}
```

**Cálculo:**
- Valor por parcela: 1000 / 3 = 333.333...
- Parcela formatada: 333.33
- Total 2 primeiras: 333.33 * 2 = 666.66
- Resto: 1000 - 666.66 = 333.34

**Resultado:**
```
Parcela 1: R$ 333,33
Parcela 2: R$ 333,33
Parcela 3: R$ 333,34 (recebe os R$ 0,01 restantes)
Total: R$ 1.000,00 ✅
```

---

### Exemplo 3: Parcelamento Quinzenal

**Entrada:**
```json
{
  "valor_pgto": 600.00,
  "dt_venc": "2025-12-01",
  "num_parcelas": 4,
  "intervalo_dias": 15
}
```

**Resultado:**
```
Parcela 1: Venc 01/12/2025, Valor R$ 150,00
Parcela 2: Venc 16/12/2025, Valor R$ 150,00
Parcela 3: Venc 31/12/2025, Valor R$ 150,00
Parcela 4: Venc 15/01/2026, Valor R$ 150,00
```

---

## 🔍 Consultar Parcelas no Banco

### Buscar todas as parcelas de uma nota

```sql
SELECT 
  cod_pgto,
  nro_dup,
  dt_venc,
  valor_pgto,
  paga
FROM dbpgto
WHERE nro_dup LIKE 'NF12345/%'
ORDER BY nro_dup;
```

### Buscar contas parceladas

```sql
-- Padrão: nro_dup contém '/'
SELECT 
  SUBSTRING(nro_dup FROM 1 FOR POSITION('/' IN nro_dup) - 1) as base,
  COUNT(*) as qtd_parcelas,
  SUM(valor_pgto) as valor_total
FROM dbpgto
WHERE nro_dup LIKE '%/%'
GROUP BY base
ORDER BY qtd_parcelas DESC;
```

---

## ⚙️ Resposta da API

### Sucesso - Conta Simples (1 parcela)

```json
{
  "sucesso": true,
  "mensagem": "Conta a pagar criada com sucesso",
  "total_parcelas": 1,
  "valor_total": 500.00,
  "valor_parcela": 500.00,
  "contas": [
    {
      "cod_pgto": "000618506",
      "tipo": "F",
      "valor_pgto": "500.00",
      "dt_venc": "2025-12-01",
      "nro_dup": "NF98765",
      "nome_credor": "Fornecedor XYZ Ltda"
    }
  ]
}
```

### Sucesso - Conta Parcelada (3 parcelas)

```json
{
  "sucesso": true,
  "mensagem": "3 parcelas criadas com sucesso!",
  "total_parcelas": 3,
  "valor_total": 900.00,
  "valor_parcela": 300.00,
  "contas": [
    {
      "cod_pgto": "000618506",
      "tipo": "F",
      "valor_pgto": "300.00",
      "dt_venc": "2025-12-01",
      "nro_dup": "NF12345/01",
      "nome_credor": "Fornecedor XYZ Ltda"
    },
    {
      "cod_pgto": "000618507",
      "tipo": "F",
      "valor_pgto": "300.00",
      "dt_venc": "2025-12-31",
      "nro_dup": "NF12345/02",
      "nome_credor": "Fornecedor XYZ Ltda"
    },
    {
      "cod_pgto": "000618508",
      "tipo": "F",
      "valor_pgto": "300.00",
      "dt_venc": "2026-01-30",
      "nro_dup": "NF12345/03",
      "nome_credor": "Fornecedor XYZ Ltda"
    }
  ]
}
```

---

## ✅ Casos de Uso Suportados

### ✅ 1. Pagamento à Vista (Padrão)
- `parcelado = false` ou `num_parcelas = 1`
- Cria 1 registro em DBPGTO
- Comportamento original mantido

### ✅ 2. Parcelamento Mensal
- `num_parcelas = 6`
- `intervalo_dias = 30`
- Vencimentos a cada 30 dias

### ✅ 3. Parcelamento Quinzenal
- `num_parcelas = 4`
- `intervalo_dias = 15`
- Vencimentos a cada 15 dias

### ✅ 4. Parcelamento Semanal
- `num_parcelas = 4`
- `intervalo_dias = 7`
- Vencimentos semanais

### ✅ 5. Parcelamento Personalizado
- Qualquer combinação de `num_parcelas` e `intervalo_dias`
- Limite: 1-360 parcelas, 1-365 dias de intervalo

---

## 🔒 Validações Implementadas

### Backend

```typescript
// 1. Número de parcelas
if (num_parcelas < 1 || num_parcelas > 360) {
  return erro('Número de parcelas inválido (1-360)');
}

// 2. Intervalo de dias
if (intervalo_dias < 1 || intervalo_dias > 365) {
  return erro('Intervalo inválido (1-365 dias)');
}

// 3. Valor total
if (valor_pgto <= 0 || valor_pgto > 999999999.99) {
  return erro('Valor inválido');
}

// 4. Data de vencimento obrigatória
if (!dt_venc) {
  return erro('Data de vencimento é obrigatória');
}
```

### Frontend

- Checkbox "Parcelar Conta" ativa campos
- Número de parcelas: min=1, max=360
- Intervalo de dias: min=1, max=365
- Resumo visual mostra preview do parcelamento

---

## 📊 Benefícios

### ✅ Compatível com Sistema Legado
- Segue o mesmo padrão do Oracle
- Campo `nro_dup` no formato `base/XX`
- Cada parcela = registro individual

### ✅ Flexível
- Suporta qualquer intervalo de dias
- Qualquer número de parcelas
- Distribui centavos corretamente

### ✅ Auditável
- Cada parcela tem cod_pgto único
- Pode marcar cada parcela como paga individualmente
- Histórico completo em DBPGTO

### ✅ Escalável
- Mesmo código serve para 1 ou 360 parcelas
- Performance otimizada (queries sequenciais)

---

## 🎨 Fluxo Completo do Usuário

### 1. Abrir Modal "Nova Conta"

### 2. Preencher Dados Básicos
- Tipo (Fornecedor/Transportadora)
- Credor
- Valor total
- Data do primeiro vencimento
- Nota fiscal

### 3. Marcar "Parcelar Conta" ✓

### 4. Configurar Parcelamento
- Número de parcelas: **3**
- Intervalo: **30** dias

### 5. Ver Resumo
```
Resumo do Parcelamento:
• 3x de R$ 300,00
• Vencimentos a cada 30 dias
• Primeiro vencimento: 01/12/2025
```

### 6. Salvar

### 7. Sistema Cria 3 Registros
- `000001 | NF12345/01 | 01/12 | R$ 300,00`
- `000002 | NF12345/02 | 31/12 | R$ 300,00`
- `000003 | NF12345/03 | 30/01 | R$ 300,00`

### 8. Toast de Sucesso
> "3 parcelas criadas com sucesso!"

---

## 🔧 Próximas Melhorias Possíveis

### 🎯 Funcionalidades Futuras

1. **Visualização Agrupada**
   - Mostrar parcelas do mesmo título agrupadas
   - Indicador visual "Parcela 2/3"

2. **Pagamento em Lote**
   - Marcar todas as parcelas de uma vez
   - Com diferentes formas de pagamento por parcela

3. **Edição de Parcelas**
   - Alterar vencimento de parcelas futuras
   - Ajustar valores mantendo total

4. **Renegociação**
   - Cancelar parcelas restantes
   - Criar novo parcelamento

5. **Relatórios**
   - Parcelas a vencer
   - Parcelas em atraso por título
   - Análise de inadimplência por parcelamento

---

## 📝 Resumo Executivo

**✅ Sistema de Parcelamento Implementado com Sucesso!**

- Frontend com checkbox e campos condicionais
- Backend cria múltiplos registros em DBPGTO
- Formato `nro_dup` compatível com legado
- Distribuição correta de centavos
- Cálculo automático de vencimentos
- Totalmente funcional e pronto para uso

**Arquivos Modificados:**
1. `src/components/corpo/contas-pagar/ContasAPagar.tsx` - UI e estados
2. `src/pages/api/contas-pagar/criar.ts` - Lógica de parcelamento

**Pronto para testes e produção! 🚀**
