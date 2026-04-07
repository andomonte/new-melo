# Sistema de Emissão Fiscal Automática

## 📋 Visão Geral

O sistema agora identifica automaticamente o tipo de documento fiscal a ser emitido baseado no **documento do destinatário** (CPF ou CNPJ).

### Regras de Emissão

| Documento | Tipo de Documento | Modelo | Descrição |
|-----------|------------------|--------|-----------|
| **CPF** (11 dígitos) | NFC-e | 65 | Nota Fiscal de Consumidor Eletrônica (Cupom Fiscal) |
| **CNPJ** (14 dígitos) | NF-e | 55 | Nota Fiscal Eletrônica |

## 🚀 Como Usar

### Opção 1: API Unificada (Recomendado)

Use o endpoint unificado que decide automaticamente:

```typescript
POST /api/fiscal/emitir

{
  "dbfatura": { ... },
  "dbclien": {
    "cpf_cnpj": "12345678901" // CPF → emite NFC-e
    // ou
    "cpf_cnpj": "12345678901234" // CNPJ → emite NF-e
  },
  "dbitvenda": [ ... ],
  ...
}
```

### Opção 2: APIs Específicas

#### Para NF-e (CNPJ)
```typescript
POST /api/faturamento/emitir
```

#### Para NFC-e / Cupom Fiscal (CPF)
```typescript
POST /api/faturamento/emitir-cupom
```

## 📂 Estrutura de Arquivos

```
src/
├── services/
│   └── fiscal/
│       └── selecionarTipoEmissao.ts    # Lógica de seleção automática
│
├── utils/
│   ├── validarDocumento.ts             # Validação e identificação de CPF/CNPJ
│   ├── gerarXmlCupomFiscal.ts          # Geração do XML da NFC-e
│   ├── enviarCupomParaSefaz.ts         # Envio da NFC-e para SEFAZ
│   ├── gerarPDFCupomFiscal.ts          # Geração do PDF do cupom
│   └── gerarXMLNFe.ts                  # Geração do XML da NF-e (existente)
│
└── pages/api/
    ├── fiscal/
    │   └── emitir.ts                   # Endpoint unificado
    │
    └── faturamento/
        ├── emitir.ts                   # Emissão de NF-e (CNPJ)
        └── emitir-cupom.ts             # Emissão de NFC-e (CPF)
```

## 🔧 Funções Utilitárias

### validarDocumento.ts

```typescript
import { 
  identificarTipoDocumento,
  validarCPF,
  validarCNPJ,
  validarDocumento,
  formatarCPF,
  formatarCNPJ,
  formatarDocumento,
  limparDocumento
} from '@/utils/validarDocumento';

// Identificar tipo
const tipo = identificarTipoDocumento('12345678901'); // 'CPF'
const tipo2 = identificarTipoDocumento('12345678901234'); // 'CNPJ'

// Validar
const cpfValido = validarCPF('123.456.789-01');
const cnpjValido = validarCNPJ('12.345.678/9012-34');
const documentoValido = validarDocumento('12345678901'); // auto-detecta

// Formatar
const cpfFormatado = formatarCPF('12345678901'); // '123.456.789-01'
const cnpjFormatado = formatarCNPJ('12345678901234'); // '12.345.678/9012-34'
```

### selecionarTipoEmissao.ts

```typescript
import { 
  selecionarTipoEmissao,
  deveEmitirNFe,
  deveEmitirNFCe,
  obterModeloDocumento
} from '@/services/fiscal/selecionarTipoEmissao';

// Seleção completa
const selecao = selecionarTipoEmissao('12345678901');
/*
{
  tipoEmissao: 'NFCE',
  modelo: '65',
  descricao: 'Nota Fiscal de Consumidor Eletrônica (NFC-e / Cupom Fiscal)',
  endpoint: '/api/faturamento/emitir-cupom'
}
*/

// Verificações diretas
const emiteNFe = deveEmitirNFe('12345678901234'); // true (CNPJ)
const emiteNFCe = deveEmitirNFCe('12345678901'); // true (CPF)

// Modelo
const modelo = obterModeloDocumento('12345678901'); // '65'
```

## 🎯 Fluxo de Emissão

### NFC-e (CPF)

1. **Validação**: Verifica se é CPF válido
2. **Geração XML**: Cria XML no formato NFC-e (modelo 65)
3. **Assinatura**: Assina digitalmente com certificado A1
4. **Envio SEFAZ**: Envia para homologação/produção
5. **Retorno**: Processa autorização (status 100)
6. **PDF**: Gera cupom fiscal em PDF
7. **Armazenamento**: Salva na tabela `dbfat_nfe` com `modelo = '65'`

### NF-e (CNPJ)

1. **Validação**: Verifica se é CNPJ válido
2. **Geração XML**: Cria XML no formato NF-e (modelo 55)
3. **Assinatura**: Assina digitalmente com certificado A1
4. **Envio SEFAZ**: Envia para homologação/produção
5. **Retorno**: Processa autorização (status 100)
6. **PDF**: Gera DANFE em PDF
7. **Armazenamento**: Salva na tabela `dbfat_nfe` com `modelo = '55'`

## 📊 Diferenças entre NF-e e NFC-e

| Característica | NF-e (Modelo 55) | NFC-e (Modelo 65) |
|----------------|------------------|-------------------|
| **Destinatário** | CNPJ | CPF |
| **Finalidade** | Empresas | Consumidor final |
| **Formato** | A4 (DANFE) | Cupom (80mm ou A4) |
| **QR Code** | Opcional | Obrigatório |
| **Consulta** | Via chave de acesso | Via QR Code |
| **Contingência** | SVC, EPEC | Offline |

## 🔐 Segurança

- Ambos os documentos usam **assinatura digital** (certificado A1)
- Validação de CPF/CNPJ antes da emissão
- Registro de logs completo
- Armazenamento seguro de XMLs

## ⚠️ Validações Importantes

### CPF
- 11 dígitos
- Dígitos verificadores válidos
- Não pode ter todos os dígitos iguais

### CNPJ
- 14 dígitos
- Dígitos verificadores válidos
- Não pode ter todos os dígitos iguais

## 📝 Exemplo Completo de Uso

```typescript
// No frontend ou backend
const emitirDocumentoFiscal = async (fatura, cliente, produtos) => {
  const response = await fetch('/api/fiscal/emitir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dbfatura: fatura,
      dbclien: cliente, // CPF ou CNPJ aqui
      dbitvenda: produtos,
      dbvenda: { ... },
      emitente: { ... }
    })
  });

  const resultado = await response.json();
  
  if (resultado.sucesso) {
    console.log('Documento emitido:', resultado.tipoEmissao);
    console.log('Modelo:', resultado.modelo);
    console.log('Chave:', resultado.chaveAcesso);
    console.log('PDF:', resultado.pdfBase64);
  }
};
```

## 🐛 Troubleshooting

### Erro: "Cliente com CNPJ não pode receber Cupom Fiscal"
- **Causa**: Tentou emitir NFC-e para CNPJ
- **Solução**: Use `/api/faturamento/emitir` ou o endpoint unificado

### Erro: "Documento do destinatário não encontrado"
- **Causa**: CPF/CNPJ não informado
- **Solução**: Verifique se `dbclien.cpf_cnpj` está preenchido

### Status 301/302/303 (Denegada)
- **Causa**: Irregularidade fiscal do emitente/destinatário
- **Solução**: Verificar situação cadastral na Receita Federal

## 📚 Referências

- [Manual NF-e 4.0](http://www.nfe.fazenda.gov.br/)
- [Manual NFC-e](http://www.nfe.fazenda.gov.br/portal/principal.aspx)
- [Validação CPF/CNPJ](https://www.geradorcpf.com/algoritmo_do_cpf.htm)

## 🎉 Conclusão

O sistema agora é **totalmente automático**:
- ✅ Identifica CPF → Emite NFC-e (Cupom Fiscal)
- ✅ Identifica CNPJ → Emite NF-e (Nota Fiscal)
- ✅ Validação automática de documentos
- ✅ APIs unificadas e específicas
- ✅ Logs completos para auditoria
