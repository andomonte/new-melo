# 📡 Endpoints SEFAZ Amazonas (AM) - Versão 4.00

## 🎫 NFC-e (Nota Fiscal de Consumidor Eletrônica - Modelo 65)

### Homologação (Testes)
```
https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4
```

### Produção (Validade Jurídica)
```
https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4
```

---

## 📄 NF-e (Nota Fiscal Eletrônica - Modelo 55)

### Homologação (Testes)
```
https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4
```

### Produção (Validade Jurídica)
```
https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4
```

---

## 🔍 Outros Serviços (para implementação futura)

### Consulta Protocolo
- Homologação: `https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4`
- Produção: `https://nfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4`

### Consulta Cadastro
- Homologação: `https://homnfce.sefaz.am.gov.br/nfce-services/services/CadConsultaCadastro4`
- Produção: `https://nfce.sefaz.am.gov.br/nfce-services/services/CadConsultaCadastro4`

### Status Serviço
- Homologação: `https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4`
- Produção: `https://nfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4`

### Inutilização de Número
- Homologação: `https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeInutilizacao4`
- Produção: `https://nfce.sefaz.am.gov.br/nfce-services/services/NfeInutilizacao4`

---

## 📝 Observações Importantes

1. **WSDL**: Algumas bibliotecas SOAP podem exigir `?wsdl` no final da URL
   - Exemplo: `https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4?wsdl`

2. **Diferença de Endpoints**:
   - NFC-e: `/nfce-services/services/`
   - NF-e: `/services2/services/`

3. **Modelo do Documento**:
   - NFC-e: `<mod>65</mod>` no XML
   - NF-e: `<mod>55</mod>` no XML

4. **Ambiente de Testes**:
   - Usar `<tpAmb>2</tpAmb>` para homologação
   - Usar `<tpAmb>1</tpAmb>` para produção

5. **Processamento**:
   - NFC-e: Geralmente usa `<indSinc>1</indSinc>` (síncrono)
   - NF-e: Pode usar `<indSinc>0</indSinc>` (assíncrono) ou `1` (síncrono)

---

## 🔗 Fontes

- Portal NFC-e SEFAZ-AM: `portalnfce.sefaz.am.gov.br`
- DFE Portal Amazonas
- Manual de Integração NFC-e versão 4.00

---

## 🚀 Status de Implementação

- ✅ **NF-e (modelo 55)**: Implementado e funcionando
- ✅ **NFC-e (modelo 65)**: Implementado (em teste)
- ⏳ **Consulta Protocolo**: Pendente
- ⏳ **Inutilização**: Pendente
- ⏳ **Status Serviço**: Pendente
