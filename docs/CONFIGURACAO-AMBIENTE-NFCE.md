# 🎫 Configuração de Ambiente para NFC-e (Cupom Fiscal)

## Variável de Ambiente

Para controlar o ambiente de emissão de NFC-e, adicione no seu arquivo `.env.local`:

```bash
# Ambiente de NFC-e
# 1 = Produção, 2 = Homologação
NEXT_PUBLIC_AMBIENTE_NFCE=2
```

## Diferenças entre Ambientes

### 🧪 Homologação (NEXT_PUBLIC_AMBIENTE_NFCE=2)

**Dados Ajustados Automaticamente:**

- **CNPJ do Emitente**: `99999999000191` (CNPJ de teste padrão NFC-e)
- **IE do Emitente**: `999999999` (IE de teste - 9 dígitos)
- **Nome do Emitente**: `NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL`
- **CPF do Cliente**: `01234567890` (padrão SEFAZ - obrigatório)
- **Nome dos Produtos**: `PRODUTO TESTE HOMOLOGACAO`
- **CSC (Código de Segurança)**: `0123456789` ⚠️ **FIXO** conforme Portal SEFAZ-AM
- **ID Token CSC**: `000001` ⚠️ **FIXO** conforme Portal SEFAZ-AM
- **tpAmb**: `2` (Homologação)
- **URL SEFAZ**: `https://homnfe.sefaz.am.gov.br`

**⚠️ IMPORTANTE - Conforme Manual NFC-e:**

> *"Para homologação, utilize CNPJ de teste 99999999000191 e IE de teste. Não é necessário cadastro prévio na SEFAZ para este CNPJ."*

**⚠️ IMPORTANTE - CSC Conforme Portal SEFAZ-AM:**

> *"Usuários do ambiente de desenvolvedores deverão utilizar o valor fixo "0123456789" para o CSC e o identificador "000001"."*

Estes valores são **obrigatórios e fixos** para homologação, não podendo ser alterados.

**Observações:**

- CNPJ de teste: `99999999000191` (fictício, público)
- IE de teste: `999999999` (9 dígitos)
- CPF de teste: `01234567890` (11 dígitos)
- Produtos devem conter "TESTE" ou "HOMOLOGACAO" no nome
- CSC e ID Token são sempre fixos em homologação (não vem do banco)
- **Nome do emitente será alterado** para indicar ambiente de teste

### 🏭 Produção (NEXT_PUBLIC_AMBIENTE_NFCE=1)

**Dados Reais:**

- **CPF do Cliente**: Valor real do cliente
- **Nome dos Produtos**: Descrição real dos produtos
- **CSC**: Código real cadastrado na SEFAZ (campo `csc_nfce_producao` no banco)
- **ID Token CSC**: ID Token real (campo `csc_nfce_id` no banco)
- **tpAmb**: `1` (Produção)
- **URL SEFAZ**: `https://nfe.sefaz.am.gov.br`

**⚠️ IMPORTANTE:**

- Só altere para produção após obter CSC e ID Token reais da SEFAZ
- Os valores devem estar cadastrados na tabela `db_manaus.dadosempresa`:
  - `csc_nfce_producao`: CSC criptografado
  - `csc_nfce_id`: ID do Token
- Certifique-se de que o certificado digital está válido
- Teste extensivamente em homologação antes de migrar

## Como Trocar de Ambiente

1. Edite o arquivo `.env.local` (criar se não existir)
2. Altere o valor de `NEXT_PUBLIC_AMBIENTE_NFCE`:
   - `2` para Homologação (padrão)
   - `1` para Produção
3. Reinicie o servidor Next.js (`npm run dev`)

## Resolução de Erros Comuns

### Erro 999 (Erro não catalogado)
- **Causa**: Geralmente ocorre em homologação quando dados de teste não são usados
- **Solução**: Verifique se `NEXT_PUBLIC_AMBIENTE_NFCE=2` está configurado
- **Validação**: Cheque nos logs se vê: `🌐 Ambiente: HOMOLOGAÇÃO`

### CPF Inválido
- **Homologação**: Use sempre `0123456789`
- **Produção**: CPF real do cliente

### Rejeição 610 (Chave de Acesso difere)
- Verifique se o certificado está correto
- Confira se a data/hora está no formato correto
- Valide o QR Code no console

## Logs para Debug

Os logs vão indicar o ambiente:
```
🌐 Ambiente: HOMOLOGAÇÃO
🔧 Ajustando dados para ambiente de HOMOLOGAÇÃO...
📝 CPF ajustado: 74978004268 → 0123456789 (teste)
📦 1 produto(s) ajustado(s) para teste
🔐 CSC e ID Token configurados para homologação
```

## Referências

- [Portal NFC-e SEFAZ-AM](https://portal.fazenda.am.gov.br/nfe/)
- [Manual de Integração NFC-e](https://www.nfe.fazenda.gov.br/portal/principal.aspx)
- [Nota Técnica 2015.002 - NFC-e](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=pjgJQRumLFg=)
