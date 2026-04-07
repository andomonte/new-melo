# 🔍 Análise Comparativa: Dar Baixa - Oracle vs Novo Sistema

## 📋 Resumo Executivo

Análise detalhada comparando a funcionalidade de "dar baixa" em contas a receber entre o sistema legado Oracle e a implementação atual em PostgreSQL/Next.js.

---

## 🏛️ Sistema Legado Oracle

### Procedures Envolvidas

#### 1. **ContasR_Baixa** (Principal)
```sql
PROCEDURE ContasR_Baixa(
  pCodReceb IN VARCHAR2,
  pDtPgto IN DATE,
  pValor IN NUMBER,
  pJuros IN NUMBER,
  pCodConta IN VARCHAR2,
  pObs IN VARCHAR2,
  pCodUsr IN VARCHAR2
)
```

**Fluxo:**
1. Insere em `dbFPreReceb` (movimento de pré-recebimento)
2. Chama `ContasFR.Inc_ContasFR(...)` para registrar movimento
3. Recalcula `valor_rec` em `dbReceb`
4. Marca `rec='S'` quando `valor_rec >= valor_pgto`
5. Faz upsert em `dbPreReceb`
6. Atualiza `dbReceb`

#### 2. **ContasFR.Inc_ContasFR** (Histórico)
```sql
PROCEDURE Inc_ContasFR(
  pID_FRECEB OUT NUMBER,
  pCodReceb IN VARCHAR2,
  pCodOpera IN VARCHAR2,
  pDt_Cartao IN DATE,
  pTx_Cartao IN NUMBER,
  pNro_Cheque IN VARCHAR2,
  pNome IN VARCHAR2,
  pCodBC IN VARCHAR2,
  pValor IN NUMBER,
  pTipo IN VARCHAR2,
  pSF IN VARCHAR2,
  pCxgeral IN VARCHAR2,
  pDt_Pgto IN DATE,
  pDt_Venc IN DATE,
  pDt_Emissao IN DATE,
  pFre_Cof_Id IN NUMBER,
  pCMC7 IN VARCHAR2,
  pId_Autenticacao IN NUMBER,
  pCODUSR IN VARCHAR2,
  pCOD_CONTA IN VARCHAR2,
  pParcela IN VARCHAR2,
  pCodDocumento IN VARCHAR2,
  pCodAutorizacao IN VARCHAR2
)
```

**Campos inseridos em `DBFRECEB`:**
- `cod_freceb` - Gerado via sequence MAX+1
- `cod_receb` - Código do título
- `codopera` - Operadora de cartão
- `Dt_Cartao` - Data do cartão
- `Tx_Cartao` - Taxa do cartão
- `nro_cheque` - Número do cheque
- `Nome` - Descrição/observação
- `CodBC` - Código banco compensação
- `valor` - Valor do movimento
- `tipo` - Tipo movimento (D=Débito, J=Juros, E=Estorno)
- `sf` - S/N (Soma/Não soma)
- `Cxgeral` - Caixa geral
- `dt_pgto` - Data pagamento
- `dt_venc` - Data vencimento
- `dt_emissao` - Data emissão
- `fre_cof_id` - ID conta financeira
- `CMC7` - Código CMC7 cheque
- `Id_Autenticacao` - ID autenticação
- `CODUSR` - Código usuário
- `COD_CONTA` - Código conta
- `Parcela` - Número parcela
- `CodDocumento` - Código documento
- `CodAutorizacao` - Código autorização

**Lógica Especial:**
```sql
-- Chama Cliente.Red_Debcli SOMENTE se:
IF pTipo = 'D' AND pSF = 'S' THEN
  Cliente.Red_Debcli(vCodCli, pValor);
END IF;
```

### Tabelas Afetadas

#### DBRECEB (Contas a Receber)
```sql
UPDATE dbReceb SET
  valor_rec = valor_rec + pValor + pJuros,
  rec = CASE WHEN (valor_rec + pValor + pJuros) >= valor_pgto THEN 'S' ELSE 'N' END,
  dt_pgto = pDtPgto,
  cod_conta = pCodConta,
  rec_cof_id = pCofId
WHERE cod_receb = pCodReceb;
```

#### DBFRECEB (Histórico/Movimentos)
```sql
-- Movimento principal (tipo 'D')
INSERT INTO DbFReceb (
  cod_freceb, cod_receb, codopera, valor, tipo, sf, 
  dt_pgto, dt_venc, dt_emissao, nome, nro_cheque,
  Dt_Cartao, Tx_Cartao, CodBC, fre_cof_id, CMC7,
  Id_Autenticacao, CODUSR, COD_CONTA, Parcela,
  CodDocumento, CodAutorizacao
) VALUES (...);

-- Movimento de juros (tipo 'J') - SE houver juros
INSERT INTO DbFReceb (
  cod_freceb, cod_receb, valor, tipo, sf,
  dt_pgto, nome
) VALUES (
  cod_freceb + 1, cod_receb, pJuros, 'J', 'S',
  pDtPgto, 'Juros de atraso'
);
```

#### DBPRERECEB (Pré-recebimento)
```sql
-- Upsert
IF NOT EXISTS (SELECT 1 FROM dbPreReceb WHERE cod_receb = pCodReceb) THEN
  INSERT INTO dbPreReceb (cod_receb, dt_pgto, valor_rec, cod_conta, rec)
  VALUES (pCodReceb, pDtPgto, pValor + pJuros, pCodConta, vRec);
ELSE
  UPDATE dbPreReceb SET
    valor_rec = pValor + pJuros,
    cod_conta = pCodConta,
    dt_pgto = pDtPgto,
    rec = vRec
  WHERE cod_receb = pCodReceb;
END IF;
```

#### DBFPRERECEB (Movimento de Pré-recebimento)
```sql
INSERT INTO dbFPreReceb (cod_receb, dt_pgto, valor)
VALUES (pCodReceb, pDtPgto, pValor);
```

### Auditoria Oracle
```sql
Usuario.inc_acao_usr(
  pCodUsr,
  'DAR_BAIXA',
  'DBRECEB',
  'COD:' || pCodReceb || ' VALOR:' || pValor
);
```

---

## 🆕 Sistema Novo (PostgreSQL/Next.js)

### Endpoint: `/api/contas-receber/dar-baixa`

#### Campos Recebidos
```typescript
{
  cod_receb: string,           // ✅ OK
  dt_pgto: string,              // ✅ OK
  dt_venc: string,              // ✅ OK
  dt_emissao: string,           // ✅ OK
  valor_recebido: number,       // ✅ OK
  valor_juros: number,          // ✅ OK
  observacoes: string,          // ✅ OK
  banco: string,                // ✅ OK
  username: string,             // ✅ OK
  cod_conta: string,            // ✅ OK
  cof_id: string,               // ✅ OK
  forma_pgto: string,           // ✅ OK
  nro_cheque: string,           // ✅ OK
  nome: string,                 // ✅ OK
  cod_operadora: string,        // ✅ OK
  codopera: string,             // ✅ OK
  caixa: string,                // ✅ OK
  cod_bc: string,               // ✅ OK (mapeado para codbc)
  ctrl: string,                 // ✅ OK
  tipo: string,                 // ✅ OK
  sf: string,                   // ✅ OK
  tx_cartao: string,            // ✅ OK
  dt_cartao: string,            // ✅ OK
  parcela: string,              // ✅ OK
  cod_documento: string,        // ✅ OK
  cod_autorizacao: string,      // ✅ OK
  cmc7: string,                 // ✅ OK
  id_autenticacao: string       // ✅ OK
}
```

#### Fluxo Atual
```typescript
1. Validar título (SELECT FOR UPDATE)
2. Verificar se cancelado ou já recebido
3. Calcular novo valor_rec
4. UPDATE db_manaus.dbreceb (rec, valor_rec, dt_pgto, banco, cod_conta)
5. Gerar cod_freceb (MAX + 1)
6. INSERT em db_manaus.dbfreceb (movimento principal)
7. Se juros > 0: INSERT em db_manaus.dbfreceb (movimento juros)
8. UPSERT em db_manaus.dbprereceb
9. Mapear username -> codusr (auditoria)
10. COMMIT
```

---

## ⚖️ Análise Comparativa

### ✅ O Que Está Implementado

| Funcionalidade | Oracle | Novo Sistema | Status |
|----------------|--------|--------------|--------|
| Validação do título | ✅ | ✅ | ✅ OK |
| Bloqueio (FOR UPDATE) | ✅ | ✅ | ✅ OK |
| Verificar cancelado | ✅ | ✅ | ✅ OK |
| Verificar já recebido | ✅ | ✅ | ✅ OK |
| Atualizar valor_rec | ✅ | ✅ | ✅ OK |
| Marcar rec='S' quando total | ✅ | ✅ | ✅ OK |
| Gerar cod_freceb sequencial | ✅ | ✅ | ✅ OK |
| INSERT em DBFRECEB (principal) | ✅ | ✅ | ✅ OK |
| INSERT em DBFRECEB (juros) | ✅ | ✅ | ✅ OK |
| Todos os campos de cartão | ✅ | ✅ | ✅ OK |
| UPSERT em DBPRERECEB | ✅ | ✅ | ✅ OK |
| Mapear username -> codusr | ✅ | ✅ | ✅ OK |
| INSERT dinâmico (colunas existentes) | ❌ | ✅ | ✅ MELHOR |
| Transação (BEGIN/COMMIT/ROLLBACK) | ✅ | ✅ | ✅ OK |

### ⚠️ O Que Está Faltando

| Funcionalidade | Oracle | Novo Sistema | Impacto |
|----------------|--------|--------------|---------|
| INSERT em DBFPRERECEB | ✅ | ❌ | ⚠️ MÉDIO |
| Cliente.Red_Debcli() | ✅ | ❌ | ⚠️ ALTO |
| Usuario.inc_acao_usr() | ✅ | ❌ | ⚠️ MÉDIO |
| Atualizar forma_fat | ✅ | ✅ | ✅ OK |
| Atualizar banco | ✅ | ✅ | ✅ OK |

### 🔴 Divergências Críticas

#### 1. **DBFPRERECEB não é populado**
**Oracle:**
```sql
INSERT INTO dbFPreReceb (cod_receb, dt_pgto, valor)
VALUES (pCodReceb, pDtPgto, pValor);
```

**Novo Sistema:**
```
❌ NÃO IMPLEMENTADO
```

**Impacto:** Histórico de pré-recebimentos não fica registrado.

**Solução:**
```typescript
// Adicionar após INSERT em dbfreceb
await client.query(`
  INSERT INTO db_manaus.dbfprereceb (cod_receb, dt_pgto, valor)
  VALUES ($1, $2, $3)
`, [cod_receb, baseDtPgto, valorReceberNum]);
```

---

#### 2. **Cliente.Red_Debcli() não é chamado**
**Oracle:**
```sql
-- Reduz débito do cliente quando tipo='D' e sf='S'
IF pTipo = 'D' AND pSF = 'S' THEN
  Cliente.Red_Debcli(vCodCli, pValor);
END IF;
```

**Novo Sistema:**
```
❌ NÃO IMPLEMENTADO
```

**Impacto:** Saldo de débito do cliente não é atualizado (pode afetar relatórios de inadimplência).

**Solução:**
```typescript
// Após INSERT em dbfreceb, verificar tipo e sf
if ((tipo === 'D' || !tipo) && (sf === 'S' || !sf)) {
  // Buscar codcli do título
  const clienteRes = await client.query(
    'SELECT codcli FROM db_manaus.dbreceb WHERE cod_receb = $1',
    [cod_receb]
  );
  
  if (clienteRes.rows.length > 0) {
    const codcli = clienteRes.rows[0].codcli;
    
    // Reduzir débito do cliente (lógica similar a Oracle)
    await client.query(`
      UPDATE db_manaus.dbclien
      SET debito = COALESCE(debito, 0) - $1
      WHERE codcli = $2
    `, [valorReceberNum + jurosNum, codcli]);
  }
}
```

---

#### 3. **Usuario.inc_acao_usr() não é chamado**
**Oracle:**
```sql
Usuario.inc_acao_usr(pCodUsr, 'DAR_BAIXA', 'DBRECEB', detalhes);
```

**Novo Sistema:**
```typescript
// Tenta mapear username -> codusr, mas não registra ação
if (username) {
  const userRes = await client.query(...);
  // ❌ NÃO FAZ NADA COM codusr
}
```

**Impacto:** Auditoria não é registrada formalmente em tabela de ações.

**Solução:**
```typescript
// Após obter codusr, registrar ação
if (userRes.rows.length > 0) {
  const codusr = userRes.rows[0].codusr;
  
  await client.query(`
    INSERT INTO db_manaus.dbusuario_acoes (
      codusr, acao, tabela, detalhes, dt_acao
    ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
  `, [
    codusr,
    'DAR_BAIXA',
    'DBRECEB',
    `COD:${cod_receb} VALOR:${valorReceberNum + jurosNum}`
  ]);
}
```

---

## 🎯 Recomendações de Implementação

### 1. Curto Prazo (Crítico)
- [ ] Implementar INSERT em `DBFPRERECEB`
- [ ] Implementar atualização de débito do cliente (`Red_Debcli`)
- [ ] Implementar auditoria formal (`inc_acao_usr`)

### 2. Médio Prazo (Importante)
- [ ] Adicionar validação de tipos de cartão especiais
- [ ] Implementar triggers/procedures de negócio Oracle faltantes
- [ ] Criar testes de integração comparando resultados Oracle vs Postgres

### 3. Longo Prazo (Opcional)
- [ ] Migrar lógica de negócio Oracle para stored procedures Postgres
- [ ] Implementar sistema de auditoria completo
- [ ] Criar dashboard de monitoramento de divergências

---

## 📊 Checklist de Paridade

### Validações
- [x] Verificar se título existe
- [x] Verificar se está cancelado
- [x] Verificar se já está recebido
- [x] Bloqueio com FOR UPDATE

### Cálculos
- [x] Calcular novo valor_rec
- [x] Determinar se totalmente pago (rec='S')
- [x] Separar juros do valor principal

### Atualizações DBRECEB
- [x] valor_rec
- [x] rec
- [x] dt_pgto
- [x] banco
- [x] cod_conta
- [x] rec_cof_id
- [x] forma_fat

### Histórico DBFRECEB
- [x] Gerar cod_freceb sequencial
- [x] INSERT movimento principal (tipo='D')
- [x] INSERT movimento juros (tipo='J')
- [x] Todos os campos de cartão/cheque/doc
- [x] INSERT dinâmico baseado em colunas existentes

### Pré-recebimento
- [x] UPSERT em DBPRERECEB
- [ ] INSERT em DBFPRERECEB ⚠️

### Integração Cliente
- [ ] Atualizar débito cliente (Red_Debcli) ⚠️

### Auditoria
- [x] Mapear username -> codusr
- [ ] Registrar ação em tabela de auditoria ⚠️

---

## 🔧 Código Corrigido Sugerido

Ver arquivo: `docs/CORRECAO-DAR-BAIXA-COMPLETO.md` (a ser criado)

---

## 📝 Conclusão

**Paridade Atual: ~80%**

O sistema novo implementa corretamente a maior parte da lógica Oracle, incluindo:
- ✅ Todas as validações
- ✅ Cálculos e atualizações principais
- ✅ Histórico em DBFRECEB
- ✅ Pré-recebimento em DBPRERECEB
- ✅ Campos de cartão/cheque/documento

**Gaps Críticos:**
1. ⚠️ DBFPRERECEB não é populado
2. ⚠️ Débito do cliente não é atualizado
3. ⚠️ Auditoria formal não é registrada

**Próximo Passo:**
Implementar os 3 gaps críticos para atingir 100% de paridade com Oracle.
