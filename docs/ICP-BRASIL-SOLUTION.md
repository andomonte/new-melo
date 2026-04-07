# 🔐 SOLUÇÃO: CERTIFICADO ICP-BRASIL PARA SEFAZ-AM

## 📋 DIAGNÓSTICO DO PROBLEMA

Após análise completa, identificamos que:

✅ **Certificado existe** no banco de dados (tabela `dadosempresa`)
✅ **Certificado é válido** (não expirado - válido até 30/12/2025)
✅ **Chave privada é válida** (RSA 2048 bits)
❌ **Certificado NÃO É ICP-BRASIL** (requisito obrigatório do SEFAZ-AM)

## 🎯 CAUSA RAIZ DO ERRO 404

O SEFAZ-AM Amazonas **exige autenticação mútua SSL/TLS** com certificados digitais **ICP-Brasil válidos**. O certificado atual, embora válido, não atende a esse requisito específico.

## 📋 REQUISITOS DO SEFAZ-AM

### Certificado Digital
- **Tipo**: ICP-Brasil (Autoridade Certificadora Brasileira)
- **Modelo**: A1 (arquivo) ou A3 (token/cartão)
- **Validade**: Deve estar dentro do prazo de validade
- **Emissor**: Autoridade certificadora credenciada pelo ICP-Brasil

### Autoridades Certificadoras Aceitas
- **SERPRO** (www.serpro.gov.br)
- **SERASA** (www.serasa.com.br)
- **VALID** (www.validcertificadora.com.br)
- **CERTISIGN** (www.certisign.com.br)
- **Outras ACs credenciadas pelo ICP-Brasil**

## 🚀 PLANO DE AÇÃO

### 1. 📞 CONTATAR AUTORIDADE CERTIFICADORA
```
Opções de contato:
• SERPRO: (61) 2021-5000
• SERASA: (11) 3372-4000
• VALID: (11) 5080-3000
• CERTISIGN: 0800-701-2424
```

### 2. 🔐 SOLICITAR CERTIFICADO ICP-BRASIL
```
Informações necessárias:
• CNPJ da empresa: 18.053.139/0001-69
• Razão Social: LEAO DE JUDA SOLUCOES EM TECNOLOGIA EIRELI - ME
• Responsável legal: [Nome do responsável]
• Email para contato
• Telefone para contato
```

### 3. 📁 FORMATOS ACEITOS
```
• A1: Arquivos .p12 ou .pfx (recomendado para servidores)
• A3: Token USB ou cartão inteligente
```

### 4. 💰 CUSTOS APROXIMADOS
```
• Certificado A1: R$ 150-300/ano
• Certificado A3: R$ 200-400/ano
• Validade típica: 1-3 anos
```

## 🔧 IMPLEMENTAÇÃO NO SISTEMA

### Após obter o certificado:

1. **Cadastrar no banco de dados**:
   ```sql
   UPDATE db_manaus.dadosempresa
   SET "certificadoKey" = '[chave_privada_criptografada]',
       "certificadoCrt" = '[certificado_criptografado]'
   WHERE cgc = '18053139000169';
   ```

2. **Verificar cadastro**:
   ```bash
   node scripts/analyze-certificates-node.js
   ```

3. **Testar emissão NFC-e**:
   ```bash
   # Testar em produção com certificado válido
   node scripts/test-production-connectivity.js
   ```

## 🧪 VALIDAÇÃO

### Scripts de teste disponíveis:
- `scripts/analyze-certificates-node.js` - Análise completa
- `scripts/check-db-certificates.js` - Verificação básica
- `scripts/test-production-connectivity.js` - Teste de conectividade

### Resultado esperado após correção:
```
✅ Certificado ICP-Brasil válido detectado
✅ Conexão SSL/TLS estabelecida
✅ NFC-e autorizada pelo SEFAZ-AM
```

## 📞 SUPORTE ADICIONAL

### Contatos SEFAZ-AM:
- **Site**: https://www.sefaz.am.gov.br
- **Suporte**: Contato através do portal
- **Documentação**: https://www.sefaz.am.gov.br/legislacao

### Validação do certificado:
- **ICP-Brasil**: https://www.icpbrasil.gov.br
- **Validação online**: https://validar.iti.gov.br

## ⏰ PRAZOS

- **Urgente**: Obter certificado ICP-Brasil válido
- **Prazo**: Até 65 dias (validade atual expira em 30/12/2025)
- **Teste**: Após instalação do certificado

## ✅ CHECKLIST FINAL

- [ ] Contatar autoridade certificadora
- [ ] Solicitar certificado ICP-Brasil A1
- [ ] Receber e validar arquivos
- [ ] Cadastrar no sistema Melo
- [ ] Testar emissão NFC-e
- [ ] Validar autorização SEFAZ-AM
- [ ] Documentar processo

---

**Status Atual**: ⏳ Aguardando certificado ICP-Brasil válido
**Bloqueador**: Sem certificado compatível com SEFAZ-AM
**Próxima Ação**: Contatar autoridade certificadora</content>
<parameter name="filePath">c:\Users\lucas\Sistema-Melo\site-melo\SOLUCAO-CERTIFICADO-ICP-BRASIL.md