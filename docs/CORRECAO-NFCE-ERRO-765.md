# 🎫 Correção NFC-e - Erro 765 SEFAZ

## 🔍 Problema Identificado

**Erro SEFAZ 765**: "Lote só poderá conter NF-e ou NFC-e"

**Causa Raiz**: O código estava usando o endpoint **ERRADO** para NFC-e!

### ❌ Código Anterior
```typescript
// Estava usando endpoint de NF-e (modelo 55)
const urlSefaz = 'https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4';
```

### ✅ Código Corrigido
```typescript
// Agora usa endpoint ESPECÍFICO de NFC-e (modelo 65)
const urlSefaz = 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4';
```

---

## 🔧 Arquivos Modificados

### 1. `src/utils/enviarCupomParaSefaz.ts`
**Mudanças**:
- ✅ URL corrigida para endpoint NFC-e
- ✅ Validação de modelo 65 no XML
- ✅ Validação de assinatura digital
- ✅ Contagem de documentos no lote (deve ser 1)
- ✅ ID de lote único (baseado em timestamp)
- ✅ Logs detalhados do XML enviado
- ✅ Detecção de tags inválidas (nfeProc, protNFe, mod=55)

### 2. `src/pages/api/faturamento/emitir-cupom.ts`
**Mudanças**:
- ✅ Removido código duplicado de envio SOAP
- ✅ Agora usa função `enviarCupomParaSefaz()` corretamente
- ✅ Simplificado e mais limpo

### 3. `src/utils/sefazUrls.ts` (novo arquivo)
**Conteúdo**:
- Documentação oficial das URLs SEFAZ-AM
- Endpoints para homologação e produção
- Separação clara entre NF-e e NFC-e

### 4. `docs/SEFAZ-AM-ENDPOINTS.md` (novo arquivo)
**Conteúdo**:
- Guia completo de endpoints SEFAZ-AM
- URLs para autorização, consulta, inutilização, etc.
- Observações sobre WSDL e processamento

---

## 📊 Validações Adicionadas

### No XML:
1. ✅ Modelo deve ser 65 (NFC-e)
2. ✅ Assinatura digital presente
3. ✅ Apenas 1 documento no lote
4. ✅ Sem tags de pós-autorização (nfeProc, protNFe)

### No Envio:
1. ✅ Endpoint correto: `/nfce-services/`
2. ✅ ID de lote único
3. ✅ indSinc=1 (processamento síncrono)
4. ✅ Namespace correto

---

## 🎯 Diferenças NF-e vs NFC-e

| Característica | NF-e (Modelo 55) | NFC-e (Modelo 65) |
|----------------|------------------|-------------------|
| **Endpoint** | `/services2/services/` | `/nfce-services/services/` |
| **URL Homologação** | `homnfe.sefaz.am.gov.br` | `homnfce.sefaz.am.gov.br` |
| **Destinatário** | CNPJ obrigatório | CPF opcional |
| **Uso** | B2B, vendas empresariais | B2C, consumidor final |
| **tpImp** | 1 = Retrato | 4 = DANFE NFC-e |
| **indFinal** | Qualquer | 1 = Consumidor final |
| **indPres** | Qualquer | 1 = Presencial |

---

## 🚀 Como Testar

1. **Reiniciar o servidor Next.js**:
   ```bash
   # Parar (Ctrl+C)
   npm run dev
   ```

2. **Emitir cupom fiscal** para cliente com CPF:
   - Cliente: REGINALDO MONTEIRO DA SILVA (CPF: 74978004268)
   - Código: 37212

3. **Verificar logs**:
   ```
   ✅ Confirmado: XML é de NFC-e (modelo 65)
   ✅ XML contém assinatura digital
   📊 Quantidade de documentos no XML: 1
   🌐 Enviando NFC-e para SEFAZ-AM (endpoint específico)
   📋 XML COMPLETO ENVIADO PARA SEFAZ: (aparecerá no console)
   ```

4. **Resultado esperado**:
   - ✅ Status 100: Autorizado
   - ✅ Chave de acesso gerada (44 dígitos)
   - ✅ Protocolo SEFAZ retornado
   - ✅ PDF do cupom fiscal gerado

---

## 📝 URLs Oficiais SEFAZ-AM

### Homologação (Testes)
- **NFC-e Autorização**: `https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4`
- **NF-e Autorização**: `https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4`

### Produção (Validade Jurídica)
- **NFC-e Autorização**: `https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4`
- **NF-e Autorização**: `https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4`

**Fonte**: Portal NFC-e SEFAZ-AM (portalnfce.sefaz.am.gov.br)

---

## ✅ Status

- [x] Endpoint correto implementado
- [x] Validações adicionadas
- [x] Função dedicada para NFC-e
- [x] Documentação criada
- [x] Código limpo e sem duplicação
- [ ] **TESTE PENDENTE** (aguardando reiniciar servidor)

---

## 🎯 Próximos Passos

1. ✅ **Reiniciar Next.js** (aplicar mudanças)
2. ✅ **Testar emissão** de cupom fiscal
3. ✅ **Verificar logs** completos
4. ✅ **Confirmar autorização** SEFAZ
5. ⏳ **Migrar para produção** (quando aprovado)

---

**Data**: 14/10/2025
**Branch**: feat/lucas_gabriel_faturamento
**Desenvolvedor**: Lucas Gabriel
