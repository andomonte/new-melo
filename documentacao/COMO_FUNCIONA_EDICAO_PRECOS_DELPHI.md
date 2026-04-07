# 🔍 Como Funciona a Edição de Preços no Delphi

## Data: 11 de Janeiro de 2026

---

## 🎯 Resposta Direta

**NO DELPHI:**

❌ **NÃO dá para editar os preços direto no cadastro de produto!**

✅ **Existe uma tela SEPARADA** chamada "Análise de Margem de Preço dos Produtos"

---

## 📊 Fluxo no Delphi

### 1. Cadastrar/Editar Produto
**Localização:** UNIPRODUTO.PAS (tela principal)

**Abas:**
- Dados Cadastrais
- Dados Fiscais
- **Dados de Custos** ← Aqui ficam os preços BASE
  - Preço Fábrica
  - Preço Líquido
  - Preço NF
  - Preço Venda (base)
  - Preço Importação
  - etc.

**Ao clicar em Salvar:**
```sql
-- Procedure Oracle executa automaticamente:
spInc_Produto(...) ou spAlt_Produto(...)

-- Dentro da procedure:
FOR i IN 0..7 LOOP
  INSERT/UPDATE DBFORMACAOPRVENDA
  SET PRECOVENDA = fnCalculaPreco(codprod, i, prvenda, margem, ...)
  WHERE CODPROD = vCodProd AND TIPOPRECO = i;
END LOOP;
```

**Resultado:** Os 8 tipos de preço são **recalculados automaticamente**

---

### 2. Editar Preços Manualmente (Tela Separada)

**Como Acessar:**
- Menu no cadastro de produtos
- Item: **"Análise de margem de preço dos produtos (Novo)"**

**Código no UNIPRODUTO.PAS:**
```delphi
procedure TFProduto.AnlisedemargemdepreodosprodutosNovo1Click(
  Sender: TObject);
begin
  Application.CreateForm(TfrmAnaliseMargemPrecoVendasNovo,
                         frmAnaliseMargemPrecoVendasNovo);
  frmAnaliseMargemPrecoVendasNovo.ShowModal;
end;
```

**Localização:** Linhas 7249-7253 do UNIPRODUTO.PAS

**Formulário:** `uniMargemPrecoVendasNovo` (não está na pasta compartilhada)

---

## 🔄 Comportamento do Delphi

### Automatização:
1. ✅ Ao **salvar produto** → Recalcula automaticamente 8 preços
2. ✅ Preços ficam consistentes com margens cadastradas
3. ✅ Usuário não precisa fazer nada

### Ajuste Manual:
1. ✅ Existe **menu/tela separada** para análise de margens
2. ✅ Permite visualizar e ajustar preços manualmente
3. ✅ Útil para casos especiais (promoções, ajustes pontuais)

---

## 📋 Campos no Cadastro de Produto (Aba Custos)

### Preços BASE (salvos na tabela PRODUTO):
```
┌─────────────────────────────────────┐
│  Custo Ref. Lista de Fábrica        │
├─────────────────────────────────────┤
│  - Preço Fábrica                    │
│  - Preço Líquido                    │
│  - Preço NF                         │
│  - Preço sem NF                     │
├─────────────────────────────────────┤
│  Custo Ref. Compra/Transferência    │
├─────────────────────────────────────┤
│  - Custo Compra                     │
│  - Custo Transf. Líquido            │
│  - Custo Transf. Bruto              │
│  - Taxa Dólar Compra                │
├─────────────────────────────────────┤
│  Lista de Preço                     │
├─────────────────────────────────────┤
│  - Preço Venda ← BASE para cálculo  │
│  - Preço Importação                 │
│  - Preço Imp. Fatura                │
│  - Preço Imp. Fábrica               │
│  - Preço Concorrência               │
│  - Taxa Dólar Venda                 │
└─────────────────────────────────────┘
```

### ❌ NÃO tem no cadastro de produto:
- TIPOPRECO (0-7)
- PRECOVENDA por categoria
- Margens específicas por categoria

### ✅ Esses ficam na tabela DBFORMACAOPRVENDA
- Recalculados automaticamente
- Editados na tela separada

---

## 💡 Conclusão para o Next.js

### Implementação Ideal (igual ao Delphi):

1. **Cadastro de Produto** (`/admin/cadastro/produtos`)
   - ✅ Campos de preço BASE (já tem!)
   - ✅ Ao salvar → Recalcula automaticamente DBFORMACAOPRVENDA (**precisa implementar**)

2. **Tela Separada** (`/admin/cadastro/formacao-preco`)
   - ✅ Já existe e funciona!
   - ✅ Para ajustes manuais quando necessário
   - ✅ Visualização detalhada por TIPOPRECO

### Resposta à pergunta:

> "como isso é feito no delphi como o usuário edita esses preços, da para fazer isso só no cadastro do produto?"

**Resposta:**

❌ **NÃO dá para fazer só no cadastro do produto no Delphi!**

✅ **No Delphi também tem tela separada** (menu "Análise de Margem")

✅ **Mas o recálculo é automático** ao salvar produto

📝 **Solução Next.js:**
- Implementar recálculo automático (igual Delphi)
- Manter tela separada para ajustes (igual Delphi)
- **Melhor dos dois mundos!**

---

## 🔧 O que Precisa Implementar

### 1. Modificar APIs de Produto

**Arquivos:**
- `src/pages/api/produtos/add.ts`
- `src/pages/api/produtos/edit.ts`

**Adicionar após inserir/atualizar produto:**
```typescript
// Recalcular 8 tipos de preço automaticamente
await recalcularPrecosPorCategoria(data.codprod, data);
```

### 2. Criar Função de Recálculo

**Arquivo:** `src/lib/calcularPrecos.ts` (novo)

**Função:**
```typescript
async function recalcularPrecosPorCategoria(
  codprod: string,
  produto: Produto
) {
  for (let tipopreco = 0; tipopreco <= 7; tipopreco++) {
    const preco = calcularPrecoPorTipo(produto, tipopreco);

    await upsertFormacaoPreco({
      CODPROD: codprod,
      TIPOPRECO: tipopreco,
      PRECOVENDA: preco,
      MARGEMLIQUIDA: ...,
      ICMS: produto.icms,
      IPI: produto.ipi,
      ...
    });
  }
}
```

### 3. Tela Separada

**Status:** ✅ Já existe! (`/admin/cadastro/formacao-preco`)

**Uso:**
- Para visualizar preços calculados
- Para ajustar manualmente quando necessário
- Para casos especiais (promoções, etc.)

---

## ✅ Vantagens da Solução

1. ✅ **Automação:** Igual ao Delphi (recalcula ao salvar)
2. ✅ **Flexibilidade:** Tela separada para ajustes manuais
3. ✅ **Consistência:** Preços sempre atualizados
4. ✅ **Praticidade:** Usuário não precisa cadastrar 8 preços manualmente
5. ✅ **Compatibilidade:** Comportamento idêntico ao Delphi

---

## 📝 Resumo

| Aspecto | Delphi | Next.js (Atual) | Next.js (Ideal) |
|---------|--------|-----------------|-----------------|
| **Preços no cadastro** | ✅ Só BASE | ✅ Só BASE | ✅ Só BASE |
| **Recalcula auto** | ✅ SIM | ❌ NÃO | ✅ SIM |
| **Tela separada** | ✅ SIM | ✅ SIM | ✅ SIM |
| **Edição manual** | ✅ Tela sep. | ✅ Tela sep. | ✅ Tela sep. |

**Objetivo:** Implementar recálculo automático para ficar igual ao Delphi!
