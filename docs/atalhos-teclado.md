# Atalhos de Teclado e Padrões de UX - MeloSys

## Padrões a seguir em todas as telas

### Menu de contexto (botão direito do mouse)
- **Toda tela principal** deve ter um `ContextMenu` (Radix) envolvendo o conteúdo
- O menu mostra as ações disponíveis com seus atalhos ao lado (ex: `Ctrl+S`)
- Se houver item selecionado na lista, o menu mostra qual item está selecionado
- Itens do menu ficam desabilitados quando não há seleção ou sem permissão
- No rodapé do menu, mostrar uma legenda com os atalhos de navegação (↑↓, Enter, etc.)

### Modais de informação/sucesso
- Botão "Fechar" deve ter `autoFocus` para que Enter feche o modal
- Adicionar `onKeyDown` no botão para garantir que Enter funcione

### Telas de listagem (padrão DataTablePadrao)
- **↑ / ↓** → navegar entre linhas (funciona mesmo com foco em input de busca)
- **Enter** → abrir/editar item selecionado (só fora de inputs)
- **Delete** → excluir item selecionado (só fora de inputs, requer permissão)
- **Ctrl+N** → novo registro
- **V** → ver detalhes do item selecionado (só fora de inputs)
- Usar `window.addEventListener('keydown', handler, true)` com `capture: true` para interceptar antes de outros handlers
- Usar `useRef` para `linhaSelecionada` evitando stale closures
- Linha selecionada deve ter destaque visual via `rowClassName` no DataTablePadrao
- Clicar na linha também seleciona via `onRowClick`

### Telas de formulário/modal (criar/editar)
- **Ctrl+S** → salvar
- **Ctrl+L** → limpar formulário
- **Ctrl+N** → adicionar item (quando aplicável)
- **Ctrl+E** → exportar (quando aplicável)
- **Escape** → fechar modal (só se nenhum sub-modal está aberto)
- Input principal (ex: Nome) deve ter `autoFocus`
- Navegação entre campos via Tab (ordem natural dos inputs)
- Usar `useRef` para funções nos atalhos evitando stale closures:
  ```tsx
  const handleSubmitRef = useRef<() => void>(() => {});
  // atualizar após definir a função:
  handleSubmitRef.current = handleSubmit;
  ```
- Listener com `window.addEventListener('keydown', handler, true)`

### AG Grid (telas estilo planilha)
- **Duplo clique** ou **Enter** → editar célula
- **Tab** → próxima célula editável
- **Shift+Tab** → célula editável anterior
- **↑ / ↓** → navegar entre linhas
- **Escape** → cancelar edição da célula
- Células editáveis com fundo azul claro (`#dbeafe`)
- Botão de excluir item usa `AlertDialog` (Radix), nunca `confirm()` nativo

### Regras gerais
- **Nunca** usar `alert()`, `confirm()` ou `prompt()` nativos do navegador
- Usar `AlertDialog` do Radix para confirmações
- Usar `toast` (react-hot-toast ou useToast) para notificações
- Atalhos não devem interferir quando foco está em INPUT/TEXTAREA/SELECT (exceto setas ↑↓ e Ctrl+combinações)
- Atalhos desativados quando modais estão abertos

---

## Atalhos por tela

### Lista de Promoções (`/vendas/promocoes`)

| Atalho | Ação | Contexto |
|--------|------|----------|
| ↑ / ↓ | Navegar entre promoções | Sempre |
| Enter | Editar promoção selecionada | Fora de inputs |
| Delete | Excluir promoção selecionada | Fora de inputs |
| V | Ver itens da promoção | Fora de inputs |
| Ctrl+N | Nova promoção | Sempre |

**Menu contexto (botão direito):**
- Nova Promoção (Ctrl+N)
- Info da promoção selecionada
- Ver Itens (V)
- Editar (Enter)
- Excluir (Delete)

---

### Criar/Editar Promoção (modal)

| Atalho | Ação | Contexto |
|--------|------|----------|
| Ctrl+S | Salvar promoção | Sempre |
| Ctrl+L | Limpar formulário | Sempre |
| Ctrl+N | Adicionar item | Sempre |
| Ctrl+E | Exportar CSV | Sempre |
| Escape | Fechar modal | Sem sub-modal aberto |

**Menu contexto (botão direito):**
- Salvar (Ctrl+S)
- Limpar (Ctrl+L)
- Adicionar Item (Ctrl+N)
- Exportar CSV (Ctrl+E)
- Fechar (Esc)

---

## Componentes utilizados

| Componente | Pacote | Uso |
|-----------|--------|-----|
| `ContextMenu` | `@radix-ui/react-context-menu` | Menu botão direito |
| `AlertDialog` | `@radix-ui/react-alert-dialog` | Confirmações (ex: excluir item) |
| `AgGridReact` | `ag-grid-react` | Grid editável estilo Excel |
| `DataTablePadrao` | componente interno | Listagens com filtros/paginação |
| `InfoModal` | componente interno | Modal de sucesso/info |
| `toast` | `react-hot-toast` / `useToast` | Notificações rápidas |
