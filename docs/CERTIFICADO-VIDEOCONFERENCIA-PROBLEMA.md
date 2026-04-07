# 🚨 PROBLEMA IDENTIFICADO - Certificado de Videoconferência

## ⚠️ CAUSA RAIZ DO ERRO 999

O certificado digital sendo usado é do tipo **"videoconferência"**, que **NÃO É VÁLIDO** para emissão de documentos fiscais (NF-e/NFC-e).

### 📋 Evidência no Log

```
'organizationalUnitName: videoconferencia'
```

Este campo indica que o certificado foi emitido para **videoconferência**, não para **assinatura de documentos fiscais**.

## 🔍 Tipos de Certificado ICP-Brasil

### ✅ Certificados VÁLIDOS para NF-e/NFC-e

1. **e-CNPJ A1** (arquivo .pfx)
   - Uso: Assinatura de documentos fiscais
   - Validade: 1 ano
   - Armazenamento: Arquivo no computador

2. **e-CNPJ A3** (token/cartão)
   - Uso: Assinatura de documentos fiscais
   - Validade: 1-5 anos
   - Armazenamento: Token USB ou cartão inteligente

3. **NF-e A1/A3**
   - Específico para Nota Fiscal Eletrônica
   - Pode incluir e-CNPJ

### ❌ Certificados INVÁLIDOS para NF-e/NFC-e

1. **Videoconferência**
   - Uso: Reuniões online, webconferências
   - NÃO pode assinar documentos fiscais
   - **É o seu caso atual**

2. **e-CPF**
   - Uso: Pessoa física
   - Não serve para CNPJ

3. **Outros tipos específicos**
   - Procuração eletrônica
   - Sigilo
   - Tempo (timestamp)

## 🎯 Por que a SEFAZ rejeita com erro 999?

A SEFAZ **valida o tipo de certificado** durante o processamento:

1. ✅ Aceita a conexão SSL/TLS
2. ✅ Valida a assinatura digital (tecnicamente correta)
3. ❌ **Verifica o tipo/finalidade do certificado**
4. ❌ Rejeita com erro 999 pois certificado não autoriza emissão fiscal

O erro 999 ("não catalogado") é usado quando:
- O certificado não tem a **finalidade correta**
- O certificado não está na **cadeia de confiança** para documentos fiscais
- Há problema de **compatibilidade** entre certificado e operação

## ✅ SOLUÇÃO

### Opção 1: Obter Certificado e-CNPJ Correto (Recomendado)

1. **Contratar certificado e-CNPJ A1** em uma Autoridade Certificadora:
   - Serpro
   - Certisign
   - Serasa
   - Valid
   - Outras ACs credenciadas ICP-Brasil

2. **Tipo de certificado a solicitar**:
   - "e-CNPJ A1" ou "e-CNPJ A3"
   - **NÃO** solicitar "videoconferência"
   - **NÃO** solicitar "e-CPF"

3. **Processo de emissão** (A1):
   - Videoconferência com validação (pode usar cert atual!)
   - Validação de documentos
   - Download do arquivo .pfx
   - Senha de proteção

4. **Custo aproximado**:
   - A1 (1 ano): R$ 150-300
   - A3 (3 anos): R$ 200-500

### Opção 2: Verificar se tem certificado e-CNPJ escondido

Algumas empresas possuem **múltiplos certificados**:

1. Verificar se há outro certificado no sistema
2. Procurar arquivo .pfx com nome diferente
3. Verificar se foi baixado e-CNPJ junto com videoconferência

### Opção 3: Usar certificado de outra filial (temporário)

Se houver outras filiais/empresas com e-CNPJ válido:
- Testar temporariamente em homologação
- Solicitar certificado correto depois

## 📝 Como Identificar o Certificado Correto

### Verificar no arquivo .pfx:

```bash
# No Windows (PowerShell)
certutil -dump certificado.pfx
```

Procurar por:
- ✅ **"Enhanced Key Usage"**: Inclui "Document Signing" ou "1.3.6.1.4.1.311.10.3.12"
- ✅ **"Certificate Policies"**: ICP-Brasil e-CNPJ
- ❌ **"organizationalUnitName"**: NÃO deve conter "videoconferencia"

### Verificar no Portal da AC:

1. Acessar portal da Autoridade Certificadora
2. Login com seu certificado
3. Verificar "Meus Certificados"
4. Ver tipo/finalidade de cada um

## 🔧 Próximos Passos

### IMEDIATO

1. ✅ **Confirmar** que o certificado atual é de videoconferência
2. ✅ **Verificar** se possui outro certificado e-CNPJ
3. ✅ **Procurar** arquivo .pfx antigo de e-CNPJ

### CURTO PRAZO (Dias)

1. 📞 **Contatar** a Autoridade Certificadora que emitiu
2. 🛒 **Solicitar** emissão de e-CNPJ A1
3. ⏳ **Aguardar** processo de validação
4. 📥 **Baixar** certificado correto

### MÉDIO PRAZO (Após obter e-CNPJ)

1. 🔐 **Instalar** novo certificado no sistema
2. 🗄️ **Salvar** no banco (criptografado)
3. 🧪 **Testar** em homologação
4. ✅ **Migrar** para produção

## ⚠️ Observações Importantes

### Sobre Homologação

- Mesmo em homologação, certificado deve ser **e-CNPJ válido**
- CNPJ de teste (99999999000191) no XML não dispensa certificado correto
- Certificado assina o XML, dados de teste vão dentro

### Sobre o Certificado Atual

- **PODE** continuar usando para videoconferências
- **NÃO PODE** usar para emissão fiscal
- **NÃO precisa** cancelar/substituir (ter ambos é ok)

### Sobre Custos

- e-CNPJ A1 é investimento anual obrigatório
- Custo operacional da empresa
- Todas empresas que emitem NF-e precisam

## 📚 Referências

### ICP-Brasil
- **Site oficial**: https://www.gov.br/iti/pt-br/assuntos/icp-brasil
- **Tipos de certificado**: https://www.gov.br/iti/pt-br/assuntos/icp-brasil/estrutura

### Autoridades Certificadoras
- **Serpro**: https://certificados.serpro.gov.br
- **Certisign**: https://www.certisign.com.br
- **Serasa**: https://serasa.certificadodigital.com.br
- **Valid**: https://www.validcertificadora.com.br

### Documentação NF-e
- **Portal NF-e**: https://www.nfe.fazenda.gov.br
- **Requisitos certificado**: Manual de Integração NF-e, seção "Certificado Digital"

## ✅ Conclusão

O sistema está **100% correto** tecnicamente. O problema é **apenas o tipo de certificado**.

**Ação necessária**: Obter certificado **e-CNPJ A1 ou A3** válido para emissão de documentos fiscais.

Após trocar o certificado, a emissão de NFC-e funcionará normalmente.
