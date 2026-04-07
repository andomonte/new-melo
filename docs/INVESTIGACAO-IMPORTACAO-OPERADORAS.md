# 🔍 INVESTIGAÇÃO: Sistema de Importação de Arquivos de Operadoras

## 📊 **RESUMO EXECUTIVO**

### ✅ **CONCLUSÃO:**
**NÃO existe sistema de importação de arquivos das operadoras (Cielo/GetNet) no legado**

---

## 🏗️ **ESTRUTURA ATUAL DO SISTEMA**

### 📋 **Oracle - Tabelas:**

#### 1. **DBOPERA** (41 operadoras cadastradas)
```sql
CODOPERA      VARCHAR2(3)   - Código (001-041)
DESCR         VARCHAR2(80)  - Ex: "CIELO - VISA", "SANTANDER - MASTERCARD"
TXOPERA       NUMBER(22)    - Taxa % (0.9% a 3.3%)
PZOPERA       NUMBER(22)    - Prazo dias (3 a 31 dias)
COND_PAGTO    VARCHAR2(5)   - Condição (00-00, 01-01, 02-06, 07-12)
DESATIVADO    NUMBER(22)    - Status (0=ativo, 1=inativo)
CODCLI        VARCHAR2(5)   - Código cliente associado
```

**Operadoras Ativas:**
- **CIELO**: 20 operadoras (diversos cartões/condições)
- **SANTANDER (GetNet)**: 20 operadoras
- **REDECARD**: 1 operadora (desativada)

#### 2. **FIN_CARTAO** (93.804 transações registradas)
```sql
CAR_ID              NUMBER        - ID único
CAR_CODCLI          VARCHAR2      - Código cliente
CAR_VALOR           NUMBER        - Valor bruto
CAR_VLRLIQ          NUMBER        - Valor líquido (após taxa)
CAR_NRODOCUMENTO    VARCHAR2      - Número documento
CAR_NROAUTORIZACAO  VARCHAR2      - Autorização
CAR_NROPARCELA      VARCHAR2      - Parcela
CAR_DATA            DATE          - Data transação
CAR_CODOPERADORA    VARCHAR2      - FK → DBOPERA
```

#### 3. **FIN_CARTAO_RECEB** (132.373 ligações)
```sql
CAR_CAR_ID          NUMBER        - FK → FIN_CARTAO
CAR_COD_RECEB       VARCHAR2      - FK → DBRECEB (contas a receber)
CAR_PARCELA         NUMBER        - Número parcela
```

Vincula transações de cartão → contas a receber

#### 4. **FIN_CARTAO_MENSAGEM_CIELO** (131 registros)
```sql
- Códigos e mensagens de retorno Cielo
- Bandeiras: 001=VISA, 002=MASTERCARD, 003=AMEX, 007=ELO, etc
```

---

### 🔧 **Oracle - Packages/Procedures:**

#### **OPERADORA** (Package Principal)
```sql
PROCEDURE Navega_Operadora        -- Listar operadoras
PROCEDURE Pesq_Operadora          -- Pesquisar operadora  
PROCEDURE Pesq_Opera_Receb        -- Verificar uso em contas a receber
PROCEDURE Inc_Operadora           -- Incluir operadora
PROCEDURE Del_Operadora           -- Deletar operadora
PROCEDURE Alt_Operadora           -- Alterar operadora
```

**Usado em:**
- CAIXA (5 referências)
- CONSULTA (6 referências)
- CONTASFR (2 referências)
- PRECONTASR (7 referências)
- CONFERENCIA (3 referências)

---

### 💻 **Sistema Legado (Delphi):**

#### **Formulário: OPERADORA DE CARTAO**
- Arquivo: `UNIOPERADORA.PAS`
- **Funcionalidade**: Cadastro/manutenção de operadoras
- **NÃO FAZ**: Importação de arquivos

**Operações:**
- Incluir nova operadora
- Alterar dados (taxa, prazo, condição)
- Excluir operadora (valida uso em contas a receber)
- Navegar registros

#### **Formulário: PAGAMENTO CARTAO DE CREDITO**
- Arquivo: `uniPagamentoCartaoCredito.pas`
- **Funcionalidade**: Exibir formas de pagamento/parcelamento
- **NÃO FAZ**: Importação ou registro de transações

---

## 📊 **DADOS ESTATÍSTICOS:**

### **TOP 5 Operadoras por Volume:**
1. **CIELO - MC MAESTRO**: 22.132 transações - R$ 5.459.382,07
2. **CIELO - VISA ELETRON**: 15.138 transações - R$ 4.188.587,33
3. **CIELO - MASTERCARD**: 11.384 transações - R$ 2.667.940,83
4. **CIELO - ELO DEBITO**: 8.863 transações - R$ 2.484.384,10
5. **SANTANDER**: Dados a partir de set/2024

### **Período Histórico:**
- **Primeira transação**: 09/01/2014
- **Última transação**: 01/11/2025
- **Total de valor processado**: ~R$ 35+ milhões

---

## 🚫 **O QUE NÃO EXISTE:**

1. ❌ Importação de arquivos EDI (Cielo/GetNet)
2. ❌ Parser de arquivos .txt das operadoras
3. ❌ Conciliação automática
4. ❌ Procedures de importação de cartão
5. ❌ Telas de upload de arquivos
6. ❌ Histórico de arquivos importados

---

## 💡 **COMO OS DADOS ENTRAM HOJE:**

### **Hipóteses (não confirmado):**
1. **Registro Manual**: Digitação das transações
2. **API/Integração**: Pode existir integração via API (não encontrado no legado)
3. **Importação Externa**: Script/sistema separado não integrado ao ERP
4. **POS/TEF**: Integração direta com terminal de pagamento

---

## 🎯 **PARA IMPLEMENTAR IMPORTAÇÃO:**

### **Seria necessário criar:**

#### 1. **Parser de Arquivos**
- Ler formato EDI das operadoras
- Validar estrutura e dados
- Extrair transações

#### 2. **Mapeamento de Dados**
```
Arquivo → FIN_CARTAO:
- Número documento → CAR_NRODOCUMENTO
- Número autorização → CAR_NROAUTORIZACAO  
- Valor bruto → CAR_VALOR
- Taxa → Calcular CAR_VLRLIQ
- Data → CAR_DATA
- Bandeira/Produto → CAR_CODOPERADORA
- Parcela → CAR_NROPARCELA
```

#### 3. **Vinculação com Contas a Receber**
```
FIN_CARTAO → FIN_CARTAO_RECEB → DBRECEB
- Localizar conta a receber correspondente
- Criar vínculo na FIN_CARTAO_RECEB
- Atualizar status de recebimento
```

#### 4. **Interface de Importação**
- Upload de arquivo
- Preview de dados
- Validação/conciliação
- Confirmação de importação
- Log de processamento

---

## 📁 **FORMATOS DE ARQUIVO CONHECIDOS:**

### **Cielo:**
- EDI (Electronic Data Interchange)
- Layout posicional
- Informações: transações, valores, bandeiras, parcelas

### **GetNet (Santander):**
- TXT com layout próprio
- Similar ao Cielo mas com particularidades

---

## 🔐 **SEGURANÇA/AUDITORIA:**

### **Triggers Ativos:**
- `TRG_AUD_DBRECEB`: Auditoria de contas a receber
- `TRG_DTPREVISAO_DBRECEB`: Atualização de datas
- `XAUD_CONTA_BREMESSA`: Auditoria de remessas

---

## 📝 **RECOMENDAÇÕES:**

### **Investigação Adicional:**
1. Verificar se existe integração via API (não no legado Delphi)
2. Consultar usuários sobre fluxo atual
3. Verificar sistema novo (Next.js) - possível integração

### **Implementação:**
1. Definir prioridade (Cielo vs GetNet vs ambas)
2. Obter layouts de arquivo das operadoras
3. Criar parser no sistema novo (TypeScript)
4. Desenvolver UI de importação
5. Implementar conciliação automática

---

## 🎲 **ARQUIVOS RELACIONADOS NO WORKSPACE:**

### **Scripts de Investigação:**
- `docs/scripts/consultar-contas-receber-oracle.js`
- `docs/scripts/investigar-dbopera.js`
- `docs/scripts/buscar-importacao-operadoras.js`
- `docs/scripts/investigar-fin-cartao.js`

### **Sistema Legado:**
- `projeto legado sistema melo/Formularios/OPERADORA DE CARTAO/`
- `projeto legado sistema melo/Formularios/PAGAMENTO CARTAO DE CREDITO/`

---

**Data da Investigação**: 14/11/2025  
**Investigador**: GitHub Copilot  
**Status**: ✅ COMPLETO
