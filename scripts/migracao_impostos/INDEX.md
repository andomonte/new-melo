# Índice de Arquivos - Migração de Impostos

**Diretório:** `E:\src\next\sistemas\clones\melo\site-melo\scripts\migracao_impostos\`

---

## 📚 Documentação

### README.md (7.9 KB)
Documentação principal com instruções de uso, exemplos e troubleshooting.
```bash
# Visualizar
cat README.md
```

### RELATORIO_MIGRACAO.md (7.1 KB)
Relatório detalhado da migração com estatísticas, amostra de dados e observações importantes.
```bash
# Visualizar
cat RELATORIO_MIGRACAO.md
```

### INDEX.md (este arquivo)
Índice de todos os arquivos disponíveis.

---

## 🗄️ Scripts SQL

### schema_completo.sql (6.2 KB)
Schema completo incluindo:
- CREATE TABLE de todas as 4 tabelas
- Foreign Keys
- Comentários nas tabelas e colunas
- Todos os 11 índices
- Query de exemplo

**Uso:**
```bash
# Recriar schema completo
psql "postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres" < schema_completo.sql
```

### migracao_completa.sql (1.1 KB)
CREATE TABLE das 4 tabelas (sem índices nem FKs).

### indices.sql (1.6 KB)
Todos os 11 índices para otimização de consultas.

**Uso:**
```bash
# Recriar apenas índices
psql "postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres" < indices.sql
```

### exemplo_consultas.sql (6.2 KB)
10 exemplos de consultas prontas para uso:
1. Buscar MVA por NCM específico
2. Listar NCMs de um protocolo
3. Buscar NCMs por prefixo
4. Listar protocolos em vigor
5. Buscar alíquota por código
6. Buscar CEST por NCM
7. Listar autopeças com CEST
8. Estatísticas gerais
9. Query completa para cálculo de ST
10. Verificar NCMs sem MVA

**Uso:**
```bash
# Executar uma query específica
psql "postgresql://postgres:Melodb@2025@servicos.melopecas.com.br:5432/postgres" < exemplo_consultas.sql
```

---

## 🖥️ Scripts Node.js

### migracao_completa.js (14.4 KB)
Script completo de migração Oracle → PostgreSQL.

**Funcionalidades:**
- Conecta ao Oracle e PostgreSQL
- Extrai estrutura das tabelas
- Converte tipos Oracle → PostgreSQL
- Migra todos os dados
- Cria índices
- Gera relatórios

**Uso:**
```bash
node scripts/migracao_impostos/migracao_completa.js
```

**⚠️ Atenção:** Este script sobrescreve os dados existentes (TRUNCATE).

---

### resumo.js (13.6 KB)
Exibe um resumo visual da migração com:
- Status de cada tabela
- Contagem de registros
- Lista de índices
- Teste de performance
- Arquivos disponíveis
- Comandos úteis

**Uso:**
```bash
node scripts/migracao_impostos/resumo.js
```

**Exemplo de saída:**
```
╔═══════════════════════════════════════════╗
║  RESUMO DA MIGRAÇÃO - TABELAS DE IMPOSTOS ║
╚═══════════════════════════════════════════╝

TABELAS MIGRADAS:
✅ cad_legislacao_icmsst (16 registros)
✅ cad_legislacao_icmsst_ncm (1.823 registros)
✅ fis_tributo_aliquota (249 registros)
✅ dbcest (1.119 registros)
```

---

### debug_tables.js (2.2 KB)
Verifica a estrutura e dados das 4 tabelas.

**Funcionalidades:**
- Lista todas as colunas com tipos
- Conta registros
- Exibe amostra de 2 registros por tabela

**Uso:**
```bash
node scripts/migracao_impostos/debug_tables.js
```

**Exemplo de saída:**
```
TABELA: CAD_LEGISLACAO_ICMSST_NCM
Colunas (6):
  - LIN_ID: numeric NOT NULL
  - LIN_NCM: varchar(9) NOT NULL
  - LIN_MVA_ST_ORIGINAL: numeric
Total de registros: 1823
```

---

### testar_consultas.js (5.2 KB)
Executa 6 testes de validação nas tabelas.

**Testes:**
1. Buscar MVA por NCM
2. Contar NCMs por protocolo
3. Buscar CESTs de autopeças
4. Buscar alíquota por código
5. Estatísticas gerais
6. Performance de índice (EXPLAIN ANALYZE)

**Uso:**
```bash
node scripts/migracao_impostos/testar_consultas.js
```

**Exemplo de saída:**
```
1. TESTE: Buscar MVA para NCM 84213920
✓ Encontrado!
{
  "LEI_PROTOCOLO": "36",
  "mva_percentual": "71.780"
}

6. TESTE: Performance de busca por NCM
✓ Plano de execução:
Execution Time: 0.124 ms
```

---

### criar_indices.js (3.3 KB)
Cria todos os 11 índices de otimização.

**Índices criados:**
- 2 índices em CAD_LEGISLACAO_ICMSST
- 5 índices em CAD_LEGISLACAO_ICMSST_NCM (incluindo composto)
- 1 índice em FIS_TRIBUTO_ALIQUOTA
- 3 índices em DBCEST

**Uso:**
```bash
node scripts/migracao_impostos/criar_indices.js
```

**Exemplo de saída:**
```
✓ idx_legislacao_icmsst_protocolo (cad_legislacao_icmsst)
✓ idx_legislacao_ncm_ncm (cad_legislacao_icmsst_ncm)
✓ idx_dbcest_cest (dbcest)
...
Total: 11/11 índices criados
```

---

## 📝 Scripts SQL Individuais

### cad_legislacao_icmsst_create.sql (360 bytes)
CREATE TABLE da tabela de legislação.

### cad_legislacao_icmsst_ncm_create.sql (264 bytes)
CREATE TABLE da tabela NCM (CRÍTICA).

### fis_tributo_aliquota_create.sql (128 bytes)
CREATE TABLE da tabela de alíquotas.

### dbcest_create.sql (135 bytes)
CREATE TABLE da tabela CEST.

---

## 📊 Logs

### migracao_log.txt (433 KB)
Log completo da execução da migração com timestamps.

**Contém:**
- Detalhes de cada tabela migrada
- Erros e avisos
- Contadores de progresso
- Verificações finais

**Visualizar:**
```bash
cat migracao_log.txt | tail -100  # Últimas 100 linhas
```

---

## 🚀 Quick Start

### 1. Visualizar Resumo
```bash
node scripts/migracao_impostos/resumo.js
```

### 2. Verificar Estrutura
```bash
node scripts/migracao_impostos/debug_tables.js
```

### 3. Testar Consultas
```bash
node scripts/migracao_impostos/testar_consultas.js
```

### 4. Consultar Exemplos
```bash
cat scripts/migracao_impostos/exemplo_consultas.sql
```

---

## 📈 Estatísticas dos Arquivos

| Tipo | Quantidade | Tamanho Total |
|------|------------|---------------|
| Documentação (.md) | 3 | 23 KB |
| Scripts SQL | 8 | 16 KB |
| Scripts Node.js | 5 | 39 KB |
| Logs | 1 | 433 KB |
| **TOTAL** | **17** | **511 KB** |

---

## 🔧 Manutenção

### Atualizar dados do Oracle
```bash
node scripts/migracao_impostos/migracao_completa.js
```

### Recriar índices
```bash
node scripts/migracao_impostos/criar_indices.js
```

### Validar migração
```bash
node scripts/migracao_impostos/testar_consultas.js
```

---

## 📞 Suporte

Para problemas ou dúvidas:

1. Consulte `README.md` para instruções
2. Verifique `RELATORIO_MIGRACAO.md` para detalhes
3. Execute `resumo.js` para verificar status
4. Execute `testar_consultas.js` para validar

---

**Última atualização:** 2026-01-09
**Versão:** 1.0
**Status:** ✅ Produção Ready
