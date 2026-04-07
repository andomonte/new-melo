# Compras Internacionais - Sistema Legado Oracle

## Visão Geral

O sistema legado Oracle possui um módulo completo de **Compras Internacionais** (importação) que gerencia todo o fluxo desde a Declaração de Importação (DI) até a entrada dos produtos no estoque com cálculo de custo em dólar/real.

## Packages Oracle Principais

| Package | Função |
|---------|--------|
| `ENTRADA_IMPORTACAO` | Gerenciamento de entradas de importação, cálculo de custos, geração de DI |
| `AUTO_DESEMBARACO` | Controle do Desembaraço Eletrônico SEFAZ-AM |
| `DECLARACAO_IMPORTACAO` | Processamento de Declarações de Importação |
| `ORDEM_COMPRA` | Requisições e ordens de compra (nacionais e internacionais) |

## Tabelas do Sistema

### Tabela Principal: `DBENT_IMPORTACAO`

Armazena os dados da Declaração de Importação:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `ID` | NUMBER | ID único da importação (formato: FAAAAMMNNNN) |
| `NRO_DI` | VARCHAR2(50) | Número da Declaração de Importação |
| `DATA_DI` | DATE | Data da DI |
| `STATUS` | VARCHAR2(1) | N=Nova, E=Entrada gerada, C=Cancelada |
| `TAXA_DOLAR` | NUMBER(9,6) | Taxa do dólar no momento da DI |
| `TOTAL_MERCADORIA` | NUMBER(11,2) | Valor total das mercadorias em USD |
| `THC` | NUMBER(11,2) | Terminal Handling Charge |
| `FRETE` | NUMBER(11,2) | Frete internacional |
| `TOTAL_CIF` | NUMBER(11,2) | Valor CIF (Cost + Insurance + Freight) |
| `PIS` | NUMBER(11,2) | PIS-Importação |
| `COFINS` | NUMBER(11,2) | COFINS-Importação |
| `II` | NUMBER(11,2) | Imposto de Importação |
| `IPI` | NUMBER(11,2) | IPI |
| `ICMS_ST` | NUMBER(11,2) | ICMS-ST |
| `ANUENCIA` | NUMBER(11,2) | Taxa de anuência |
| `SISCOMEX` | NUMBER(11,2) | Taxa SISCOMEX |
| `CONTRATO_CAMBIO` | NUMBER(11,2) | Valor contrato de câmbio (USD) |
| `DESPACHANTE` | NUMBER(11,2) | Honorários do despachante |
| `FRETEORIGEM_TOTAL` | NUMBER(11,2) | Frete origem total |
| `INFRAERO_PORTO` | NUMBER(11,2) | Taxas aeroportuárias/portuárias |
| `CARRETEIRO_EADI` | NUMBER(11,2) | Frete carreteiro EADI |
| `CARRETEIRO_MELO` | NUMBER(11,2) | Frete carreteiro Melo |
| `EADI` | NUMBER(11,2) | Estação Aduaneira do Interior |

### Tabela: `DBENT_IMPORTACAO_IT_ENT` (Itens)

Itens da importação com cálculos detalhados:

| Coluna | Descrição |
|--------|-----------|
| `CODPROD` | Código do produto |
| `ID_ORC` | ID da Ordem de Compra |
| `QTD` | Quantidade |
| `PROFORMA_UNIT` | Preço unitário da Proforma (USD) |
| `PROFORMA_TOTAL` | Total Proforma (USD) |
| `INVOICE_UNIT` | Preço unitário Invoice (USD) |
| `INVOICE_TOTAL` | Total Invoice (USD) |
| `REAL_UNIT` | Valor unitário em Reais |
| `REAL_TOTAL` | Total em Reais |
| `DESPESA_PERC` | % de rateio de despesas |
| `DESPESA_TOTAL` | Despesas rateadas (R$) |
| `DESPESA_UNIT` | Despesa unitária (R$) |
| `ICMS_PERC` | % de rateio ICMS |
| `ICMS_TOTAL` | ICMS rateado (R$) |
| `ICMS_UNIT` | ICMS unitário (R$) |
| `PIS_COFINS_TOTAL` | PIS/COFINS rateado |
| `CUSTO_UNIT_REAL` | **Custo unitário final em Reais** |
| `CUSTO_TOTAL_REAL` | Custo total em Reais |
| `CUSTO_UNIT_DOLAR` | **Custo unitário final em Dólares** |
| `TX_DOLAR_DI` | Taxa do dólar da DI |
| `TX_DOLAR_MEDIO` | Taxa média ponderada dos contratos |
| `NF_UNIT` | Valor unitário para NF |
| `NF_TOTAL` | Valor total para NF |

### Tabela: `DBENT_IMPORTACAO_CONTRATOS`

Contratos de câmbio associados à importação:

| Coluna | Descrição |
|--------|-----------|
| `ID_IMPORTACAO` | FK para DBENT_IMPORTACAO |
| `DATA` | Data do contrato |
| `TAXA_DOLAR` | Taxa do dólar do contrato |
| `VL_MERC_DOLAR` | Valor em USD coberto pelo contrato |
| `CONTRATO` | Número do contrato de câmbio |

### Tabela: `DBENT_IMPORTACAO_ENTRADA`

Entradas de estoque geradas pela importação:

| Coluna | Descrição |
|--------|-----------|
| `ID_IMPORTACAO` | FK para DBENT_IMPORTACAO |
| `COD_CREDOR` | Código do fornecedor estrangeiro |
| `COD_CLIENTE` | Cliente (para DI de saída) |
| `CODENT` | Código da entrada no estoque |
| `COD_COMPRADOR` | Comprador responsável |

## Fórmulas de Cálculo de Custo

### Variáveis Globais (da DI)

```sql
-- Taxa média ponderada dos contratos de câmbio
vTxDolarMedio = SUM(taxa_dolar * vl_merc_dolar) / SUM(vl_merc_dolar)

-- Adicional de segurança na taxa (10 centavos)
vTxDolarAdicional = 0.10

-- Total de despesas para custo
vDespesaCusto = PIS + COFINS + II + IPI + ANUENCIA + SISCOMEX
              + (TAXA_DOLAR * CONTRATO_CAMBIO)
              + DESPACHANTE + FRETEORIGEM_TOTAL + INFRAERO_PORTO
              + CARRETEIRO_EADI + CARRETEIRO_MELO + EADI

-- Fator CIF (para rateio de THC + Frete)
vIMP_PERC = ((THC + FRETE) / TOTAL_MERCADORIA) + 1

-- Percentual ICMS-ST
vIMP_ICMS_PERC = ICMS_ST / (TOTAL_CIF * TAXA_DOLAR)
```

### Cálculo por Item

```sql
-- Totais do item
PROFORMA_TOTAL = QTD * PROFORMA_UNIT
INVOICE_TOTAL = QTD * INVOICE_UNIT

-- Conversão para Reais (com adicional de segurança)
REAL_UNIT = PROFORMA_UNIT * (TX_DOLAR_MEDIO + 0.10)
REAL_TOTAL = PROFORMA_TOTAL * (TX_DOLAR_MEDIO + 0.10)

-- Rateio de despesas proporcional ao valor do item
DESPESA_PERC = INVOICE_TOTAL / TOTAL_MERCADORIA
DESPESA_TOTAL = DESPESA_PERC * vDespesaCusto
DESPESA_UNIT = DESPESA_TOTAL / QTD

-- Rateio de ICMS-ST
ICMS_PERC = INVOICE_TOTAL / TOTAL_MERCADORIA
ICMS_TOTAL = ICMS_ST * ICMS_PERC
ICMS_UNIT = ICMS_TOTAL / QTD

-- CUSTO FINAL em Reais
CUSTO_UNIT_REAL = REAL_UNIT + DESPESA_UNIT + ICMS_UNIT + PIS_COFINS_UNIT

-- CUSTO FINAL em Dólares (para registro no produto)
CUSTO_UNIT_DOLAR = CUSTO_UNIT_REAL / (TX_DOLAR_MEDIO + 0.10)
```

### Valores para Nota Fiscal

```sql
-- CIF unitário
NF_CIF_UNIT = PROFORMA_UNIT * IMP_PERC
NF_CIF_TOTAL = QTD * NF_CIF_UNIT

-- Valor em Reais para NF
NF_REAL_UNIT = NF_CIF_UNIT * TAXA_DOLAR
NF_REAL_TOTAL = QTD * NF_REAL_UNIT

-- Despesas rateadas para NF
NF_DESP_TOTAL = DESPESA_PERC * DESPESA_NOTA
NF_DESP_UNIT = NF_DESP_TOTAL / QTD

-- Total NF
NF_TOTAL = NF_REAL_TOTAL + NF_DESP_TOTAL
NF_UNIT = NF_TOTAL / QTD
```

## Fluxo de Processo

### 1. Criação da Importação

```
ENTRADA_IMPORTACAO.INC_IMPORTACAO(
  pNRO_DI,           -- Número da DI
  pDATA_DI,          -- Data da DI
  pTAXA_DOLAR,       -- Taxa do dólar
  pTOTAL_MERCADORIA, -- Total em USD
  pTHC, pFRETE,      -- Custos de frete
  pTOTAL_CIF,        -- Valor CIF
  pPIS, pCOFINS, pII, pIPI, pICMS_ST,  -- Impostos
  pANUENCIA, pSISCOMEX,                 -- Taxas
  pCONTRATO_CAMBIO, pDESPACHANTE,       -- Câmbio
  pFRETEORIGEM_TOTAL, pINFRAERO_PORTO,  -- Fretes
  pCARRETEIRO_EADI, pCARRETEIRO_MELO, pEADI  -- EADI
)
```

### 2. Registro de Contratos de Câmbio

```
ENTRADA_IMPORTACAO.INC_IMPORTACAO_CONTRATOS(
  pID_IMPORTACAO,
  pDATA,          -- Data do contrato
  pTAXA_DOLAR,    -- Taxa contratada
  pVL_MERC_DOLAR, -- Valor em USD
  pCONTRATO       -- Número do contrato
)
```

### 3. Inclusão de Itens

```
ENTRADA_IMPORTACAO.INC_IT_ENTRADA_AUX(
  pCODPROD,
  pID_ORC,         -- Ordem de compra
  pQTD,
  pPROFORMA_UNIT,  -- Preço Proforma (USD)
  pINVOICE_UNIT,   -- Preço Invoice (USD)
  pTX_DOLAR_DI,
  pTX_DOLAR_MEDIO,
  pIPI, pICMS, pSTRIB, pNCM,
  pTotalMercadoria, pDespesaCusto, pTotalICMS_ST,
  pIMP_PERC, pIMP_ICMS_PERC, pDESPESA_NOTA
)
```

### 4. Atualizar Custos (Recálculo)

```
ENTRADA_IMPORTACAO.ATUALIZAR_CUSTO(pID_IMPORTACAO)
```

Recalcula todos os custos dos itens quando há alteração nos valores da DI ou nos contratos de câmbio.

### 5. Gerar Entradas de Estoque

```
ENTRADA_IMPORTACAO.GERAR_ENTRADAS(pID_IMPORTACAO, pCODUSR)
```

Gera as entradas de estoque chamando:
- `ENTRADASEFAZ.ENTRADA_INCLUIR` — Cria a entrada
- `ENTRADASEFAZ.Inc_AuxItEnt` — Adiciona itens com `CUSTO_UNIT_DOLAR`
- `ENTRADASEFAZ.Inc_ItEntrada` — Finaliza os itens
- Altera status da importação para 'E' (Entrada gerada)

## Relação com DBPROD

Ao dar entrada no estoque de produto importado:

1. O `prcompra` recebe o **custo em dólar** (`CUSTO_UNIT_DOLAR`)
2. O campo `dolar` é marcado como 'S'
3. O campo `txdolarcompra` recebe a taxa do dólar usada
4. O custo real é calculado: `prcustoatual = prcompra * txdolarcompra`

## Pagamentos Internacionais

### Tabela DBPGTO (migração já realizada)

Campos adicionados para suporte a pagamentos internacionais:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `eh_internacional` | CHAR(1) | 'S' = Internacional, 'N' = Nacional |
| `moeda` | VARCHAR(3) | Código ISO 4217 (EUR, USD, GBP) |
| `taxa_conversao` | NUMERIC(10,4) | Taxa de câmbio |
| `valor_moeda` | NUMERIC(15,2) | Valor na moeda estrangeira |
| `nro_invoice` | VARCHAR(30) | Número da Invoice |
| `nro_contrato` | VARCHAR(30) | Número do contrato de câmbio |

## Exemplo Real de Importação

```
ID: 12021060001
DI: 21/1095776-9
Data: 08/JUN/2021
Status: E (Entrada gerada)

Taxa Dólar DI: 5.0498
Taxa Dólar Média (contratos): 5.334912
Total Mercadoria: USD 117,407.76
Total CIF: USD 127,475.26

Exemplo de item:
- Produto: 394634
- Qtd: 100
- Proforma Unit: USD 6.85
- Invoice Unit: USD 6.85
- Real Unit: R$ 37.23
- Custo Unit Real: R$ 46.81
- Custo Unit Dolar: USD 8.61
- NF Unit: R$ 44.08
```

## Pontos de Integração com Next.js

### Para implementar no Melo Next.js:

1. **Importar DI**: Criar tela para cadastro de importações com todos os campos
2. **Contratos de câmbio**: Registrar múltiplos contratos com taxas diferentes
3. **Cálculo automático**: Replicar a procedure `ATUALIZAR_CUSTO`
4. **Geração de entradas**: Integrar com o fluxo de `entradas_estoque` existente
5. **Flag dolar no produto**: Marcar `dolar='S'` e salvar `txdolarcompra`
6. **Confirmar preço**: Usar `prcompra * txdolarcompra` como custo base
