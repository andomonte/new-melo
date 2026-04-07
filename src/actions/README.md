# Cliente - Actions

Server Actions para gerenciamento de clientes.

## Funções Disponíveis

### `verifyClientExistence(cpfCnpj: string)`

Verifica se um CPF/CNPJ já está cadastrado no sistema.

**Parâmetros:**

- `cpfCnpj`: CPF ou CNPJ (com ou sem máscara)

**Retorno:**

```typescript
{
  exists: boolean;
  client?: {
    codigo: number;
    nome: string;
    nome_fantasia: string | null;
    cpf_cnpj: string;
    cidade: string | null;
    uf: string | null;
  };
}
```

**Exemplo:**

```typescript
const result = await verifyClientExistence('123.456.789-00');
if (result.exists) {
  console.log('Cliente encontrado:', result.client);
}
```

---

### `getClientByCode(codigo: number)`

Busca cliente por código único.

**Parâmetros:**

- `codigo`: Código único do cliente

**Retorno:**

- Objeto com dados completos do cliente ou `null` se não encontrado

**Exemplo:**

```typescript
const client = await getClientByCode(123);
if (client) {
  console.log('Nome:', client.nome);
}
```

---

### `isCpfCnpjAvailable(cpfCnpj: string, excludeCode?: number)`

Valida se CPF/CNPJ está disponível para cadastro.

**Parâmetros:**

- `cpfCnpj`: CPF ou CNPJ a verificar
- `excludeCode`: (Opcional) Código do cliente a excluir da busca (para edição)

**Retorno:**

- `true`: CPF/CNPJ disponível
- `false`: CPF/CNPJ já cadastrado

**Exemplo:**

```typescript
// Novo cadastro
const available = await isCpfCnpjAvailable('123.456.789-00');

// Edição (excluir o próprio cliente)
const available = await isCpfCnpjAvailable('123.456.789-00', 123);
```

---

## Segurança

✅ Todas as queries usam **Query Parameterization** ($1, $2, ...) para prevenir SQL Injection

✅ Validação de entrada antes da query

✅ Tratamento de erros adequado

## Uso com Hook

Recomendado usar junto com o hook `useClientVerification`:

```typescript
import { useClientVerification } from '@/hooks/useClientVerification';

const { verifyClient, duplicateClient, showModal } = useClientVerification();

<Input onBlur={(e) => verifyClient(e.target.value)} />;
```

## Testes

Execute os testes de integração:

```bash
npx tsx scripts/test-client-verification.ts
```
