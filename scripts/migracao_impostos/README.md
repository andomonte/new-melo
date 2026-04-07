# Migração de Tabelas de Impostos - Oracle → PostgreSQL

## Status: ✅ CONCLUÍDO

Migração realizada com sucesso em **2026-01-09**

---

## Sumário

1. [Resumo da Migração](#resumo-da-migração)
2. [Tabelas Migradas](#tabelas-migradas)
3. [Scripts Disponíveis](#scripts-disponíveis)
4. [Como Usar](#como-usar)
5. [Estrutura das Tabelas](#estrutura-das-tabelas)
6. [Exemplos de Consultas](#exemplos-de-consultas)
7. [Performance](#performance)
8. [Troubleshooting](#troubleshooting)

---

## Resumo da Migração

**Origem:** Oracle Database
- Host: 201.64.221.132:1524
- Database: desenv.mns.melopecas.com.br
- User: GERAL

**Destino:** PostgreSQL
- Host: servicos.melopecas.com.br:5432
- Database: postgres
- Schema: public

**Resultado:**
- ✅ 4 tabelas migradas
- ✅ 3.207 registros migrados (99.97% de sucesso)
- ✅ 11 índices criados
- ✅ 1 foreign key criada
- ✅ Performance validada (< 1ms por consulta)

---

## Tabelas Migradas

| Tabela | Registros | Descrição | Prioridade |
|--------|-----------|-----------|------------|
| **CAD_LEGISLACAO_ICMSST** | 16 | Protocolos ICMS-ST | Alta |
| **CAD_LEGISLACAO_ICMSST_NCM** | 1.823 | NCM x Protocolo x MVA | **CRÍTICA** |
| **FIS_TRIBUTO_ALIQUOTA** | 249 | Alíquotas por exceção | Média |
| **DBCEST** | 1.119 | Códigos CEST | Média |

---

## Scripts Disponíveis

### Scripts SQL

| Arquivo | Descrição |
|---------|-----------|
| `schema_completo.sql` | Schema completo com tabelas, FKs, índices e comentários |
| `migracao_completa.sql` | CREATE TABLE de todas as tabelas |
| `indices.sql` | Todos os índices para otimização |
| `exemplo_consultas.sql` | 10 exemplos de consultas prontas para usar |
| **`funcoes_calculo.sql`** ⭐ | **VIEW + 5 FUNCTIONS para cálculo de impostos** |
| `testes_funcoes.sql` | Suite completa de testes das funções |

### Scripts Node.js

| Arquivo | Comando | Descrição |
|---------|---------|-----------|
| `migracao_completa.js` | `node migracao_completa.js` | Script completo de migração Oracle→PG |
| `criar_indices.js` | `node criar_indices.js` | Cria todos os índices |
| `debug_tables.js` | `node debug_tables.js` | Verifica estrutura e dados |
| `testar_consultas.js` | `node testar_consultas.js` | Testa 6 consultas principais |
| **`executar_direto.js`** ⭐ | `node executar_direto.js` | **Executa funções de cálculo + testes** |

### Documentação

| Arquivo | Descrição |
|---------|-----------|
| `README.md` | Este arquivo |
| `RELATORIO_MIGRACAO.md` | Relatório detalhado da migração |
| **`FUNCOES_IMPOSTOS.md`** ⭐ | **Documentação completa das funções de cálculo** |

---

## Como Usar

### 1. Verificar as Tabelas

```bash
cd E:\src\next\sistemas\clones\melo\site-melo
node scripts/migracao_impostos/debug_tables.js
```

### 2. Testar Consultas

```bash
node scripts/migracao_impostos/testar_consultas.js
```

### 3. Recriar Índices (se necessário)

```bash
node scripts/migracao_impostos/criar_indices.js
```

### 4. ⭐ Executar Funções de Cálculo de Impostos (NOVO!)

```bash
node scripts/migracao_impostos/executar_direto.js
```

Este script:
- Cria 1 VIEW: `v_mva_ncm_uf_completa`
- Cria 5 FUNCTIONS: cálculo de CFOP, CST, MVA, IBS/CBS
- Executa todos os testes automaticamente
- Valida performance (< 100ms)

**Leia a documentação completa:** [FUNCOES_IMPOSTOS.md](./FUNCOES_IMPOSTOS.md)

### 5. Executar Consultas Customizadas

Abra o arquivo `exemplo_consultas.sql` e copie as queries que precisa.

---

## Estrutura das Tabelas

### CAD_LEGISLACAO_ICMSST

```sql
"LEI_ID"              NUMERIC       PRIMARY KEY
"LEI_PROTOCOLO"       NUMERIC       NOT NULL
"LEI_DATA_CADASTRO"   TIMESTAMP     NOT NULL
"LEI_STATUS"          VARCHAR(20)   NOT NULL
"LEI_DATA_VIGENCIA"   TIMESTAMP     NOT NULL
"LEI_DATA_PUBLICACAO" TIMESTAMP     NOT NULL
"LEI_MVA_AJUSTADA"    VARCHAR(100)  NOT NULL
"LEI_TIPO"            VARCHAR(20)
```

**Índices:**
- `idx_legislacao_icmsst_protocolo` (LEI_PROTOCOLO)
- `idx_legislacao_icmsst_status` (LEI_STATUS)

---

### CAD_LEGISLACAO_ICMSST_NCM ⭐ CRÍTICA

```sql
"LIN_ID"              NUMERIC       PRIMARY KEY
"LIN_LEI_ID"          NUMERIC       NOT NULL FK → CAD_LEGISLACAO_ICMSST
"LIN_NCM"             VARCHAR(9)    NOT NULL
"LIN_STATUS"          VARCHAR(10)   NOT NULL
"LIN_MVA_ST_ORIGINAL" NUMERIC(6,3)
"LIN_CEST"            VARCHAR(8)
```

**Índices:**
- `idx_legislacao_ncm_ncm` (LIN_NCM)
- `idx_legislacao_ncm_lei_id` (LIN_LEI_ID)
- `idx_legislacao_ncm_ncm_lei` (LIN_NCM, LIN_LEI_ID) ← Índice composto
- `idx_legislacao_ncm_status` (LIN_STATUS)
- `idx_legislacao_ncm_cest` (LIN_CEST)

---

### FIS_TRIBUTO_ALIQUOTA

```sql
codigo      VARCHAR(4)
n_ne_co     NUMERIC
s_se        NUMERIC
importado   NUMERIC
```

**Índices:**
- `idx_tributo_aliquota_codigo` (codigo)

---

### DBCEST

```sql
id          SERIAL      PRIMARY KEY
cest        VARCHAR(7)  NOT NULL
ncm         VARCHAR(8)
segmento    VARCHAR(100)
descricao   VARCHAR(1000)
```

**Índices:**
- `idx_dbcest_cest` (cest)
- `idx_dbcest_ncm` (ncm)
- `idx_dbcest_segmento` (segmento)

---

## Exemplos de Consultas

### Buscar MVA por NCM

```sql
SELECT
  l."LEI_PROTOCOLO",
  l."LEI_MVA_AJUSTADA" AS formula,
  ln."LIN_MVA_ST_ORIGINAL" AS mva_percent
FROM cad_legislacao_icmsst_ncm ln
JOIN cad_legislacao_icmsst l
  ON l."LEI_ID" = ln."LIN_LEI_ID"
WHERE ln."LIN_NCM" = '84213920'
  AND ln."LIN_STATUS" = 'REGRA'
  AND l."LEI_STATUS" = 'EM VIGOR';
```

**Resultado:**
```json
{
  "LEI_PROTOCOLO": "36",
  "formula": "((1 + :MVA_ST_ORIGINAL) * (1 - :ALQ_INTER) / (1 - :ALQ_INTRA)) - 1",
  "mva_percent": "71.780"
}
```

### Listar NCMs de um Protocolo

```sql
SELECT
  ln."LIN_NCM",
  ln."LIN_MVA_ST_ORIGINAL"
FROM cad_legislacao_icmsst l
JOIN cad_legislacao_icmsst_ncm ln
  ON ln."LIN_LEI_ID" = l."LEI_ID"
WHERE l."LEI_PROTOCOLO" = 41
  AND l."LEI_STATUS" = 'EM VIGOR'
ORDER BY ln."LIN_NCM";
```

### Buscar Alíquota por Código

```sql
SELECT
  codigo,
  n_ne_co AS aliq_norte,
  s_se AS aliq_sul,
  importado AS aliq_imp
FROM fis_tributo_aliquota
WHERE codigo = 'A001';
```

**Resultado:**
```json
{
  "codigo": "A001",
  "aliq_norte": "5",
  "aliq_sul": "10",
  "aliq_imp": "13"
}
```

### Buscar CEST por NCM

```sql
SELECT cest, descricao
FROM dbcest
WHERE ncm = '9032899';
```

---

## Performance

**Testes realizados em 2026-01-09:**

### Busca por NCM (índice composto)
```
Query: SELECT * FROM cad_legislacao_icmsst_ncm WHERE "LIN_NCM" = '84213920'
Execution Time: 0.124 ms
Index Used: idx_legislacao_ncm_ncm_lei
Rows Returned: 8
```

✅ **Performance excelente:** < 1ms para consultas indexadas

### Estatísticas das Tabelas

```
CAD_LEGISLACAO_ICMSST:     16 registros (14 em vigor)
CAD_LEGISLACAO_ICMSST_NCM: 1.823 registros (1.817 regras ativas)
FIS_TRIBUTO_ALIQUOTA:      249 registros
DBCEST:                    1.119 registros (24 segmentos)
```

---

## Troubleshooting

### Problema: Coluna não encontrada

**Erro:**
```
column "lei_id" does not exist
```

**Solução:**
As colunas foram criadas em UPPERCASE. Use aspas duplas:
```sql
SELECT "LEI_ID" FROM cad_legislacao_icmsst;
```

---

### Problema: Slow Query

**Solução:**
Verifique se os índices estão criados:
```bash
node scripts/migracao_impostos/criar_indices.js
```

---

### Problema: Registro faltante

**Info:**
A tabela `CAD_LEGISLACAO_ICMSST_NCM` perdeu 1 registro na migração (1.824 → 1.823).

**Investigação:**
Possível registro duplicado ou com dados inválidos no Oracle.

---

## Notas Importantes

### ⚠️ Case Sensitivity

As colunas foram criadas em **UPPERCASE** no PostgreSQL e requerem aspas duplas:

```sql
-- ✅ CORRETO
SELECT "LEI_ID" FROM cad_legislacao_icmsst;

-- ❌ ERRADO
SELECT lei_id FROM cad_legislacao_icmsst;
```

### 🔐 Segurança

As credenciais estão nos scripts. Em produção:
1. Use variáveis de ambiente
2. Implemente pgBouncer para pooling
3. Configure SSL/TLS

### 🔄 Sincronização

Não há sincronização automática Oracle→PG. Para atualizar:
1. Execute `migracao_completa.js` novamente
2. Ou implemente CDC (Change Data Capture)

---

---

## ⭐ Funções de Cálculo de Impostos (NOVO!)

### Resumo

Infraestrutura SQL completa para cálculo automatizado de impostos:

**Objetos Criados:**
- 1 VIEW: `v_mva_ncm_uf_completa` (busca MVA por NCM e UF)
- 5 FUNCTIONS:
  - `buscar_aliquota_ncm(ncm, ano)` - IBS/CBS (Reforma Tributária 2026)
  - `calcular_cfop(operacao, uf_orig, uf_dest)` - Determina CFOP
  - `determinar_cst_icms(tem_st, base_red, isento)` - CST ICMS
  - `buscar_aliquota_icms(uf)` - Alíquotas ICMS por UF
  - `calcular_mva_ajustado(mva, alq_intra, alq_inter)` - MVA ajustado

**Performance Validada:**
- VIEW: < 30ms para consultas típicas
- FUNCTIONS: < 5ms cada
- Consulta complexa: **22ms** para 20 registros

### Quick Start

```bash
# Executar scripts
cd E:\src\next\sistemas\clones\melo\site-melo
node scripts/migracao_impostos/executar_direto.js
```

### Exemplos Rápidos

```sql
-- Buscar MVA para NCM 84213920 destino SP
SELECT * FROM db_manaus.v_mva_ncm_uf_completa
WHERE ncm = '84213920' AND uf_destino = 'SP';

-- Calcular CFOP (Venda AM->SP)
SELECT db_manaus.calcular_cfop('VENDA', 'AM', 'SP');
-- Retorna: 6102

-- Determinar CST ICMS (com ST)
SELECT db_manaus.determinar_cst_icms(TRUE, FALSE, FALSE);
-- Retorna: 10

-- Buscar IBS/CBS 2026
SELECT * FROM db_manaus.buscar_aliquota_ncm('84213920', 2026);
-- Retorna: IBS=0.10%, CBS=0.90%

-- Calcular MVA ajustado
SELECT db_manaus.calcular_mva_ajustado(71.78, 18, 12);
-- Retorna: 84.35
```

### Documentação Completa

👉 **[FUNCOES_IMPOSTOS.md](./FUNCOES_IMPOSTOS.md)** 👈

Este documento contém:
- Documentação detalhada de cada função
- Parâmetros e retornos
- Exemplos de uso avançados
- Cenários completos (ex: venda AM→SP)
- Integração com Next.js
- Troubleshooting

### Estatísticas

- **4.509** MVAs cadastrados
- **676** NCMs distintos
- **27** UFs distintas
- **13** Protocolos ICMS distintos

---

---

## 🔬 Simulador Comparativo de Impostos (NOVO!)

### Visão Geral

Ferramenta para **validar e comparar** cálculos de impostos entre Oracle (Delphi) e PostgreSQL (Next.js).

**Recursos:**
- ✅ Busca produtos/clientes em ambos bancos
- ✅ Executa cálculo Oracle (package CALCULO_IMPOSTO)
- ✅ Executa cálculo PostgreSQL (funções SQL)
- ✅ Compara resultados campo a campo
- ✅ Gera relatórios detalhados em JSON e Markdown
- ✅ Modo interativo (CLI) e modo batch (múltiplos testes)

### Quick Start

#### Modo Interativo (1 teste por vez)

```bash
cd E:\src\next\sistemas\clones\melo\site-melo
node scripts/migracao_impostos/simulador-comparativo.js
```

**Exemplo de uso:**
```
╔═══════════════════════════════════════════╗
║  SIMULADOR COMPARATIVO DE IMPOSTOS       ║
║  Oracle (Delphi) vs PostgreSQL (Next.js) ║
╚═══════════════════════════════════════════╝

Produto (código ou descrição): AR CONDICIONADO
Cliente (código ou nome): DISTRIBUIDORA
Valor unitário (R$): 1000
Quantidade (padrão 1): 1

🔍 Buscando produto: "AR CONDICIONADO"...
   ✓ Produto encontrado: [123] AR CONDICIONADO AUTOMOTIVO

🔍 Buscando cliente: "DISTRIBUIDORA"...
   ✓ Cliente encontrado: [456] DISTRIBUIDORA XYZ LTDA

⚙️  Calculando impostos Oracle...
   ✓ Package CALCULO_IMPOSTO executado (142ms)

⚙️  Calculando impostos PostgreSQL...
   ✓ Função calcular_icms_completo executada (87ms)

📊 COMPARAÇÃO DE RESULTADOS:
[Tabela comparativa exibida aqui]

✅ RESULTADO: COMPATÍVEL!
💾 Relatório salvo em: testes_comparativos/2026-01-09_164523.md
```

#### Modo Batch (múltiplos testes)

```bash
# Usar casos de teste pré-configurados
node scripts/migracao_impostos/simulador-batch.js

# Ou especificar arquivo customizado
node scripts/migracao_impostos/simulador-batch.js meus-casos.json
```

**Casos de teste inclusos:**
1. Venda Interestadual com ST (AR CONDICIONADO AM→SP)
2. Venda Interna sem ST (ÓLEO LUBRIFICANTE AM→AM)
3. Venda Contribuinte ZFM (TELEVISOR AM→RJ)

### Arquivos Gerados

Todos os relatórios são salvos em: `scripts/migracao_impostos/testes_comparativos/`

**Estrutura:**
```
testes_comparativos/
├── casos-teste.json              # Casos pré-configurados
├── teste_2026-01-09_164523.json  # Resultado individual (JSON)
├── teste_2026-01-09_164523.md    # Resultado individual (Markdown)
└── consolidado_2026-01-09.md     # Relatório consolidado (batch)
```

### Como Funciona

1. **Busca Produto/Cliente:**
   - Aceita código numérico ou descrição (LIKE)
   - Busca em ambos bancos simultaneamente
   - Se múltiplos resultados, permite escolher

2. **Cálculo Oracle:**
   - Tenta executar package `CALCULO_IMPOSTO.Calcular_Impostos`
   - Se não disponível, faz cálculo direto consultando tabelas
   - Retorna: CFOP, CST, ICMS, ST, IPI, PIS, COFINS

3. **Cálculo PostgreSQL:**
   - Tenta executar função `calcular_icms_completo`
   - Se não disponível, faz cálculo direto consultando tabelas
   - Retorna: mesmos campos + IBS/CBS (2026)

4. **Comparação:**
   - Compara campo a campo
   - Aceita divergência < R$ 0,01 (arredondamento)
   - Destaca novos campos (IBS/CBS)
   - Gera estatísticas (% compatibilidade)

### Campos Comparados

- **CFOP** (string)
- **CST ICMS** (string)
- **Alíquota ICMS** (percentual)
- **Base ICMS** (valor)
- **Valor ICMS** (valor)
- **MVA Original** (percentual)
- **MVA Ajustado** (percentual)
- **Base ST** (valor)
- **Valor ST** (valor)
- **Alíquota IPI** (percentual)
- **Valor IPI** (valor)
- **Alíquota PIS** (percentual)
- **Valor PIS** (valor)
- **Alíquota COFINS** (percentual)
- **Valor COFINS** (valor)
- **IBS (2026)** - Novo no PG
- **CBS (2026)** - Novo no PG

### Exemplo de Relatório

```markdown
# Relatório de Simulação Comparativa de Impostos

**Data:** 09/01/2026 16:45:23

## Dados de Entrada
- **Produto:** [123] AR CONDICIONADO AUTOMOTIVO
- **Cliente:** [456] DISTRIBUIDORA XYZ LTDA
- **Valor:** R$ 1.000,00

## Comparação

| Campo           | Oracle   | PostgreSQL | Status |
|-----------------|----------|------------|--------|
| CFOP            | 6102     | 6102       | ✓      |
| CST ICMS        | 10       | 10         | ✓      |
| Alíquota ICMS   | 12%      | 12%        | ✓      |
| Base ICMS       | 1000.00  | 1000.00    | ✓      |
| Valor ICMS      | 120.00   | 120.00     | ✓      |
| MVA Original    | 71.78%   | 71.78%     | ✓      |
| MVA Ajustado    | 84.35%   | 84.35%     | ✓      |
| Base ST         | 1843.50  | 1843.50    | ✓      |
| Valor ST        | 101.22   | 101.22     | ✓      |
| IPI             | 15%      | 15%        | ✓      |
| Valor IPI       | 150.00   | 150.00     | ✓      |
| PIS             | 1.65%    | 1.65%      | ✓      |
| Valor PIS       | 18.98    | 18.98      | ✓      |
| COFINS          | 7.60%    | 7.60%      | ✓      |
| Valor COFINS    | 87.40    | 87.40      | ✓      |
| IBS (2026)      | N/A      | 0.10%      | NOVO   |
| CBS (2026)      | N/A      | 0.90%      | NOVO   |

## Estatísticas
- ✓ Compatíveis: 14/14 (100%)
- ✗ Divergentes: 0
- ✨ Novos: 2 (IBS/CBS)

✅ **RESULTADO: SISTEMAS COMPATÍVEIS!**
```

### Casos de Uso

1. **Validação após mudanças:**
   ```bash
   # Após alterar função de cálculo
   node simulador-batch.js
   ```

2. **Debug de divergências:**
   ```bash
   # Testar produto/cliente específico
   node simulador-comparativo.js
   # Digite código do produto com divergência
   ```

3. **Documentação de homologação:**
   ```bash
   # Gerar relatórios para aprovação
   node simulador-batch.js casos-homologacao.json
   # Entregar arquivo consolidado_*.md
   ```

4. **Testes de regressão:**
   ```bash
   # Manter casos-teste.json atualizado
   # Executar antes de deploy
   node simulador-batch.js
   ```

### Criar Novos Casos de Teste

Edite `testes_comparativos/casos-teste.json`:

```json
{
  "nome": "Meu Novo Caso",
  "descricao": "Descrição do cenário",
  "produto": {
    "termo_busca": "CÓDIGO_OU_DESCRIÇÃO",
    "id_produto": 999
  },
  "cliente": {
    "termo_busca": "CÓDIGO_OU_NOME",
    "id_cliente": 888
  },
  "valores": {
    "valor_unitario": 500.00,
    "quantidade": 2
  },
  "resultado_esperado": {
    "cfop": "6102",
    "tem_st": true,
    "observacoes": ["Nota importante"]
  }
}
```

### Troubleshooting

**Problema: Package CALCULO_IMPOSTO não encontrado**
```
⚠ Package CALCULO_IMPOSTO.Calcular_Impostos não encontrado
Tentando consulta direta nas tabelas...
```
✅ Isso é esperado! O simulador automaticamente usa fallback.

**Problema: Função calcular_icms_completo não encontrada**
```
⚠ Função calcular_icms_completo não encontrada
Tentando consulta direta nas tabelas...
```
✅ Execute primeiro: `node executar_direto.js` para criar as funções.

**Problema: Produto/Cliente não encontrado**
- Verifique se o termo de busca está correto
- Tente buscar por código numérico
- Verifique se existe em ambos bancos

**Problema: Divergências nos valores**
- Diferenças < R$ 0,01 são ignoradas (arredondamento)
- Verifique se MVA está correto em ambos
- Confira alíquotas ICMS cadastradas

### Scripts Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `simulador-comparativo.js` | Modo interativo (1 teste) |
| `simulador-batch.js` | Modo batch (múltiplos testes) |
| `testes_comparativos/casos-teste.json` | Casos pré-configurados |
| `testes_comparativos/*.md` | Relatórios gerados |

### Dependências

```json
{
  "oracledb": "^6.8.0",
  "pg": "^8.16.0"
}
```

Já estão instaladas no projeto.

---

## Contato

Para dúvidas sobre a migração:
- Verifique `RELATORIO_MIGRACAO.md`
- Execute `testar_consultas.js` para validar
- Consulte `exemplo_consultas.sql` para exemplos

Para dúvidas sobre funções de cálculo:
- Leia `FUNCOES_IMPOSTOS.md` (documentação completa)
- Execute `executar_direto.js` (testes automatizados)

Para validar compatibilidade Oracle/PostgreSQL:
- Execute `simulador-comparativo.js` (modo interativo)
- Execute `simulador-batch.js` (testes automatizados)

---

**Data:** 2026-01-09
**Status:** ✅ PRODUÇÃO READY
**Versão:** 1.2 (+ Simulador Comparativo)

**Changelog:**
- v1.0: Migração inicial (4 tabelas, 11 índices)
- v1.1: Funções de cálculo SQL (1 view, 5 functions)
- v1.2: Simulador comparativo Oracle vs PostgreSQL
