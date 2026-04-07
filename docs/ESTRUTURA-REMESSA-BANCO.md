# 📋 ESTRUTURA DE REMESSA - BANCO ORACLE

## 🗂️ **TABELAS PRINCIPAIS**

### **1. DBREMESSA_ARQUIVO** (Cabeçalho da Remessa)
Armazena informações sobre arquivos de remessa gerados.

**Campos:**
- `CODREMESSA` - Código único da remessa (PK)
- `BANCO` - Código do banco ('0'=Bradesco, '1'=BB, '2'=Itaú, etc.)
- `DATA_GERADO` - Data de geração do arquivo
- `NOME_ARQUIVO` - Nome do arquivo gerado
- `USUARIO_IMPORTACAO` - Usuário que importou/gerou
- `CODBODERO` - Código do borderô associado

---

### **2. DBREMESSA_DETALHE** (Detalhes da Remessa)
Armazena os títulos/boletos incluídos na remessa.

**Campos:**
- `CODREMESSA` - FK para DBREMESSA_ARQUIVO
- `NROSEQ` - Número sequencial do registro
- `CODCLI` - Código do cliente
- `CODRECEB` - Código do título (FK para DBRECEB)
- `NROBANCO` - Nosso número do banco
- `DOCUMENTO` - Número do documento
- `REGISTRO` - Linha CNAB completa
- `CONTA` - Conta bancária utilizada
- `VALOR` - Valor do título
- `ABATIMENTO` - Valor de abatimento

---

### **3. TABELAS DE BORDERÔ (por Banco)**

Cada banco tem suas próprias tabelas de borderô:

- **`DBBODERO_BRADESCO`** - Borderô Bradesco
- **`DBBODEROBBS`** - Borderô Banco do Brasil
- **`DBBODERO`** - Borderô genérico (Itaú, Rural, Santander)
- **`DBBODEROSAFRA`** - Borderô Safra
- **`DBBODERO_CITIBANK`** - Borderô Citibank
- **`DBBODERO_CAIXA`** - Borderô Caixa Econômica

**Estrutura comum:**
- `COD_BODERO` - Código do borderô (PK)
- `COD_CONTA` - Conta bancária
- `DTINICIAL` - Data inicial dos títulos
- `DTFINAL` - Data final dos títulos
- `DTEMISSAO` - Data de emissão do borderô
- `CANCEL` - Flag de cancelamento ('S'/'N')

---

### **4. TABELAS DE DOCUMENTOS DO BORDERÔ**

- **`DBDOCBODERO_BRADESCO`**
- **`DBDOCBODEROBB`**
- **`DBDOCBODERO`**
- **`DBDOCBODEROSAFRA`**
- **`DBDOCBODERO_CITIBANK`**
- **`DBDOCBODERO_CAIXA`**
- **`DBDOCBODERO_BAIXA_BANCO`** - Controla títulos para baixa

**Estrutura comum:**
- `COD_BODERO` - FK para borderô
- `COD_RECEB` - FK para título
- `OPERACAO` - Tipo: 'I'=Inclusão, 'D'=Baixa, 'V'=Alteração Vencimento
- `VALOR` - Valor do título
- `DT_VENC` - Data de vencimento
- `DIGITO` - Dígito verificador do nosso número
- `EXPORT` - Flag de exportação (0/1)

---

## 🔧 **PROCEDURES PRINCIPAIS**

### **PACKAGE: REMESSA_BOLETO**

#### **1. SELECIONA_REMESSA**
```sql
PROCEDURE SELECIONA_REMESSA(
  vdt1 IN DATE,              -- Data inicial
  vdt2 IN DATE,              -- Data final
  vBanco IN VARCHAR2,        -- Código do banco
  vcodconta IN VARCHAR2,     -- Código da conta
  cursor OUT CURSORGENERICO
)
```

**Função:** Seleciona títulos para remessa bancária (CNAB).

**Retorna:** 
- Títulos novos (para inclusão)
- Títulos para baixa (já pagos)
- Títulos para prorrogação (vencimento alterado)

**Campos retornados:**
- Dados do cliente (CPF/CNPJ, nome, endereço)
- Dados do título (número, valor, vencimento)
- Dados bancários (nosso número, carteira, convenio)
- Situação: "REMESSA", "BAIXAR TITULO", "PRORROGAR TITULO"

---

#### **2. ARQUIVO_INC**
```sql
PROCEDURE ARQUIVO_INC(
  vBanco IN VARCHAR2,
  vData IN DATE,
  vNome_Arquivo IN VARCHAR2,
  vUsuario_Importacao IN VARCHAR2,
  vCodBodero IN VARCHAR2,
  vCodigo OUT NUMBER         -- Retorna código da remessa
)
```

**Função:** Cria registro de arquivo de remessa em `DBREMESSA_ARQUIVO`.

---

#### **3. DETALHE_INC**
```sql
PROCEDURE DETALHE_INC(
  vCodRemessa IN NUMBER,
  vNroSeq IN NUMBER,
  vCodcli IN VARCHAR2,
  vCodReceb IN VARCHAR2,
  vNroBanco IN VARCHAR2,
  vDocumento IN VARCHAR2,
  vRegistro IN LONG,         -- Linha CNAB
  vConta IN VARCHAR2,
  vValor IN NUMBER,
  vAbatimento IN NUMBER
)
```

**Função:** Insere detalhe de título na `DBREMESSA_DETALHE`.

---

#### **4. BODERO_INC**
```sql
PROCEDURE BODERO_INC(
  vBanco IN VARCHAR2,
  vDtInicial IN DATE,
  vDtFinal IN DATE,
  vDtEmissao IN DATE,
  vTipoDocumento IN VARCHAR2,  -- 'FAG' ou 'NOTA FISCAL'
  vCodBodero OUT VARCHAR2
)
```

**Função:** Cria borderô na tabela específica do banco.

**Lógica:**
- Identifica conta correta por tipo de documento
- Gera código sequencial do borderô
- Insere registro na tabela do banco

---

#### **5. DOCBODERO_INC**
```sql
PROCEDURE DOCBODERO_INC(
  vBanco IN VARCHAR2,
  vCodBodero IN VARCHAR2,
  vCodReceb IN VARCHAR2,
  vDigito IN VARCHAR2,
  vOperacao IN VARCHAR2      -- 'I', 'D', 'V'
)
```

**Função:** Adiciona título ao borderô.

**Operações:**
- **'I'** - Inclusão: Marca `BRADESCO='S'` no título
- **'D'** - Baixa: Marca `EXPORT=1` em `DBDOCBODERO_BAIXA_BANCO`
- **'V'** - Alteração: Atualiza vencimento/valor

---

#### **6. ROLLBACK_ALL**
```sql
PROCEDURE ROLLBACK_ALL(
  vBanco IN VARCHAR2,
  vCodBodero IN VARCHAR2
)
```

**Função:** Reverte remessa gerada.
- Deleta registros de borderô
- Remove flags de exportação dos títulos
- Limpa `DBREMESSA_ARQUIVO` e `DBREMESSA_DETALHE`

---

#### **7. DIGITO_DOCUMENTO**
```sql
FUNCTION DIGITO_DOCUMENTO(
  vCodConta IN VARCHAR2,
  vNro_Banco IN VARCHAR2,
  vBanco IN VARCHAR2,
  vDtEmissao IN DATE
) RETURN VARCHAR2
```

**Função:** Calcula dígito verificador do nosso número por banco.

**Implementa algoritmos para:**
- Bradesco (módulo 11)
- Banco do Brasil (módulo 11)
- Itaú (módulo 10)
- Rural, Santander, Safra, Citibank, Caixa

---

#### **8. CONVENIOBB / VARIACAOBB**
```sql
FUNCTION CONVENIOBB(
  vCodConta IN VARCHAR2,
  vDtEmissao IN DATE
) RETURN VARCHAR2

FUNCTION VARIACAOBB(
  vCodConta IN VARCHAR2,
  vDtEmissao IN DATE
) RETURN VARCHAR2
```

**Função:** Retorna convênio e variação do Banco do Brasil.
- Convênio unificado: `2552433`
- Variação: `167`
- Para datas antigas, busca em `DBCONVENIOBB`

---

## 🔄 **PROCEDURE: SELECIONA_REMESSA_EQUIFAX**

```sql
PROCEDURE SELECIONA_REMESSA_EQUIFAX(
  dtini IN DATE,
  dtfim IN DATE,
  vCURSOR OUT CURSORGENERICO
)
```

**Função:** Gera arquivo de remessa para bureau de crédito Equifax.

**Retorna:**
- Títulos emitidos (não pagos) entre datas
- Títulos pagos entre datas
- Dados formatados para envio ao Equifax

---

## 🏦 **CÓDIGOS DE BANCO**

| Código | Banco |
|--------|-------|
| '0' | Bradesco |
| '1' | Banco do Brasil |
| '2' | Itaú |
| '3' | Rural |
| '5' | Santander |
| '6' | Safra |
| '7' | Citibank |
| '8' | Caixa Econômica Federal |

---

## 📊 **CARTEIRAS POR BANCO**

| Banco | Código Carteira |
|-------|----------------|
| Bradesco | '009' |
| Banco do Brasil | '17' |
| Itaú | '109' |
| Rural | '1' |
| Santander | '5' |
| Safra | '2' |
| Citibank | '2' |
| Caixa | '12' |

---

## 🔐 **CÓDIGOS DE EMPRESA (Cedente)**

| Banco | Código Empresa |
|-------|---------------|
| Bradesco (0006) | 00000000000000040723 |
| Bradesco (outros) | 00000000000000197033 |
| Rural | 00200600020411 |
| Santander | 14030000956001300233 |
| Citibank | 09163309163300190314 |
| Caixa | 1043870000002347 |

---

## 🔄 **FLUXO DE GERAÇÃO DE REMESSA**

### **1. Preparação:**
```sql
-- Criar borderô
BODERO_INC('BANCO BRADESCO', '01/11/2025', '30/11/2025', SYSDATE, 'FAG', vCodBodero);

-- Criar arquivo de remessa
ARQUIVO_INC('0', SYSDATE, 'CB011125.REM', 'USUARIO', vCodBodero, vCodRemessa);
```

### **2. Selecionar Títulos:**
```sql
SELECIONA_REMESSA('01/11/2025', '30/11/2025', '0', '0003', vCursor);
```

### **3. Para cada título:**
```sql
-- Adicionar ao borderô
DOCBODERO_INC('BANCO BRADESCO', vCodBodero, vCodReceb, vDigito, 'I');

-- Adicionar detalhe à remessa
DETALHE_INC(vCodRemessa, vSeq, vCodCli, vCodReceb, vNroBanco, ...);
```

### **4. Gerar arquivo CNAB (fora do Oracle)**

### **5. Em caso de erro:**
```sql
ROLLBACK_ALL('BANCO BRADESCO', vCodBodero);
```

---

## 📝 **OBSERVAÇÕES IMPORTANTES**

1. **Flag BRADESCO:**
   - Mesmo nome, mas usado para todos os bancos
   - 'N' = Não enviado na remessa
   - 'S' = Já enviado na remessa
   - 'B' = Situação especial

2. **Nosso Número:**
   - Campo `NRO_BANCO` na `DBRECEB`
   - Calculado com dígito verificador
   - Formato varia por banco

3. **Operações no Borderô:**
   - **I** - Inclusão de novo título
   - **D** - Baixa de título pago
   - **V** - Alteração de vencimento/valor

4. **Controle de Exportação:**
   - `DBDOCBODERO_BAIXA_BANCO.EXPORT`
   - 0 = Não exportado
   - 1 = Exportado (não gerar novamente)

5. **Data de Convenio Unificado:**
   - Banco do Brasil mudou formato
   - Usar `DTCONVENIO_UNIFICADO` como referência

---

## 🎯 **PRÓXIMOS PASSOS PARA IMPLEMENTAÇÃO**

1. ✅ Mapear estrutura Oracle → PostgreSQL
2. ✅ Criar migrations para tabelas de remessa
3. ✅ Implementar APIs para geração de arquivo CNAB
4. ✅ Interface para seleção de títulos
5. ✅ Visualização de remessas geradas
6. ✅ Download de arquivo CNAB 240/400
7. ✅ Rollback de remessas
8. ✅ Histórico de exportações
