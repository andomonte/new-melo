# Emissão de Documentos Fiscais

Este projeto suporta dois tipos de documentos fiscais eletrônicos:

## 📄 NF-e (Nota Fiscal Eletrônica) - Modelo 55
**Arquivo:** `src/pages/api/faturamento/emitir.ts`

### Quando usar:
- Vendas para **CNPJ** (pessoa jurídica)
- Vendas B2B (empresa para empresa)
- Operações que exigem nota fiscal completa

### Características:
- Modelo: **55**
- Destinatário: **CNPJ obrigatório**
- Layout: DANFE (A4 vertical/horizontal)
- Dados completos: endereço, transportadora, impostos detalhados
- Série: Pode ser alfanumérica (ex: "AA", "AB")

### Campos salvos em `dbfat_nfe`:
```sql
modelo = '55'  -- NF-e
serie = 'AA'   -- Alfanumérica
status = '100' -- 100=Autorizado, 301/302/303=Denegado
```

---

## 🎫 NFC-e (Nota Fiscal ao Consumidor Eletrônica) - Modelo 65
**Arquivo:** `src/pages/api/faturamento/emitir-cupom.ts`

### Quando usar:
- Vendas para **CPF** (pessoa física)
- Vendas ao consumidor final (B2C)
- Substituição de cupom fiscal (ECF)

### Características:
- Modelo: **65**
- Destinatário: **CPF** (CNPJ não aceito)
- Layout: DANFE NFC-e (recibo vertical, tamanho 80mm)
- QR Code obrigatório para consulta
- Dados resumidos
- Pode funcionar em contingência offline

### Campos salvos em `dbfat_nfe`:
```sql
modelo = '65'  -- NFC-e (Cupom)
serie = '1'    -- Geralmente numérica
status = '100' -- 100=Autorizado, 301/302/303=Denegado
```

---

## 🔄 Fluxo de Emissão

### NF-e (CNPJ):
```
1. Validar cliente tem CNPJ
2. Gerar XML (gerarXml.ts)
3. Assinar XML (assinarXml.ts)
4. Enviar para SEFAZ (enviarParaSefaz.ts)
5. Gerar PDF DANFE (gerarPDFNFe.ts)
6. Salvar em dbfat_nfe (modelo='55')
```

### NFC-e (CPF):
```
1. Validar cliente tem CPF
2. Gerar XML (gerarXmlCupomFiscal.ts) ⚠️ TODO
3. Assinar XML (assinarXml.ts)
4. Enviar para SEFAZ (enviarCupomParaSefaz.ts) ⚠️ TODO
5. Gerar PDF Cupom (gerarPDFCupomFiscal.ts) ⚠️ TODO
6. Gerar QR Code para consulta ⚠️ TODO
7. Salvar em dbfat_nfe (modelo='65')
```

---

## 📋 Validações Importantes

### NF-e (emitir.ts):
```typescript
// Não aceita CPF
if (!dados.dbclien.cnpj || dados.dbclien.cnpj.length !== 14) {
  return res.status(400).json({ 
    erro: 'Cliente sem CNPJ. Use emissão de Cupom Fiscal para CPF.' 
  });
}
```

### NFC-e (emitir-cupom.ts):
```typescript
// Não aceita CNPJ
if (dados.dbclien.cnpj && dados.dbclien.cnpj.length === 14) {
  return res.status(400).json({ 
    erro: 'Cliente com CNPJ não pode receber Cupom Fiscal. Use NF-e.' 
  });
}
```

---

## 🎯 Status de Implementação

### ✅ Implementado:
- [x] API de emissão de NF-e (modelo 55)
- [x] Geração de XML para NF-e
- [x] Assinatura digital
- [x] Envio para SEFAZ (NF-e)
- [x] Geração de PDF DANFE
- [x] Salvamento em banco com modelo correto
- [x] Suporte a série alfanumérica (AA, AB)
- [x] Campo `denegada` atualizado para códigos 301/302/303
- [x] Estrutura base para NFC-e

### ⚠️ TODO - NFC-e:
- [ ] Implementar `gerarXmlCupomFiscal.ts` (XML específico para modelo 65)
- [ ] Implementar `enviarCupomParaSefaz.ts` (endpoint pode ser diferente)
- [ ] Implementar `gerarPDFCupomFiscal.ts` (layout vertical de recibo)
- [ ] Implementar geração de QR Code (obrigatório para NFC-e)
- [ ] Implementar consulta via QR Code
- [ ] Contingência offline (opcional)
- [ ] Validação de CSC (Código de Segurança do Contribuinte)

---

## 🗂️ Estrutura de Arquivos

```
src/
├── pages/api/faturamento/
│   ├── emitir.ts              # ✅ NF-e (CNPJ) - Modelo 55
│   ├── emitir-cupom.ts        # ⚠️  NFC-e (CPF) - Modelo 65 (em desenvolvimento)
│   └── emitir-faturado.ts     # ✅ NF-e alternativa
│
└── utils/
    ├── gerarXml.ts            # ✅ XML NF-e (modelo 55)
    ├── gerarXmlCupomFiscal.ts # ⚠️  XML NFC-e (modelo 65) - TODO
    ├── assinarXml.ts          # ✅ Assinatura (compartilhado)
    ├── enviarParaSefaz.ts     # ✅ Envio NF-e
    ├── enviarCupomParaSefaz.ts# ⚠️  Envio NFC-e - TODO
    ├── gerarPDFNFe.ts         # ✅ PDF DANFE (NF-e)
    └── gerarPDFCupomFiscal.ts # ⚠️  PDF Cupom - TODO
```

---

## 💾 Banco de Dados

### Tabela: `dbfat_nfe`
```sql
CREATE TABLE dbfat_nfe (
  codfat VARCHAR(9),
  modelo VARCHAR(2),  -- '55' = NF-e | '65' = NFC-e
  serie VARCHAR(3),   -- Alfanumérico para NF-e, numérico para NFC-e
  status VARCHAR(4),  -- '100', '301', '302', '303', etc.
  chave VARCHAR(44),  -- Chave de acesso
  xmlremessa TEXT,    -- XML enviado
  xmlretorno TEXT,    -- Resposta SEFAZ
  imagem BYTEA,       -- PDF do documento
  ...
);
```

### Tabela: `dbfatura`
```sql
CREATE TABLE dbfatura (
  codfat VARCHAR(9) PRIMARY KEY,
  denegada VARCHAR(1) DEFAULT 'N',  -- 'S' para códigos 301/302/303
  serie VARCHAR(3),                  -- Série do documento
  nroform VARCHAR(9),                -- Número sequencial
  ...
);
```

---

## 📚 Referências

- [Manual de Integração NF-e](http://www.nfe.fazenda.gov.br/)
- [Manual de Integração NFC-e](http://www.nfce.fazenda.gov.br/)
- [Schemas XSD SEFAZ](https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w=)
