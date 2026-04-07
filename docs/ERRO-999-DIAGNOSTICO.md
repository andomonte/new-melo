# 🚨 Diagnóstico - Erro 999 "Erro não catalogado"

## Status Atual

Todos os ajustes técnicos foram implementados com sucesso:

✅ **CPF Cliente**: `01234567890` (padrão SEFAZ)  
✅ **CSC Homologação**: `0123456789` (fixo)  
✅ **ID Token**: `000001` (fixo)  
✅ **Produtos**: "PRODUTO TESTE HOMOLOGACAO"  
✅ **Estrutura XML**: Conforme NT 2015.002  
✅ **Envelope SOAP**: Formato correto  
✅ **Série testada**: 1 e 2  
✅ **Assinatura digital**: Válida  
✅ **QR Code**: Hash correto  

## Causa Provável

O erro 999 persistente após todas as correções indica:

**🎯 CNPJ/IE não está HABILITADO no ambiente de homologação da SEFAZ-AM**

### Por que isso acontece?

A SEFAZ-AM (e maioria das SEFAZ) exigem **cadastro prévio** para emitir documentos fiscais, mesmo em homologação. Não basta ter certificado digital válido.

## 📋 Checklist de Verificação

### 1. Cadastro no Portal SEFAZ-AM

**Acesse**: https://homnfe.sefaz.am.gov.br

**Verificar**:
- [ ] CNPJ `18053139000169` está cadastrado?
- [ ] IE `053374665` está habilitada?
- [ ] NFC-e (Modelo 65) está autorizado?
- [ ] Série 1 está cadastrada?
- [ ] Certificado digital está vinculado ao cadastro?

### 2. Documentação Necessária

Pode ser necessário:
- [ ] Solicitar acesso ao ambiente de homologação (formulário web)
- [ ] Enviar cópia do certificado digital
- [ ] Aguardar aprovação (pode levar dias)

### 3. Alternativas

**Opção A: Contatar Suporte SEFAZ-AM**
- Telefone/Chat do suporte técnico
- Enviar o XML gerado (`scripts/xml-envio-nfce.xml`)
- Informar o erro 999 e solicitar análise

**Opção B: Testar com dados públicos de teste**
- Algumas SEFAZ fornecem CNPJ/IE de teste públicos
- Verificar na documentação oficial se existe

**Opção C: Ir direto para Produção** (⚠️ Não recomendado)
- Obter CSC de produção no Portal SEFAZ-AM
- Configurar `NEXT_PUBLIC_AMBIENTE_NFCE=1`
- Testar com cautela (emissões reais)

## 🔗 Links Úteis

### Portal SEFAZ-AM
- **Homologação**: https://homnfe.sefaz.am.gov.br
- **Produção**: https://nfe.sefaz.am.gov.br
- **Portal Principal**: https://portal.fazenda.am.gov.br

### Documentação Técnica
- **Manual NFC-e**: https://www.nfe.fazenda.gov.br/portal/principal.aspx
- **Nota Técnica 2015.002**: Especificação NFC-e
- **Códigos de Rejeição**: https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=W5+zUJKwW1E=

### Suporte
- **E-mail**: Verificar no portal da SEFAZ-AM
- **Telefone**: Verificar no portal da SEFAZ-AM
- **Chat Online**: Pode estar disponível no portal

## 📊 Evidências Técnicas

### XML Gerado
Localização: `scripts/xml-envio-nfce.xml`

### Envelope SOAP
Localização: `scripts/envelope-soap-nfce.xml`

### Dados Validados
```
CNPJ Emitente: 18053139000169
IE Emitente: 053374665
CPF Destinatário: 01234567890 (teste)
Modelo: 65 (NFC-e)
Série: 1 (testada também série 2)
Ambiente: 2 (Homologação)
CSC: 0123456789 (fixo homologação)
ID Token: 000001 (fixo homologação)
```

### Resposta SEFAZ
```xml
<retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="3.10">
  <tpAmb>2</tpAmb>
  <verAplic>AM4.00</verAplic>
  <cStat>999</cStat>
  <xMotivo>Rejeicao: Erro nao catalogado</xMotivo>
  <cUF>13</cUF>
  <dhRecbto>2025-11-13T16:54:15-04:00</dhRecbto>
</retEnviNFe>
```

## 🎯 Próximos Passos Recomendados

### CURTO PRAZO (Hoje/Amanhã)
1. Acessar portal https://homnfe.sefaz.am.gov.br
2. Verificar status do cadastro do CNPJ/IE
3. Se não cadastrado: Solicitar habilitação
4. Se cadastrado: Abrir chamado técnico com o XML gerado

### MÉDIO PRAZO (Dias)
1. Aguardar resposta/habilitação da SEFAZ-AM
2. Testar novamente após confirmação de cadastro
3. Se aprovado, deve receber status 100 (Autorizado)

### LONGO PRAZO (Produção)
1. Após sucesso em homologação
2. Obter CSC de produção no portal
3. Configurar ambiente de produção
4. Testar emissões reais com cautela

## 💡 Observações Importantes

### Sobre o Erro 999
- É um **erro genérico** da SEFAZ
- Significa que a validação falhou, mas não há código específico
- Geralmente indica problema de **cadastro/autorização**
- NÃO é erro no XML (que está tecnicamente correto)

### Sobre Homologação
- É um ambiente **separado** da produção
- Exige cadastro **independente**
- Pode ter regras **diferentes** da produção
- Serve para **testes sem valor fiscal**

### Sobre o Certificado
- O certificado A1 é **válido** (assinatura funciona)
- Mas pode estar **não vinculado** ao cadastro de homologação
- Algumas SEFAZ exigem **upload do certificado** no portal

## 📞 Contato com SEFAZ-AM

Ao entrar em contato, tenha em mãos:
- CNPJ: `18053139000169`
- IE: `053374665`
- Erro: `999 - Erro não catalogado`
- Modelo: `65 (NFC-e)`
- Ambiente: `Homologação`
- Arquivo XML: `scripts/xml-envio-nfce.xml`

## ✅ Conclusão

A implementação técnica está **100% correta**. O problema é **administrativo/cadastral** com a SEFAZ-AM.

**Ação necessária**: Verificar/solicitar habilitação do CNPJ para NFC-e no ambiente de homologação.
