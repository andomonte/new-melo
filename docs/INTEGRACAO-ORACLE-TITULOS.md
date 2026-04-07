# 📋 Integração Oracle - Procedures de Títulos e Pagamentos

## 🎯 Objetivo
Documentar as procedures Oracle do sistema legado relacionadas a títulos e pagamentos para integração com o novo sistema Node.js/Next.js.

---

## 📦 Procedures Analisadas

### 1. **CARREGA_TITULOS**
**Função:** Carrega títulos de uma fatura específica

**Parâmetros:**
- `vParam` (VARCHAR2, IN) - Código da fatura (cod_fat)
- `Cursor_ContasR` (REF CURSOR, OUT) - Cursor com os títulos

**Retorna:**
- nro_doc, cod_receb, cod_conta, cod_fat, nroform
- valor_pgto, valor_rec
- dt_venc, dt_pgto, dt_emissao
- tipo, rec (status recebimento)
- codcli, nome (cliente)
- nro_conta

**Uso no Sistema:**
```javascript
// Exemplo de integração
async function carregarTitulosFatura(codFat) {
  const connection = await oracledb.getConnection(config);
  const result = await connection.execute(
    `BEGIN CARREGA_TITULOS(:vParam, :cursor); END;`,
    {
      vParam: codFat,
      cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
    }
  );
  
  const resultSet = result.outBinds.cursor;
  const rows = await resultSet.getRows();
  await resultSet.close();
  
  return rows;
}
```

---

### 2. **CLIENTE_TITULO**
**Função:** Consulta títulos de um cliente com cálculo de juros e diferentes filtros

**Parâmetros:**
- `vTipo` (VARCHAR2, IN) - Tipo de filtro:
  - '1' = Títulos atrasados com juros
  - '2' = Títulos em dia
  - '3' = Vencimentos agrupados por mês
  - '4' = Histórico de vendas (últimos 3 meses)
  - '5' = Histórico de prazo médio
  - '6' = Títulos a vencer
- `vTxJuros` (NUMBER, IN) - Taxa de juros (ex: 8 para 8%)
- `vParam` (VARCHAR2, IN) - Código do cliente
- `cur_receb` (REF CURSOR, OUT) - Cursor com resultados

**Cálculo de Juros:**
```sql
-- Taxa por dia = vTxJuros / 3000
-- Exemplo: 8% ao mês = 8/3000 = 0.00266% ao dia
valor_juros = valor_pgto * nro_dias * (vTxJuros / 3000)
```

**Classificação de Vencimento:**
- Ajusta vencimento para fim de semana usando `VENCIMENTO_FIM_SEMANA()`
- Calcula dias de atraso: `TRUNC(SYSDATE) - dt_venc`
- Calcula juros proporcionalmente aos dias

**Tabelas Auxiliares:**
- Usa `DBRECEBAUX` para armazenar cálculos temporários de juros e dias

**Retornos por Tipo:**

**Tipo 1 (Atrasados):**
- nro_doc, cod_receb, dt_emissao, dt_pgto, dt_venc
- valor_pgto, valor_rec, valor_aberto (pgto + juros - rec)
- dias, valor_juros
- codcli, nome

**Tipo 3 (Vencimentos por Mês):**
- Vecimento (mm/yyyy)
- Pagamento (soma dos valores)

**Tipo 6 (A Vencer):**
- Títulos com dt_venc > SYSDATE

---

### 3. **LIBERA_TITULOS**
**Função:** Libera títulos de restrição (campo BRADESCO), reseta vencimento para hoje

**Parâmetros:**
- `vcodigo` (VARCHAR2, IN) - Código da fatura ou grupo
- `vUName` (VARCHAR2, IN) - Nome do usuário
- `vtipo` (VARCHAR2, IN) - Tipo de liberação:
  - '1' = Por fatura (COD_FAT)
  - '2' = Por grupo (CODGP)

**Ação:**
```sql
UPDATE DBRECEB 
SET BRADESCO = 'N', DT_VENC = SYSDATE 
WHERE COD_FAT = vcodigo  -- se vtipo = '1'
   OR CODGP = vcodigo     -- se vtipo = '2'
```

**Log:** Registra ação do usuário em auditoria

---

### 4. **RECEB_TOTAL_TITULO**
**Função:** Calcula valor total recebido de um título até uma data

**Parâmetros:**
- `vCod_Receb` (VARCHAR2, IN) - Código do título
- `vDia` (DATE, IN) - Data limite
- `Valor` (NUMBER, OUT) - Valor total recebido

**Lógica:**
```sql
SELECT SUM(valor) 
FROM dbfreceb 
WHERE cod_receb = vCod_Receb 
  AND dt_pgto <= vDia 
  AND (tipo <= '05' OR tipo > '09')
```

**Uso:**
- Calcula recebimentos parciais
- Filtra tipos específicos de pagamento (exclui 06-09)

---

### 5. **SAV_UPDATE_TITULOS**
**Função:** Atualiza tabela consolidada de títulos de todas as filiais

**Características:**
- **Multi-filial:** Consolida dados de 4 filiais (codorigem 1-4)
- **Truncate:** Limpa tabela antes de recarregar
- **Database Links:** Usa @lnkmelodbrec, @lnkmelodbpvh, @lnkmelodbflz

**Campos Calculados:**
1. **Código do Banco:**
```sql
CASE 
  WHEN COD_CONTA IN ('0003', '0006') THEN 2  -- BRADESCO
  WHEN COD_CONTA IN ('0007', '0008') THEN 1  -- BANCO DO BRASIL
  WHEN COD_CONTA IN ('0104', '0106') THEN 3  -- ITAÚ
  WHEN COD_CONTA IN ('0124') THEN 5          -- RURAL
  WHEN COD_CONTA IN ('0133') THEN 4          -- REAL
  ELSE 100 
END
```

2. **Juros:**
```sql
-- Se recebido com atraso:
(8 / 3000) * valor_pgto * ROUND(dt_pgto - dt_venc, 0)

-- Se em aberto e atrasado:
(8 / 3000) * valor_pgto * ROUND(SYSDATE - dt_venc, 0)
```

3. **Status:**
- `recebido`: 1 se rec='S', 0 caso contrário
- `cancelado`: 1 se CANCEL='S'
- `vencido`: 1 se atrasado
- `dias_atrasado`: Dias de atraso calculado

4. **Compensação:**
- `valor_compensado`: Maior entre valor_compensado e valor_rec
- `valor_acompensar`: Valores pendentes de compensação

**Tabelas Relacionadas:**
- `DBRECEB` - Títulos receber
- `DBFPRERECEB` - Pré-recebimentos (compensação)

---

### 6. **TITULO_REM_NORMAL_AVISTA**
**Função:** Lista títulos para remessa - pagos à vista

**Parâmetros:**
- `vDt1`, `vDt2` (DATE, IN) - Período de vencimento
- `vTipofat` (VARCHAR2, IN) - Tipo de faturamento
- `cur_titulos` (REF CURSOR, OUT) - Cursor com títulos

**Filtros:**
```sql
WHERE dt_venc BETWEEN vDt1 AND vDt2
  AND forma_fat = '2'           -- Remessa normal
  AND dt_emissao = dt_pgto      -- Pago na emissão (à vista)
  AND cancel = 'N'
  AND f.tipofat = vTipofat
```

**Retorna:**
- DT_EMISSAO, DT_VENC, DT_PGTO
- NRO_TITULO, VALOR_TITULO
- CODCLI, NOME, CNPJ, TIPO
- TIPOFAT, DATACAD

---

### 7. **TITULOS_SERASA (Package)**
**Função:** Package com 3 procedures para remessa ao Serasa

#### 7.1. **Titulo_Rem_Normal_Avista**
- Títulos pagos à vista (dt_emissao = dt_pgto)
- forma_fat = '2'

#### 7.2. **Titulo_Rem_Normal_Avencer**
- Títulos a vencer (rec='N', valor_rec=0)
- dt_venc = venc_ant (vencimento original não alterado)
- forma_fat = '2'

#### 7.3. **Titulo_Rem_Normal_Pg_Parcial**
- Títulos pagos parcialmente
- valor_rec > 0 OR valor_pgto = valor_rec
- rec='N' (ainda não totalmente recebido)

**Parâmetros Comuns:**
- vDt1, vDt2 (DATE) - Período
- vTipofat (VARCHAR2) - Tipo faturamento
- cur_titulos (REF CURSOR OUT) - Resultado

---

## 🔗 Tabelas Principais

### DBRECEB (Contas a Receber)
```sql
- cod_receb (PK)         -- Código do título
- nro_doc                -- Número documento
- cod_fat                -- Código fatura
- codcli                 -- Código cliente
- valor_pgto             -- Valor nominal
- valor_rec              -- Valor recebido
- dt_emissao             -- Data emissão
- dt_venc                -- Data vencimento
- dt_pgto                -- Data pagamento
- venc_ant               -- Vencimento original
- rec (S/N)              -- Recebido?
- cancel (S/N)           -- Cancelado?
- tipo                   -- Tipo título (F/S/G/T)
- forma_fat              -- Forma faturamento
- cod_conta              -- Conta financeira
- bradesco               -- Flag bloqueio
- nro_banco              -- Número banco
```

### DBFATURA (Faturas)
```sql
- codfat (PK)
- codcli
- data
- totalfat
- tipofat
- nroform
```

### DBFRECEB (Movimentos Pagamento)
```sql
- cod_receb              -- FK para DBRECEB
- dt_pgto                -- Data pagamento
- valor                  -- Valor pago
- tipo                   -- Tipo movimentação
```

### DBFPRERECEB (Pré-Recebimentos)
```sql
- cod_receb              -- FK para DBRECEB
- valor                  -- Valor
- sf (S/P/N)             -- Status (S=compensado, P/N=a compensar)
```

### DBRECEBAUX (Auxiliar - Temporária)
```sql
- cod_receb
- dias                   -- Dias atraso
- valor_juros            -- Juros calculados
```

---

## 💡 Regras de Negócio Identificadas

### Taxa de Juros Padrão
- **8% ao mês** = 0.00266% ao dia
- Fórmula: `(8 / 3000) * valor * dias`

### Classificação de Títulos
- **Tipo F/S/G/T**: Títulos válidos para consulta
- **rec='N'**: Não recebido
- **rec='S'**: Recebido
- **cancel='N'**: Ativo

### Forma de Faturamento
- **'2'**: Remessa normal (boleto bancário)

### Vencimento Fim de Semana
- Sistema ajusta vencimentos para próximo dia útil
- Usa função `VENCIMENTO_FIM_SEMANA()`

### Mapeamento de Bancos
| Código Conta | Banco             | Código |
|--------------|-------------------|--------|
| 0003, 0006   | Bradesco          | 2      |
| 0007, 0008   | Banco do Brasil   | 1      |
| 0104, 0106   | Itaú              | 3      |
| 0124         | Rural             | 5      |
| 0133         | Real              | 4      |

---

## 🔧 Estratégias de Integração

### Opção 1: Chamar Procedures Diretamente
```javascript
// Vantagem: Reutiliza lógica existente
// Desvantagem: Dependência do Oracle

const oracledb = require('oracledb');

async function consultarTitulosCliente(codcli, tipo, txJuros) {
  const connection = await oracledb.getConnection(dbConfig);
  
  const result = await connection.execute(
    `BEGIN CLIENTE_TITULO(:tipo, :txjuros, :codcli, :cursor); END;`,
    {
      tipo: tipo,
      txjuros: txJuros,
      codcli: codcli,
      cursor: { type: oracledb.CURSOR, dir: oracledb.BIND_OUT }
    }
  );
  
  const cursor = result.outBinds.cursor;
  const rows = await cursor.getRows();
  await cursor.close();
  await connection.close();
  
  return rows;
}
```

### Opção 2: Replicar Lógica em TypeScript
```typescript
// Vantagem: Independente do Oracle
// Desvantagem: Manter duas versões da lógica

interface TituloCliente {
  nro_doc: string;
  cod_receb: string;
  valor_pgto: number;
  valor_rec: number;
  dt_venc: Date;
  dias_atraso: number;
  valor_juros: number;
}

async function calcularJurosTitulo(
  valorPgto: number,
  dtVenc: Date,
  txJuros: number = 8
): Promise<{ dias: number; juros: number }> {
  const hoje = new Date();
  const vencimento = new Date(dtVenc);
  
  // Calcula dias de atraso
  const dias = vencimento < hoje 
    ? Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Taxa ao dia = txJuros / 3000
  const txDia = txJuros / 3000;
  const juros = valorPgto * dias * txDia;
  
  return { dias, juros };
}

async function consultarTitulosAtrasados(codcli: string) {
  // Consulta no PostgreSQL (novo sistema)
  const titulos = await prisma.dbreceb.findMany({
    where: {
      codcli: codcli,
      cancel: 'N',
      rec: 'N',
      dt_venc: {
        lt: new Date()
      },
      tipo: {
        in: ['F', 'S', 'G', 'T']
      }
    },
    include: {
      cliente: true
    }
  });
  
  // Calcula juros para cada título
  const titulosComJuros = await Promise.all(
    titulos.map(async (titulo) => {
      const { dias, juros } = await calcularJurosTitulo(
        titulo.valor_pgto,
        titulo.dt_venc
      );
      
      return {
        ...titulo,
        dias_atraso: dias,
        valor_juros: juros,
        valor_aberto: titulo.valor_pgto + juros - titulo.valor_rec
      };
    })
  );
  
  return titulosComJuros;
}
```

### Opção 3: Híbrida (Recomendada)
```typescript
// Usa PostgreSQL para consultas rápidas
// Chama Oracle apenas para operações críticas/complexas

class TitulosService {
  
  // Consulta rápida no PostgreSQL
  async listarTitulosCliente(codcli: string) {
    return prisma.dbreceb.findMany({
      where: { codcli, cancel: 'N' }
    });
  }
  
  // Operações complexas chamam Oracle
  async liberarTitulos(codigo: string, tipo: '1' | '2', username: string) {
    const oracleConn = await getOracleConnection();
    
    await oracleConn.execute(
      `BEGIN LIBERA_TITULOS(:codigo, :username, :tipo); END;`,
      { codigo, username, tipo }
    );
    
    await oracleConn.close();
  }
  
  // Sincronização periódica
  async sincronizarTitulos() {
    // Busca dados atualizados do Oracle
    const oracleConn = await getOracleConnection();
    
    const result = await oracleConn.execute(
      `SELECT * FROM SAV_TITULOS WHERE codorigem = 1`
    );
    
    // Atualiza PostgreSQL
    for (const row of result.rows) {
      await prisma.dbreceb.upsert({
        where: { cod_receb: row.CODTITULO },
        update: { /* campos */ },
        create: { /* campos */ }
      });
    }
    
    await oracleConn.close();
  }
}
```

---

## 📊 Mapeamento para o Novo Sistema

### Campos do Formulário "Marcar como Pago"

| Campo Frontend | Tabela Oracle | Campo Oracle | Tipo |
|----------------|---------------|--------------|------|
| dt_pgto | DBRECEB | DT_PGTO | DATE |
| valor_pago | DBFRECEB | VALOR | NUMBER |
| valor_juros | DBRECEBAUX | VALOR_JUROS | NUMBER |
| banco | DBRECEB | NRO_BANCO | VARCHAR2 |
| forma_pgto | DBRECEB | FORMA_FAT | VARCHAR2 |
| comprovante | - | - | Novo campo |
| cod_ccusto | - | - | Novo campo |
| cod_conta | DBRECEB | COD_CONTA | VARCHAR2 |
| obs | - | - | Novo campo |

### Procedure Sugerida para Marcar como Pago

```sql
CREATE OR REPLACE PROCEDURE MARCAR_TITULO_PAGO(
  p_cod_receb IN VARCHAR2,
  p_dt_pgto IN DATE,
  p_valor_pago IN NUMBER,
  p_valor_juros IN NUMBER,
  p_banco IN VARCHAR2,
  p_forma_pgto IN VARCHAR2,
  p_cod_conta IN VARCHAR2,
  p_username IN VARCHAR2,
  p_obs IN VARCHAR2 DEFAULT NULL
) IS
  v_codusr NUMBER;
BEGIN
  -- Busca usuário
  SELECT codusr INTO v_codusr 
  FROM dbusuario 
  WHERE nomeusr = p_username;
  
  -- Atualiza título
  UPDATE DBRECEB 
  SET dt_pgto = p_dt_pgto,
      valor_rec = valor_rec + p_valor_pago,
      rec = CASE WHEN (valor_rec + p_valor_pago) >= valor_pgto THEN 'S' ELSE 'N' END,
      nro_banco = p_banco,
      forma_fat = p_forma_pgto,
      cod_conta = p_cod_conta
  WHERE cod_receb = p_cod_receb;
  
  -- Registra movimento de pagamento
  INSERT INTO DBFRECEB (
    cod_receb, dt_pgto, valor, tipo, obs
  ) VALUES (
    p_cod_receb, p_dt_pgto, p_valor_pago, '01', p_obs
  );
  
  -- Registra juros se houver
  IF p_valor_juros > 0 THEN
    INSERT INTO DBFRECEB (
      cod_receb, dt_pgto, valor, tipo, obs
    ) VALUES (
      p_cod_receb, p_dt_pgto, p_valor_juros, '02', 'Juros de atraso'
    );
  END IF;
  
  -- Log de auditoria
  Usuario.inc_acao_usr(
    v_codusr, 
    'MARCAR_PAGO', 
    'DBRECEB', 
    'COD:' || p_cod_receb || ' VALOR:' || p_valor_pago
  );
  
  COMMIT;
END;
```

---

## ✅ Próximos Passos

1. **Criar Procedures de Integração**
   - [ ] MARCAR_TITULO_PAGO
   - [ ] CALCULAR_JUROS_TITULO
   - [ ] CONSULTAR_TITULOS_CLIENTE_SIMPLIFICADO

2. **Implementar Serviços Node.js**
   - [ ] TitulosService.ts
   - [ ] OracleConnectionPool.ts
   - [ ] CalculoJurosHelper.ts

3. **Atualizar API Endpoints**
   - [ ] GET /api/titulos/cliente/:codcli
   - [ ] POST /api/titulos/:id/marcar-pago
   - [ ] GET /api/titulos/:id/calcular-juros

4. **Migração de Dados**
   - [ ] Script para sincronizar DBRECEB Oracle → PostgreSQL
   - [ ] Job periódico de sincronização (cron)
   - [ ] Validação de integridade

5. **Testes**
   - [ ] Testar cálculo de juros (comparar Oracle vs TypeScript)
   - [ ] Testar marcar como pago
   - [ ] Testar consultas com filtros

---

## 📞 Contatos Técnicos

- **Database Oracle:** 201.64.221.132:1524/desenv.mns.melopecas.com.br
- **Usuário:** GERAL
- **Schema:** GERAL
- **Instant Client:** C:\oracle\instantclient_23_8

---

## 📚 Referências

- Arquivo completo: `docs/oracle-procedures-titulos.txt`
- Script de consulta: `scripts/consultar-procedures-titulos.js`
- Sistema legado: `projeto legado sistema melo/`
