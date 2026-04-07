# 🧪 Correção Erro 373 - Ambiente de Homologação

## 🎯 Erro SEFAZ 373

**Mensagem**: "Rejeição: Descrição do primeiro item diferente de NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"

---

## 🔍 O Que É Esse Erro?

Este é um **erro de validação específico** para o **ambiente de homologação (testes)** da SEFAZ.

Segundo o **Manual de Integração NF-e versão 4.0**, no ambiente de homologação:

> O primeiro item da nota fiscal DEVE ter obrigatoriamente a descrição:  
> **"NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"**

---

## 📋 Por Que Essa Regra Existe?

Esta regra serve para:

1. ✅ **Identificação clara**: Garantir que a nota é de teste
2. ✅ **Prevenção**: Evitar que notas de teste sejam confundidas com reais
3. ✅ **Validação**: Confirmar que o desenvolvedor está ciente do ambiente
4. ✅ **Conformidade**: Seguir as normas técnicas da SEFAZ

---

## ❌ Código Anterior

```typescript
const produtos = (dados.dbitvenda || []).map((item: any, index: number) => {
  const prod = item.dbprod ?? {};
  
  return {
    codigo: item.codprod ?? `P${index + 1}`,
    descricao: prod.descr?.trim() || `Produto ${index + 1}`, // ❌ Descrição real
    // ... outros campos
  };
});
```

**Resultado**: Primeiro produto com descrição real → **Erro 373**

---

## ✅ Código Corrigido

```typescript
const produtos = (dados.dbitvenda || []).map((item: any, index: number) => {
  const prod = item.dbprod ?? {};
  
  // REGRA DE HOMOLOGAÇÃO: Primeiro item deve ter descrição específica
  let descricao = prod.descr?.trim() || `Produto ${index + 1}`;
  if (index === 0) {
    descricao = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
    console.log('⚠️ HOMOLOGAÇÃO: Primeiro produto com descrição obrigatória');
  }

  return {
    codigo: item.codprod ?? `P${index + 1}`,
    descricao: descricao, // ✅ Primeiro item com descrição obrigatória
    // ... outros campos
  };
});
```

**Resultado**: Primeiro produto validado ✅

---

## 🔄 Comportamento

### No Ambiente de Homologação (tpAmb=2):
- **Item 1**: "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
- **Item 2+**: Descrição real do produto

### No Ambiente de Produção (tpAmb=1):
- **Todos os itens**: Descrição real do produto
- **IMPORTANTE**: Remover essa regra ao migrar para produção!

---

## ⚠️ Observações

1. **Apenas o primeiro item** precisa ter essa descrição
2. **Demais itens** podem ter descrição normal
3. **Valores, quantidades e impostos** continuam normais
4. **Esta regra NÃO se aplica em produção** (tpAmb=1)

---

## 🧪 Exemplo de Cupom Fiscal em Homologação

```xml
<NFe>
  <infNFe>
    <ide>
      <tpAmb>2</tpAmb> <!-- Homologação -->
      <mod>65</mod> <!-- NFC-e -->
    </ide>
    
    <det nItem="1">
      <prod>
        <cProd>000001</cProd>
        <xProd>NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xProd>
        <NCM>87089990</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>1.00</qCom>
        <vUnCom>43.60</vUnCom>
        <vProd>43.60</vProd>
      </prod>
    </det>
    
    <!-- Demais itens (se houver) com descrição normal -->
  </infNFe>
</NFe>
```

---

## 🚀 Como Migrar para Produção

Quando for migrar para **produção**, você deve:

1. **Remover a regra de homologação**:
```typescript
// REMOVER este bloco:
if (index === 0) {
  descricao = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
}
```

2. **Alterar tpAmb** de `2` para `1` em `gerarXmlCupomFiscal.ts`:
```typescript
.ele('tpAmb').txt('1').up() // 1 = Produção
```

3. **Alterar URLs** em `enviarCupomParaSefaz.ts`:
```typescript
// Homologação:
const urlSefaz = 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';

// Produção:
const urlSefaz = 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
```

---

## ✅ Teste

1. **Emitir cupom fiscal** para cliente com CPF
2. **Verificar log**:
   ```
   ⚠️ HOMOLOGAÇÃO: Primeiro produto com descrição obrigatória
   ```
3. **Resultado esperado**:
   - ✅ Status 100: Autorizado pela SEFAZ
   - ✅ Primeiro item com descrição de homologação

---

## 📊 Progresso de Correções

- [x] **Erro 765**: Endpoint correto (NFC-e vs NF-e) ✅
- [x] **Erro 610**: Total da NF incluindo IPI ✅
- [x] **Erro 373**: Descrição obrigatória em homologação ✅
- [ ] **Teste final**: Autorização completa

---

**Data**: 14/10/2025  
**Desenvolvedor**: Lucas Gabriel  
**Branch**: feat/lucas_gabriel_faturamento
