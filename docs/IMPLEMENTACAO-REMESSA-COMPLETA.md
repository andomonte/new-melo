# 📦 IMPLEMENTAÇÃO COMPLETA - REMESSA BANCÁRIA

## 🎯 Objetivo
Alinhar o sistema de remessa com o fluxo do cliente Oracle, implementando controles de flags, operações múltiplas (I/D/V) e filtros otimizados.

---

## ✅ IMPLEMENTAÇÕES REALIZADAS

### 1. **Estrutura de Banco de Dados**

#### ✓ Campos na tabela `dbreceb` (já existentes)
- `bradesco` VARCHAR(10) - Flag de controle (usado para TODOS os bancos)
  - 'N' = Não enviado ainda
  - 'S' = Já enviado em remessa
- `venc_ant` DATE - Vencimento anterior (para detectar prorrogação)
- `nro_banco` VARCHAR(20) - Nosso número do banco

#### ✓ Tabela `dbdocbodero_baixa_banco` (já existente)
- `cod_receb` - Código do título
- `export` INTEGER - Flag de exportação
  - 0 = Aguardando envio de baixa
  - 1 = Baixa já enviada

---

### 2. **Funções de Dígito Verificador**

**Arquivo:** `src/utils/cnab/digitoVerificador.ts`

#### Algoritmos implementados para 8 bancos:

1. **Bradesco (237)** - Módulo 11 base 2-7
2. **Banco do Brasil (001)** - Módulo 11 base 9-1, retorna 'X' se resto=10
3. **Itaú (341)** - Módulo 10 base 1-2 alternado
4. **Rural (453)** - Fórmula customizada (AG + TC + NC + DAC) % 9
5. **Santander (033)** - Módulo 11 base 8-1
6. **Safra (422)** - Módulo 11 base 9-1
7. **Citibank (745)** - Módulo 11 base 2-9
8. **Caixa (104)** - Módulo 11 base 2-9

#### Funções auxiliares:
- `calcularDigitoDocumento()` - Seleciona algoritmo por banco
- `gerarNossoNumeroCompleto()` - Gera nosso número + dígito
- `getConvenioBB()` - Retorna convênio BB (unificado após 21/05/2012)
- `CARTEIRAS_POR_BANCO` - Mapa de carteiras
- `CODIGO_EMPRESA_POR_BANCO` - Mapa de códigos cedente

---

### 3. **API de Seleção de Títulos**

**Arquivo:** `src/pages/api/remessa/titulos.ts`

**Endpoint:** `GET /api/remessa/titulos`

**Parâmetros:**
- `dtini` (obrigatório) - Data inicial
- `dtfim` (obrigatório) - Data final
- `banco` (opcional) - Código do banco para filtrar
- `conta` (opcional) - Código da conta bancária para filtrar

**Implementação das 3 UNIONs do Oracle:**

#### PARTE 1: NOVOS TÍTULOS (REMESSA)
```sql
WHERE r.bradesco = 'N'           -- Não enviado
  AND r.cancel = 'N'             -- Não cancelado
  AND r.rec = 'N'                -- Não recebido
  AND r.forma_fat = '2'          -- Boleto
  AND (venc_ant IS NULL OR dt_venc = venc_ant)  -- Sem alteração
```
**Resultado:** `situacao = 'REMESSA'`

#### PARTE 2: TÍTULOS PARA BAIXA
```sql
FROM dbdocbodero_baixa_banco db
WHERE export = 0                 -- Não exportado
```
**Resultado:** `situacao = 'BAIXAR TITULO'`

#### PARTE 3: TÍTULOS PRORROGADOS
```sql
WHERE venc_ant IS NOT NULL
  AND dt_venc <> venc_ant        -- Vencimento mudou
  AND r.bradesco = 'S'           -- Já foi enviado antes
```
**Resultado:** `situacao = 'PRORROGAR TITULO'`

**Retorno:**
```json
{
  "titulos": [...],
  "estatisticas": {
    "total": 100,
    "remessa": 85,
    "baixa": 10,
    "prorrogacao": 5,
    "valor_total": 250000.00
  },
  "por_banco": [
    {
      "banco": "237",
      "nome_banco": "BRADESCO",
      "titulos": 50,
      "valor_total": 125000.00,
      "remessa": 45,
      "baixa": 3,
      "prorrogacao": 2
    }
  ]
}
```

---

### 4. **API de Geração de Remessa CNAB 400**

**Arquivo:** `src/pages/api/remessa/bancaria/gerar-v2.ts`

**Endpoint:** `POST /api/remessa/bancaria/gerar`

**Parâmetros:**
- `dtini` (obrigatório)
- `dtfim` (obrigatório)
- `banco` (obrigatório)
- `conta` (opcional)

**Fluxo implementado:**

1. **Buscar títulos** usando a API de seleção (3 UNIONs)
2. **Gerar arquivo CNAB 400:**
   - Header com sequencial por banco
   - Detalhes com nosso número + dígito verificador
   - Código de operação por situação:
     - 01 = REMESSA (novo título)
     - 02 = BAIXA
     - 06 = PRORROGAÇÃO
   - Trailer com totalizador
3. **Salvar arquivo** em `public/remessas/bancaria/`
4. **Registrar no banco:**
   - `dbremessa_arquivo` com codbodero
   - `dbremessa_detalhe` com todos os títulos
5. **Atualizar flags:**
   - REMESSA → `bradesco='S'`, `venc_ant=dt_venc`
   - BAIXA → `export=1`
   - PRORROGAÇÃO → `bradesco='S'`, `venc_ant=dt_venc`

**Retorno:**
```json
{
  "sucesso": true,
  "codremessa": 1234,
  "codbodero": "000000567",
  "nome_arquivo": "REM_237_000001.REM",
  "caminho": "/remessas/bancaria/REM_237_000001.REM",
  "titulos_processados": 100,
  "estatisticas": {
    "remessa": 85,
    "baixa": 10,
    "prorrogacao": 5,
    "valor_total": 250000.00
  }
}
```

---

### 5. **API de Rollback (Reversão)**

**Arquivo:** `src/pages/api/remessa/rollback.ts`

**Endpoint:** `DELETE /api/remessa/rollback`

**Parâmetros:**
- `codremessa` OU `codbodero` (obrigatório)
- `deletar_arquivo` (opcional) - Se true, deleta arquivo físico

**Implementação do ROLLBACK_ALL do Oracle:**

1. Busca informações da remessa
2. Busca todos os títulos da remessa
3. **Reverte flags:**
   - REMESSA/PRORROGAÇÃO → `bradesco='N'`
   - BAIXA → `export=0`
4. Deleta registros de `dbremessa_detalhe`
5. Deleta registro de `dbremessa_arquivo`
6. Opcionalmente deleta arquivo físico

**Retorno:**
```json
{
  "sucesso": true,
  "mensagem": "Remessa revertida com sucesso",
  "remessa": {
    "codremessa": 1234,
    "codbodero": "000000567",
    "banco": "237",
    "nome_arquivo": "REM_237_000001.REM",
    "data_gerado": "2025-11-13"
  },
  "titulos_afetados": 100,
  "estatisticas": {
    "remessa": 85,
    "baixa": 10,
    "prorrogacao": 5
  }
}
```

---

## 🎨 OTIMIZAÇÕES PARA O CLIENTE

### 1. **Filtro por Banco na Listagem**

A API `/api/remessa/titulos` retorna agrupamento `por_banco`, permitindo:
- Visualizar quantos títulos tem por banco
- Filtrar e gerar remessa específica de cada banco
- Evitar misturar bancos em uma mesma remessa

**Exemplo de uso no frontend:**
```typescript
// Listar todos os títulos do período
const response = await fetch('/api/remessa/titulos?dtini=2025-11-01&dtfim=2025-11-30');
const { por_banco } = await response.json();

// Mostrar para o usuário:
// ✓ BRADESCO (237): 50 títulos - R$ 125.000,00
// ✓ SANTANDER (033): 30 títulos - R$ 75.000,00

// Gerar remessa só do Bradesco
await fetch('/api/remessa/bancaria/gerar', {
  method: 'POST',
  body: JSON.stringify({
    dtini: '2025-11-01',
    dtfim: '2025-11-30',
    banco: '237'
  })
});
```

### 2. **Indicadores Visuais por Situação**

- 🆕 REMESSA - Badge verde (novo título)
- ❌ BAIXAR TITULO - Badge vermelho (cancelar no banco)
- 🔄 PRORROGAR TITULO - Badge amarelo (vencimento alterado)

### 3. **Validação Antes de Gerar**

Antes de gerar remessa, mostrar resumo:
```
📊 Resumo da Remessa - BRADESCO

Período: 01/11/2025 a 30/11/2025

✓ 85 títulos novos          R$ 212.500,00
✓ 10 títulos para baixa     R$ 25.000,00
✓ 5 títulos prorrogados     R$ 12.500,00

Total: 100 títulos          R$ 250.000,00

[Confirmar] [Cancelar]
```

---

## 📋 DIFERENÇAS ORACLE vs NOVA IMPLEMENTAÇÃO

| Funcionalidade | Oracle | Nova Implementação | Status |
|---|---|---|---|
| Seleção de títulos (3 tipos) | ✅ UNION de 3 partes | ✅ UNION implementado | ✅ |
| Flag bradesco | ✅ 'N'/'S' | ✅ 'N'/'S' | ✅ |
| Campo venc_ant | ✅ DATE | ✅ DATE (já existe) | ✅ |
| Tabela de baixa | ✅ DBDOCBODERO_BAIXA_BANCO | ✅ dbdocbodero_baixa_banco | ✅ |
| Dígito verificador | ✅ 8 bancos | ✅ 8 algoritmos | ✅ |
| Convênio BB | ✅ Unificado após 21/05/2012 | ✅ 2552433/167 | ✅ |
| Operações I/D/V | ✅ Inclusão/Baixa/Alteração | ✅ Códigos 01/02/06 | ✅ |
| Rollback | ✅ ROLLBACK_ALL | ✅ API rollback | ✅ |
| Filtro por banco | ⚠️ Parâmetro simples | ✅ Com estatísticas | ✅ Melhorado |
| Filtro por conta | ✅ Por parâmetro | ✅ Opcional | ✅ |

---

## 🚀 PRÓXIMOS PASSOS SUGERIDOS

### 1. **Atualizar Frontend**
- Modificar componente de remessa para usar nova API
- Adicionar seletor de banco com estatísticas
- Implementar preview antes de gerar
- Adicionar botão de rollback com confirmação

### 2. **Testes**
- Testar geração de remessa com títulos novos
- Testar baixa de títulos
- Testar prorrogação
- Testar rollback

### 3. **Validações Adicionais**
- Validar CPF/CNPJ do pagador
- Validar endereço completo
- Validar dados bancários (agência, conta)

### 4. **Logs e Auditoria**
- Registrar quem gerou cada remessa
- Registrar quem fez rollback
- Histórico de alterações nos títulos

---

## 📖 DOCUMENTAÇÃO DE USO

### Gerar Remessa
```bash
POST /api/remessa/bancaria/gerar
{
  "dtini": "2025-11-01",
  "dtfim": "2025-11-30",
  "banco": "237",
  "conta": "0001" # opcional
}
```

### Consultar Títulos Disponíveis
```bash
GET /api/remessa/titulos?dtini=2025-11-01&dtfim=2025-11-30&banco=237
```

### Reverter Remessa
```bash
DELETE /api/remessa/rollback
{
  "codremessa": 1234,
  "deletar_arquivo": true
}
```

---

## ⚠️ IMPORTANTE

1. **Flag BRADESCO é usado para TODOS os bancos** (não só Bradesco)
2. **venc_ant deve ser atualizado** sempre que gerar remessa
3. **export=1 bloqueia** reenvio de baixa
4. **Rollback só deve ser feito** antes do retorno do banco
5. **Backup do arquivo** antes de fazer rollback

---

## 🎯 CONCLUSÃO

Sistema agora está **100% alinhado** com o fluxo do Oracle do cliente, com:
- ✅ Controle de flags correto
- ✅ 3 tipos de operação (I/D/V)
- ✅ Dígito verificador por banco
- ✅ Filtros otimizados
- ✅ Rollback completo
- ✅ Estatísticas por banco
