# Notas de Conhecimento - CT-e

## 📋 Visão Geral

Sistema completo para gerenciamento de **Notas de Conhecimento de Transporte Eletrônico (CT-e)** de transportadoras, com funcionalidades de listagem, filtros e pagamento (individual e em lote).

## 🗂️ Estrutura de Tabelas

### 1. **dbconhecimentoent** (Tabela Principal)
Armazena as notas de conhecimento (CT-e) das transportadoras.

**Colunas principais:**
- `codtransp` (varchar(5)) - Código da transportadora
- `nrocon` (varchar(9)) - Número do conhecimento
- `serie` (varchar(3)) - Série do CT-e
- `totalcon` (numeric) - Valor total do conhecimento
- `totaltransp` (numeric) - Valor do transporte
- `icms` (numeric) - Valor do ICMS
- `baseicms` (numeric) - Base de cálculo do ICMS
- `dtcon` (date) - Data do conhecimento
- `dtemissao` (date) - Data de emissão
- `pago` (char(1)) - Flag de pagamento ('S'/'N')
- `cancel` (char(1)) - Flag de cancelamento ('S'/'N')
- `chave` (varchar(200)) - Chave de acesso do CT-e
- `protocolo` (varchar(16)) - Protocolo de autorização

### 2. **dbconhecimento** (Relacionamento)
Tabela de relacionamento entre CT-e e pagamentos.

**Colunas:**
- `codpgto` (varchar(9)) - Código do pagamento (FK → dbpgto.cod_pgto)
- `codtransp` (varchar(5)) - Código da transportadora
- `nrocon` (varchar(9)) - Número do conhecimento

### 3. **dbpgto** (Pagamentos)
Tabela de contas a pagar (já existente no sistema).

**Relacionamento:**
- Um CT-e pode gerar um registro em `dbpgto` (tipo='T' para Transportadora)
- A ligação é feita através de `dbconhecimento`

## 🔄 Fluxo de Pagamento

1. **Entrada do CT-e**: Registro criado em `dbconhecimentoent` com `pago='N'`
2. **Seleção para pagamento**: Usuário seleciona CT-e(s) na interface
3. **Criar pagamento**:
   - Insere registro em `dbpgto` (tipo='T', paga='S')
   - Insere relacionamento em `dbconhecimento`
   - Atualiza `dbconhecimentoent.pago = 'S'`
4. **Status final**: CT-e marcado como pago

## 📁 Arquivos Criados

### Backend (APIs)

```
src/pages/api/notas-conhecimento/
├── index.ts                      # GET - Listar notas de conhecimento
├── transportadoras.ts            # GET - Buscar transportadoras
└── [codtransp]/
    └── [nrocon]/
        └── marcar-pago.ts        # PUT - Marcar nota como paga
```

### Frontend

```
src/
├── hooks/
│   └── useNotasConhecimento.ts   # Hook customizado
└── components/
    └── corpo/
        └── notas-conhecimento/
            └── NotasConhecimento.tsx  # Componente principal
```

## 🎯 Funcionalidades

### ✅ Listagem de Notas
- Paginação
- Filtros: Status, Período, Transportadora, Nº Conhecimento
- Busca geral (número, transportadora, chave)
- Exibição de dados: CT-e, transportadora, valores, ICMS, status

### ✅ Pagamento Individual
- Modal com dados do CT-e
- Campos: Data pagamento, Valor, Banco, Observações
- Validações automáticas
- Atualização de status

### ✅ Pagamento em Lote
- Seleção múltipla via checkboxes
- Botão "Pagar (X)" com contador
- Modal com resumo (quantidade + valor total)
- Lista de CT-es selecionados
- Pagamento simultâneo de múltiplas notas
- Feedback de erros individuais

### ✅ Status e Badges
- **Pendente**: Amarelo - CT-e não pago
- **Pago**: Verde - CT-e quitado
- **Cancelado**: Vermelho - CT-e cancelado

## 🔌 Endpoints da API

### GET /api/notas-conhecimento
Lista notas de conhecimento com filtros e paginação.

**Query params:**
```
?page=1
&limit=20
&status=pendente|pago|cancelado
&data_inicio=2025-01-01
&data_fim=2025-12-31
&codtransp=00076
&nrocon=000031863
&search=texto
```

**Response:**
```json
{
  "notas_conhecimento": [...],
  "paginacao": {
    "pagina": 1,
    "limite": 20,
    "total": 150,
    "totalPaginas": 8
  }
}
```

### PUT /api/notas-conhecimento/[codtransp]/[nrocon]/marcar-pago
Marca uma nota de conhecimento como paga.

**Body:**
```json
{
  "dt_pgto": "2025-11-25",
  "valor_pgto": 4196.38,
  "banco": "001",
  "obs": "Pagamento CT-e 000016252"
}
```

**Response:**
```json
{
  "sucesso": true,
  "mensagem": "Nota de conhecimento marcada como paga",
  "cod_pgto": "000058163",
  "codtransp": "00088",
  "nrocon": "000016252"
}
```

## 🚀 Como Usar

1. **Acessar a tela**: Navegar para `/notas-conhecimento`
2. **Filtrar**: Usar filtros rápidos ou avançados
3. **Selecionar**: Marcar checkboxes das notas pendentes
4. **Pagar em lote**: Clicar em "Pagar (X)"
5. **Ou pagar individual**: Clicar no botão "Pagar" de cada linha

## 📊 Estrutura do Hook

```typescript
const {
  notas,              // Array de NotaConhecimento
  carregando,         // boolean
  paginaAtual,        // number
  totalPaginas,       // number
  total,              // number total de registros
  limite,             // itens por página
  consultarNotas,     // function(pagina, limite, filtros)
  marcarComoPago,     // function(codtransp, nrocon, dados)
  setPaginaAtual,
  setLimite,
} = useNotasConhecimento();
```

## 🎨 Componentes Utilizados

- **DataTable**: Tabela com paginação e filtros
- **Modal**: Modais de pagamento
- **DefaultButton**: Botões padrão do sistema
- **Input, Select, Textarea**: Campos de formulário
- **toast (sonner)**: Notificações

## ⚙️ Integração com Sistema Existente

- ✅ Usa mesma estrutura de `contas-pagar`
- ✅ Compartilha API de bancos
- ✅ Mesmo padrão visual e UX
- ✅ Integrado com tabela `dbpgto`
- ✅ Suporte a pagamento internacional (se necessário)

## 📝 Notas Técnicas

- **Chave composta**: `codtransp` + `nrocon` identifica uma nota
- **Transação atômica**: Pagamento usa BEGIN/COMMIT/ROLLBACK
- **Validações**: Verifica se nota existe, se está cancelada, se já foi paga
- **Geração de IDs**: `cod_pgto` e `pag_cof_id` auto-incrementados
- **Tipo de pagamento**: Sempre 'T' (Transportadora) em `dbpgto.tipo`

---

**Status**: ✅ Implementação completa
**Última atualização**: 25/11/2025
