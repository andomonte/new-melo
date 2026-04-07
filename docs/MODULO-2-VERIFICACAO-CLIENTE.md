# Módulo 2: Verificação de Cliente Existente

## 📋 Visão Geral

Este módulo implementa a verificação automática de duplicidade de clientes por CPF/CNPJ, garantindo que não sejam cadastrados clientes duplicados no sistema.

### Stack Técnica

- **Frontend**: Next.js 13+, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js com driver nativo `pg` (node-postgres)
- **Validação**: Zod schemas
- **Segurança**: SQL com Query Parameterization ($1)

---

## 🏗️ Arquitetura

### Arquivos Criados

```
src/
├── actions/
│   └── client.actions.ts              # Server Actions
├── hooks/
│   └── useClientVerification.ts       # Hook customizado
├── components/
│   └── clientes/
│       ├── DuplicateClientModal.tsx   # Modal de alerta
│       └── examples/
│           └── ClientVerificationExamples.tsx
└── docs/
    └── MODULO-2-VERIFICACAO-CLIENTE.md
```

---

## 🔧 Componentes

### 1. Server Action: `verifyClientExistence`

**Arquivo**: `src/actions/client.actions.ts`

Função assíncrona que verifica se um CPF/CNPJ já está cadastrado.

#### Funcionalidades:

- ✅ Limpa CPF/CNPJ (remove `.`, `-`, `/`, espaços)
- ✅ Valida formato (11 ou 14 dígitos)
- ✅ Query SQL com parameterização ($1)
- ✅ Retorna dados resumidos do cliente

#### API:

```typescript
async function verifyClientExistence(cpfCnpj: string): Promise<{
  exists: boolean;
  client?: {
    codigo: number;
    nome: string;
    nome_fantasia: string | null;
    cpf_cnpj: string;
    cidade: string | null;
    uf: string | null;
  };
}>;
```

#### SQL Query:

```sql
SELECT
  codigo,
  nome,
  nome_fantasia,
  cpf_cnpj,
  cidade,
  uf
FROM dbclien
WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = $1
LIMIT 1
```

#### Exemplo de Uso:

```typescript
import { verifyClientExistence } from '@/actions/client.actions';

const result = await verifyClientExistence('123.456.789-00');

if (result.exists) {
  console.log('Cliente encontrado:', result.client);
  // { codigo: 123, nome: 'João Silva', ... }
}
```

---

### 2. Hook: `useClientVerification`

**Arquivo**: `src/hooks/useClientVerification.ts`

Hook React customizado para gerenciar a verificação de cliente.

#### Features:

- ✅ Estado de loading automático
- ✅ Controle do modal
- ✅ Callbacks configuráveis
- ✅ Verificação automática ou manual
- ✅ Reset de estado

#### API:

```typescript
interface UseClientVerificationOptions {
  onDuplicateFound?: (client: ExistingClient) => void;
  onAvailable?: () => void;
  onError?: (error: Error) => void;
  autoVerify?: boolean; // default: true
}

function useClientVerification(options?: UseClientVerificationOptions): {
  isLoading: boolean;
  duplicateClient: ExistingClient | null;
  showModal: boolean;
  verifyClient: (cpfCnpj: string) => Promise<void>;
  closeModal: () => void;
  reset: () => void;
  error: string | null;
};
```

#### Exemplo de Uso:

```typescript
const {
  verifyClient, // Função para verificar
  duplicateClient, // Cliente encontrado
  showModal, // Controle do modal
  closeModal, // Fechar modal
  isLoading, // Estado de carregamento
  error, // Erro (se houver)
} = useClientVerification({
  onDuplicateFound: (client) => {
    console.log('Duplicado:', client);
  },
  onAvailable: () => {
    console.log('CPF/CNPJ disponível');
  },
});

// Uso no input
<Input onBlur={(e) => verifyClient(e.target.value)} />;
```

---

### 3. Modal: `DuplicateClientModal`

**Arquivo**: `src/components/clientes/DuplicateClientModal.tsx`

Modal elegante que exibe informações do cliente duplicado.

#### Features:

- ✅ Design responsivo com Tailwind CSS
- ✅ Ícones do Lucide React
- ✅ Formatação automática de CPF/CNPJ
- ✅ Botões de ação (Editar/Visualizar)
- ✅ Navegação com Next.js Link
- ✅ Dark mode ready

#### Props:

```typescript
interface DuplicateClientModalProps {
  open: boolean;
  onClose: () => void;
  client: ExistingClient | null;
  onEdit?: (codigo: number) => void;
  onView?: (codigo: number) => void;
  showViewButton?: boolean; // default: true
  showEditButton?: boolean; // default: true
}
```

#### Exemplo de Uso:

```typescript
<DuplicateClientModal
  open={showModal}
  onClose={closeModal}
  client={duplicateClient}
/>
```

#### Preview:

```
┌─────────────────────────────────────────┐
│  ⚠️  Cliente já cadastrado!             │
│     Este CPF/CNPJ já existe no sistema │
├─────────────────────────────────────────┤
│                                         │
│  ⚠️ Não é possível cadastrar um        │
│     cliente com CPF/CNPJ já existente  │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ #123  Código do Cliente           │ │
│  ├───────────────────────────────────┤ │
│  │ 👤  Nome / Razão Social           │ │
│  │     João Silva Ltda               │ │
│  │                                   │ │
│  │ 🏢  CPF/CNPJ                      │ │
│  │     12.345.678/0001-00           │ │
│  │                                   │ │
│  │ 📍  Localização                   │ │
│  │     São Paulo - SP                │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [ Fechar ] [ Visualizar ] [ Editar ]  │
└─────────────────────────────────────────┘
```

---

## 🚀 Guia de Implementação

### Passo 1: Importar Dependências

```typescript
import { useClientVerification } from '@/hooks/useClientVerification';
import { DuplicateClientModal } from '@/components/clientes/DuplicateClientModal';
```

### Passo 2: Usar o Hook

```typescript
const { verifyClient, duplicateClient, showModal, closeModal, isLoading } =
  useClientVerification();
```

### Passo 3: Adicionar Verificação ao Input

```typescript
<Input
  type="text"
  placeholder="CPF/CNPJ"
  onBlur={(e) => verifyClient(e.target.value)}
  disabled={isLoading}
/>
```

### Passo 4: Renderizar o Modal

```typescript
<DuplicateClientModal
  open={showModal}
  onClose={closeModal}
  client={duplicateClient}
/>
```

---

## 📝 Exemplos Práticos

### Exemplo 1: Formulário Simples

```typescript
function ClientForm() {
  const [cpfCnpj, setCpfCnpj] = useState('');

  const { verifyClient, duplicateClient, showModal, closeModal } =
    useClientVerification();

  return (
    <>
      <Input
        value={cpfCnpj}
        onChange={(e) => setCpfCnpj(e.target.value)}
        onBlur={(e) => verifyClient(e.target.value)}
      />

      <DuplicateClientModal
        open={showModal}
        onClose={closeModal}
        client={duplicateClient}
      />
    </>
  );
}
```

### Exemplo 2: Com Validação de Submit

```typescript
function ClientFormWithValidation() {
  const [canSubmit, setCanSubmit] = useState(false);

  const { verifyClient, showModal, closeModal, duplicateClient } =
    useClientVerification({
      onDuplicateFound: () => setCanSubmit(false),
      onAvailable: () => setCanSubmit(true),
    });

  return (
    <form onSubmit={handleSubmit}>
      <Input onBlur={(e) => verifyClient(e.target.value)} />

      <Button disabled={!canSubmit}>Cadastrar</Button>

      <DuplicateClientModal
        open={showModal}
        onClose={closeModal}
        client={duplicateClient}
      />
    </form>
  );
}
```

### Exemplo 3: Navegação Customizada

```typescript
function ClientFormWithCustomNav() {
  const router = useRouter();

  const { verifyClient, showModal, closeModal, duplicateClient } =
    useClientVerification();

  const handleEdit = (codigo: number) => {
    router.push(`/clientes/editar/${codigo}`);
  };

  return (
    <>
      <Input onBlur={(e) => verifyClient(e.target.value)} />

      <DuplicateClientModal
        open={showModal}
        onClose={closeModal}
        client={duplicateClient}
        onEdit={handleEdit}
      />
    </>
  );
}
```

---

## 🔒 Segurança

### SQL Injection Prevention

✅ **Query Parameterization**: Todas as queries usam `$1, $2, ...` em vez de concatenação de strings.

```typescript
// ❌ ERRADO (Vulnerável a SQL Injection)
const query = `SELECT * FROM dbclien WHERE cpf_cnpj = '${cpfCnpj}'`;

// ✅ CORRETO (Seguro)
const query = `SELECT * FROM dbclien WHERE cpf_cnpj = $1`;
await pool.query(query, [cpfCnpj]);
```

### Validação de Entrada

✅ Validação de formato antes da query
✅ Limpeza de caracteres especiais
✅ Validação de tamanho (11 ou 14 dígitos)
✅ Validação de tipo (apenas números)

---

## 🧪 Testes

### Teste Manual

1. Abra o formulário de cadastro
2. Digite um CPF/CNPJ existente
3. Tire o foco do campo (onBlur)
4. Verifique se o modal aparece
5. Clique em "Ir para Edição" → Deve redirecionar
6. Clique em "Visualizar" → Deve redirecionar
7. Clique em "Fechar" → Modal deve fechar

### Casos de Teste

| Caso                  | Input                | Resultado Esperado |
| --------------------- | -------------------- | ------------------ |
| CPF válido existente  | `123.456.789-00`     | Modal aparece      |
| CNPJ válido existente | `12.345.678/0001-00` | Modal aparece      |
| CPF novo              | `999.999.999-99`     | Sem modal          |
| Input vazio           | ` `                  | Sem verificação    |
| Formato inválido      | `123`                | Sem verificação    |

---

## 🎨 Customização

### Personalizar Callbacks

```typescript
const { verifyClient } = useClientVerification({
  onDuplicateFound: (client) => {
    // Custom logic
    console.log('Duplicado:', client);
    toast.error('Cliente já existe!');
  },
  onAvailable: () => {
    // Custom logic
    toast.success('CPF/CNPJ disponível!');
  },
  onError: (error) => {
    // Custom error handling
    Sentry.captureException(error);
  },
});
```

### Personalizar Modal

```typescript
<DuplicateClientModal
  open={showModal}
  onClose={closeModal}
  client={duplicateClient}
  showViewButton={false} // Ocultar botão visualizar
  showEditButton={true} // Mostrar apenas editar
/>
```

---

## 🐛 Troubleshooting

### Modal não abre

**Problema**: Modal não aparece após verificação

**Solução**: Verificar se `showModal` está sendo controlado corretamente

```typescript
console.log('showModal:', showModal);
console.log('duplicateClient:', duplicateClient);
```

### Query não encontra cliente

**Problema**: Query retorna vazio mesmo com CPF existente

**Solução**: Verificar formato do campo no banco

```sql
-- Verificar formato armazenado
SELECT cpf_cnpj, LENGTH(cpf_cnpj) FROM dbclien LIMIT 5;

-- Testar query manualmente
SELECT * FROM dbclien
WHERE REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') = '12345678900';
```

### Loading infinito

**Problema**: `isLoading` fica em `true` permanentemente

**Solução**: Verificar try/catch no Server Action

```typescript
try {
  setIsLoading(true);
  await verifyClient(cpfCnpj);
} catch (error) {
  console.error(error);
} finally {
  setIsLoading(false); // SEMPRE executar
}
```

---

## 📊 Performance

### Otimizações Implementadas

- ✅ **LIMIT 1** na query (retorna apenas 1 registro)
- ✅ **Índice no campo cpf_cnpj** (recomendado)
- ✅ **Pool de conexões** com getPgPool()
- ✅ **Debounce** (pode ser adicionado ao hook se necessário)

### Adicionar Índice ao Banco

```sql
-- Criar índice para performance
CREATE INDEX idx_dbclien_cpf_cnpj_clean
ON dbclien (
  REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '')
);
```

---

## 🚀 Próximos Passos

### Possíveis Melhorias

1. **Debounce**: Adicionar delay antes da verificação
2. **Cache**: Cachear resultados por alguns segundos
3. **Toast**: Adicionar notificações toast
4. **Analytics**: Rastrear duplicações tentadas
5. **Histórico**: Registrar tentativas de cadastro duplicado

---

## 📚 Referências

- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)
- [node-postgres Documentation](https://node-postgres.com/)
- [Zod Validation](https://zod.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## ✅ Checklist de Implementação

- [x] Server Action criada (`verifyClientExistence`)
- [x] Hook customizado criado (`useClientVerification`)
- [x] Modal de duplicação criado (`DuplicateClientModal`)
- [x] SQL com Query Parameterization
- [x] Validação de CPF/CNPJ
- [x] Limpeza de caracteres especiais
- [x] Estados de loading
- [x] Tratamento de erros
- [x] Navegação para edição
- [x] Navegação para visualização
- [x] Documentação completa
- [x] Exemplos de uso

---

**Autor**: Sistema de Clientes - Migração Legado  
**Data**: Dezembro 2025  
**Versão**: 1.0.0
