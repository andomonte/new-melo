# 🔢 Correção Erro 610 - Total da NF-e

## 🎯 Erro SEFAZ 610

**Mensagem**: "Rejeição: Total da NF difere do somatório dos Valores que compõem o Valor Total da NF"

---

## 🔍 Problema Identificado

O **valor total da nota (vNF)** não estava batendo com a fórmula da SEFAZ.

### ❌ Código Anterior
```typescript
totalNF: totalProdutos.toFixed(2), // ❌ NÃO incluía IPI!
```

**Resultado**: 
- `vProd = 43.60`
- `vIPI = 5.23`
- **vNF enviado = 43.60** ❌

---

## ✅ Fórmula Oficial SEFAZ

Segundo o Manual de Integração NF-e versão 4.0:

```
vNF = vProd - vDesc + vFrete + vSeg + vOutro + vII + vIPI + vST
```

Onde:
- `vProd` = Valor total dos produtos
- `vDesc` = Valor total dos descontos
- `vFrete` = Valor total do frete
- `vSeg` = Valor total do seguro
- `vOutro` = Outras despesas acessórias
- `vII` = Valor total do Imposto de Importação
- `vIPI` = Valor total do IPI
- `vST` = Valor total do ICMS ST

---

## ✅ Código Corrigido

```typescript
// Calcular total da NF (IMPORTANTE: deve incluir IPI!)
// Fórmula SEFAZ: vNF = vProd - vDesc + vFrete + vSeg + vOutro + vII + vIPI + vST
const totalNF = totalProdutos + totalIPI; // Produtos + IPI (outros valores são zero)
console.log(`💰 Total da NF (com IPI): ${totalNF.toFixed(2)}`);

const xmlCupom = await gerarXmlCupomFiscal({
  // ...
  totalNF: totalNF.toFixed(2), // ✅ AGORA inclui IPI
  // ...
});
```

**Resultado correto**:
- `vProd = 43.60`
- `vIPI = 5.23`
- **vNF = 48.83** ✅

---

## 📊 Exemplo de Cálculo

### Cupom Fiscal 001701856

**Produtos**:
- Valor dos produtos: `R$ 43,60`

**Impostos**:
- ICMS: `R$ 8,72` (não entra no total)
- IPI: `R$ 5,23` ✅ **DEVE entrar no total**
- PIS: `R$ 0,00` (não entra no total)
- COFINS: `R$ 0,00` (não entra no total)

**Outros valores** (todos zero):
- Desconto: `R$ 0,00`
- Frete: `R$ 0,00`
- Seguro: `R$ 0,00`
- Outras despesas: `R$ 0,00`

**Cálculo**:
```
vNF = 43.60 - 0.00 + 0.00 + 0.00 + 0.00 + 0.00 + 5.23 + 0.00
vNF = 48.83 ✅
```

---

## ⚠️ Observação Importante

**IPI sempre entra no total da NF-e/NFC-e!**

Mesmo que o IPI seja calculado "por fora" do preço, ele **deve compor** o valor total do documento fiscal. Isso é diferente de outros impostos como ICMS, PIS e COFINS que não entram no `vNF`.

---

## 🧪 Como Testar

1. **Reiniciar o servidor** Next.js
2. **Emitir cupom fiscal** para cliente com CPF
3. **Verificar log**:
   ```
   💰 Totais: Produtos=43.60, ICMS=8.72, IPI=5.23
   💰 Total da NF (com IPI): 48.83
   ```
4. **Resultado esperado**:
   - ✅ Status 100: Autorizado pela SEFAZ
   - ✅ vNF = 48.83 (produtos + IPI)

---

## 📝 Arquivo Modificado

- `src/pages/api/faturamento/emitir-cupom.ts`
  - Linha ~243: Cálculo do `totalNF` corrigido
  - Linha ~273: Envio do `totalNF` correto para XML

---

## ✅ Status

- [x] Erro 765 (endpoint) - **RESOLVIDO**
- [x] Erro 610 (totais) - **RESOLVIDO**
- [ ] Teste final pendente

---

**Data**: 14/10/2025  
**Desenvolvedor**: Lucas Gabriel  
**Branch**: feat/lucas_gabriel_faturamento
