# Guia de Validação e Deploy - Sistema de Impostos

**Versão:** 2.0
**Data:** 09/01/2026

---

## Checklist de Validação Pré-Deploy

### 1. Validação de Código

```bash
# Compilação TypeScript
npm run build

# Verificar erros de type
npx tsc --noEmit

# Linting
npm run lint

# Formatar código
npm run format
```

**Resultado esperado:** ✅ Sem erros

---

### 2. Testes Unitários

```bash
# Rodar todos os testes
npm test src/pages/api/impostos/__tests__

# Com coverage
npm test -- --coverage src/pages/api/impostos/__tests__

# Resultado esperado:
# - Todos os testes passando (15+)
# - Cobertura > 80%
```

**Resultado esperado:**
```
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Coverage:    > 80%
Time:        < 30s
```

---

### 3. Validação de Functions SQL

```sql
-- 1. Testar buscar_aliquota_ncm
SELECT * FROM buscar_aliquota_ncm('84715010', 2026);
-- Esperado: categoria, aliquota_ibs, aliquota_cbs

-- 2. Testar calcular_cfop
SELECT * FROM calcular_cfop('VENDA', 'AM', 'SP');
-- Esperado: cfop = '6102', descricao

-- 3. Testar determinar_cst_icms
SELECT * FROM determinar_cst_icms(true, false, false);
-- Esperado: cst = '10'

-- 4. Testar buscar_aliquota_icms
SELECT * FROM buscar_aliquota_icms('AM');
-- Esperado: aliquota_interna = 18, aliquota_interestadual = 12

-- 5. Testar calcular_mva_ajustado
SELECT * FROM calcular_mva_ajustado(40.0, 18.0, 12.0);
-- Esperado: mva_ajustado > 40.0 (aproximadamente 45.71)

-- 6. Validar view v_mva_ncm_uf_completa
SELECT COUNT(*) FROM v_mva_ncm_uf_completa;
-- Esperado: > 0

-- 7. Validar índices
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('db_ibs_cbs', 'dbsubst_trib', 'dbuf_n')
ORDER BY tablename, indexname;
-- Esperado: Índices em ncm, uf

-- 8. Validar performance
EXPLAIN ANALYZE SELECT * FROM buscar_aliquota_ncm('84715010', 2026);
-- Esperado: Planning time < 1ms, Execution time < 20ms
```

**Todos os testes devem retornar dados válidos.**

---

### 4. Validação de APIs (Manual)

#### API 1: /api/impostos

```bash
curl -X POST http://localhost:3000/api/impostos \
  -H "Content-Type: application/json" \
  -H "Cookie: filial_melo=BOA_VISTA" \
  -d '{
    "codProd": "000001",
    "codCli": "000001",
    "quantidade": 10,
    "valorUnitario": 1000,
    "tipoOperacao": "VENDA"
  }'
```

**Esperado:**
```json
{
  "cards": {
    "valorIPI": 5.00,
    "valorICMS": 18.00,
    "valorICMS_Subst": 0,
    "valorPIS": 1.65,
    "valorCOFINS": 7.60,
    "totalImpostos": 32.25
  },
  "aliquotas": { ... },
  "debug": { ... }
}
```

**Status:** 200 OK
**Tempo:** < 500ms

---

#### API 2: /api/impostos-ibs-cbs

```bash
curl -X POST http://localhost:3000/api/impostos-ibs-cbs \
  -H "Content-Type: application/json" \
  -H "Cookie: filial_melo=BOA_VISTA" \
  -d '{
    "codProd": "000001",
    "ano": 2026,
    "valorProduto": 1000
  }'
```

**Esperado:**
```json
{
  "ano": 2026,
  "ncm": "...",
  "categoria": "PADRAO",
  "aliquota_ibs": 27.00,
  "aliquota_cbs": 10.00,
  "valor_ibs": 270.00,
  "valor_cbs": 100.00,
  "informativo": true
}
```

**Status:** 200 OK
**Tempo:** < 500ms

---

#### API 3: /api/impostos/calcular-completo

```bash
curl -X POST http://localhost:3000/api/impostos/calcular-completo \
  -H "Content-Type: application/json" \
  -H "Cookie: filial_melo=BOA_VISTA" \
  -d '{
    "itens": [
      {
        "codprod": "000001",
        "quantidade": 10,
        "valor_unitario": 1000
      },
      {
        "codprod": "000002",
        "quantidade": 5,
        "valor_unitario": 500
      }
    ],
    "codcli": "000001",
    "tipo_operacao": "VENDA"
  }'
```

**Esperado:**
```json
{
  "ok": true,
  "resultado": {
    "itens": [ ... ],
    "totais": {
      "valor_produtos": 12500.00,
      "total_icms": 2250.00,
      ...
    }
  }
}
```

**Status:** 200 OK
**Tempo:** < 2s (2 itens)

---

### 5. Teste de Integração com finalizarVenda

```bash
curl -X POST http://localhost:3000/api/vendas/finalizarVenda \
  -H "Content-Type: application/json" \
  -H "Cookie: filial_melo=BOA_VISTA" \
  -d '{
    "header": {
      "codcli": "000001",
      "codusr": "1",
      "tipo": "P",
      "tele": "N"
    },
    "itens": [
      {
        "codprod": "000001",
        "qtd": 1,
        "prunit": 1000,
        "arm_id": 1
      }
    ]
  }'
```

**Esperado:**
```json
{
  "ok": true,
  "codvenda": "000000123",
  "nrovenda": "000000456",
  "status": "N",
  "total": 1000.00
}
```

**Validar:**
1. Venda criada em Oracle
2. Venda criada em Postgres
3. Estoque atualizado
4. Impostos calculados e salvos em `dbitvenda`

**Queries de validação:**
```sql
-- Postgres
SELECT * FROM dbvenda WHERE codvenda = '000000123';
SELECT * FROM dbitvenda WHERE codvenda = '000000123';

-- Verificar se tem impostos
SELECT
  codprod,
  icms,
  baseicms,
  totalicms,
  ipi,
  totalipi,
  pis,
  valorpis,
  cofins,
  valorcofins,
  cfop,
  csticms
FROM dbitvenda
WHERE codvenda = '000000123';
-- Esperado: Todos os campos preenchidos (não null)
```

---

### 6. Teste de Performance

```bash
# Criar script de teste de carga
cat > test_performance.sh << 'EOF'
#!/bin/bash

ENDPOINT="http://localhost:3000/api/impostos/calcular-completo"
COOKIE="filial_melo=BOA_VISTA"

echo "Testando performance com 100 requisições..."

for i in {1..100}; do
  RESPONSE_TIME=$(curl -X POST $ENDPOINT \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    -d '{
      "itens": [
        {"codprod": "000001", "quantidade": 10, "valor_unitario": 1000}
      ],
      "codcli": "000001",
      "tipo_operacao": "VENDA"
    }' \
    -w "%{time_total}\n" \
    -o /dev/null \
    -s)

  echo "Request $i: ${RESPONSE_TIME}s"
done | awk '{sum+=$NF; count++} END {print "Média:", sum/count, "s"}'
EOF

chmod +x test_performance.sh
./test_performance.sh
```

**Resultado esperado:**
- Média < 0.5s (500ms)
- Sem erros 500
- Sem memory leaks

---

### 7. Validação de Cenários Específicos

#### Cenário 1: Venda Intraestadual

```sql
-- Input simulado
NCM: '85171231'
UF Empresa: 'AM'
UF Cliente: 'AM'
Valor: 1000.00

-- Validar resultado
ICMS: 18% (interna)
CFOP: '5102'
CST ICMS: '00'
ST: Não aplicável
```

#### Cenário 2: Venda Interestadual com ST

```sql
-- Input simulado
NCM: '84715010'
UF Empresa: 'AM'
UF Cliente: 'SP'
Valor: 3000.00
IPI: 5%

-- Validar resultado
ICMS: 12% (interestadual)
CFOP: '6102'
CST ICMS: '10'
ST: Sim
MVA Ajustado: ~45.71%
Base ST: ~4589.87
Valor ST: > 0
```

#### Cenário 3: Exportação

```sql
-- Input simulado
Tipo Operação: 'EXPORTACAO'
Valor: 5000.00

-- Validar resultado
ICMS: 0%
IBS: 0%
CBS: 0%
CST IPI: '53'
CST PIS/COFINS: '08'
```

---

## Deploy em Homologação

### Pré-requisitos

1. **Banco de dados preparado:**
   - Functions criadas
   - Views criadas
   - Tabelas migradas
   - Índices criados

2. **Variáveis de ambiente configuradas:**
   ```env
   DATABASE_URL_BOA_VISTA=postgresql://...
   DATABASE_URL2=oracle://...  # Oracle
   NODE_ENV=staging
   ```

3. **Build validado:**
   ```bash
   npm run build
   # Sem erros
   ```

### Passos do Deploy

```bash
# 1. Backup do banco (segurança)
pg_dump db_manaus > backup_pre_deploy_impostos_$(date +%Y%m%d).sql

# 2. Pull do código
git pull origin main

# 3. Instalar dependências
npm install

# 4. Build
npm run build

# 5. Rodar migrations (se houver)
npm run migrate:up

# 6. Restart da aplicação
pm2 restart next-app

# 7. Verificar logs
pm2 logs next-app --lines 100

# 8. Smoke test
curl http://localhost:3000/api/impostos -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: filial_melo=BOA_VISTA" \
  -d '{"codProd":"000001","codCli":"000001","quantidade":1,"valorUnitario":100}'

# Esperado: Status 200, resposta JSON válida
```

### Validação Pós-Deploy

```bash
# 1. Verificar saúde da aplicação
curl http://localhost:3000/api/health

# 2. Verificar logs de erro
tail -f /var/log/next-app/error.log

# 3. Monitorar performance
# - Acessar dashboard de métricas
# - Verificar tempo de resposta
# - Verificar taxa de erro

# 4. Testar todas as APIs
./scripts/test_apis.sh

# 5. Criar venda de teste
# - Usar interface web
# - Verificar cálculo de impostos
# - Confirmar venda
# - Validar no banco
```

---

## Deploy em Produção

### Estratégia: Blue-Green Deploy

1. **Preparação:**
   - Deploy em servidor green (novo)
   - Validar funcionamento
   - Configurar load balancer

2. **Execução:**
   - Redirecionar 10% do tráfego para green
   - Monitorar por 1 hora
   - Se OK, redirecionar 50%
   - Monitorar por 2 horas
   - Se OK, redirecionar 100%

3. **Rollback (se necessário):**
   - Redirecionar tráfego de volta para blue
   - Investigar problemas
   - Corrigir e repetir processo

### Checklist Pré-Produção

- [ ] Todos os testes passando
- [ ] Performance validada (< 500ms)
- [ ] Documentação atualizada
- [ ] Equipe treinada
- [ ] Plano de rollback pronto
- [ ] Backup do banco realizado
- [ ] Monitoramento configurado
- [ ] Alertas configurados
- [ ] Comunicação enviada aos usuários
- [ ] Janela de manutenção agendada (se necessário)

### Comunicação

**Template de email:**

```
Assunto: [IMPORTANTE] Atualização do Sistema de Cálculo de Impostos

Prezados,

Informamos que será realizada a atualização do sistema de cálculo de impostos.

Data: [DATA]
Horário: [HORÁRIO]
Duração estimada: 30 minutos
Impacto: Nenhum (deploy sem downtime)

Principais melhorias:
- Performance 56% mais rápida
- Cálculo automático no backend
- Suporte à Reforma Tributária 2026 (IBS/CBS)
- Cálculo de ST com MVA ajustado
- Validações robustas

Em caso de dúvidas, entre em contato com a equipe de TI.

Atenciosamente,
Equipe de TI
```

---

## Monitoramento Pós-Deploy

### Métricas a Monitorar

1. **Performance:**
   - Tempo de resposta médio
   - P95, P99
   - Requests por segundo
   - Taxa de erro

2. **Negócio:**
   - Vendas finalizadas com sucesso
   - Erros de cálculo reportados
   - Diferenças vs sistema antigo

3. **Infraestrutura:**
   - CPU usage
   - Memory usage
   - Database connections
   - Query performance

### Alertas Configurados

```yaml
# alerts.yml
alerts:
  - name: response_time_high
    condition: avg(response_time) > 500ms
    duration: 5m
    severity: warning

  - name: error_rate_high
    condition: sum(errors) / sum(requests) > 0.01
    duration: 1m
    severity: critical

  - name: calculation_difference
    condition: abs(new_calculation - old_calculation) > 1.00
    severity: warning
```

### Queries de Monitoramento

```sql
-- 1. Vendas finalizadas hoje
SELECT COUNT(*) as total_vendas
FROM dbvenda
WHERE data = CURRENT_DATE;

-- 2. Itens com impostos zerados (potencial problema)
SELECT COUNT(*) as itens_sem_impostos
FROM dbitvenda
WHERE codvenda IN (
  SELECT codvenda FROM dbvenda WHERE data = CURRENT_DATE
)
AND (icms IS NULL OR icms = 0)
AND (ipi IS NULL OR ipi = 0);

-- 3. Performance média de cálculo
SELECT
  COUNT(*) as total_calculos,
  AVG(duracao_ms) as media_ms,
  MAX(duracao_ms) as max_ms,
  MIN(duracao_ms) as min_ms
FROM log_calculo_impostos
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- 4. Erros de cálculo
SELECT COUNT(*) as total_erros
FROM log_calculo_impostos
WHERE timestamp > NOW() - INTERVAL '1 hour'
AND status = 'ERROR';
```

---

## Troubleshooting Pós-Deploy

### Problema: Impostos zerados

**Sintomas:**
- Vendas salvas com ICMS = 0
- Base de cálculo = 0

**Investigação:**
```sql
-- Verificar última venda
SELECT * FROM dbitvenda
ORDER BY codvenda DESC LIMIT 1;

-- Verificar logs
SELECT * FROM log_calculo_impostos
ORDER BY timestamp DESC LIMIT 10;
```

**Solução:**
1. Verificar se produto tem NCM cadastrado
2. Verificar se cliente tem UF cadastrada
3. Verificar logs de erro da aplicação
4. Recalcular manualmente se necessário

---

### Problema: Performance degradada

**Sintomas:**
- Tempo de resposta > 1s
- Timeout em requisições

**Investigação:**
```sql
-- Queries lentas
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Conexões ativas
SELECT COUNT(*) FROM pg_stat_activity;

-- Locks
SELECT * FROM pg_locks WHERE NOT granted;
```

**Solução:**
1. Aumentar pool de conexões (se necessário)
2. Adicionar índices faltantes
3. Otimizar queries lentas
4. Escalar horizontalmente (se necessário)

---

### Problema: Diferenças vs sistema antigo

**Sintomas:**
- Usuários reportam valores diferentes
- Contabilidade questiona cálculos

**Investigação:**
1. Capturar exemplo específico
2. Executar cálculo em ambos sistemas
3. Comparar passo a passo:
   - ICMS
   - ST
   - IPI
   - PIS/COFINS

**Solução:**
1. Validar qual cálculo está correto (consultar legislação)
2. Ajustar lógica se necessário
3. Documentar diferença
4. Comunicar aos usuários

---

## Rollback

### Quando fazer rollback:

- Taxa de erro > 5%
- Performance degradada (> 2s)
- Diferenças significativas de cálculo (> R$ 10,00)
- Bugs críticos descobertos

### Procedimento de Rollback:

```bash
# 1. Reverter para versão anterior
git checkout <commit-anterior>

# 2. Rebuild
npm run build

# 3. Restart
pm2 restart next-app

# 4. Restaurar banco (se necessário)
psql db_manaus < backup_pre_deploy_impostos_YYYYMMDD.sql

# 5. Validar
curl http://localhost:3000/api/health

# 6. Comunicar equipe
# Enviar email informando rollback
```

---

## Documentação de Incidentes

**Template:**

```markdown
# Incidente: [TÍTULO]

**Data:** [DATA]
**Horário:** [INÍCIO] - [FIM]
**Severidade:** [BAIXA/MÉDIA/ALTA/CRÍTICA]
**Impacto:** [DESCRIÇÃO]

## Linha do Tempo

- HH:MM - Incidente detectado
- HH:MM - Equipe notificada
- HH:MM - Investigação iniciada
- HH:MM - Causa raiz identificada
- HH:MM - Correção aplicada
- HH:MM - Incidente resolvido

## Causa Raiz

[DESCRIÇÃO DETALHADA]

## Impacto

- Usuários afetados: X
- Vendas afetadas: Y
- Duração: Z minutos

## Correção

[DESCRIÇÃO DA CORREÇÃO]

## Prevenção

[AÇÕES PARA PREVENIR RECORRÊNCIA]

## Lições Aprendidas

1. [LIÇÃO 1]
2. [LIÇÃO 2]
```

---

## Contato e Suporte

**Equipe de Desenvolvimento:**
- Email: dev@meloDistribuidora.com.br
- Slack: #sistema-impostos
- On-call: [TELEFONE]

**Documentação:**
- `/docs/CALCULO_IMPOSTOS.md`
- `/docs/RESUMO_REESCRITA_IMPOSTOS.md`
- `/docs/VALIDACAO_E_DEPLOY.md` (este arquivo)

**Repositório:**
- GitHub: [URL]
- Branch: main
- CI/CD: [URL]

---

**Última atualização:** 09/01/2026
**Versão:** 2.0
