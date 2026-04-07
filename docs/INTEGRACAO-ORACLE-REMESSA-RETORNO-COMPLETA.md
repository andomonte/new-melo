# Integração Oracle - Remessa e Retorno Bancário

## Resumo das Alterações

Implementação completa da compatibilidade com o sistema Oracle legacy nas funcionalidades de geração de remessa e processamento de retorno bancário.

## 1. Geração de Remessa Bancária

**Arquivo:** `src/pages/api/remessa/bancaria/gerar.ts`

### 1.1 Query de Seleção de Títulos

#### Antes:
```sql
WHERE r.dt_venc BETWEEN $1 AND $2
  AND r.cancel = 'N'
  AND r.rec = 'N'
  AND r.banco = $3
```

#### Depois:
```sql
WHERE r.dt_venc BETWEEN $1 AND $2
  AND r.cancel = 'N'
  AND r.rec = 'N'
  AND r.valor_rec = 0              -- Valor recebido = 0
  AND r.forma_fat = '2'            -- Apenas boletos
  AND COALESCE(r.bradesco, 'N') = 'N'  -- Apenas não enviados
  AND r.banco = $3
  AND r.valor_pgto > 0
  AND c.cpfcgc IS NOT NULL AND c.cpfcgc != ''
```

**Campos Adicionais Retornados:**
- `nro_docbanco` - Número do documento bancário
- `dt_emissao` - Data de emissão do título
- `venc_ant` - Vencimento anterior
- `forma_fat` - Forma de faturamento
- `codcli` - Código do cliente
- `tipo_cliente` - Tipo de cliente
- `endercobr` - Endereço de cobrança
- `numerocobr` - Número do endereço de cobrança
- `cepcobr` - CEP de cobrança
- `codbairrocobr` - Código do bairro de cobrança
- `cod_conta` - Código da conta bancária

**Join Adicional:**
```sql
LEFT JOIN db_manaus.dbbairro b ON b.codbairro = c.codbairrocobr
```

### 1.2 Criação de Borderô (dbboderobb)

Implementado conforme procedimento Oracle `REMESSABANCO.Inc_Boderobb`:

```typescript
// Buscar próximo código de borderô
const boderoResult = await pool.query(`
  SELECT COALESCE(MAX(CAST(cod_bodero AS INTEGER)), 0) + 1 as proximo_cod
  FROM db_manaus.dbboderobb
  WHERE cod_bodero ~ '^[0-9]+$'
`);

const codBodero = String(boderoResult.rows[0].proximo_cod).padStart(9, '0');

// Inserir registro no dbboderobb
await pool.query(`
  INSERT INTO db_manaus.dbboderobb
  (cod_bodero, cod_conta, dtinicial, dtfinal, dtemissao, cancel)
  VALUES ($1, $2, $3, $4, $5, 'N')
`, [codBodero, codConta, dtini, dtfim, dataGeracao]);
```

**Campos:**
- `cod_bodero` - Código do borderô (9 dígitos, padded com zeros)
- `cod_conta` - Código da conta bancária
- `dtinicial` - Data inicial do período
- `dtfinal` - Data final do período
- `dtemissao` - Data de emissão do borderô
- `cancel` - Flag de cancelamento ('N' = não cancelado)

### 1.3 Registro de Documentos do Borderô (dbdocboderobb)

Implementado conforme procedimento Oracle `REMESSABANCO.Inc_DocBoderobb`:

```typescript
for (const titulo of titulos) {
  // Inserir em dbremessa_detalhe (nova estrutura)
  await pool.query(`
    INSERT INTO db_manaus.dbremessa_detalhe
    (cod_arquivo, cod_receb, nosso_numero, valor_titulo, dt_vencimento)
    VALUES ($1, $2, $3, $4, $5)
  `, [codArquivo, titulo.cod_receb, titulo.nosso_numero, titulo.valor_titulo, titulo.data_vencimento]);

  // Inserir em dbdocboderobb (estrutura Oracle)
  await pool.query(`
    INSERT INTO db_manaus.dbdocboderobb
    (cod_bodero, cod_receb, digito, operacao, valor, dt_venc)
    VALUES ($1, $2, '', 'I', $3, $4)
  `, [codBodero, titulo.cod_receb, titulo.valor_titulo, titulo.data_vencimento]);

  // Marcar título como enviado (bradesco = 'S')
  await pool.query(`
    UPDATE db_manaus.dbreceb
    SET bradesco = 'S'
    WHERE cod_receb = $1
  `, [titulo.cod_receb]);
}
```

**Operações Suportadas:**
- `'I'` - Inclusão de título (novo envio)
- `'V'` - Concessão de abatimento (desconto)
- `'D'` - Alteração de data de vencimento

### 1.4 Status dos Títulos (dbreceb.bradesco)

**Estados Possíveis:**
- `'N'` - Não enviado (disponível para remessa)
- `'S'` - Enviado (incluído em remessa)
- `'B'` - Baixado (liquidado ou baixado manualmente)

## 2. Processamento de Retorno Bancário

**Arquivo:** `src/pages/api/remessa/retorno/processar.ts`

### 2.1 Atualização de Status por Ocorrência

Implementado conforme lógica Oracle de atualização de status:

```typescript
if (['06', '15', '17'].includes(detalhe.codigoOcorrencia)) {
  // Liquidação - marcar como 'B' (Baixado)
  estatisticas.liquidados++;
  await client.query(`
    UPDATE db_manaus.dbreceb
    SET bradesco = 'B'
    WHERE cod_receb = $1
  `, [detalhe.nossoNumero]);

} else if (['09', '10'].includes(detalhe.codigoOcorrencia)) {
  // Baixa manual - também marcar como 'B'
  estatisticas.baixados++;
  await client.query(`
    UPDATE db_manaus.dbreceb
    SET bradesco = 'B'
    WHERE cod_receb = $1
  `, [detalhe.nossoNumero]);

} else if (['03', '24', '32'].includes(detalhe.codigoOcorrencia)) {
  // Rejeição - voltar para 'N' (permitir reenvio)
  estatisticas.rejeitados++;
  await client.query(`
    UPDATE db_manaus.dbreceb
    SET bradesco = 'N'
    WHERE cod_receb = $1
  `, [detalhe.nossoNumero]);
}
```

### 2.2 Códigos de Ocorrência

**Liquidação (bradesco = 'B'):**
- `06` - Liquidação Normal
- `15` - Liquidação em Cartório
- `17` - Liquidação após Baixa

**Baixa Manual (bradesco = 'B'):**
- `09` - Baixa Simples
- `10` - Baixa por ter sido Liquidado

**Rejeição (bradesco = 'N'):**
- `03` - Rejeição de Entrada
- `24` - Rejeição de Instrução
- `32` - Abatimento/Alteração do Valor do Título ou Solicitação de Baixa Rejeitados

## 3. Estrutura de Tabelas Oracle

### 3.1 dbboderobb (Borderô de Remessa)
```sql
CREATE TABLE db_manaus.dbboderobb (
  cod_bodero VARCHAR(9) PRIMARY KEY,  -- Código sequencial padded
  cod_conta VARCHAR(10),              -- Código da conta bancária
  dtinicial DATE,                     -- Data inicial período
  dtfinal DATE,                       -- Data final período
  dtemissao DATE,                     -- Data emissão borderô
  cancel CHAR(1) DEFAULT 'N'         -- Cancelado? (S/N)
);
```

### 3.2 dbdocboderobb (Documentos do Borderô)
```sql
CREATE TABLE db_manaus.dbdocboderobb (
  cod_bodero VARCHAR(9) REFERENCES dbboderobb(cod_bodero),
  cod_receb INTEGER REFERENCES dbreceb(cod_receb),
  digito VARCHAR(2),                  -- Dígito verificador
  operacao CHAR(1),                   -- I=Inclusão, V=Abatimento, D=Alteração
  valor DECIMAL(15,2),                -- Valor do título
  dt_venc DATE                        -- Data de vencimento
);
```

### 3.3 dbreceb (Títulos a Receber)
Campo adicional usado:
```sql
bradesco CHAR(1)  -- N=Não enviado, S=Enviado, B=Baixado
```

### 3.4 dbremessa_arquivo (Nova Estrutura)
Mantida para compatibilidade com novo sistema:
```sql
CREATE TABLE db_manaus.dbremessa_arquivo (
  cod_arquivo SERIAL PRIMARY KEY,
  dt_geracao TIMESTAMP,
  nome_arquivo VARCHAR(255),
  qtd_registros INTEGER,
  valor_total DECIMAL(15,2),
  banco VARCHAR(3),
  tipo_remessa VARCHAR(20),
  sequencial_arquivo INTEGER
);
```

### 3.5 dbremessa_detalhe (Nova Estrutura)
```sql
CREATE TABLE db_manaus.dbremessa_detalhe (
  cod_arquivo INTEGER REFERENCES dbremessa_arquivo(cod_arquivo),
  cod_receb INTEGER REFERENCES dbreceb(cod_receb),
  nosso_numero VARCHAR(20),
  valor_titulo DECIMAL(15,2),
  dt_vencimento DATE
);
```

## 4. Fluxo Completo

### 4.1 Geração de Remessa

1. **Seleção de Títulos**
   - Filtra títulos com `bradesco = 'N'`
   - Apenas boletos (`forma_fat = '2'`)
   - Vencimento no período especificado
   - Valor recebido = 0

2. **Criação do Borderô**
   - Gera `cod_bodero` sequencial (9 dígitos)
   - Insere em `dbboderobb`

3. **Registro dos Documentos**
   - Para cada título:
     - Insere em `dbremessa_detalhe` (nova estrutura)
     - Insere em `dbdocboderobb` (Oracle legacy)
     - Marca como enviado: `UPDATE dbreceb SET bradesco = 'S'`

4. **Geração do Arquivo CNAB 400**
   - Header + Detalhes + Trailer
   - Salva em `public/remessas/bancaria/`

### 4.2 Processamento de Retorno

1. **Validação do Arquivo**
   - Verifica se já foi importado (baseado em data + sequencial)

2. **Inserção do Header**
   - Insere em `dbretorno_arquivo`

3. **Processamento dos Detalhes**
   - Para cada título no retorno:
     - Insere em `dbretorno_detalhe`
     - Atualiza status em `dbreceb`:
       - Liquidado → `bradesco = 'B'`
       - Rejeitado → `bradesco = 'N'` (permite reenvio)

4. **Classificação**
   - Títulos para baixa automática
   - Títulos para baixa manual

## 5. Compatibilidade Oracle

### 5.1 Procedures Oracle Mapeados

| Procedure Oracle | Implementação Next.js |
|-----------------|----------------------|
| `REMESSABANCO.Titulo_Remessa` | Query com filtros Oracle em `gerar.ts` |
| `REMESSABANCO.Inc_Boderobb` | Criação de borderô em `gerar.ts` |
| `REMESSABANCO.Inc_DocBoderobb` | Inserção em dbdocboderobb + UPDATE bradesco |
| `RETORNO.DETALHE_INC` | Inserção em dbretorno_detalhe em `processar.ts` |
| `RETORNO.VALIDA_ARQUIVO` | Função `validarArquivoDuplicado` em `processar.ts` |

### 5.2 Diferenças Mantidas

**Oracle Legacy:** Usa apenas tabelas `dbboderobb` e `dbdocboderobb`

**Next.js (Híbrido):** Usa ambas:
- `dbremessa_arquivo` + `dbremessa_detalhe` (nova estrutura)
- `dbboderobb` + `dbdocboderobb` (Oracle legacy)

**Motivo:** Manter compatibilidade total com relatórios e processos Oracle existentes enquanto permite evolução do sistema.

## 6. Testes Recomendados

### 6.1 Geração de Remessa
1. Criar títulos com `bradesco = 'N'`
2. Gerar remessa bancária
3. Verificar:
   - ✓ Arquivo CNAB 400 criado corretamente
   - ✓ Registro em `dbremessa_arquivo`
   - ✓ Registros em `dbremessa_detalhe`
   - ✓ Borderô criado em `dbboderobb`
   - ✓ Documentos em `dbdocboderobb`
   - ✓ Títulos marcados com `bradesco = 'S'`

### 6.2 Processamento de Retorno
1. Importar arquivo de retorno CNAB 400
2. Verificar:
   - ✓ Registro em `dbretorno_arquivo`
   - ✓ Detalhes em `dbretorno_detalhe`
   - ✓ Status atualizado em `dbreceb`:
     - Liquidados: `bradesco = 'B'`
     - Rejeitados: `bradesco = 'N'`

### 6.3 Ciclo Completo
1. Gerar remessa com 3 títulos
2. Simular retorno:
   - 1 liquidado (código 06)
   - 1 rejeitado (código 03)
   - 1 em aberto
3. Verificar status dos 3 títulos em `dbreceb`
4. Tentar gerar nova remessa - deve incluir apenas o rejeitado

## 7. Monitoramento

### 7.1 Queries Úteis

**Verificar títulos por status:**
```sql
SELECT 
  bradesco,
  COUNT(*) as total,
  SUM(valor_pgto) as valor_total
FROM db_manaus.dbreceb
WHERE cancel = 'N' AND rec = 'N'
GROUP BY bradesco;
```

**Últimos borderôs gerados:**
```sql
SELECT 
  b.cod_bodero,
  b.dtemissao,
  COUNT(d.cod_receb) as qtd_titulos,
  SUM(d.valor) as valor_total
FROM db_manaus.dbboderobb b
LEFT JOIN db_manaus.dbdocboderobb d ON d.cod_bodero = b.cod_bodero
WHERE b.cancel = 'N'
GROUP BY b.cod_bodero, b.dtemissao
ORDER BY b.dtemissao DESC
LIMIT 10;
```

**Títulos enviados sem borderô:**
```sql
SELECT r.*
FROM db_manaus.dbreceb r
WHERE r.bradesco = 'S'
  AND NOT EXISTS (
    SELECT 1 FROM db_manaus.dbdocboderobb d
    WHERE d.cod_receb = r.cod_receb
  );
```

## 8. Conclusão

A integração está completa e mantém compatibilidade total com o sistema Oracle legacy:

- ✅ Títulos só são enviados uma vez (filtro `bradesco = 'N'`)
- ✅ Borderôs criados com código sequencial Oracle
- ✅ Documentos registrados em tabelas Oracle e novas
- ✅ Status atualizado corretamente após retorno
- ✅ Títulos rejeitados podem ser reenviados automaticamente
- ✅ Relatórios Oracle continuam funcionando

**Data da Implementação:** 2025-01-27
**Desenvolvedor:** GitHub Copilot
**Revisado:** Pendente
