# 🧪 Guia de Teste Manual - Módulo Clientes

## Validação Pós-Correção de Bugs

**Data**: 2025-11-01  
**Objetivo**: Validar que a correção dos bugs BUG-CLT-001, BUG-CLT-002 e BUG-CLT-003 não quebrou a funcionalidade

---

## ⚙️ Pré-requisitos

- ✅ Servidor de desenvolvimento rodando (`npm run dev`)
- ✅ Acesso ao sistema com usuário que tem permissão em `/clientes`
- ✅ Filial configurada nos cookies (`filial_melo`)
- ✅ Database PostgreSQL acessível

---

## 📋 CT 1.1: Criar Cliente PF - Campos Mínimos Obrigatórios

**Prioridade**: P0 (CRÍTICO)  
**Tempo Estimado**: 3 minutos  
**Tipo**: Happy Path

### Passos

1. **Acesse a página de Clientes**

   - URL: `http://localhost:3000/[perfil]/clientes`
   - Substitua `[perfil]` pelo perfil do seu usuário (ex: `admin`)

2. **Clique no botão "Cadastrar Cliente"**

   - Deve abrir um modal com abas: "Dados", "Isenções", "Endereço de Cobrança"

3. **Preencha os campos obrigatórios mínimos (aba "Dados")**:

   | Campo                       | Valor de Teste                     |
   | --------------------------- | ---------------------------------- |
   | **CPF/CNPJ**                | `12345678901` (11 dígitos para PF) |
   | **Nome**                    | `João da Silva Teste`              |
   | **CEP**                     | `69000000`                         |
   | **Logradouro**              | `Rua Teste`                        |
   | **UF**                      | `AM`                               |
   | **Cidade**                  | `Manaus`                           |
   | **Bairro**                  | `Centro`                           |
   | **País**                    | Selecionar `Brasil` (1058)         |
   | **Tipo Cliente**            | Selecionar qualquer opção          |
   | **Situação Tributária**     | Selecionar qualquer opção          |
   | **Classificação Pagamento** | Selecionar qualquer opção          |
   | **Faixa Financeira**        | Selecionar qualquer opção          |
   | **ICMS**                    | Selecionar qualquer opção          |
   | **Preço de Venda**          | Selecionar qualquer opção          |
   | **Kickback**                | `0`                                |
   | **Bloquear Preço**          | Selecionar qualquer opção          |
   | **Limite**                  | `1000`                             |

4. **Marque "Isento IE", "Isento IM", "Isento Suframa"**

   - Isso deve desabilitar os campos IE, IM e Suframa (não são obrigatórios)

5. **Marque "Mesmo Endereço" na aba "Endereço de Cobrança"**

   - Isso deve desabilitar todos os campos de cobrança

6. **Clique em "Salvar"**

### Resultado Esperado ✅

- ✅ Modal fecha sem erros
- ✅ Cliente aparece na tabela de clientes
- ✅ Mensagem de sucesso exibida (toast/alert)
- ✅ Dados salvos no banco de dados

### Resultado em Caso de Falha ❌

- ❌ Modal não fecha
- ❌ Mensagens de validação aparecem (indicaria que a correção quebrou algo)
- ❌ Erro no console do navegador ou do servidor

---

## 📋 CT 1.1-BUG: Validar Correção BUG-CLT-001, 002, 003

**Prioridade**: P0 (CRÍTICO)  
**Tempo Estimado**: 5 minutos  
**Tipo**: Validação de Bug Fix

### Passos

1. **Acesse a página de Clientes**
2. **Clique em "Cadastrar Cliente"**
3. **Deixe os campos CPF/CNPJ, Nome e CEP VAZIOS**
4. **Preencha APENAS os outros campos obrigatórios**:
   - Logradouro: `Rua Teste`
   - UF: `AM`
   - Cidade: `Manaus`
   - Bairro: `Centro`
   - País: `Brasil`
   - Tipo Cliente, Situação Tributária, etc.
5. **Clique em "Salvar"**

### Resultado Esperado ✅

**DEVE aparecer mensagens de erro para os 3 campos**:

- ❌ "Campo CPF/CNPJ é obrigatório."
- ❌ "Campo nome é obrigatório."
- ❌ "Campo CEP é obrigatório."

**O formulário NÃO deve ser enviado** - modal deve permanecer aberto

### Resultado em Caso de Falha ❌

Se o modal fechar e o cliente for criado com campos vazios:

- 🚨 **BUG CRÍTICO** - Os bugs NÃO foram corrigidos
- 🚨 Verifique se o schema está sendo usado corretamente no componente
- 🚨 Possível cache do navegador - limpe o cache e tente novamente

---

## 📋 CT 1.2: Criar Cliente PJ - Todos os Campos

**Prioridade**: P1  
**Tempo Estimado**: 5 minutos  
**Tipo**: Happy Path Completo

### Passos

1. **Acesse a página de Clientes**
2. **Clique em "Cadastrar Cliente"**
3. **Preencha TODOS os campos**:

   **Aba "Dados"**:

   ```
   CPF/CNPJ: 12345678000190 (14 dígitos para PJ)
   Nome: Empresa de Teste LTDA
   CEP: 69005001
   Logradouro: Av. Eduardo Ribeiro
   Número: 123
   UF: AM
   Cidade: Manaus
   Bairro: Centro
   País: Brasil
   Tipo Cliente: [Selecionar]
   Situação Tributária: [Selecionar]
   Classificação Pagamento: [Selecionar]
   Faixa Financeira: [Selecionar]
   ICMS: [Selecionar]
   Banco: [Opcional]
   Preço de Venda: [Selecionar]
   Kickback: 0
   Bloquear Preço: [Selecionar]
   Vendedor Externo: [Opcional]
   Limite: 5000
   ```

   **Aba "Isenções"**:

   ```
   ☐ Isento IE
   IE: 123456789

   ☐ Isento IM
   IM: 987654321

   ☐ Isento Suframa
   Suframa: 111222333

   ☐ Aceitar Atraso
   Dias em Atraso: [deixar vazio pois Aceitar Atraso está desmarcado]
   ```

   **Aba "Endereço de Cobrança"**:

   ```
   ☐ Mesmo Endereço

   CEP Cobrança: 69036610
   Logradouro Cobrança: Av. Djalma Batista
   Número Cobrança: 456
   UF Cobrança: AM
   Cidade Cobrança: Manaus
   Bairro Cobrança: Chapada
   País Cobrança: Brasil
   ```

4. **Clique em "Salvar"**

### Resultado Esperado ✅

- ✅ Modal fecha
- ✅ Cliente PJ aparece na tabela
- ✅ Ao clicar em "Editar", todos os campos devem estar preenchidos corretamente
- ✅ Endereço de cobrança diferente do principal salvo corretamente

---

## 📋 CT 1.3: Editar Cliente - Alterar Dados Básicos

**Prioridade**: P1  
**Tempo Estimado**: 3 minutos  
**Tipo**: CRUD - Update

### Passos

1. **Localize o cliente criado em CT 1.1 ou CT 1.2**
2. **Clique no botão "Editar"** (ícone de lápis)
3. **Altere os seguintes campos**:
   - Nome: `[Nome Original] - EDITADO`
   - Limite: `2000` (ou qualquer valor diferente)
4. **Clique em "Salvar"**

### Resultado Esperado ✅

- ✅ Modal fecha
- ✅ Nome atualizado na tabela com sufixo "- EDITADO"
- ✅ Limite atualizado

---

## 📋 CT 1.4: Editar Cliente - Alterar Isenção IE

**Prioridade**: P1  
**Tempo Estimado**: 4 minutos  
**Tipo**: Validação de Lógica Refine

### Passos - Parte 1: Remover Isenção (Deve Exigir IE)

1. **Edite o cliente criado em CT 1.1** (que tinha Isento IE marcado)
2. **Vá para a aba "Isenções"**
3. **Desmarque "Isento IE"**
4. **DEIXE o campo IE vazio**
5. **Clique em "Salvar"**

### Resultado Esperado - Parte 1 ✅

- ❌ **DEVE aparecer erro**: "Campo Inscrição Estadual é obrigatório quando Isento IE está desmarcado."
- ✅ Modal permanece aberto

### Passos - Parte 2: Preencher IE

6. **Preencha o campo IE**: `123456789`
7. **Clique em "Salvar"**

### Resultado Esperado - Parte 2 ✅

- ✅ Modal fecha
- ✅ Cliente atualizado com IE preenchido
- ✅ Ao reabrir edição, IE está salvo e Isento IE está desmarcado

---

## 🧪 CT 1.5: Validar Lógica de "Aceitar Atraso"

**Prioridade**: P1  
**Tempo Estimado**: 3 minutos  
**Tipo**: Validação de Lógica Refine

### Passos

1. **Edite qualquer cliente**
2. **Vá para a aba "Isenções"**
3. **Marque "Aceitar Atraso"**
4. **DEIXE "Dias em Atraso" vazio ou com valor 0**
5. **Clique em "Salvar"**

### Resultado Esperado ✅

- ❌ **DEVE aparecer erro**: "Campo Dias em Atraso é obrigatório quando Aceitar Atraso está marcado."
- ✅ Modal permanece aberto

### Passos - Parte 2

6. **Preencha "Dias em Atraso"**: `30`
7. **Clique em "Salvar"**

### Resultado Esperado - Parte 2 ✅

- ✅ Modal fecha
- ✅ Cliente salvo com "Aceitar Atraso" marcado e dias = 30

---

## 🧪 CT 1.6: Validar Endereço de Cobrança Condicional

**Prioridade**: P1  
**Tempo Estimado**: 4 minutos  
**Tipo**: Validação de Lógica SuperRefine

### Passos - Parte 1: Desmarcar "Mesmo Endereço" sem preencher

1. **Edite qualquer cliente**
2. **Vá para a aba "Endereço de Cobrança"**
3. **Desmarque "Mesmo Endereço"**
4. **DEIXE todos os campos de cobrança vazios**
5. **Clique em "Salvar"**

### Resultado Esperado - Parte 1 ✅

**DEVE aparecer erros para TODOS os campos de cobrança**:

- ❌ "Campo CEP cobrança é obrigatório."
- ❌ "Campo logradouro cobrança é obrigatório."
- ❌ "Campo UF cobrança é obrigatório."
- ❌ "Campo cidade cobrança é obrigatório."
- ❌ "Campo bairro cobrança é obrigatório."
- ❌ "Campo país cobrança é obrigatório."

### Passos - Parte 2: Preencher campos de cobrança

6. **Preencha todos os campos de cobrança**:
   ```
   CEP Cobrança: 69000000
   Logradouro Cobrança: Rua Cobrança Teste
   Número Cobrança: 789
   UF Cobrança: AM
   Cidade Cobrança: Manaus
   Bairro Cobrança: Aleixo
   País Cobrança: Brasil
   ```
7. **Clique em "Salvar"**

### Resultado Esperado - Parte 2 ✅

- ✅ Modal fecha
- ✅ Endereço de cobrança salvo corretamente

---

## 📊 Checklist de Execução

Marque cada teste à medida que executa:

- [ ] **CT 1.1**: Criar Cliente PF - Campos Mínimos ✅
- [ ] **CT 1.1-BUG**: Validar Correção de Bugs (CPF/Nome/CEP vazios) ✅
- [ ] **CT 1.2**: Criar Cliente PJ - Todos os Campos ✅
- [ ] **CT 1.3**: Editar Cliente - Dados Básicos ✅
- [ ] **CT 1.4**: Editar Cliente - Isenção IE ✅
- [ ] **CT 1.5**: Validar "Aceitar Atraso" ✅
- [ ] **CT 1.6**: Validar Endereço de Cobrança Condicional ✅

---

## 🐛 Registro de Bugs Encontrados

Se encontrar algum problema, registre aqui:

### Bug Template

```markdown
**ID**: BUG-CLT-XXX
**CT**: [Número do CT que falhou]
**Severidade**: [CRÍTICA/ALTA/MÉDIA/BAIXA]
**Descrição**: [O que aconteceu]
**Passos para Reproduzir**:

1.
2. **Resultado Esperado**: [O que deveria acontecer]
   **Resultado Atual**: [O que realmente aconteceu]
   **Evidências**: [Screenshot, mensagem de erro, stack trace]
```

---

## ✅ Critérios de Aceitação

Para considerar os testes APROVADOS:

- ✅ **TODOS os 7 CTs** devem passar sem erros
- ✅ **CT 1.1-BUG** deve confirmar que os bugs foram corrigidos (campos vazios devem ser rejeitados)
- ✅ **Validações de refine/superRefine** devem funcionar corretamente (CT 1.4, 1.5, 1.6)
- ✅ **Clientes criados** devem aparecer na tabela e serem editáveis
- ✅ **Nenhum erro** no console do navegador (F12 > Console)
- ✅ **Nenhum erro** no terminal do servidor

---

## 🔍 Dicas de Troubleshooting

### Se os campos vazios forem aceitos (Bug não corrigido):

1. **Verifique se salvou o arquivo** `clientesSchema.ts`
2. **Limpe o cache do navegador** (Ctrl+Shift+Delete)
3. **Reinicie o servidor** (`npm run dev`)
4. **Verifique o build**: `npm run build` para ver erros de TypeScript

### Se aparecerem erros inesperados:

1. **Abra o Console do navegador** (F12) e veja a mensagem de erro
2. **Verifique o terminal do servidor** para erros de backend
3. **Confirme que está usando a filial correta** (cookie `filial_melo`)
4. **Verifique se o banco de dados está acessível**

---

## 📞 Suporte

Se encontrar problemas que não consegue resolver:

1. Anote o CT que falhou
2. Copie a mensagem de erro completa
3. Tire um screenshot da tela
4. Compartilhe com a equipe de desenvolvimento

---

**Última Atualização**: 2025-11-01  
**Autor**: GitHub Copilot (Automated Testing)  
**Versão do Schema**: `clientesSchema.ts` com correção BUG-CLT-001/002/003
