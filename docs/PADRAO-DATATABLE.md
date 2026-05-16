# Padrao DataTable - Sistema Melo

Referencia: Tela de Contas a Pagar (`src/components/corpo/contas-pagar/ContasAPagar.tsx`)
Componente: `src/components/common/DataTableContasPagar.tsx`

---

## Estrutura Visual

```
┌─────────────────────────────────────────────┐
│  CARD (border, rounded, shadow)             │
│  ┌───────────────────────────────────────┐  │
│  │ Busca | Opcoes (filtros, export...)   │  │
│  ├───────────────────────────────────────┤  │
│  │ Tabela (scroll horizontal e vertical) │  │
│  │ - Header sticky com ordenacao (setas) │  │
│  │ - Filtros rapidos por coluna (toggle) │  │
│  │ - Dados com hover                    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  RODAPE (separado do card)                  │
│  Qtd Itens | Colunas(X/Y) | Ir p/ pag | <> │
└─────────────────────────────────────────────┘
```

---

## Funcionalidades do Componente

### 1. Gerenciamento de Colunas
- Botao "Colunas (X/Y)" no rodape
- Dropdown com checkboxes para mostrar/esconder colunas
- Drag-and-drop para reordenar colunas
- Botoes "Mostrar Todas" e "Resetar Ordem"
- Icones Eye/EyeOff indicando estado

### 2. Ordenacao
- Clique no header da coluna ordena ASC
- Clique novamente inverte para DESC
- Seta azul indica coluna/direcao ativa
- Seta dupla cinza indica colunas ordenaveis
- Colunas "Acoes" e "checkbox" nao ordenam
- Ordenacao local (nos dados ja carregados)

### 3. Filtros
- Filtros rapidos: inputs por coluna no header (toggle via Opcoes)
- Filtros avancados: modal com condicoes (contem, igual, maior, etc.)
- Debounce de 300ms nos filtros rapidos

### 4. Paginacao
- Seletor de itens por pagina (10, 20, 25, 50, 100, 500, 1000)
- Navegacao por setas
- Campo "Ir para pagina"

### 5. Persistencia de Preferencias (banco de dados)
- Tabela: `tb_user_screen_preferences`
- Chave: `login_user_login` + `screen_key`
- Salva automaticamente (debounce 1s):
  - Colunas visiveis
  - Ordem das colunas
  - Coluna de ordenacao e direcao
  - Itens por pagina
  - Filtros rapidos visivel/oculto
- Carrega ao montar o componente
- Funciona em qualquer dispositivo (nao usa navegador)

---

## Como Aplicar em uma Nova Tela

### Passo 1: Importar o componente e AuthContext

```tsx
import DataTableContasPagar from '@/components/common/DataTableContasPagar';
import { AuthContext } from '@/contexts/authContexts';
import { useContext } from 'react';
```

### Passo 2: Obter o usuario

```tsx
const { user } = useContext(AuthContext);
```

### Passo 3: Definir headers (array de strings)

```tsx
const headers = [
  'Acoes',
  'ID',
  'Nome',
  'Data',
  'Valor',
  'Status',
];
```

### Passo 4: Criar funcao prepararDadosTabela

Mapear cada item de dados para um array na MESMA ORDEM dos headers:

```tsx
const prepararDadosTabela = () => {
  return dados.map(item => [
    <BotaoAcoes item={item} />,           // Acoes
    <span className="font-mono">{item.id}</span>,  // ID
    item.nome,                             // Nome
    formatarData(item.data),               // Data
    formatarBRL(item.valor),               // Valor
    <Badge>{item.status}</Badge>,          // Status
  ]);
};
```

### Passo 5: Usar o componente com screenKey unico

```tsx
<DataTableContasPagar
  screenKey="nome-da-tela"       // unico por tela
  userName={user?.usuario}        // usuario logado
  headers={headers}
  rows={prepararDadosTabela()}
  meta={meta}
  onPageChange={setPage}
  onPerPageChange={setPerPage}
  onSearch={handleSearch}
  loading={loading}
  noDataMessage="Nenhum registro encontrado"
  nonsortableColumns={['Acoes']} // colunas que nao ordenam
/>
```

### Passo 6 (opcional): Filtros

```tsx
// Colunas disponiveis para filtro avancado
const colunasFiltro = ['id', 'nome', 'data', 'valor', 'status'];

<DataTableContasPagar
  ...
  onFiltroChange={handleFiltro}
  colunasFiltro={colunasFiltro}
/>
```

### Passo 7 (opcional): Exportar Excel

```tsx
<DataTableContasPagar
  ...
  onExportarExcel={handleExportar}
/>
```

---

## Props do Componente

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| headers | string[] | Sim | Nomes das colunas |
| rows | any[][] | Sim | Dados (array de arrays, mesma ordem dos headers) |
| meta | Meta | Sim | Paginacao { currentPage, lastPage, perPage, total } |
| onPageChange | (page) => void | Sim | Callback mudanca de pagina |
| onSearch | (e) => void | Sim | Callback busca |
| screenKey | string | Nao* | ID unico da tela (necessario para persistencia) |
| userName | string | Nao* | Login do usuario (necessario para persistencia) |
| onPerPageChange | (n) => void | Nao | Callback mudanca itens/pagina |
| onSearchKeyDown | (e) => void | Nao | Callback tecla na busca |
| searchInputPlaceholder | string | Nao | Placeholder do campo de busca |
| loading | boolean | Nao | Exibe loading spinner |
| noDataMessage | string | Nao | Mensagem quando nao ha dados |
| onFiltroChange | (filtros) => void | Nao | Callback filtros |
| colunasFiltro | string[] | Nao | Colunas disponiveis para filtro |
| onExportarExcel | () => void | Nao | Callback exportar Excel |
| onDashboardGeral | () => void | Nao | Callback abrir dashboard |
| columnWidths | string[] | Nao | Larguras customizadas das colunas |
| onSort | (col, dir) => void | Nao | Callback ordenacao (para API) |
| sortableColumns | string[] | Nao | Colunas que permitem ordenacao |
| nonsortableColumns | string[] | Nao | Colunas que NAO ordenam (padrao: Acoes, checkbox) |

*Necessario para salvar preferencias no banco

---

## screenKey por Tela

Cada tela deve usar um screenKey unico. Sugestao de nomenclatura:

| Tela | screenKey |
|------|-----------|
| Contas a Pagar | `contas-a-pagar` |
| Central de Vendas | `central-vendas` |
| Requisicoes de Compra | `requisicoes-compra` |
| Ordens de Compra | `ordens-compra` |
| Entrada XML | `entrada-xml` |
| Entradas | `entradas` |
| Estoque | `estoque` |
| Clientes | `clientes` |
| Produtos | `produtos` |

---

## Observacoes

- O componente ainda se chama `DataTableContasPagar` por compatibilidade.
  Futuramente pode ser renomeado para `DataTable`.
- A ordenacao atual e local (ordena os dados ja carregados na pagina).
  Para ordenacao via API, use a prop `onSort`.
- A tabela `tb_user_screen_preferences` e criada automaticamente
  na primeira chamada da API.
