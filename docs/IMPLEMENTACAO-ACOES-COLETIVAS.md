# Implementação de Ações Coletivas - Clientes

## Funcionalidades Implementadas

### 1. Alterar Classe de Pagamento em Massa

- **Modal**: `MudarClasseModal.tsx`
- **API**: `/api/clientes/bulk-update-classe`
- **Funcionalidade**: Permite alterar a classe de pagamento de múltiplos clientes selecionados

#### Características:

- Carrega lista de classes disponíveis da tabela `dbcclien`
- Validação de seleção (ao menos 1 cliente)
- Validação de classe de pagamento existente
- Atualização em lote usando `UPDATE ... WHERE codcli = ANY($2::text[])`
- Transação segura (BEGIN/COMMIT/ROLLBACK)
- Feedback com quantidade de clientes atualizados
- Limpa seleção após sucesso

### 2. Alterar Banco em Massa

- **Modal**: `AlterarBancoModal.tsx`
- **API**: `/api/clientes/bulk-update-banco`
- **Funcionalidade**: Permite alterar o banco de múltiplos clientes selecionados

#### Características:

- Carrega lista de bancos disponíveis da tabela `dbbanco_cobranca`
- Validação de seleção (ao menos 1 cliente)
- Validação de banco existente
- Atualização em lote usando `UPDATE ... WHERE codcli = ANY($2::text[])`
- Transação segura (BEGIN/COMMIT/ROLLBACK)
- Feedback com quantidade de clientes atualizados
- Limpa seleção após sucesso

## Estrutura dos Arquivos

### Componentes Criados:

```
src/components/cadastros/clientes/
├── MudarClasseModal.tsx    # Modal para alterar classe de pagamento
└── AlterarBancoModal.tsx   # Modal para alterar banco
```

### APIs Criadas:

```
src/pages/api/clientes/
├── bulk-update-classe.ts   # Endpoint para atualização em massa de classe
└── bulk-update-banco.ts    # Endpoint para atualização em massa de banco
```

### Alterações em Arquivos Existentes:

```
src/pages/admin/cadastros/clientes/index.tsx
├── Imports: +2 (MudarClasseModal, AlterarBancoModal)
├── State: +2 (isClasseModalOpen, isBancoModalOpen)
├── Handlers: Modificados para abrir modals
├── Callback: +1 (handleBulkUpdateSuccess)
└── Render: +2 modals adicionados
```

## Fluxo de Funcionamento

### 1. Seleção de Clientes

```
Usuário → Marca checkboxes → Set<string> selectedClients
```

### 2. Ação Coletiva - Classe de Pagamento

```
Usuário → Clica "Opções" → "Mudar Classe de Pagamento"
  ↓
Validação (≥1 cliente selecionado)
  ↓
Abre MudarClasseModal
  ↓
Carrega classes de dbcclien
  ↓
Usuário seleciona classe → Clica "Confirmar"
  ↓
POST /api/clientes/bulk-update-classe
  {
    clienteCodes: ["34290", "12345", ...],
    codcc: "1"
  }
  ↓
API valida classe existe → BEGIN
  ↓
UPDATE dbclien SET codcc = $1 WHERE codcli = ANY($2::text[])
  ↓
COMMIT → Retorna { updated: N }
  ↓
Toast de sucesso → Limpa seleção → Recarrega tabela
```

### 3. Ação Coletiva - Banco

```
Usuário → Clica "Opções" → "Alterar Banco de Cliente"
  ↓
Validação (≥1 cliente selecionado)
  ↓
Abre AlterarBancoModal
  ↓
Carrega bancos de dbbanco_cobranca
  ↓
Usuário seleciona banco → Clica "Confirmar"
  ↓
POST /api/clientes/bulk-update-banco
  {
    clienteCodes: ["34290", "12345", ...],
    banco: "1"
  }
  ↓
API valida banco existe → BEGIN
  ↓
UPDATE dbclien SET banco = $1 WHERE codcli = ANY($2::text[])
  ↓
COMMIT → Retorna { updated: N }
  ↓
Toast de sucesso → Limpa seleção → Recarrega tabela
```

## Validações Implementadas

### Frontend (Modals):

- ✅ Verificação de seleção vazia
- ✅ Verificação de valor selecionado no select
- ✅ Loading states durante requisições
- ✅ Tratamento de erros de API
- ✅ Feedback visual com sonner toast

### Backend (APIs):

- ✅ Método HTTP (apenas POST)
- ✅ Cookie de autenticação (filial_melo)
- ✅ Array de códigos não vazio
- ✅ Valor de classe/banco informado
- ✅ Existência de classe/banco no banco de dados
- ✅ Transações seguras com rollback em caso de erro
- ✅ Release de conexão no finally

## Segurança

### Transações SQL:

```typescript
await client.query('BEGIN');
try {
  // Validações
  // UPDATE
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

### Prepared Statements:

```sql
-- Previne SQL Injection
UPDATE dbclien
SET codcc = $1
WHERE codcli = ANY($2::text[])
```

## Status do Build

✅ **Build Compilado com Sucesso**

```
✓ Compiled successfully
✓ Generating static pages (50/50)
```

Endpoints criados visíveis no build:

- `/api/clientes/bulk-update-banco`
- `/api/clientes/bulk-update-classe`

## Próximos Passos Sugeridos

1. **Implementar "Status de Compra"** (ação individual pendente)
2. **Exportar para Excel** (ação coletiva)
3. **"Selecionar Tudo"** com paginação via API
4. **Histórico de alterações** em massa (auditoria)
5. **Desfazer ações** coletivas (opcional)

## Testes Recomendados

1. ✓ Selecionar 1 cliente → Alterar classe → Verificar atualização
2. ✓ Selecionar múltiplos clientes → Alterar banco → Verificar todos atualizados
3. ✓ Tentar sem seleção → Verificar mensagem de erro
4. ✓ Cancelar modal → Verificar não atualiza
5. ✓ Erro de rede → Verificar rollback e mensagem
6. ✓ Build e deploy em produção
