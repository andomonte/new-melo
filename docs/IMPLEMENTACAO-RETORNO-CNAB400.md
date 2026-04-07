# Sistema de Importação de Retorno CNAB 400 - Resumo Completo

## 📋 Visão Geral

Sistema completo para processamento de arquivos de retorno bancário CNAB 400 (BRADESCO, SANTANDER e outros bancos), com análise automática de títulos para baixa e integração com contas a pagar.

## 🗄️ Estrutura do Banco de Dados

### Tabelas Criadas

**1. `db_retorno_arquivo`** - Header dos arquivos importados
- `codretorno` (PK) - Identificador único do arquivo
- `banco` - Nome do banco (BRADESCO, SANTANDER)
- `data_importacao` - Timestamp da importação
- `nome_arquivo` - Nome do arquivo .ret/.txt
- `usuario_importacao` - Usuário que importou
- Contadores por filial: `qtd_mao`, `qtd_pvh`, `qtd_rec`, `qtd_flz`, `qtd_cccc`, `qtd_csac`, `qtd_jps`
- Dados do header CNAB: `datageracaoarquivo`, `numerosequencialarquivo`, `nomebanco`, `numerobancocamaracompensacao`

**2. `db_retorno_detalhe`** - Detalhes dos títulos
- `coddetalhe` (PK) - Identificador único do título
- `codretorno` (FK) - Referência ao arquivo
- Identificação: `codreceb`, `codcli`, `nomecli`, `cnpj`, `tipo_empresa`
- Documentos: `nro_docbanco`, `nro_doc`, `carteira`
- Ocorrência: `codocorrencia`, `ocorrencia`, `dt_ocorrencia`
- Valores: `valor_titulo`, `valor_pago`, `valor_desconto`, `valor_juros`
- Bancos: `banco_cobrador`, `agencia_cobradora`
- Status: `situacao` (P=Pago, 1=Não pago, 2=Atraso JX correto, 3=Atraso JX menor, 4=Não localizado)

**3. `db_retorno_ocorrencias`** - Códigos de ocorrência por banco
- `cod_ocorrencia` (PK) - Código da ocorrência (02, 06, 09, etc)
- `banco` - Banco aplicável (BRADESCO, SANTANDER, TODOS)
- `descricao` - Descrição da ocorrência
- `tipo` - Tipo (ENTRADA, LIQUIDACAO, BAIXA, PROTESTO, REJEICAO)
- `baixa_automatica` - Se permite baixa automática

**4. `db_retorno_situacao`** - Situações de processamento
- `cod_situacao` (PK) - Código da situação (P, 1, 2, 3, 4)
- `descricao` - Descrição
- `permite_baixa_automatica` - Se permite baixa automática

**5. `vw_retorno_completo`** - View consolidada
- Join de todas as tabelas para consulta fácil

## 📦 Arquivos Criados/Modificados

### 1. Migration SQL
**`database/migrations/create_retorno_tables.sql`**
- Cria 4 tabelas + 1 view
- Insere códigos de ocorrência para BRADESCO e SANTANDER
- Insere códigos de situação
- Índices para performance

### 2. Parser CNAB 400
**`src/utils/cnab/parseRetorno400.ts`**

**Interfaces:**
```typescript
- RetornoHeader: dados do header (tipo 0)
- RetornoDetalhe: dados dos títulos (tipo 1)
- RetornoTrailer: totalizador (tipo 9)
- RetornoCNAB400: estrutura completa
```

**Funções principais:**
- `parseCNAB400Retorno(conteudo)`: Parseia arquivo completo
- `validarRetornoCNAB400(conteudo)`: Valida formato
- `parseHeader(linha)`: Extrai dados do header
- `parseDetalheBradesco(linha)`: Parser específico BRADESCO
- `parseDetalheSantander(linha)`: Parser específico SANTANDER
- `parseTrailer(linha)`: Extrai totalizador
- `converterData(DDMMAA)`: Converte para YYYY-MM-DD
- `converterValor(str)`: Converte valores com decimais implícitos
- `identificarBanco(codigo)`: Mapeia código para nome

**Layout CNAB 400 Suportado:**
- Linha 400 caracteres
- Header: posições fixas (1-400)
- Detalhe: 22+ campos extraídos
- Trailer: quantidade e valores totais

### 3. API de Processamento
**`src/pages/api/remessa/retorno/processar.ts`**

**Fluxo de Processamento:**

1. **Upload do arquivo** → `/api/upload`
2. **Validação do formato** → `validarRetornoCNAB400()`
3. **Parse do arquivo** → `parseCNAB400Retorno()`
4. **Verificação de duplicata** → `validarArquivoDuplicado()`
   - Compara: data geração + número sequencial + banco
5. **Inserção do header** → `db_retorno_arquivo` (ARQUIVO_INC)
   - Contadores por filial
   - Metadados do arquivo
6. **Inserção dos detalhes** → `db_retorno_detalhe` (DETALHE_INC)
   - Para cada título no arquivo
   - Análise automática de situação
7. **Análise de títulos** → `analisarTitulo()` (ANALISA_TITULO)
   - Verifica ocorrência (06, 09, 15, 17 = baixa automática)
   - Compara valor pago vs valor título
   - Determina situação (P, 1, 2, 3, 4)
8. **Classificação**
   - Títulos para baixa automática
   - Títulos para baixa manual (com motivo)
9. **Retorno** → Estatísticas completas

**Estatísticas Retornadas:**
```json
{
  "codretorno": 123,
  "banco": "BRADESCO",
  "nomeArquivo": "retorno.ret",
  "totalTitulos": 50,
  "valorTotal": 15000.00,
  "estatisticas": {
    "totalProcessados": 50,
    "liquidados": 35,
    "baixados": 10,
    "rejeitados": 3,
    "outros": 2,
    "porFilial": {
      "mao": 25,
      "pvh": 15,
      "rec": 5,
      "flz": 3,
      "bmo": 2,
      "csac": 0,
      "jps": 0
    }
  },
  "titulosParaBaixaAutomatica": [...],
  "titulosParaBaixaManual": [...]
}
```

### 4. Frontend
**`src/components/corpo/remessa/equifax.tsx`**

**Alterações:**

1. **Interface TypeScript Atualizada**
   - Suporte para dados de DDA (legado)
   - Suporte para dados de retorno CNAB 400
   - Campos opcionais para compatibilidade

2. **Função `handleProcessarArquivoDDA` Modificada**
   - Agora chama `/api/remessa/retorno/processar`
   - Recebe estrutura de retorno CNAB
   - Adapta para formato do estado
   - Toast com resumo do processamento

3. **UI de Resultados Redesenhada**

   **Resumo Geral:**
   - 4 cards: Total Títulos, Baixa Automática, Baixa Manual, Valor Total
   - Nome do banco e arquivo
   
   **Estatísticas por Tipo:**
   - Liquidados (verde) 📗
   - Baixados (azul) 📥
   - Rejeitados (vermelho) ❌
   - Outros (cinza) 📄
   
   **Estatísticas por Filial:**
   - MAO, PVH, REC, FLZ, BMO, CSAC, JPS
   - Grid responsivo
   
   **Tabela de Baixa Automática:**
   - Borda verde
   - Títulos OK para baixa
   - Campos: Nosso Número, Documento, Sacado, Valor, Data, Ocorrência
   
   **Tabela de Baixa Manual:**
   - Borda amarela/warning
   - Títulos que precisam análise
   - Campos: + Motivo da rejeição
   - Max-height com scroll

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuário seleciona arquivo .ret/.txt                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Upload para servidor (/api/upload)                      │
│    - Valida extensão .ret ou .txt                          │
│    - Salva em /temp com nome único                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Processamento (/api/remessa/retorno/processar)          │
│    a) Valida formato CNAB 400                              │
│    b) Parse do arquivo (header + detalhes + trailer)       │
│    c) Verifica duplicata (data+seq+banco)                  │
│    d) Insere header (db_retorno_arquivo)                   │
│    e) Para cada título:                                     │
│       - Determina filial                                    │
│       - Obtém descrição da ocorrência                       │
│       - Analisa título (situação + baixa auto?)             │
│       - Insere detalhe (db_retorno_detalhe)                │
│       - Classifica (automático vs manual)                   │
│    f) Calcula estatísticas                                  │
│    g) Remove arquivo temporário                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Frontend exibe resultados                                │
│    - Resumo geral (4 cards)                                 │
│    - Estatísticas por tipo (liquidados, baixados, etc)      │
│    - Estatísticas por filial (MAO, PVH, etc)                │
│    - Tabela baixa automática (verde)                        │
│    - Tabela baixa manual (amarela)                          │
│    - Toast com resumo                                       │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Lógica de Análise de Títulos

### Códigos de Ocorrência (Baixa Automática)
- **06** - Liquidação Normal
- **09** - Baixado Automaticamente
- **15** - Liquidação em Cartório
- **17** - Liquidação após baixa

### Códigos de Ocorrência (Rejeição)
- **03** - Entrada Rejeitada
- **24** - Instrução de Protesto Rejeitada
- **32** - Instrução Rejeitada

### Situações Determinadas

| Código | Descrição | Permite Baixa Automática |
|--------|-----------|-------------------------|
| **P** | PAGO | ✅ Sim |
| **1** | NAO PAGO TOTALMENTE | ❌ Não |
| **2** | PAGO ATRASO JX CORRETO | ✅ Sim |
| **3** | PAGO ATRASO JX MENOR | ❌ Não (divergência juros) |
| **4** | TITULO NAO LOCALIZADO | ❌ Não |

### Regras de Análise

```typescript
1. Ocorrência permite baixa automática? (06, 09, 15, 17)
   ├─ SIM
   │  ├─ Valor pago == Valor título (tolerância R$ 0,01)?
   │  │  ├─ SIM → Situação: P (Pago) ✅ BAIXA AUTOMÁTICA
   │  │  ├─ Valor pago > Valor título
   │  │  │  └─ Situação: 3 (Pago atraso JX menor) ❌ BAIXA MANUAL
   │  │  └─ Valor pago < Valor título
   │  │     └─ Situação: 1 (Não pago totalmente) ❌ BAIXA MANUAL
   │  └─ NÃO
   └─ Ocorrência de rejeição? (03, 24, 32)
      ├─ SIM → Situação: 4 (Título não localizado) ❌ BAIXA MANUAL
      └─ Outras → Situação: 1 ❌ BAIXA MANUAL (análise necessária)
```

## 📊 Exemplo de Processamento

**Arquivo:** `retorno_bradesco_20241113.ret`
- Total: 50 títulos
- BRADESCO (237)

**Processamento:**
- ✅ 35 liquidados (ocorrência 06) → **30 baixa automática** (valor correto) + **5 manual** (divergência)
- ✅ 10 baixados (ocorrência 09) → **10 baixa automática**
- ❌ 3 rejeitados (ocorrência 03) → **3 manual**
- ℹ️ 2 outros (ocorrência 14) → **2 manual** (vencimento alterado)

**Resultado:**
- Baixa Automática: 40 títulos
- Baixa Manual: 10 títulos (5 divergência + 3 rejeitados + 2 análise)

## 🚀 Próximos Passos

### 1. Executar Migration
```bash
# Conectar ao PostgreSQL
psql -U seu_usuario -d seu_banco

# Executar script
\i database/migrations/create_retorno_tables.sql
```

### 2. Testar com Arquivo Real
- Obter arquivo de retorno real do banco
- Upload pela interface
- Validar parsing e processamento
- Verificar classificação automática/manual

### 3. Implementar Baixa Automática
- Criar endpoint `/api/remessa/retorno/baixar-automatico`
- Gerar títulos em `db_contas_pagar` para liquidados
- Atualizar títulos existentes
- Registrar histórico de baixa

### 4. Relatórios
- Histórico de importações
- Títulos pendentes de análise manual
- Dashboard de retornos processados

## 📝 Observações Importantes

1. **Compatibilidade:** Parser suporta BRADESCO (237) e SANTANDER (033). Outros bancos usam parser BRADESCO como fallback.

2. **Tolerância:** Diferença de R$ 0,01 aceita para considerar valor correto (arredondamentos).

3. **Filiais:** Lógica de determinação de filial pode precisar ajuste conforme padrão da empresa no campo "número de controle".

4. **Segurança:** Arquivos temporários são removidos após processamento.

5. **Duplicatas:** Sistema verifica duplicação por data+sequencial+banco, evitando reprocessamento.

6. **Extensibilidade:** Fácil adicionar novos bancos (criar parser específico) e novas regras de análise.
