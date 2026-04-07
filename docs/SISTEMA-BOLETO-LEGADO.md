# 🎫 Sistema de Boletos Bancários - Implementação Legada

Sistema de geração de boletos bancários implementado seguindo **exatamente** as regras do sistema legado em Delphi.

## 📋 Visão Geral

Este sistema **NÃO USA** APIs externas como Asaas. Todo o cálculo é feito localmente seguindo as especificações FEBRABAN e a lógica do sistema legado (`unitBoletoGrupo.pas` e `UniRelVendas.pas`).

## 🏦 Bancos Suportados

- **Bradesco** (código `'0'` ou `'237'`)
- **Banco do Brasil** (código `'1'` ou `'001'`)
- **Itaú** (código `'2'` ou `'341'`)

## 📂 Arquivos Criados

### 1. **Biblioteca de Cálculos**
```
src/lib/boleto/calculoBoleto.ts
```
Contém todas as funções de cálculo:
- ✅ Módulo 10 (dígitos verificadores da linha digitável)
- ✅ Módulo 11 (dígito verificador do código de barras)
- ✅ Geração de campo livre (25 dígitos)
- ✅ Geração de código de barras (44 dígitos)
- ✅ Geração de linha digitável (47 dígitos + formatação)
- ✅ Cálculo de Nosso Número
- ✅ Cálculo de fator de vencimento
- ✅ Cálculo de juros e mora

### 2. **API de Geração**
```
src/pages/api/boleto/gerar-legado.ts
```
Endpoint para gerar boletos:
- **POST** `/api/boleto/gerar-legado`
- Busca dados no banco (dbfatura, dbclien, dbdados_banco)
- Gera boleto usando a biblioteca de cálculo
- Salva em `dbreceb` e atualiza `dbfatura`

### 3. **Componente Visualizador**
```
src/components/boleto/BoletoVisualizador.tsx
```
Componente React para exibir e imprimir boleto:
- Layout padrão FEBRABAN
- Código de barras gerado com JsBarcode
- Ficha de compensação completa
- Recibo do sacado
- Função de impressão

### 4. **Botão Gerador**
```
src/components/boleto/GerarBoletoButton.tsx
```
Botão reutilizável para gerar boleto:
- Loading state
- Modal com visualização
- Toast notifications
- Callback de sucesso

## 🚀 Como Usar

### Exemplo Básico

```tsx
import { GerarBoletoButton } from '@/components/boleto/GerarBoletoButton';

function MinhaFatura() {
  return (
    <GerarBoletoButton
      codfat="000002828"
      valor={1500.00}
      vencimento="2025-11-15"
      banco="0" // 0=Bradesco, 1=BB, 2=Itaú
      descricao="Fatura #2828 - Produtos diversos"
      onSucesso={(boleto) => {
        console.log('Boleto gerado:', boleto);
      }}
    />
  );
}
```

### Exemplo com API Diretamente

```typescript
const response = await axios.post('/api/boleto/gerar-legado', {
  codfat: '000002828',
  valor: 1500.00,
  vencimento: '2025-11-15', // YYYY-MM-DD
  banco: '0', // opcional, usa do cliente
  descricao: 'Fatura #2828',
});

const { boleto } = response.data;
console.log('Linha digitável:', boleto.linhaDigitavel);
console.log('Nosso número:', boleto.nossoNumero);
```

## 🔧 Estrutura do Banco de Dados

### Tabela: `dbreceb` (Contas a Receber)

```sql
CREATE TABLE dbreceb (
  cod_receb VARCHAR(11) PRIMARY KEY,  -- Código único do recebível
  codcli VARCHAR(5) NOT NULL,         -- Código do cliente
  cod_fat VARCHAR(9) NOT NULL,        -- Código da fatura
  dt_venc DATE NOT NULL,              -- Data de vencimento
  valor_pgto DECIMAL(15,2) NOT NULL,  -- Valor do pagamento
  nro_doc VARCHAR(20),                -- Número do documento
  nro_docbanco VARCHAR(20),           -- Nosso número formatado
  nro_banco VARCHAR(50),              -- Código de barras
  forma_fat CHAR(1),                  -- 'B' = Boleto
  banco CHAR(1),                      -- 0, 1 ou 2
  rec CHAR(1) DEFAULT 'N',            -- Recebido
  cancel CHAR(1) DEFAULT 'N'          -- Cancelado
);
```

### Tabela: `dbfatura`

```sql
ALTER TABLE dbfatura 
ADD COLUMN linha_digitavel VARCHAR(100),
ADD COLUMN codigo_barras VARCHAR(100),
ADD COLUMN status_boleto VARCHAR(20);
```

### Tabela: `dbdados_banco`

```sql
CREATE TABLE dbdados_banco (
  id SERIAL PRIMARY KEY,
  banco CHAR(1),           -- 0, 1 ou 2
  nroconta VARCHAR(10),
  agencia VARCHAR(4),
  convenio VARCHAR(10),
  carteira VARCHAR(3),
  variacao VARCHAR(3)
);
```

## 📐 Regras de Cálculo

### 1. Fator de Vencimento

```typescript
const DATA_BASE = new Date('1997-10-07');
const fatorVencimento = diferencaDias(dtVencimento, DATA_BASE);
// Exemplo: 15/01/2025 = fator 9862
```

### 2. Código de Barras (44 dígitos)

```
Posição  | Tamanho | Descrição
---------|---------|------------------------------------------
1-3      | 3       | Código do banco (237, 001, 341)
4        | 1       | Código da moeda (9 = Real)
5        | 1       | Dígito verificador (Módulo 11)
6-9      | 4       | Fator de vencimento
10-19    | 10      | Valor (em centavos, com zeros à esquerda)
20-44    | 25      | Campo livre (específico de cada banco)
```

**Exemplo Bradesco:**
```
237 9 8 9862 0000150000 2368090001234567800000010
│   │ │  │    │          └─ Campo livre (25)
│   │ │  │    └─ Valor R$ 1.500,00
│   │ │  └─ Fator vencimento
│   │ └─ DV
│   └─ Moeda
└─ Bradesco
```

### 3. Linha Digitável (47 dígitos)

A linha digitável é dividida em 5 campos separados por espaços:

```
23790.00012 34567.800000 00010.00000 8 98620000150000
│          │            │           │ └─ Campo 5 (14)
│          │            │           └─ Campo 4: DV (1)
│          │            └─ Campo 3 + DV (11)
│          └─ Campo 2 + DV (11)
└─ Campo 1 + DV (10)
```

**Campo 1:** Código banco (3) + moeda (1) + primeiros 5 do campo livre + DV (Módulo 10)  
**Campo 2:** Próximos 10 do campo livre + DV (Módulo 10)  
**Campo 3:** Últimos 10 do campo livre + DV (Módulo 10)  
**Campo 4:** Dígito verificador geral do código de barras  
**Campo 5:** Fator de vencimento (4) + valor (10)

### 4. Nosso Número

**Bradesco:**
```typescript
// Carteira: 09
// Número: 00012345678 (11 dígitos)
// Dígito: Calculado com Módulo 11 especial
// Formato: "09 / 00012345678-P"
```

**Algoritmo do dígito:**
```typescript
function gerarDigitoNossoNumeroBradesco(nossoNumero: string): string {
  let soma = 0;
  let multiplicador = 2;
  
  for (let i = nossoNumero.length - 1; i >= 0; i--) {
    soma += parseInt(nossoNumero[i]) * multiplicador;
    multiplicador = (multiplicador === 7) ? 2 : multiplicador + 1;
  }
  
  soma += 63; // Constante mágica do Bradesco
  const resto = soma % 11;
  
  if (resto === 0) return '0';
  if (resto === 1) return 'P';
  return String(11 - resto);
}
```

### 5. Campo Livre (25 dígitos)

**Bradesco:**
```
Posição | Descrição
--------|------------------------------------------
1-6     | Fixo: 236809
7-17    | Número do documento no banco (11)
18-24   | Zeros para completar
25      | Dígito da conta ou zero
```

**Banco do Brasil:**
```
Posição | Descrição
--------|------------------------------------------
1-7     | Convênio (7)
8-24    | Nosso número (17)
25-26   | Carteira (2)
```

## 🧪 Testes

### Teste Manual

```bash
# 1. Testar API
curl -X POST http://localhost:3000/api/boleto/gerar-legado \
  -H "Content-Type: application/json" \
  -d '{
    "codfat": "000002828",
    "valor": 1500.00,
    "vencimento": "2025-11-15",
    "banco": "0"
  }'
```

### Validar Cálculos

```typescript
import { gerarBoleto } from '@/lib/boleto/calculoBoleto';

const boleto = gerarBoleto({
  banco: '0', // Bradesco
  nroConta: '0000000123',
  agencia: '1999',
  codReceb: '00012345678',
  nroDoc: '000002828',
  nroDocBanco: '00012345678',
  valor: 1500.00,
  dtEmissao: new Date('2025-10-13'),
  dtVencimento: new Date('2025-11-15'),
  nomeCli: 'CLIENTE TESTE LTDA',
  endereco: 'Rua Teste, 123',
  bairro: 'Centro',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '01234-567',
});

console.log('Linha digitável:', boleto.linhaDigitavel);
console.log('Código de barras:', boleto.codigoBarras);
console.log('Nosso número:', boleto.nossoNumero);
```

## 🔒 Segurança

- ✅ Validação de CPF/CNPJ
- ✅ Validação de valor (> 0)
- ✅ Validação de vencimento (> emissão)
- ✅ COD_RECEB único (sequence do banco)
- ✅ Sanitização de inputs
- ✅ Prevenção de SQL Injection (prepared statements)

## 📊 Fluxo Completo

```
1. Usuário clica em "Gerar Boleto"
   ↓
2. POST /api/boleto/gerar-legado
   ↓
3. Busca dados no banco:
   - dbfatura (dados da fatura)
   - dbclien (dados do cliente)
   - dbdados_banco (dados bancários)
   ↓
4. Gera ou busca COD_RECEB (sequence)
   ↓
5. Calcula boleto:
   - Campo livre (25 dígitos)
   - Código de barras (44 dígitos)
   - Linha digitável (47 dígitos)
   - Nosso número
   ↓
6. Salva em dbreceb (novo ou atualiza)
   ↓
7. Atualiza dbfatura
   ↓
8. Retorna boleto gerado
   ↓
9. Exibe modal com visualização
   ↓
10. Usuário pode imprimir ou copiar linha
```

## 🐛 Troubleshooting

### Erro: "COD_RECEB deve ter 11 dígitos"
**Solução:** Verifique se a sequence `seq_cod_receb` existe no banco.

### Erro: "Fatura não encontrada"
**Solução:** Confirme que o `codfat` existe na tabela `dbfatura`.

### Erro: "Valor do boleto inválido"
**Solução:** Certifique-se de que o valor é maior que zero.

### Linha digitável não valida no banco
**Solução:** Verifique se os cálculos de Módulo 10 e 11 estão corretos. Compare com o sistema legado.

## 📚 Referências

- **Sistema Legado:** `projeto legado sistema melo/Geral/unitBoletoGrupo.pas`
- **Sistema Legado:** `projeto legado sistema melo/Geral/UniRelVendas.pas`
- **FEBRABAN:** Especificação técnica de boletos
- **Bradesco:** Manual de emissão de boletos
- **Banco do Brasil:** Especificação de convênio
- **Itaú:** Manual de cobrança registrada

## 🎯 Próximos Passos

- [ ] Implementar envio de email com boleto
- [ ] Adicionar geração de PDF do boleto
- [ ] Implementar consulta de status de pagamento
- [ ] Adicionar registro de boletos em arquivo remessa
- [ ] Implementar leitura de arquivo retorno
- [ ] Adicionar boletos agrupados (múltiplas faturas)
- [ ] Implementar baixa automática de boletos pagos

## ✅ Vantagens sobre Asaas

1. **Sem custos de API** - Não paga por transação
2. **Controle total** - Todos os cálculos locais
3. **Sem dependências externas** - Sistema offline
4. **Compatível com legado** - Mesma lógica do Delphi
5. **Dados no banco** - Tudo armazenado localmente
6. **Customizável** - Ajuste conforme necessário

## 📝 Licença

Este código segue as mesmas regras do sistema legado da empresa.
