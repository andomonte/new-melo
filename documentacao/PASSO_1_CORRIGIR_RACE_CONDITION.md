# ✅ PASSO 1: Corrigir Race Condition na Geração de Código

**Data:** 2026-01-10
**Status:** 🟡 Pronto para Executar
**Prioridade:** 🔴 CRÍTICA

---

## 🎯 OBJETIVO

Corrigir o bug de **race condition** na geração do código de produto que poderia gerar códigos duplicados quando dois usuários cadastram produtos simultaneamente.

---

## ❌ PROBLEMA ATUAL

### Código Antigo (BUGADO):
```typescript
// src/pages/api/produtos/add.ts (ANTES)
const latestResult = await pool.query(`
  SELECT codprod FROM dbprod
  WHERE codprod ~ '^[0-9]+$'
  ORDER BY CAST(codprod AS INTEGER) DESC
  LIMIT 1
`);
const nextNumber = parseInt(latestResult.rows[0].codprod) + 1;
const newCodProd = nextNumber.toString().padStart(6, '0');
```

**Problema:**
- ⚠️ Usuário A busca último código: `000100`
- ⚠️ Usuário B busca último código: `000100` (ao mesmo tempo)
- ❌ Ambos tentam inserir `000101` → ERRO ou duplicação!

---

## ✅ SOLUÇÃO IMPLEMENTADA

### Usar SEQUENCE do PostgreSQL (Thread-Safe)

**Vantagens:**
- ✅ Nativo do PostgreSQL
- ✅ Thread-safe (sem race condition)
- ✅ Mais rápido (não precisa SELECT)
- ✅ Garante unicidade automática

### Código Novo (CORRETO):
```typescript
// src/pages/api/produtos/add.ts (DEPOIS)
const sequenceResult = await pool.query(`
  SELECT LPAD(nextval('seq_dbprod_codprod')::TEXT, 6, '0') as codprod
`);
data.codprod = sequenceResult.rows[0].codprod;
```

---

## 📁 ARQUIVOS MODIFICADOS

### 1. **Criados:**
- ✅ `migrations/001_criar_sequence_codprod.sql` - Cria as sequences
- ✅ `migrations/001_rollback_sequence_codprod.sql` - Rollback (se necessário)

### 2. **Modificados:**
- ✅ `src/pages/api/produtos/add.ts` - Usa sequence ao invés de SELECT

---

## 🚀 COMO EXECUTAR

### **Passo 1: Executar Migration SQL**

Abra seu cliente PostgreSQL (DBeaver, pgAdmin, psql, etc.) e execute:

```bash
# Opção 1: Via psql (linha de comando)
psql -h localhost -U postgres -d seu_banco -f migrations/001_criar_sequence_codprod.sql

# Opção 2: Copiar e colar no DBeaver/pgAdmin
# Abra o arquivo migrations/001_criar_sequence_codprod.sql
# Copie todo o conteúdo
# Cole no Query Editor do DBeaver
# Execute (Ctrl+Enter ou botão Execute)
```

### **Passo 2: Verificar se Sequences Foram Criadas**

Execute esta query para verificar:

```sql
SELECT
  schemaname,
  sequencename,
  last_value,
  is_called
FROM pg_sequences
WHERE sequencename = 'seq_dbprod_codprod'
ORDER BY schemaname;
```

**Resultado esperado:**
```
schemaname    | sequencename           | last_value | is_called
--------------+------------------------+------------+-----------
db_manaus     | seq_dbprod_codprod     | 123456     | false
db_roraima    | seq_dbprod_codprod     | 123456     | false
db_rondonia   | seq_dbprod_codprod     | 123456     | false
```

(O `last_value` será o próximo código a ser gerado)

### **Passo 3: Testar Geração de Código**

Execute manualmente para ver o próximo código:

```sql
-- Schema db_manaus (padrão)
SELECT LPAD(nextval('db_manaus.seq_dbprod_codprod')::TEXT, 6, '0') as proximo_codigo;
-- Resultado: "123456" (exemplo)

-- Ver valor atual sem incrementar
SELECT last_value FROM db_manaus.seq_dbprod_codprod;
```

⚠️ **ATENÇÃO:** `nextval()` **incrementa** a sequence! Use apenas para testar.

---

## 🧪 COMO TESTAR NO NEXT.JS

### **Teste 1: Cadastro Normal**

1. Abra o Next.js: `http://localhost:3000`
2. Vá para **Cadastro de Produtos**
3. Clique em **"Novo"**
4. Preencha os campos obrigatórios:
   - Referência: `TEST001`
   - Descrição: `Produto Teste`
   - Unidade: `UN`
   - Marca: `00000`
   - Grupo Função: `00000`
   - Grupo Produto: `00000`
5. Clique em **"Salvar"**
6. ✅ Produto deve ser cadastrado com código sequencial (ex: `000123`)

### **Teste 2: Cadastros Simultâneos (Race Condition)**

**Método 1: Manual (2 abas)**
1. Abra **2 abas** do navegador
2. Em **ambas**, abra o modal de cadastro de produto
3. Preencha os campos em **ambas** (produtos diferentes)
4. Clique **"Salvar" nas 2 abas ao mesmo tempo** (ou o mais rápido possível)
5. ✅ **Esperado:** Ambos cadastram com códigos diferentes e sequenciais
   - Aba 1: `000124`
   - Aba 2: `000125`

**Método 2: Script Automatizado**

Crie um script para testar:

```typescript
// test-race-condition.ts
async function testRaceCondition() {
  const promises = [];

  // Criar 10 produtos simultaneamente
  for (let i = 0; i < 10; i++) {
    promises.push(
      fetch('http://localhost:3000/api/produtos/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: `TEST${i}`,
          descr: `Produto Teste ${i}`,
          unimed: 'UN',
          codmarca: '00000',
          codgpf: '00000',
          codgpp: '00000',
          curva: 'D',
          inf: 'A',
          multiplo: 1,
          coddesc: 0,
          compradireta: 'N',
          tipo: 'ME',
          multiplocompra: 1,
          trib: 'N',
          strib: '000',
          isentopiscofins: 'N',
          isentoipi: 'S',
          prcompra: 0,
          qtestmax: 0,
          percsubst: 0,
          clasfiscal: '',
          cest: ''
        })
      })
    );
  }

  // Executar todos ao mesmo tempo
  const results = await Promise.all(promises);

  // Verificar se todos têm códigos únicos
  const codigos = results.map(r => r.json()).map(d => d.data.codprod);
  const codigosUnicos = new Set(codigos);

  console.log('Total de códigos:', codigos.length);
  console.log('Códigos únicos:', codigosUnicos.size);
  console.log('✅ Teste passou:', codigos.length === codigosUnicos.size);
}

testRaceCondition();
```

Execute:
```bash
npx tsx test-race-condition.ts
```

**Resultado esperado:**
```
Total de códigos: 10
Códigos únicos: 10
✅ Teste passou: true
```

---

## 🔍 VALIDAÇÃO FINAL

### Verificar no Banco de Dados:

```sql
-- Últimos 10 produtos cadastrados
SELECT codprod, ref, descr, data_cadastro
FROM db_manaus.dbprod
ORDER BY CAST(codprod AS INTEGER) DESC
LIMIT 10;
```

**Verificar:**
- ✅ Códigos são sequenciais sem pulos (000123, 000124, 000125...)
- ✅ Não há códigos duplicados
- ✅ Todos foram criados recentemente

---

## ⚠️ TROUBLESHOOTING

### Erro: "relation seq_dbprod_codprod does not exist"

**Causa:** Migration não foi executada

**Solução:**
```sql
-- Execute novamente a migration
\i migrations/001_criar_sequence_codprod.sql
```

### Erro: "sequence already exists"

**Causa:** Sequence já foi criada antes

**Solução:**
```sql
-- Ver valor atual
SELECT last_value FROM seq_dbprod_codprod;

-- Se necessário, ajustar para o próximo valor correto
ALTER SEQUENCE seq_dbprod_codprod RESTART WITH 123456;
```

### Códigos pulando números (ex: 000100, 000102, 000104)

**Causa:** Sequence foi incrementada mas produto não foi inserido (erro na validação)

**Solução:** Isso é **NORMAL** e **esperado**! As sequences podem ter "buracos" se:
- Houve erro na validação
- Transação foi revertida
- `nextval()` foi chamado sem inserção

**Não é problema!** O importante é que **não há duplicatas**.

---

## 🔄 ROLLBACK (Se Necessário)

Se precisar desfazer a mudança:

### 1. Executar Rollback SQL:
```bash
psql -h localhost -U postgres -d seu_banco -f migrations/001_rollback_sequence_codprod.sql
```

### 2. Reverter Código:
```bash
git checkout src/pages/api/produtos/add.ts
# ou restaurar manualmente o código antigo
```

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

| Aspecto | ANTES (SELECT) | DEPOIS (SEQUENCE) |
|---------|----------------|-------------------|
| **Race Condition** | ❌ Possível | ✅ Impossível |
| **Performance** | 🟡 SELECT + INSERT | ✅ Apenas INSERT |
| **Queries** | 2 (SELECT + INSERT) | 1 (INSERT) |
| **Locks** | ❌ Sem lock | ✅ Lock automático |
| **Simplicidade** | 🟡 15 linhas | ✅ 3 linhas |
| **Padrão PostgreSQL** | ❌ Não | ✅ Sim |

---

## ✅ CHECKLIST DE CONCLUSÃO

Após executar e testar:

- [ ] Migration executada sem erros
- [ ] Sequences criadas nos 3 schemas (MANAUS, RORAIMA, RONDONIA)
- [ ] Código atualizado em `add.ts`
- [ ] Teste manual: cadastrou 1 produto com sucesso
- [ ] Teste simultâneo: cadastrou 2 produtos ao mesmo tempo sem duplicação
- [ ] Validação no banco: códigos são sequenciais e únicos
- [ ] **✅ PASSO 1 CONCLUÍDO!**

---

## 📋 PRÓXIMO PASSO

Após concluir e testar este passo:

**PASSO 2:** Adicionar validações de negócio (Grupo vs Tipo, CEST vs NCM, etc)

---

**Última atualização:** 2026-01-10
**Status:** 🟢 Pronto para executar e testar
