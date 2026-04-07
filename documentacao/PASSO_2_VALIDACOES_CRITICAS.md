# PASSO 2: Validações Críticas - Implementado ✅

## Objetivo
Implementar validações críticas no cadastro de produtos para garantir integridade de dados e compatibilidade com regras fiscais.

## Data de Implementação
11 de Janeiro de 2026

---

## 1. Validações no Schema (produtosSchema.ts)

### 1.1. Múltiplo >= 1
**Localização:** `src/data/produtos/produtosSchema.ts:49-54`

```typescript
multiplo: z
  .preprocess((val) => {
    if (val === null || val === undefined || val === '') return 1;
    const num = Number(val);
    return isNaN(num) ? 1 : num;
  }, z.number().min(1, 'Múltiplo não pode ser menor que 1')),
```

**Comportamento:**
- Valor padrão: 1
- Validação: >= 1
- Erro: "Múltiplo não pode ser menor que 1"

### 1.2. Múltiplo de Compra >= 1
**Localização:** `src/data/produtos/produtosSchema.ts:97-103`

```typescript
multiplocompra: z
  .preprocess((val) => {
    if (val === null || val === undefined || val === '') return 1;
    const num = Number(val);
    return isNaN(num) ? 1 : num;
  }, z.number().min(1, 'Múltiplo de compra não pode ser menor que 1'))
  .optional(),
```

**Comportamento:**
- Valor padrão: 1
- Validação: >= 1
- Erro: "Múltiplo de compra não pode ser menor que 1"

### 1.3. Grupo de Produto vs Tipo (MC/ME)
**Localização:** `src/data/produtos/produtosSchema.ts:144-173`

```typescript
.refine(
  (data) => {
    const tipo = data.tipo?.toUpperCase();
    const codgpp = data.codgpp?.toUpperCase();

    if (!tipo || !codgpp || codgpp === '00000') {
      return true; // Pula validação se campos vazios ou padrão
    }

    const comecaComZ = codgpp.startsWith('Z');

    if (tipo === 'MC' && comecaComZ) {
      return false; // MC não pode começar com Z
    }

    if (tipo === 'ME' && !comecaComZ) {
      return false; // ME deve começar com Z
    }

    return true;
  },
  {
    message: 'Grupo de Produto inválido: Mercadoria Comercial (MC) não pode começar com "Z" e Mercadoria Especial (ME) deve começar com "Z"',
    path: ['codgpp'],
  }
)
```

**Regras:**
- **MC (Mercadoria Comercial):** NÃO pode ter Grupo de Produto começando com "Z"
- **ME (Mercadoria Especial):** DEVE ter Grupo de Produto começando com "Z"
- Campo padrão "00000" é ignorado na validação

---

## 2. Validações no Backend (APIs)

### 2.1. Validar CEST vs NCM
**Arquivo:** `src/pages/api/produtos/validar-cest.ts`

**Funcionalidade:**
Valida se o código CEST é compatível com o NCM informado, seguindo a regra da stored procedure `spVALIDA_CEST` do Delphi.

**Endpoint:** `POST /api/produtos/validar-cest`

**Request Body:**
```json
{
  "ncm": "84439990",
  "cest": "0123456"
}
```

**Response:**
```json
// SUCESSO
{
  "resultado": "OK",
  "message": "CEST válido para este NCM"
}

// ERRO 1: NCM Inválido
{
  "resultado": "NOK1",
  "message": "NCM 84439990 não encontrado na tabela de classificações fiscais"
}

// ERRO 2: CEST Incompatível
{
  "resultado": "NOK2",
  "message": "CEST 0123456 não é válido para o NCM 84439990"
}

// CEST não informado
{
  "resultado": "OK",
  "message": "CEST não informado"
}
```

**Validações:**
1. Se CEST vazio → retorna OK
2. Se NCM vazio → retorna NOK1
3. Verifica se NCM existe em `db_manaus.dbnmcfiscal`
4. Verifica se CEST é compatível com NCM em `db_manaus.cest`

### 2.2. Validar Referência Duplicada
**Arquivo:** `src/pages/api/produtos/validar-referencia.ts`

**Funcionalidade:**
Valida se a referência do produto já está cadastrada em outro produto, seguindo a regra da função `CheckRefProdutos` do Delphi.

**Endpoint:** `POST /api/produtos/validar-referencia`

**Request Body:**
```json
{
  "ref": "ABC123",
  "codprod": "000001"  // Opcional: código do produto em edição
}
```

**Response:**
```json
// SUCESSO: Referência disponível
{
  "resultado": "OK",
  "message": "Referência disponível"
}

// ERRO: Referência já cadastrada
{
  "resultado": "NOK",
  "message": "Referência \"ABC123\" já cadastrada no produto 000002 - PRODUTO EXEMPLO",
  "produto": {
    "codprod": "000002",
    "ref": "ABC123",
    "descr": "PRODUTO EXEMPLO"
  }
}

// Referência não informada
{
  "resultado": "OK",
  "message": "Referência não informada"
}
```

**Validações:**
1. Se REF vazio → retorna OK
2. Busca produtos com mesma REF (case-insensitive, trim)
3. Ao editar, ignora o próprio produto (codprod)
4. Retorna dados do produto duplicado se encontrado

---

## 3. Validações no Frontend

### 3.1. DadosCadastrais.tsx
**Arquivo:** `src/components/corpo/admin/cadastro/produtos/_forms/DadosCadastrais.tsx`

**Modificações:**

1. **Import adicionado:**
```typescript
import { toast } from 'sonner';
```

2. **Estado adicionado:**
```typescript
const [validatingRef, setValidatingRef] = useState<boolean>(false);
```

3. **Função de validação adicionada:**
```typescript
const handleValidateRef = async () => {
  if (!produto.ref || produto.ref.trim() === '') return;

  setValidatingRef(true);
  try {
    const response = await fetch('/api/produtos/validar-referencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: produto.ref,
        codprod: produto.codprod,
      }),
    });

    const data = await response.json();

    if (data.resultado === 'NOK') {
      toast.error(data.message, {
        duration: 5000,
      });
    }
  } catch (error) {
    console.error('Erro ao validar referência:', error);
  } finally {
    setValidatingRef(false);
  }
};
```

4. **Campo de referência modificado:**
```typescript
<FormInput
  name="ref"
  type="text"
  label="Referência"
  value={produto.ref || ''}
  onChange={(e) =>
    handleProdutoChange({ ...produto, ref: e.target.value })
  }
  onBlur={handleValidateRef}  // ← VALIDAÇÃO ADICIONADA
  error={error?.ref}
  required
/>
```

**Comportamento:**
- Validação ocorre quando o usuário sai do campo (onBlur)
- Toast de erro aparece se referência já existir
- Duração do toast: 5 segundos

### 3.2. DadosFiscais.tsx
**Arquivo:** `src/components/corpo/admin/cadastro/produtos/_forms/DadosFiscais.tsx`

**Modificações:**

1. **Import adicionado:**
```typescript
import { toast } from 'sonner';
```

2. **Estado adicionado:**
```typescript
const [validatingCest, setValidatingCest] = useState<boolean>(false);
```

3. **Função de validação adicionada:**
```typescript
const handleValidateCest = async (cestValue?: string, ncmValue?: string) => {
  const cest = cestValue || produto.cest;
  const ncm = ncmValue || produto.clasfiscal;

  if (!cest || cest.trim() === '') return;

  if (!ncm || ncm.trim() === '') {
    toast.warning('NCM não informado. CEST requer NCM válido.', {
      duration: 5000,
    });
    return;
  }

  setValidatingCest(true);
  try {
    const response = await fetch('/api/produtos/validar-cest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ncm: ncm,
        cest: cest,
      }),
    });

    const data = await response.json();

    if (data.resultado === 'NOK1') {
      toast.error(data.message, {
        duration: 5000,
      });
    } else if (data.resultado === 'NOK2') {
      toast.error(data.message, {
        duration: 5000,
      });
    }
  } catch (error) {
    console.error('Erro ao validar CEST:', error);
  } finally {
    setValidatingCest(false);
  }
};
```

4. **Campo CEST modificado:**
```typescript
<SearchSelectInput
  name="cest"
  label="CEST"
  options={cestsOptions}
  value={produto.cest || ''}
  onValueChange={(value) => {
    handleProdutoChange({ ...produto, cest: value as string });
    handleValidateCest(value as string);  // ← VALIDAÇÃO ADICIONADA
  }}
  onInputChange={(value) => {
    setCestSearch(value);
    handleCestSearch();
  }}
  error={error?.cest}
/>
```

**Comportamento:**
- Validação ocorre quando o usuário seleciona um CEST (onValueChange)
- Toast de warning se NCM não foi informado
- Toast de erro se NCM for inválido ou CEST incompatível
- Duração dos toasts: 5 segundos

---

## 4. Resumo das Validações Implementadas

| Validação | Tipo | Local | Quando Ocorre |
|-----------|------|-------|---------------|
| Múltiplo >= 1 | Schema | produtosSchema.ts | Ao submeter formulário |
| Múltiplo Compra >= 1 | Schema | produtosSchema.ts | Ao submeter formulário |
| Grupo vs Tipo MC/ME | Schema | produtosSchema.ts | Ao submeter formulário |
| CEST vs NCM | API + Frontend | validar-cest.ts + DadosFiscais.tsx | Ao selecionar CEST |
| Referência Duplicada | API + Frontend | validar-referencia.ts + DadosCadastrais.tsx | Ao sair do campo REF |

---

## 5. Arquivos Modificados

### Criados:
- ✅ `src/pages/api/produtos/validar-cest.ts`
- ✅ `src/pages/api/produtos/validar-referencia.ts`

### Modificados:
- ✅ `src/data/produtos/produtosSchema.ts`
- ✅ `src/components/corpo/admin/cadastro/produtos/_forms/DadosCadastrais.tsx`
- ✅ `src/components/corpo/admin/cadastro/produtos/_forms/DadosFiscais.tsx`

---

## 6. Testes Recomendados

### 6.1. Testar Validações do Schema
1. Tentar cadastrar produto com múltiplo = 0
2. Tentar cadastrar produto com múltiplo de compra = 0
3. Tentar cadastrar MC com grupo começando com "Z"
4. Tentar cadastrar ME com grupo NÃO começando com "Z"

### 6.2. Testar Validação de CEST
1. Informar CEST sem informar NCM
2. Informar NCM inválido
3. Informar CEST incompatível com NCM válido
4. Informar CEST válido para NCM válido

### 6.3. Testar Validação de Referência
1. Cadastrar produto com referência existente
2. Editar produto mantendo mesma referência
3. Editar produto alterando para referência existente
4. Cadastrar produto com referência nova

---

## 7. Próximos Passos (PASSO 3)

- Adicionar campos faltantes identificados na comparação Delphi vs Next.js
- Implementar cálculos de margem e comissão
- Adicionar validações de preço
- Integrar com procedures Oracle faltantes

---

## 8. Observações Importantes

⚠️ **Atenção:** As validações do schema (Zod) são executadas ao submeter o formulário, enquanto as validações de CEST e Referência são executadas em tempo real.

✅ **Compatibilidade:** Todas as validações seguem as mesmas regras do sistema Delphi original.

📝 **UX:** Mensagens de erro aparecem como toasts com duração de 5 segundos, não bloqueando o envio do formulário, apenas alertando o usuário.
