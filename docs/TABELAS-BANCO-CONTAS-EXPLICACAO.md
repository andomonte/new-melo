# Tabelas de Banco e Contas - Documentação Técnica

**Data:** 19/11/2025  
**Desenvolvedor:** Alejandro (Estagiário)  
**Status:** ✅ Implementado e Funcionando

---

## 📋 Resumo Executivo

O sistema possui **duas tabelas distintas** para gerenciar bancos e contas bancárias:

1. **`dbbanco_cobranca`** - Cadastro de Bancos (Master)
2. **`dbdados_banco`** - Contas Bancárias (Detail)

Essas tabelas estão **corretamente relacionadas** e foram **unificadas em uma única tela** seguindo o padrão master-detail do sistema.

---

## 🗂️ Estrutura das Tabelas

### 1️⃣ `dbbanco_cobranca` (Tabela Master - Bancos)

```sql
CREATE TABLE dbbanco_cobranca (
  banco VARCHAR PRIMARY KEY,  -- Código do banco (ex: "001", "237")
  nome VARCHAR NOT NULL        -- Nome do banco (ex: "Banco do Brasil", "Bradesco")
);
```

**Propósito:** Armazenar o cadastro básico de instituições bancárias.

**Exemplos de dados:**
| banco | nome |
|-------|-------------------|
| 001 | Banco do Brasil |
| 237 | Bradesco |
| 341 | Itaú |

---

### 2️⃣ `dbdados_banco` (Tabela Detail - Contas Bancárias)

```sql
CREATE TABLE dbdados_banco (
  id SERIAL PRIMARY KEY,           -- ID único da conta
  banco VARCHAR REFERENCES dbbanco_cobranca(banco), -- FK → Banco
  tipo VARCHAR,                     -- Tipo de conta (ex: "Corrente", "Poupança")
  nroconta VARCHAR,                 -- Número da conta
  agencia VARCHAR,                  -- Agência
  convenio VARCHAR,                 -- Convênio bancário
  variacao VARCHAR,                 -- Variação da conta
  carteira VARCHAR,                 -- Carteira de cobrança
  melo VARCHAR                      -- Identificador interno
);
```

**Propósito:** Armazenar dados específicos de cada conta bancária da empresa.

**Exemplos de dados:**
| id | banco | tipo | nroconta | agencia | convenio | carteira |
|----|-------|----------|----------|---------|----------|----------|
| 1 | 001 | Corrente | 12345-6 | 0001 | 123456 | 17 |
| 2 | 001 | Poupança | 98765-4 | 0001 | NULL | NULL |
| 3 | 237 | Corrente | 55555-0 | 1234 | 789012 | 09 |

---

## 🔗 Relacionamento Entre as Tabelas

```
dbbanco_cobranca (1) ─────────── (N) dbdados_banco
     ↑ banco                              ↑ banco (FK)

Significado:
- 1 Banco pode ter VÁRIAS Contas
- 1 Conta pertence a APENAS 1 Banco
```

**Exemplo no sistema:**

- Banco do Brasil (001) possui 2 contas: conta corrente e poupança
- Bradesco (237) possui 1 conta: conta corrente

---

## 🎨 Interface Implementada

### Tela Unificada: `/admin/cadastros/bancos`

**Padrão:** Master-Detail (igual à tela de Clientes → Limites)

```
┌─────────────────────────────────────────────────────┐
│  BANCOS (Master)                            [+ Novo]│
├─────────────────────────────────────────────────────┤
│  Código │ Nome              │ Ações                 │
│  001    │ Banco do Brasil   │ ✏️ 🗑️  [Selecionado] │ ← Clique aqui
│  237    │ Bradesco          │ ✏️ 🗑️                │
│  341    │ Itaú              │ ✏️ 🗑️                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  CONTAS DO BANCO: Banco do Brasil (001)    [+ Nova]│
├─────────────────────────────────────────────────────┤
│  Tipo     │ Conta    │ Agência │ Convênio │ Ações  │
│  Corrente │ 12345-6  │ 0001    │ 123456   │ ✏️ 🗑️  │
│  Poupança │ 98765-4  │ 0001    │ -        │ ✏️ 🗑️  │
└─────────────────────────────────────────────────────┘
```

**Fluxo de uso:**

1. Usuário vê lista de Bancos
2. Clica em um Banco (linha fica azul)
3. Abaixo aparece automaticamente a lista de Contas daquele Banco
4. Pode cadastrar/editar/excluir tanto Bancos quanto Contas

---

## 📍 Onde as Tabelas São Usadas no Sistema

### `dbbanco_cobranca` é usada em:

1. **Clientes** (`dbclien.banco`)

   - Para saber qual banco o cliente usa
   - JOIN para mostrar o nome do banco na tela de clientes

2. **Faturamento/Vendas**

   ```sql
   LEFT JOIN dbbanco_cobranca bc ON c.banco = bc.banco
   ```

   - Para mostrar nome do banco nas notas fiscais
   - Dropdown de seleção de banco

3. **Cadastros**
   - `/api/bancos/*` - CRUD completo

---

### `dbdados_banco` é usada em:

1. **Dados completos de conta bancária**

   - Agência, convênio, carteira para boletos
   - Geração de remessa bancária

2. **Faturamento avançado**

   ```sql
   LEFT JOIN dbdados_banco db ON c.banco = db.banco
   ```

   - Para pegar dados específicos da conta (carteira, convênio)

3. **Cadastros**
   - `/api/contas/*` - CRUD completo

---

## ✅ Validação Técnica

### Estrutura de Arquivos

```
src/
├── components/corpo/admin/cadastro/
│   ├── bancosContas/              ✅ Tela unificada (master-detail)
│   │   └── index.tsx              → 1011 linhas
│   ├── bancos.OLD/                📦 Backup (tela antiga separada)
│   └── contas.OLD/                📦 Backup (tela antiga separada)
│
├── pages/api/
│   ├── bancos/
│   │   ├── get.ts                 ✅ Lista de bancos (dbbanco_cobranca)
│   │   ├── add.ts                 ✅ Criar banco
│   │   ├── update.ts              ✅ Editar banco
│   │   └── delete/[id].ts         ✅ Deletar banco
│   └── contas/
│       ├── get.ts                 ✅ Lista de contas (dbdados_banco)
│       ├── add.ts                 ✅ Criar conta
│       ├── update.ts              ✅ Editar conta
│       └── delete/[id].ts         ✅ Deletar conta
│
└── data/
    ├── bancos/
    │   ├── bancos.ts              ✅ Interface + funções CRUD
    │   └── bancosSchema.ts        ✅ Validação Zod
    └── contas/
        ├── contas.ts              ✅ Interface + funções CRUD
        └── contasSchema.ts        ✅ Validação Zod
```

---

## 🚀 Como Testar

### 1. Acesse a tela

```
http://localhost:3000/admin/cadastros/bancos
```

### 2. Teste o fluxo Master-Detail

- Cadastre um novo banco (ex: "Caixa Econômica")
- Clique nesse banco
- Cadastre uma conta para ele
- Verifique se a conta aparece apenas quando o banco está selecionado

### 3. Teste permissões

- Usuário com perfil "CONSULTA" não deve ver botões de editar/deletar
- Usuário "ADMINISTRAÇÃO" vê todos os botões

---

## 🎯 Por Que Esta Estrutura É Correta

### ✅ Normalização de Banco de Dados

- Evita duplicação de dados (nome do banco repetido para cada conta)
- Facilita manutenção (alterar nome do banco em 1 lugar só)

### ✅ Escalabilidade

- Empresa pode ter múltiplas contas no mesmo banco
- Fácil adicionar novos bancos sem mexer nas contas

### ✅ Integridade Referencial

- Foreign Key garante que toda conta pertence a um banco válido
- Não permite criar conta de banco inexistente

### ✅ Padrão do Sistema

- Mesma arquitetura de Clientes → Limites
- Mesma arquitetura de Fornecedores → Produtos

---

## 📊 Comparação com Outras Abordagens

### ❌ Alternativa 1: Tudo em uma tabela só

```sql
-- NÃO RECOMENDADO
CREATE TABLE banco_conta (
  id SERIAL,
  codigo_banco VARCHAR,
  nome_banco VARCHAR,    -- ❌ Repetição de dados
  nroconta VARCHAR,
  agencia VARCHAR,
  ...
);
```

**Problemas:**

- Nome do banco repetido 50x (se tiver 50 contas)
- Alterar nome do banco = UPDATE em 50 linhas
- Violação da 3ª Forma Normal

### ❌ Alternativa 2: Telas separadas sem relação

```
/admin/cadastros/bancos     (sem mostrar contas)
/admin/cadastros/contas     (sem mostrar banco relacionado)
```

**Problemas:**

- Usuário não vê a relação entre banco e contas
- Precisa abrir 2 telas para fazer 1 tarefa
- Experiência de usuário ruim

### ✅ Solução Atual: Master-Detail

```
/admin/cadastros/bancos     (mostra bancos E contas numa tela)
```

**Vantagens:**

- Relação visual clara
- 1 tela para gerenciar tudo
- Padrão já usado no sistema

---

## 📝 Conclusão

As tabelas `dbbanco_cobranca` e `dbdados_banco` **NÃO são duplicatas**, são **complementares** e seguem as melhores práticas de modelagem de dados.

A tela unificada em `/admin/cadastros/bancos` já implementa corretamente o relacionamento master-detail entre elas.

**Nenhuma alteração de estrutura de banco de dados é necessária.**

---

## 🤝 Próximos Passos (Opcional)

Se quiser melhorar ainda mais a tela:

1. **Badge visual** mostrando "Banco Selecionado: Banco do Brasil (001)"
2. **Contador** de contas por banco na lista master
3. **Filtro avançado** para buscar contas por agência/convênio
4. **Exportação** para Excel de bancos + contas

---

**Dúvidas?** Pergunte ao Alejandro (estagiário) ou equipe técnica.
