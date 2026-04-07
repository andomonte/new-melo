```markdown
# Documentação: Componente Genérico de CRUD

Este documento explica como utilizar o conjunto de componentes genéricos para criar páginas de listagem, cadastro, edição e exclusão (CRUD) de forma rápida e padronizada em nosso sistema.

## 🎯 Objetivo

O objetivo destes componentes é **eliminar a repetição de código e padronizar a experiência do usuário**. Em vez de reescrever a lógica de estado, modais e chamadas de API para cada entidade (Produtos, Fornecedores, etc.), você apenas fornecerá as configurações específicas, acelerando o desenvolvimento e garantindo consistência visual e funcional.

## 📂 Estrutura de Arquivos

Os componentes genéricos estão localizados em `src/components/common/Crud/`. Para criar uma nova página, você só precisa importar o `GenericCrudPage`.

A estrutura dos componentes base é a seguinte:
```

src/
└── components/
└── common/
└── Crud/ \<-- Pasta dos componentes genéricos
├── ConfirmDeleteModal.tsx
├── GenericFormModal.tsx
└── GenericCrudPage.tsx \<-- O componente principal que você usará

````

## ✨ Conceito Principal: Inversão de Controle

O design do componente utiliza o princípio de Inversão de Controle:

- O `GenericCrudPage` cuida de **TODA a lógica reutilizável**: busca de dados, paginação, pesquisa, estado dos modais, dropdown de ações, etc.
- **Você**, como desenvolvedor, apenas **fornece as partes que mudam** para cada contexto, através de `props`:
  1. As **funções da API** para a entidade específica.
  2. A definição das **colunas da tabela**.
  3. O componente com os **campos do formulário**.
  4. O **schema de validação (Zod)** para o formulário.

## 🚀 Como Usar: Guia Passo a Passo

Vamos criar uma página de CRUD para **"Formação de Preço"** como exemplo.

### Passo 1: Criar o Objeto da API

Crie um objeto que satisfaça a interface `CrudApi<T>`. Ele deve conter as funções que se comunicam com seu backend.

> **Nota:** Se a assinatura de uma função da sua API (ex: `update`) for diferente da esperada pela `CrudApi`, basta criar uma pequena função adaptadora, como no exemplo abaixo para `update`.

```tsx
// No arquivo da sua página, ex: src/pages/formacao-preco/index.tsx

import { CrudApi } from '@/components/common/Crud/GenericCrudPage';
import { FormacaoPrecoVenda, getFormacoesPrecoVenda, getFormacaoPrecoVenda, createFormacaoPrecoVenda, updateFormacaoPrecoVenda, deleteFormacaoPrecoVenda } from '@/services/formacaoPrecoService'; // Ajuste o caminho

const formacaoApi: CrudApi<FormacaoPrecoVenda> = {
  list: getFormacoesPrecoVenda,
  getById: getFormacaoPrecoVenda,
  create: createFormacaoPrecoVenda,
  // A interface espera `(id, data)`, mas nossa API só quer `data`.
  // Criamos uma função anônima para adaptar a chamada.
  update: (id, data) => updateFormacaoPrecoVenda(data),
  remove: deleteFormacaoPrecoVenda,
};
````

### Passo 2: Definir as Colunas da Tabela

Crie um array de objetos `CrudColumn<T>`. Cada objeto define um `header` (cabeçalho) e uma função `cell` que renderiza o conteúdo da célula, permitindo formatação.

```tsx
// No arquivo da sua página

import { CrudColumn } from '@/components/common/Crud/GenericCrudPage';
import { FormacaoPrecoVenda } from '@/services/formacaoPrecoService';

const formacaoColumns: CrudColumn<FormacaoPrecoVenda>[] = [
  {
    header: 'Cód. Produto',
    cell: (item) => item.CODPROD,
  },
  {
    header: 'Tipo Preço',
    cell: (item) => item.TIPOPRECO,
  },
  {
    header: 'Margem Líquida',
    cell: (item) => `${Number(item.MARGEMLIQUIDA).toFixed(2)}%`,
  },
  {
    header: 'Preço Venda',
    cell: (item) =>
      Number(item.PRECOVENDA).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
  },
];
```

### Passo 3: Criar o Componente do Formulário (`FormComponent`)

Este é um componente React "burro" (dumb component) que contém **apenas os campos do formulário**. Ele recebe os dados e as funções de alteração via `props` do `GenericFormModal`.

> **Dica:** Use a `prop` `formData` para controlar o estado dos campos. Por exemplo, você pode desabilitar a chave primária (`CODPROD`) durante a edição verificando se ela já existe em `formData`.

```tsx
// Em um arquivo separado: src/pages/formacao-preco/FormacaoPrecoForm.tsx

import React from 'react';
import { FormComponentProps } from '@/components/common/Crud/GenericFormModal';
import FormInput from '@/components/ui/FormInput'; // Ajuste o caminho
import { FormacaoPrecoVenda } from '@/services/formacaoPrecoService';

export const FormacaoPrecoForm: React.FC<
  FormComponentProps<FormacaoPrecoVenda>
> = ({ formData, onFormChange, errors }) => {
  // Função genérica para atualizar o estado do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange(e.target.name as keyof FormacaoPrecoVenda, e.target.value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FormInput
        name="CODPROD"
        label="Cód. Produto"
        value={formData.CODPROD || ''}
        onChange={handleInputChange}
        error={errors.CODPROD}
        required
        maxLength={6}
        // Dica: Desabilita o campo na edição para proteger a chave primária
        disabled={!!formData.id}
      />
      <FormInput
        name="TIPOPRECO"
        type="number"
        label="Tipo Preço"
        value={String(formData.TIPOPRECO || '')}
        onChange={handleInputChange}
        error={errors.TIPOPRECO}
        required
      />
      {/* ... Adicione todos os outros FormInputs aqui (MARGEMLIQUIDA, ICMS, etc.) ... */}
    </div>
  );
};
```

### Passo 4: Definir Schema de Validação e Estado Vazio

No arquivo da sua página, defina um schema de validação com **Zod** e um objeto que representa o estado inicial de um novo item.

```tsx
// No arquivo da sua página

import { z } from 'zod';
import { FormacaoPrecoVenda } from '@/services/formacaoPrecoService';

// Schema de validação para o formulário
const formacaoSchema = z.object({
  CODPROD: z.string().min(1, 'Código do produto é obrigatório.'),
  TIPOPRECO: z.coerce.number().min(0.01, 'Tipo de preço deve ser positivo.'),
  MARGEMLIQUIDA: z.coerce.number().min(0, 'A margem não pode ser negativa.'),
  // ... adicione as outras regras de validação aqui
});

// Objeto usado para abrir o formulário de criação
const formacaoEmptyState: FormacaoPrecoVenda = {
  id: undefined, // ou null
  CODPROD: '',
  TIPOPRECO: 0,
  MARGEMLIQUIDA: 0,
  // ... inicialize todos os outros campos com 0 ou ''
};
```

### Passo 5: Montar a Página Final

Finalmente, junte todas as peças no seu componente de página. Observe como o código final é limpo, declarativo e fácil de entender.

```tsx
// src/pages/formacao-preco/index.tsx

import { GenericCrudPage } from '@/components/common/Crud/GenericCrudPage';
import { FormacaoPrecoForm } from './FormacaoPrecoForm';
// ... importe formacaoApi, formacaoColumns, formacaoSchema, formacaoEmptyState

const FormacaoPrecoVendaPage = () => {
  // A lógica de permissões pode vir do seu hook de autenticação
  const userPermissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  return (
    <GenericCrudPage
      title="Formação de Preço de Venda"
      entityName="formação de preço"
      idKey="id" // Use a chave primária do seu objeto (ex: "id", "CODPROD")
      api={formacaoApi}
      columns={formacaoColumns}
      permissions={userPermissions}
      FormComponent={FormacaoPrecoForm}
      validationSchema={formacaoSchema}
      emptyState={formacaoEmptyState}
    />
  );
};

export default FormacaoPrecoVendaPage;
```

---

## 📖 Referência de Props (`GenericCrudPage`)

| Prop               | Tipo                                         | Obrigatório | Descrição                                                                                     |
| :----------------- | :------------------------------------------- | :---------- | :-------------------------------------------------------------------------------------------- |
| `title`            | `string`                                     | Sim         | O título principal que aparece no topo da página.                                             |
| `entityName`       | `string`                                     | Sim         | O nome da entidade no singular, usado em mensagens como "Salvar formação de preço".           |
| `idKey`            | `keyof T`                                    | Sim         | O nome da propriedade que é a chave primária do objeto de dados (ex: `"id"`, `"CODPROD"`).    |
| `api`              | `CrudApi<T>`                                 | Sim         | Objeto com as funções (`list`, `create`, etc.) que devem corresponder à interface `CrudApi`.  |
| `columns`          | `CrudColumn<T>[]`                            | Sim         | Array de objetos que definem os cabeçalhos e a renderização das células da tabela.            |
| `permissions`      | `{ canCreate, canEdit, canDelete }`          | Sim         | Objeto de booleanos que controla a exibição dos botões de ação (`Novo`, `Editar`, `Excluir`). |
| `FormComponent`    | `React.ComponentType<FormComponentProps<T>>` | Sim         | O componente React que renderiza os campos do formulário. Ele receberá `props` específicas.   |
| `validationSchema` | `z.Schema<T>`                                | Sim         | O schema do Zod usado para validar o formulário antes do envio.                               |
| `emptyState`       | `T`                                          | Sim         | Um objeto com a estrutura da entidade e valores padrão, usado ao criar um novo item.          |

```

```
