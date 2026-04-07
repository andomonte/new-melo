# ✅ Checklist de Execução Rápida - Testes Manuais Clientes

## 🚀 Setup Inicial

- [x] Servidor rodando em `http://localhost:3000` ✅
- [ ] Login realizado no sistema
- [ ] Usuário com permissão em `/[perfil]/clientes`
- [ ] Filial selecionada (cookie `filial_melo`)

---

## 🧪 Execução dos Testes

### ✅ CT 1.1-BUG: Validar Bugs Corrigidos (CRÍTICO - Executar primeiro!)

**URL**: `http://localhost:3000/[perfil]/clientes` (substitua [perfil] pelo seu perfil, ex: `admin`)

**Passos Rápidos**:

1. Clicar em "Cadastrar Cliente"
2. **Deixar CPF/CNPJ, Nome e CEP vazios**
3. Preencher apenas os outros campos obrigatórios
4. Clicar em "Salvar"

**✅ DEVE APARECER 3 ERROS**:

- ❌ "Campo CPF/CNPJ é obrigatório."
- ❌ "Campo nome é obrigatório."
- ❌ "Campo CEP é obrigatório."

**Status**: [ ] PASS / [ ] FAIL

---

### ✅ CT 1.1: Criar Cliente PF - Mínimo

**Passos Rápidos**:

1. Clicar em "Cadastrar Cliente"
2. Preencher:
   - CPF/CNPJ: `12345678901`
   - Nome: `João Teste`
   - CEP: `69000000`
   - Logradouro: `Rua Teste`
   - UF: `AM`
   - Cidade: `Manaus`
   - Bairro: `Centro`
   - País: `Brasil`
   - Todos os selects obrigatórios
   - Limite: `1000`
3. Marcar: Isento IE, Isento IM, Isento Suframa
4. Marcar: Mesmo Endereço
5. Clicar em "Salvar"

**✅ DEVE**: Modal fechar e cliente aparecer na tabela

**Status**: [ ] PASS / [ ] FAIL

---

### ✅ CT 1.4: Validar Refine - IE

**Passos Rápidos**:

1. Editar o cliente criado em CT 1.1
2. Ir para aba "Isenções"
3. **Desmarcar "Isento IE"**
4. **Deixar campo IE vazio**
5. Clicar em "Salvar"

**✅ DEVE**: Aparecer erro "Campo Inscrição Estadual é obrigatório quando Isento IE está desmarcado."

**Status**: [ ] PASS / [ ] FAIL

---

### ✅ CT 1.5: Validar Refine - Aceitar Atraso

**Passos Rápidos**:

1. Editar qualquer cliente
2. Ir para aba "Isenções"
3. **Marcar "Aceitar Atraso"**
4. **Deixar "Dias em Atraso" vazio ou 0**
5. Clicar em "Salvar"

**✅ DEVE**: Aparecer erro "Campo Dias em Atraso é obrigatório quando Aceitar Atraso está marcado."

**Status**: [ ] PASS / [ ] FAIL

---

### ✅ CT 1.6: Validar SuperRefine - Endereço Cobrança

**Passos Rápidos**:

1. Editar qualquer cliente
2. Ir para aba "Endereço de Cobrança"
3. **Desmarcar "Mesmo Endereço"**
4. **Deixar TODOS os campos vazios**
5. Clicar em "Salvar"

**✅ DEVE**: Aparecer 6 erros (CEP, Logradouro, UF, Cidade, Bairro, País cobrança)

**Status**: [ ] PASS / [ ] FAIL

---

## 📊 Resumo

| CT         | Descrição               | Status | Observações |
| ---------- | ----------------------- | ------ | ----------- |
| CT 1.1-BUG | Validar Bugs Corrigidos | [ ]    | **CRÍTICO** |
| CT 1.1     | Criar PF Mínimo         | [ ]    | Happy Path  |
| CT 1.4     | Refine IE               | [ ]    | Validação   |
| CT 1.5     | Refine Atraso           | [ ]    | Validação   |
| CT 1.6     | SuperRefine Cobrança    | [ ]    | Validação   |

---

## 🐛 Bugs Encontrados

Se algum teste FALHAR, anote aqui:

```
CT: _____
Problema: ___________________________________________
Screenshot/Erro: ____________________________________
```

---

## ✅ Conclusão

- [ ] **TODOS os testes passaram** - Schema corrigido com sucesso! 🎉
- [ ] **Algum teste falhou** - Verificar e documentar bugs

---

**Tempo estimado total**: 10-15 minutos  
**Prioridade**: Executar CT 1.1-BUG primeiro para confirmar correção dos bugs
