# ANÁLISE COMPLETA DAS REGRAS DO PROCEDIMENTO ORACLE

**Data:** 2026-01-10
**Fonte:** `scripts/oracle_calculo_imposto.sql`
**Objetivo:** Documentar TODAS as regras de cálculo de impostos para implementação completa

---

## 1. REGRAS DE IPI (Validar_IPI - linhas 1612-1673)

### 1.1. Para SAÍDA (Vendas/Faturamento) - linhas 1648-1665

A lógica do Oracle é **INVERTIDA**: define quando COBRA IPI, caso contrário é ISENTO.

#### ✅ Condições que COBRAM IPI (alíquota do NCM):

```sql
if ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao not in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO'))) or
   (RowProd.Isentoipi in ('I','T')) or
   ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO'))) or
   ((RowProd.Isentoipi = 'P') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao in ('DEVOLUCAO_COMPRA','DEVOLUCAO_TRANSFERENCIA','REMESSA_GARANTIA_FABRICA','REMESSA_CONSERTO'))) or
   ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'N'))
then
  xResult := nvl(RowNCM.Ipi,0.00);  -- USA ALÍQUOTA DO NCM, NÃO DO PRODUTO!
else
  xResult := 0.00;  -- ISENTO
end if;
```

**Traduzindo em regras claras:**

1. **IsentoIPI = 'C' (Cobrado):**
   - Se UF Origem ≠ UF Destino E operação normal (não devolução/remessa) → **COBRA IPI**
   - Se UF Origem ≠ UF Destino E operação é devolução/remessa → **COBRA IPI**

2. **IsentoIPI = 'I' (Isento) ou 'T' (Tributado):**
   - **SEMPRE COBRA IPI**

3. **IsentoIPI = 'P' (Pago):**
   - Se UF Origem ≠ UF Destino E operação é devolução/remessa → **COBRA IPI**
   - Caso contrário → **ISENTO**

4. **IsentoIPI = 'S' (Suspenso):**
   - Se Zona_Isentivada = 'N' (NÃO é zona franca) → **COBRA IPI**
   - Se Zona_Isentivada = 'S' (é zona franca) → **ISENTO**

5. **IsentoIPI = 'Z' ou qualquer outro valor:**
   - **SEMPRE ISENTO**

#### 🚫 **REGRA UNIVERSAL - TEM PRIORIDADE SOBRE TODAS AS OUTRAS** (linha 1667-1669):
```sql
if DadosDestino.TipoDestino = 'F' then
  xResult := 0.00;  -- Cliente Pessoa Física: IPI = 0 SEMPRE
end if;
```

**CRÍTICO:** Esta regra é verificada **DEPOIS** de todas as outras e **SOBRESCREVE** qualquer cálculo de IPI.
- Se `cliente.tipo = 'F'` (Pessoa Física) → **IPI = 0, SEMPRE, SEM EXCEÇÃO**
- Esta é a regra que explica por que produtos 002822 e 414069 tiveram IPI=0 no Delphi (cliente 18786 é PF)

**IMPORTANTE:** Quando cobra IPI (e cliente não é PF), a alíquota vem do **NCM** (`RowNCM.Ipi`), NÃO do produto (`RowProd.Ipi`).

---

## 2. REGRAS DE CST IPI (VALIDAR_CSTIPI - linhas 2734-2819)

### 2.1. Para SAÍDA - linhas 2779-2799

```sql
if ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'N')) or
   (RowProd.Isentoipi in ('I','T')) or
   ((RowProd.Isentoipi = 'C') and (RowUF_Origem.Uf <> RowUF_Destino.Uf) and (TipoOperacao not in (...))) or
   ((RowProd.Isentoipi = 'C') and (TipoOperacao in (...))) or
   ((RowProd.Isentoipi = 'P') and (TipoOperacao in (...)))
then
  xResult := '50';  -- Saída tributada
elsif (RowProd.Isentoipi = 'Z') then
  xResult := '51';  -- Saída tributada com alíquota zero
elsif ((RowProd.Isentoipi = 'S') and (RowUF_Destino.Zona_Isentivada = 'S')) then
  xResult := '55';  -- Saída com suspensão
else
  xResult := '99';  -- Outras saídas
end if;
```

**Mapeamento:**

| IsentoIPI | Zona_Isentivada | Outras condições | CST IPI | Alíquota |
|-----------|-----------------|------------------|---------|----------|
| 'S' | 'N' | - | '50' | NCM.ipi |
| 'S' | 'S' | - | '55' | 0% |
| 'I' ou 'T' | - | - | '50' | NCM.ipi |
| 'C' | - | UF diferente, não devolução | '50' | NCM.ipi |
| 'C' | - | Devolução/remessa | '50' | NCM.ipi |
| 'P' | - | Devolução/remessa, UF diferente | '50' | NCM.ipi |
| 'Z' | - | - | '51' | 0% |
| Outros | - | - | '99' | 0% |

---

## 3. REGRAS DE PIS/COFINS (Calcular_PIS_COFINS_Saida - linhas 2821-2929)

### 3.1. Lógica em cascata (waterfall)

```sql
if (RowUF_Destino.uf = 'EX') then
  -- EXPORTAÇÃO
  CSTPIS := '08';
  Aliquota_Pis := 0.00;
  CSTCOFINS := '08';
  Aliquota_Cofins := 0.00;

elsif ((NCM_MONOFASICO) and (TipoOperacao in ('VENDA'))) then
  -- MONOFÁSICO POR NCM
  CSTPIS := '04';
  Aliquota_Pis := 0.00;
  CSTCOFINS := '04';
  Aliquota_Cofins := 0.00;

elsif ((((nvl(RowProd.Pis,0) + nvl(RowProd.Cofins,0)) = 13.10) or
        ((nvl(RowProd.Pis,0) + nvl(RowProd.Cofins,0)) = 11.50)) and
       (TipoOperacao in ('VENDA'))) then
  -- MONOFÁSICO POR SOMA DO PRODUTO
  CSTPIS := '04';
  Aliquota_Pis := 0.00;
  CSTCOFINS := '04';
  Aliquota_Cofins := 0.00;

elsif (TipoOperacao in ('VENDA') and
       CIDADE_Destino.Descricao in ('MANAUS','BRASILEIA','MACAPA','SANTANA','TABATINGA','BOA VISTA','BONFIM','GUAJARA-MIRIM') and
       RowUF_Origem.uf = 'AM') then
  -- ZONA FRANCA (cidades específicas com origem AM)
  CSTPIS := '06';
  Aliquota_Pis := 0.00;
  CSTCOFINS := '06';
  Aliquota_Cofins := 0.00;

elsif TipoOperacao in ('VENDA') then
  -- VENDA NORMAL - USA VALORES FIXOS ORACLE
  CSTPIS := '01';
  Aliquota_Pis := 1.65;
  Base_Pis := Base_Produto;
  Valor_Pis := round((Base_Produto * 0.0165),2);
  CSTCOFINS := '01';
  Aliquota_Cofins := 7.60;
  Base_Cofins := Base_Produto;
  Valor_Cofins := round((Base_Produto * 0.076),2);

else
  -- OUTRAS OPERAÇÕES
  CSTPIS := '49';
  Aliquota_Pis := 0.00;
  CSTCOFINS := '49';
  Aliquota_Cofins := 0.00;
end if;
```

### 3.2. Função NCM_MONOFASICO (linhas 2950-3000)

Verifica se o NCM está na tabela `DBCLASSIFICACAO_PISCOFINS`, tentando match com:
- 8 dígitos completos
- 7 primeiros dígitos
- 6 primeiros dígitos
- 5 primeiros dígitos
- 4 primeiros dígitos
- 3 primeiros dígitos

**IMPORTANTE:** Esta função consulta a tabela `DBCLASSIFICACAO_PISCOFINS`, não usa os valores do produto!

### 3.3. Cidades da Zona Franca (linha 2877)

```sql
CIDADE_Destino.Descricao in ('MANAUS','BRASILEIA','MACAPA','SANTANA','TABATINGA','BOA VISTA','BONFIM','GUAJARA-MIRIM')
```

E a UF de origem deve ser 'AM'.

**IMPLEMENTAÇÃO:**
- Usar o campo `dbclien.cidade` (texto), NÃO a tabela `dbmunicipio`
- Comparar com UPPER() para garantir match case-insensitive
- Lista de cidades: `['MANAUS','BRASILEIA','MACAPA','SANTANA','TABATINGA','BOA VISTA','BONFIM','GUAJARA-MIRIM']`

### 3.4. Ordem de prioridade:

1. **Exportação** (UF = 'EX') → PIS/COFINS = 0, CST = '08'
2. **NCM Monofásico** → PIS/COFINS = 0, CST = '04'
3. **Soma Monofásica** (13.10% ou 11.50%) → PIS/COFINS = 0, CST = '04'
4. **Zona Franca** (cidades específicas + UF origem AM) → PIS/COFINS = 0, CST = '06'
5. **Venda Normal** → PIS = 1.65%, COFINS = 7.60%, CST = '01'
6. **Outras operações** → PIS/COFINS = 0, CST = '49'

---

## 4. REGRAS ICMS (Validar_ICMS - linhas 1677+)

### 4.1. CFOPs especiais:

- CFOP 1600 → ICMS = 6.00%
- CFOPs 6915, 6916 (remessa/retorno conserto) → ICMS = 0%
- CFOPs 5551, 6651, 1553 → Lógica especial (precisa ler mais)

### 4.2. Legislação ST

A função `LEGISLACAO_ICMS` verifica se há legislação específica para o produto/NCM que determina ST.

---

## 5. VARIÁVEIS GLOBAIS IMPORTANTES

### 5.1. RowProd (produto)
- `Isentoipi` - Flag que determina tratamento de IPI
- `Pis`, `Cofins`, `Ipi` - Alíquotas cadastradas no produto
- `Strib` - Código origem mercadoria (1,2,3,8 = importado)

### 5.2. RowNCM (classificação fiscal)
- `Ipi` - Alíquota IPI do NCM (**ESTA É USADA PARA COBRAR IPI, NÃO A DO PRODUTO!**)
- `Ncm` - Código NCM para validações

### 5.3. RowUF_Destino / RowUF_Origem
- `Zona_Isentivada` - 'S' ou 'N' - determina isenção de IPI/PIS/COFINS

### 5.4. CIDADE_Destino
- `Descricao` - Nome da cidade para verificar Zona Franca

### 5.5. DadosDestino
- `TipoDestino` - 'F' (Física) ou 'J' (Jurídica) - Pessoa Física não paga IPI

---

## 6. DESCOBERTAS CRÍTICAS

### 6.1. IPI usa alíquota do NCM, não do produto

Quando o IPI é cobrado, a alíquota vem de `RowNCM.Ipi`, não de `RowProd.Ipi`.

**Código Oracle (linha 1661):**
```sql
xResult := nvl(RowNCM.Ipi,0.00);  -- NCM, não Produto!
```

### 6.2. PIS/COFINS usa valores fixos Oracle (1.65% / 7.60%)

Para vendas normais, o Oracle ignora os valores do produto e usa:
- PIS: 1.65%
- COFINS: 7.60%

**Código Oracle (linhas 2911-2918):**
```sql
CSTPIS := '01';
Aliquota_Pis := 1.65;
Base_Pis := Base_Produto;
Valor_Pis := round((Base_Produto * 0.0165),2);
CSTCOFINS := '01';
Aliquota_Cofins := 7.60;
Base_Cofins := Base_Produto;
Valor_Cofins := round((Base_Produto * 0.076),2);
```

### 6.3. Zona Franca requer cidade específica E UF origem

Não basta a UF destino ser AM. Precisa:
- Cidade destino na lista (Manaus, Brasileia, etc.)
- **E** UF origem = 'AM'

### 6.4. Monofásico tem 2 fontes

1. Tabela `DBCLASSIFICACAO_PISCOFINS` (verifica NCM)
2. Soma `produto.pis + produto.cofins = 13.10 ou 11.50`

---

## 7. TABELAS DO BANCO NECESSÁRIAS

### 7.1. Já temos
- `dbprod` - Produtos
- `dbclien` - Clientes
- `dbuf_n` - UFs com Zona_Isentivada

### 7.2. Precisamos verificar/usar
- `dbclassificacao_fiscal` - NCMs com alíquotas (tem coluna `ipi`)
- `DBCLASSIFICACAO_PISCOFINS` - NCMs monofásicos
- `dbmunicipio` - Municípios com descrição

---

## 8. IMPLEMENTAÇÃO NECESSÁRIA

### 8.1. Modificações na CalculadoraImpostos

1. **Método `calcularIPI`:**
   - Implementar TODAS as condições de IsentoIPI (C, I, T, P, S, Z)
   - Verificar tipo cliente (F ou J)
   - Usar alíquota do **NCM**, não do produto
   - Retornar CST correto

2. **Método `calcularPIS`:**
   - Implementar cascata completa de regras
   - Verificar NCM monofásico na tabela DBCLASSIFICACAO_PISCOFINS
   - Verificar soma produto (13.10/11.50)
   - Verificar cidade + UF para Zona Franca
   - Usar 1.65% para venda normal (não usar valor do produto)

3. **Método `calcularCOFINS`:**
   - Mesmo que PIS, mas com 7.60% para venda normal

4. **Novos métodos:**
   - `buscarAliquotaNCM(ncm: string)` - buscar IPI do NCM
   - `verificarNCMMonofasico(ncm: string)` - consultar DBCLASSIFICACAO_PISCOFINS
   - `verificarCidadeZonaFranca(cidadeId: number, ufOrigem: string)` - verificar cidade na lista
   - `buscarTipoCliente(clienteId: number)` - buscar se é F ou J

### 8.2. Modificações nos types

Adicionar campos:
- `tipo_cliente_destino?: 'F' | 'J'` em DadosCalculoImposto
- `cidade_destino?: string` em DadosCalculoImposto
- Manter `usar_regras_oracle_procedimento` para escolher entre 1.65%/7.60% ou valores do produto

---

## 9. RESUMO DOS VALORES DE IsentoIPI

| Valor | Significado | IPI em SAÍDA | CST IPI |
|-------|-------------|--------------|---------|
| 'C' | Cobrado | Cobra (condições específicas) | '50' |
| 'I' | Isento | **Cobra sempre** | '50' |
| 'T' | Tributado | **Cobra sempre** | '50' |
| 'P' | Pago | Cobra (condições específicas) | '50' |
| 'S' | Suspenso | Cobra se Zona_Isentivada='N', isento se 'S' | '50' ou '55' |
| 'Z' | Zona Franca? | **Isento sempre** | '51' |
| Outros | - | **Isento sempre** | '99' |

---

## 10. TESTES NECESSÁRIOS

Após implementação, testar com:

1. Produto 002822 (IsentoIPI='S', AM=Zona Franca) → IPI=0
2. Produto 414069 (IsentoIPI='Z') → IPI=0
3. Produto com IsentoIPI='I' → IPI cobrado
4. Produto com IsentoIPI='T' → IPI cobrado
5. Produto com IsentoIPI='C', UF diferente → IPI cobrado
6. Produto com NCM monofásico → PIS/COFINS=0
7. Produto com soma 13.10% → PIS/COFINS=0
8. Venda normal → PIS=1.65%, COFINS=7.60%
9. Cliente Pessoa Física → IPI=0
10. Exportação (UF=EX) → PIS/COFINS=0

---

**FIM DA ANÁLISE**
