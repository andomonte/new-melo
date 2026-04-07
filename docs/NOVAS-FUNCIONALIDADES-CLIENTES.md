# Novas Funcionalidades - Gestão de Clientes

Este documento descreve as **2 novas funcionalidades** implementadas no módulo de clientes, seguindo o padrão de modais existente.

## 📋 Resumo das Funcionalidades

### ✅ 1. Status de Compra do Cliente

Modal individual para gerenciar o status de compra de cada cliente.

### ✅ 2. Consulta de Intervalo de Compra

Modal individual para consultar compras de um cliente em um período específico.

> **Nota**: A funcionalidade "Exportar para Excel" já existia previamente no sistema.

---

## 1️⃣ Status de Compra do Cliente

### 📁 Arquivo

`src/components/cadastros/clientes/StatusCompraModal.tsx`

### 🎯 Funcionalidade

Modal individual que permite alterar o status de compra de um cliente específico.

### 🔧 Características

- Exibe o status atual do cliente
- Permite selecionar novo status:
  - **S** - Ativo (pode comprar normalmente)
  - **N** - Inativo (não pode realizar compras)
  - **B** - Bloqueado (bloqueado temporariamente)
  - **P** - Pendente (aguardando aprovação)
- Validações e feedback visual
- Loading states durante operações
- Painel informativo explicando cada status

### 🎨 Interface

- Props: `isOpen`, `onClose`, `cliente`, `onSuccess`
- Estados: `selectedStatus`, `currentStatus`, `loading`, `loadingStatus`
- Botões: Cancelar, Confirmar
- Toast: Feedback de sucesso/erro

### 🔌 Acesso

Menu de ações individuais (⋮) → "Status de Compra" (ícone: 🛒)

### 📊 Status Atual

- ✅ **Frontend**: Completo
- ✅ **Backend**: Implementado
- ✅ **Integração**: Funcional

### 🚀 API Implementada

#### GET `/api/clientes/[id]/status-compra`

```typescript
// Response
{
  status: 'S' | 'N' | 'B' | 'P';
}
```

#### PUT `/api/clientes/[id]/status-compra`

```typescript
// Request Body
{
  status: 'S' | 'N' | 'B' | 'P'
}

// Response
{
  success: true,
  message: 'Status atualizado com sucesso',
  status: 'S' | 'N' | 'B' | 'P'
}
```

### 💾 Database

Utiliza a coluna `status` existente na tabela `dbclien`:

- Tipo: `VARCHAR(1)`
- Valores: 'S', 'N', 'B', 'P'
- Default: 'S' (Ativo)

---

## 2️⃣ Consulta de Intervalo de Compra

### 📁 Arquivo

`src/components/cadastros/clientes/IntervaloCompraModal.tsx`

### 🎯 Funcionalidade

Modal individual que permite consultar todas as compras de um cliente em um período específico.

### 🔧 Características

- Filtros de data: Data Início e Data Fim
- Validação: data início ≤ data fim
- Tabela de resultados com:
  - Número da NF
  - Data da compra
  - Valor total
  - Status (Concluída/Cancelada)
- Cards de resumo:
  - Total de compras
  - Compras concluídas
  - Valor total
- Botão individual "Exportar" para exportar resultados
- Destaque visual para compras canceladas (fundo vermelho)
- Estados visuais: vazio, loading, resultados
- Modal em 95% da tela para melhor visualização

### 🎨 Interface

- Props: `isOpen`, `onClose`, `cliente`
- Estados: `dataInicio`, `dataFim`, `loading`, `compras`, `searched`
- Interface Compra:
  ```typescript
  {
    nf: string;
    data: string;
    valorTotal: number;
    status: 'Concluída' | 'Cancelada';
  }
  ```
- Botões: Fechar, Consultar, Exportar

### 🔌 Acesso

Menu de ações individuais (⋮) → "Intervalo de Compra" (ícone: 📅)

### 📊 Status Atual

- ✅ **Frontend**: Completo
- ✅ **Backend**: Implementado
- ✅ **Integração**: Funcional

### 🚀 API Implementada

#### GET `/api/clientes/[id]/compras-intervalo`

```typescript
// Query Parameters
{
  dataInicio: string; // formato: YYYY-MM-DD
  dataFim: string;    // formato: YYYY-MM-DD
}

// Response
{
  compras: [
    {
      nf: string;
      data: string;          // formato: DD/MM/YYYY
      valorTotal: number;
      status: 'Concluída' | 'Cancelada';
    }
  ]
}
```

### 💾 Database

Query na tabela `dbvenda`:

```sql
SELECT
  nronf as nf,
  data,
  total as valorTotal,
  CASE
    WHEN cancel = 'S' THEN 'Cancelada'
    ELSE 'Concluída'
  END as status
FROM dbvenda
WHERE codcli = $1
  AND data >= $2
  AND data <= $3
  AND tipo IN ('V', 'O')
ORDER BY data DESC;
```

**Campos utilizados**:

- `nronf`: Número da nota fiscal
- `data`: Data da venda
- `total`: Valor total da venda
- `cancel`: Indicador de cancelamento ('S' = Sim)
- `tipo`: Tipo de operação ('V' = Venda, 'O' = Orçamento)

---

## 🎨 Padrão de UI Seguido

Todos os modais seguem exatamente o padrão de `ClientFormModal.tsx`:

### Estrutura Base

```tsx
<div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center">
  <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg max-w-[600px] w-full">
    {/* Cabeçalho */}
    <div className="bg-gray-100 dark:bg-zinc-800 px-6 py-4">
      <h2 className="text-xl font-bold text-blue-600 dark:text-blue-300">
        Título
      </h2>
      <button onClick={onClose}>✕</button>
    </div>

    {/* Conteúdo */}
    <div className="bg-gray-50 dark:bg-zinc-900 p-6">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6">
        {/* Conteúdo do modal */}
      </div>
    </div>

    {/* Rodapé */}
    <div className="bg-gray-100 dark:bg-zinc-800 px-6 py-4 flex justify-end gap-3">
      <Button variant="outline" onClick={onClose}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit}>Confirmar</Button>
    </div>
  </div>
</div>
```

### Cores Padrão

- **Overlay**: `bg-black/50`
- **Container**: `bg-white dark:bg-zinc-900`
- **Header/Footer**: `bg-gray-100 dark:bg-zinc-800`
- **Content**: `bg-gray-50 dark:bg-zinc-900`
- **Card interno**: `bg-white dark:bg-zinc-800`
- **Título**: `text-blue-600 dark:text-blue-300`

### Componentes

- **lucide-react**: Icons (ShoppingCart, Calendar, FileDown, X)
- **sonner**: Toast notifications
- **Button**: shadcn/ui
- **Select, Label, Input**: shadcn/ui form components

---

## 🧪 Testando o Frontend

### 1. Status de Compra

1. Acesse `/admin/cadastros/clientes`
2. Clique nos 3 pontinhos (⋮) de qualquer cliente
3. Selecione "Status de Compra"
4. Veja o status atual (mock: sempre 'S')
5. Selecione um novo status
6. Clique em "Salvar"
7. Aguarde 500ms (mock delay)
8. Veja toast de sucesso

### 2. Intervalo de Compra

1. Acesse `/admin/cadastros/clientes`
2. Clique nos 3 pontinhos (⋮) de qualquer cliente
3. Selecione "Intervalo de Compra"
4. Preencha data início e data fim
5. Clique em "Consultar"
6. Aguarde 800ms (mock delay)
7. Veja 3 compras fake na tabela
8. Veja cards de resumo atualizados
9. Teste o botão "Exportar" (toast informativo)

---

## 📝 Próximos Passos (Backend)

### ✅ Prioridade 1: Status de Compra - CONCLUÍDO

- [x] Criar API GET `/api/clientes/[id]/status-compra`
- [x] Criar API PUT `/api/clientes/[id]/status-compra`
- [x] Validar valores: S, N, B, P
- [x] Integração frontend completa
- [x] Usar coluna `status` existente em `dbclien`

### ✅ Prioridade 2: Intervalo de Compra - CONCLUÍDO

- [x] Mapear tabela de vendas (`dbvenda`)
- [x] Implementar GET `/api/clientes/[id]/compras-intervalo`
- [x] Query com filtro de datas
- [x] Incluir status de cancelamento
- [x] Calcular totalizadores no frontend
- [x] Integração completa

### Melhorias Futuras

- [ ] Implementar exportação Excel para Intervalo de Compra
- [ ] Adicionar filtros adicionais (tipo de venda, vendedor, etc)
- [ ] Implementar paginação para grandes volumes de dados

### Prioridade 3: Exportação Excel (Melhorar funcionalidade existente)

- [ ] Instalar biblioteca: `npm install xlsx` ou `exceljs`
- [ ] Implementar geração de arquivo .xlsx
- [ ] Incluir todas as colunas relevantes
- [ ] Aplicar filtros/seleção
- [ ] Retornar arquivo para download

---

## 🎯 Checklist de Conclusão

### Frontend ✅

- [x] StatusCompraModal.tsx criado
- [x] IntervaloCompraModal.tsx criado
- [x] Integração no menu individual
- [x] Handlers implementados
- [x] Estados de modal gerenciados
- [x] Dark mode suportado
- [x] TypeScript tipado
- [x] Zero erros de compilação
- [x] Modais em 95% da tela

### Backend ✅

- [x] API Status de Compra (GET/PUT)
- [x] API Intervalo de Compra (GET)
- [x] Validações implementadas
- [x] Tratamento de erros
- [x] Documentação API atualizada

---

## 📊 Progresso Atual

| Funcionalidade      | Frontend | Backend | Integração | Total       |
| ------------------- | -------- | ------- | ---------- | ----------- |
| Status de Compra    | ✅ 100%  | ✅ 100% | ✅ 100%    | 🟢 **100%** |
| Intervalo de Compra | ✅ 100%  | ✅ 100% | ✅ 100%    | 🟢 **100%** |

**Status Geral**: 🟢 **TODAS AS FUNCIONALIDADES IMPLEMENTADAS E FUNCIONAIS**
