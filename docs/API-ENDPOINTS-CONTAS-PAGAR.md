# 📡 API Endpoints - Contas a Pagar Oracle

Documentação completa dos endpoints da API integrada com Oracle.

---

## 🧮 POST /api/contas-pagar/calcular-juros

Calcula juros de mora baseado na taxa e dias de atraso.

### Request

```http
POST /api/contas-pagar/calcular-juros
Content-Type: application/json

{
  "valor_pgto": 1000.00,
  "dt_venc": "2025-10-01",
  "taxa_juros": 8
}
```

### Parameters

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `valor_pgto` | number | Sim | Valor nominal do título |
| `dt_venc` | string (ISO date) | Sim | Data de vencimento |
| `taxa_juros` | number | Não | Taxa de juros ao mês (padrão: 8) |

### Response (200 OK)

```json
{
  "sucesso": true,
  "valor_original": 1000.00,
  "dt_venc": "2025-10-01",
  "taxa_juros_mensal": 8,
  "taxa_juros_diaria": 0.00266,
  "dias_atraso": 41,
  "valor_juros": 109.20,
  "valor_total": 1109.20,
  "atrasado": true
}
```

### Response (400 Bad Request)

```json
{
  "erro": "Parâmetros obrigatórios: valor_pgto e dt_venc"
}
```

### Exemplos

#### cURL
```bash
curl -X POST http://localhost:3000/api/contas-pagar/calcular-juros \
  -H "Content-Type: application/json" \
  -d '{
    "valor_pgto": 1000,
    "dt_venc": "2025-10-01",
    "taxa_juros": 8
  }'
```

#### JavaScript/Fetch
```javascript
const response = await fetch('/api/contas-pagar/calcular-juros', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    valor_pgto: 1000,
    dt_venc: '2025-10-01',
    taxa_juros: 8
  })
});

const data = await response.json();
console.log(`Juros: R$ ${data.valor_juros}`);
console.log(`Total: R$ ${data.valor_total}`);
```

#### Axios
```javascript
const { data } = await axios.post('/api/contas-pagar/calcular-juros', {
  valor_pgto: 1000,
  dt_venc: '2025-10-01',
  taxa_juros: 8
});

console.log(`${data.dias_atraso} dias de atraso`);
```

---

## ✅ PUT /api/contas-pagar/[id]/marcar-pago

Marca uma conta como paga, integrando com Oracle.

### Request

```http
PUT /api/contas-pagar/123/marcar-pago
Content-Type: application/json

{
  "dt_pgto": "2025-11-11",
  "valor_pago": 1000.00,
  "valor_juros": 109.20,
  "banco": "Banco do Brasil",
  "forma_pgto": "pix",
  "comprovante": "PIX12345",
  "cod_ccusto": "001",
  "cod_conta": "0007",
  "obs": "Pagamento via PIX",
  "username": "ADMIN"
}
```

### Parameters

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | Sim | ID da conta (na URL) |
| `dt_pgto` | string (ISO date) | Não | Data pagamento (padrão: hoje) |
| `valor_pago` | number | Sim | Valor efetivamente pago |
| `valor_juros` | number | Não | Juros/multa (calculado auto) |
| `banco` | string | Não | Nome ou código do banco |
| `forma_pgto` | string | Não | Forma de pagamento |
| `comprovante` | string | Não | Número do comprovante |
| `cod_ccusto` | string | Não | Centro de custo |
| `cod_conta` | string | Não | Conta bancária |
| `obs` | string | Não | Observações |
| `username` | string | Não | Usuário (padrão: SYSTEM) |

### Formas de Pagamento (forma_pgto)

- `dinheiro`
- `pix`
- `transferencia`
- `cheque`
- `cartao_credito`
- `cartao_debito`
- `boleto`

### Response (200 OK)

```json
{
  "sucesso": true,
  "mensagem": "Conta marcada como paga com sucesso.",
  "conta": {
    "id": 123,
    "paga": "S",
    "dt_pgto": "2025-11-11",
    "valor_pago": 1000.00,
    "valor_juros": 109.20,
    "banco": "Banco do Brasil",
    "forma_pgto": "pix",
    ...
  },
  "jurosCalculados": 109.20,
  "diasAtraso": 41,
  "oracleAtualizado": true,
  "oracleInfo": {
    "sucesso": true,
    "totalmentePago": "S",
    "valorTotalRecebido": 1109.20
  }
}
```

### Response (404 Not Found)

```json
{
  "erro": "Conta a pagar não encontrada."
}
```

### Response (400 Bad Request)

```json
{
  "erro": "Conta já está marcada como paga."
}
```

### Exemplos

#### cURL
```bash
curl -X PUT http://localhost:3000/api/contas-pagar/123/marcar-pago \
  -H "Content-Type: application/json" \
  -d '{
    "dt_pgto": "2025-11-11",
    "valor_pago": 1000.00,
    "valor_juros": 109.20,
    "forma_pgto": "pix",
    "banco": "Banco do Brasil",
    "username": "ADMIN"
  }'
```

#### JavaScript/Fetch
```javascript
const response = await fetch('/api/contas-pagar/123/marcar-pago', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dt_pgto: '2025-11-11',
    valor_pago: 1000.00,
    valor_juros: 109.20,
    forma_pgto: 'pix',
    banco: 'Banco do Brasil',
    username: 'ADMIN'
  })
});

const data = await response.json();
if (data.oracleAtualizado) {
  console.log('✅ Oracle sincronizado!');
}
```

### Comportamento Oracle

Ao marcar como pago, o sistema:

1. **Atualiza DBRECEB:**
```sql
UPDATE DBRECEB 
SET dt_pgto = :dtPgto,
    valor_rec = valor_rec + :valorPago + :valorJuros,
    rec = CASE WHEN valor_rec >= valor_pgto THEN 'S' ELSE 'N' END,
    nro_banco = :banco,
    forma_fat = :formaPgto,
    cod_conta = :codConta
WHERE cod_receb = :codReceb
```

2. **Insere em DBFRECEB (Pagamento):**
```sql
INSERT INTO DBFRECEB (cod_receb, dt_pgto, valor, tipo, obs)
VALUES (:codReceb, :dtPgto, :valorPago, '01', :obs)
```

3. **Insere em DBFRECEB (Juros, se houver):**
```sql
INSERT INTO DBFRECEB (cod_receb, dt_pgto, valor, tipo, obs)
VALUES (:codReceb, :dtPgto, :valorJuros, '02', 'Juros de atraso')
```

4. **Registra Auditoria:**
```sql
Usuario.inc_acao_usr(:codusr, 'MARCAR_PAGO', 'DBRECEB', :detalhes)
```

### Fallback

Se o Oracle estiver offline:
- Sistema salva apenas no PostgreSQL
- `oracleAtualizado: false`
- Warning no console do servidor
- Operação continua normalmente

---

## 📊 GET /api/contas-pagar/titulos-cliente

Consulta títulos de um cliente no Oracle usando procedure `CLIENTE_TITULO`.

### Request

```http
GET /api/contas-pagar/titulos-cliente?codcli=123&tipo=1&taxa_juros=8
```

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `codcli` | string | Sim | Código do cliente |
| `tipo` | string | Não | Tipo de consulta (padrão: 1) |
| `taxa_juros` | number | Não | Taxa de juros (padrão: 8) |

### Tipos de Consulta

| Tipo | Descrição | Retorna |
|------|-----------|---------|
| `1` | Títulos Atrasados | Títulos vencidos com juros calculados |
| `2` | Títulos em Dia | Títulos não vencidos |
| `3` | Vencimentos por Mês | Agrupamento mensal de vencimentos |
| `4` | Histórico de Vendas | Últimos 3 meses de vendas |
| `5` | Prazo Médio | Histórico de prazo médio |
| `6` | Títulos a Vencer | Títulos com vencimento futuro |

### Response Tipo 1 (Títulos Atrasados)

```json
{
  "sucesso": true,
  "tipo": "1",
  "tipo_descricao": "Títulos Atrasados",
  "codcli": "123",
  "taxa_juros": 8,
  "total_registros": 3,
  "titulos": [
    {
      "nro_doc": "001",
      "cod_receb": "REC001",
      "dt_emissao": "2025-09-01T00:00:00.000Z",
      "dt_pgto": null,
      "dt_venc": "2025-10-01T00:00:00.000Z",
      "valor_pgto": 1000.00,
      "valor_rec": 0,
      "valor_aberto": 1109.20,
      "cod_conta": "0007",
      "codcli": "123",
      "nome_cli": "Cliente Exemplo",
      "dias": 41,
      "valor_juros": 109.20
    }
  ]
}
```

### Response Tipo 3 (Vencimentos por Mês)

```json
{
  "sucesso": true,
  "tipo": "3",
  "tipo_descricao": "Vencimentos por Mês",
  "codcli": "123",
  "taxa_juros": 8,
  "total_registros": 3,
  "titulos": [
    {
      "vencimento": "11/2025",
      "ordem": "202511",
      "total_pagamento": 5000.00
    },
    {
      "vencimento": "12/2025",
      "ordem": "202512",
      "total_pagamento": 3000.00
    }
  ]
}
```

### Response Tipo 6 (Títulos a Vencer)

```json
{
  "sucesso": true,
  "tipo": "6",
  "tipo_descricao": "Títulos a Vencer",
  "codcli": "123",
  "taxa_juros": 8,
  "total_registros": 5,
  "titulos": [
    {
      "nro_doc": "002",
      "cod_receb": "REC002",
      "dt_emissao": "2025-11-01T00:00:00.000Z",
      "dt_pgto": null,
      "dt_venc": "2025-12-01T00:00:00.000Z",
      "ordem": "202512",
      "valor_pgto": 2000.00,
      "valor_rec": 0,
      "cod_conta": "0007",
      "codcli": "123",
      "nome_cli": "Cliente Exemplo"
    }
  ]
}
```

### Exemplos

#### cURL - Títulos Atrasados
```bash
curl http://localhost:3000/api/contas-pagar/titulos-cliente?codcli=123&tipo=1
```

#### cURL - Títulos a Vencer
```bash
curl http://localhost:3000/api/contas-pagar/titulos-cliente?codcli=123&tipo=6
```

#### JavaScript/Fetch
```javascript
// Buscar títulos atrasados
const response = await fetch(
  '/api/contas-pagar/titulos-cliente?codcli=123&tipo=1'
);
const data = await response.json();

console.log(`Total de títulos atrasados: ${data.total_registros}`);
data.titulos.forEach(titulo => {
  console.log(`
    Título: ${titulo.nro_doc}
    Vencimento: ${new Date(titulo.dt_venc).toLocaleDateString()}
    Dias de atraso: ${titulo.dias}
    Juros: R$ ${titulo.valor_juros}
    Total em aberto: R$ ${titulo.valor_aberto}
  `);
});
```

#### React Component
```tsx
const [titulos, setTitulos] = useState([]);

useEffect(() => {
  async function carregarTitulos() {
    const res = await fetch(
      `/api/contas-pagar/titulos-cliente?codcli=${codcli}&tipo=1`
    );
    const data = await res.json();
    setTitulos(data.titulos);
  }
  carregarTitulos();
}, [codcli]);

return (
  <div>
    <h2>Títulos Atrasados ({titulos.length})</h2>
    {titulos.map(titulo => (
      <div key={titulo.cod_receb}>
        <p>Doc: {titulo.nro_doc}</p>
        <p>Dias: {titulo.dias}</p>
        <p>Juros: R$ {titulo.valor_juros.toFixed(2)}</p>
      </div>
    ))}
  </div>
);
```

---

## 🔧 Códigos de Erro

### 400 Bad Request
- Parâmetros obrigatórios faltando
- Tipo de consulta inválido
- Conta já paga
- Conta cancelada

### 404 Not Found
- Conta não encontrada
- Cliente não encontrado

### 405 Method Not Allowed
- Método HTTP incorreto

### 500 Internal Server Error
- Erro de conexão Oracle
- Erro de banco de dados
- Erro inesperado

---

## 📚 Integrações

### Oracle Procedures Utilizadas

1. **CLIENTE_TITULO** (`/titulos-cliente`)
```sql
BEGIN 
  CLIENTE_TITULO(:tipo, :txjuros, :codcli, :cursor); 
END;
```

2. **RECEB_TOTAL_TITULO** (interno)
```sql
BEGIN 
  RECEB_TOTAL_TITULO(:codReceb, :dataLimite, :valor); 
END;
```

3. **Usuario.inc_acao_usr** (auditoria)
```sql
BEGIN 
  Usuario.inc_acao_usr(:codusr, 'MARCAR_PAGO', 'DBRECEB', :detalhes); 
END;
```

### Tabelas Afetadas

**Leitura:**
- `DBRECEB` - Títulos a receber
- `DBCLIEN` - Clientes
- `DBFATURA` - Faturas
- `DBUSUARIO` - Usuários

**Escrita:**
- `DBRECEB` - Atualização de pagamento
- `DBFRECEB` - Movimentos de pagamento
- Tabela de auditoria (via procedure)

---

## 🧪 Testes com Postman

### Collection JSON

```json
{
  "info": {
    "name": "Contas a Pagar Oracle API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Calcular Juros",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"valor_pgto\": 1000,\n  \"dt_venc\": \"2025-10-01\",\n  \"taxa_juros\": 8\n}"
        },
        "url": "{{base_url}}/api/contas-pagar/calcular-juros"
      }
    },
    {
      "name": "Marcar Como Pago",
      "request": {
        "method": "PUT",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"dt_pgto\": \"2025-11-11\",\n  \"valor_pago\": 1000,\n  \"valor_juros\": 109.20,\n  \"forma_pgto\": \"pix\",\n  \"banco\": \"Banco do Brasil\"\n}"
        },
        "url": "{{base_url}}/api/contas-pagar/123/marcar-pago"
      }
    },
    {
      "name": "Títulos Atrasados Cliente",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{base_url}}/api/contas-pagar/titulos-cliente?codcli=123&tipo=1",
          "query": [
            {"key": "codcli", "value": "123"},
            {"key": "tipo", "value": "1"}
          ]
        }
      }
    }
  ]
}
```

### Variables
```json
{
  "base_url": "http://localhost:3000"
}
```

---

## 📖 Referências

- **Documentação Oracle:** `docs/INTEGRACAO-ORACLE-TITULOS.md`
- **Guia de Uso:** `docs/CONTAS-PAGAR-ORACLE-INTEGRATION.md`
- **Sumário:** `docs/SUMARIO-IMPLEMENTACAO-CONTAS-PAGAR.md`
- **Código Fonte:** `src/lib/oracleService.ts`

---

**Atualizado:** Novembro 2025  
**Versão API:** 1.0.0
