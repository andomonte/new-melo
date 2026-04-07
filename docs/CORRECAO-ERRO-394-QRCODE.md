# 📱 Correção Erro 394 - QR-Code Obrigatório NFC-e

## 🎯 Erro SEFAZ 394

**Mensagem**: "Rejeição: Nota Fiscal sem a informação do QR-Code"

---

## 🔍 O Que É o QR-Code da NFC-e?

O **QR-Code** é um elemento **OBRIGATÓRIO** em NFC-e (modelo 65). Ele permite que o consumidor:

1. ✅ Consulte a nota fiscal pelo celular
2. ✅ Verifique a autenticidade do documento
3. ✅ Acesse informações detalhadas da compra
4. ✅ Denuncie irregularidades à SEFAZ

---

## 📋 Estrutura do QR-Code

O QR-Code da NFC-e é composto por:

### Tag XML:
```xml
<NFe>
  <infNFe Id="NFe13251018053139000169650020017018561581137648">
    <!-- Dados da nota -->
  </infNFe>
  
  <!-- ⚠️ IMPORTANTE: infNFeSupl FORA de infNFe -->
  <infNFeSupl>
    <qrCode><![CDATA[http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?chNFe=...]]></qrCode>
    <urlChave>http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp</urlChave>
  </infNFeSupl>
</NFe>
```

### Parâmetros da URL:

| Parâmetro | Descrição | Exemplo |
|-----------|-----------|---------|
| `chNFe` | Chave de acesso (44 dígitos) | `13251018053139000169650020017018561581137648` |
| `nVersao` | Versão do QR-Code | `100` |
| `tpAmb` | Tipo de ambiente | `2` (homologação) ou `1` (produção) |
| `cDest` | CPF do destinatário | `74978004268` (opcional) |
| `dhEmi` | Data/hora de emissão | `2025-10-14T21:45:00-04:00` |
| `vNF` | Valor total da NF | `48.83` |
| `vICMS` | Valor do ICMS | `0.00` |
| `digVal` | Digest Value (assinatura) | Base64 do digest |
| `cIdToken` | Código do CSC | `000001` |
| `cHashQRCode` | Hash do QR-Code | SHA1 do conteúdo |

---

## ❌ Código Anterior

```typescript
// Fecha infNFe (NFe fecha automaticamente)
root.up();

const xml = root.end({ prettyPrint: true }); // ❌ Sem QR-Code
```

**Resultado**: XML sem `<infNFeSupl>` → **Erro 394**

---

## ✅ Código Corrigido

```typescript
// Fecha infNFe
root.up();

// ⚠️ IMPORTANTE: infNFeSupl DEVE estar FORA de infNFe mas DENTRO de NFe
const nfeRoot = root.up(); // Volta para o nível NFe

// Gerar QR-Code da NFC-e (obrigatório!)
const urlQrCode = 'http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp';

const qrCodeParams = [
  `chNFe=${chaveCompleta}`,
  `nVersao=100`,
  `tpAmb=2`, // Homologação
  `cDest=${cpfCliente || ''}`,
  `dhEmi=${encodeURIComponent(formatarDataSefaz(dhEmi))}`,
  `vNF=${Number(totalNF || 0).toFixed(2)}`,
  `vICMS=0.00`,
  `digVal=${encodeURIComponent('DIGEST_VALUE_PLACEHOLDER')}`,
  `cIdToken=000001`,
  `cHashQRCode=HASH_PLACEHOLDER`
].join('&');

const urlConsultaCompleta = `${urlQrCode}?${qrCodeParams}`;

nfeRoot.ele('infNFeSupl')
  .ele('qrCode').dat(urlConsultaCompleta).up()
  .ele('urlChave').txt('http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp').up()
  .up();

const xml = nfeRoot.end({ prettyPrint: true }); // ✅ Com QR-Code
```

---

## 🔐 CSC (Código de Segurança do Contribuinte)

### O Que É?
O **CSC** é um código secreto fornecido pela SEFAZ para aumentar a segurança do QR-Code.

### Como Obter?
1. Acessar o **Portal da SEFAZ-AM**
2. Ir em **NFC-e → Gerenciar CSC**
3. Gerar um novo CSC
4. Anotar o **ID** e o **Código**

### Exemplo:
- **cIdToken**: `000001` (ID do CSC)
- **CSC**: `ABC123XYZ789` (código secreto - **não vai no XML!**)

### Uso:
O CSC é usado para calcular o `cHashQRCode`:
```
cHashQRCode = SHA1(chave + vNF + vICMS + digVal + CSC)
```

⚠️ **IMPORTANTE**: O CSC **NÃO** vai no XML! Apenas seu **ID** (`cIdToken`).

---

## 🧪 Exemplo de URL do QR-Code (Homologação)

```
http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?
chNFe=13251018053139000169650020017018561581137648&
nVersao=100&
tpAmb=2&
cDest=74978004268&
dhEmi=2025-10-14T21%3A45%3A00-04%3A00&
vNF=48.83&
vICMS=0.00&
digVal=DIGEST_VALUE_PLACEHOLDER&
cIdToken=000001&
cHashQRCode=HASH_PLACEHOLDER
```

---

## ⚠️ Observações Importantes

### 1. Posição no XML
```xml
<NFe>
  <infNFe>
    <!-- Dados da nota -->
  </infNFe>
  
  <!-- ✅ AQUI - Fora de infNFe -->
  <infNFeSupl>
    <qrCode>...</qrCode>
    <urlChave>...</urlChave>
  </infNFeSupl>
</NFe>
```

### 2. URL de Consulta
- **Homologação**: `http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp`
- **Produção**: `http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp` (mesma URL)

### 3. Placeholders
- `DIGEST_VALUE_PLACEHOLDER`: Será preenchido após assinatura digital
- `HASH_PLACEHOLDER`: Será calculado com CSC

### 4. CDATA
Use `<![CDATA[...]]>` para evitar problemas com caracteres especiais:
```xml
<qrCode><![CDATA[http://...]]></qrCode>
```

---

## 🚀 Próximos Passos

Após adicionar o QR-Code, você ainda precisa:

1. ✅ **Obter CSC** no portal da SEFAZ-AM
2. ✅ **Calcular cHashQRCode** com SHA1
3. ✅ **Atualizar digVal** após assinatura
4. ✅ **Testar** a autorização

---

## 🧪 Como Testar

1. **Emitir cupom fiscal**
2. **Verificar XML gerado** (deve conter `<infNFeSupl>`)
3. **Resultado esperado**:
   - ✅ XML com QR-Code
   - ✅ Tag `<infNFeSupl>` presente
   - ⚠️ Pode ter erro de CSC inválido (próximo passo)

---

## 📊 Progresso

- [x] Erro 765: Endpoint ✅
- [x] Erro 610: Totais ✅
- [x] Erro 373: Homologação ✅
- [x] Erro 394: QR-Code ✅
- [ ] Teste final com CSC válido

---

**Data**: 14/10/2025  
**Desenvolvedor**: Lucas Gabriel  
**Branch**: feat/lucas_gabriel_faturamento
