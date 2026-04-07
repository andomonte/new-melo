# Correção do Fluxo de Confirmação de Preço

## Problema

O sistema **nunca atualizava o preço de venda** ao confirmar preço de uma entrada, mesmo com o checkbox "Atualizar Preço de Venda" marcado.

### Causa raiz

Três problemas independentes impediam o funcionamento:

1. **Condição `if (margemAtual > 0)` bloqueava tudo** — O campo `margem` do `dbprod` era usado para decidir se recalculava preços. Porém, todos os produtos tinham `margem = 0` no dbprod. As margens reais estavam na tabela `DBFORMACAOPRVENDA` (campo `MARGEMLIQUIDA`), com valores como 40%, 50%, 70%.

2. **`recalcularPrecosProduto` sobrescrevia margens existentes** — A função gerava formações do zero usando a margem do dbprod (que era 0), ignorando completamente as margens já cadastradas na `DBFORMACAOPRVENDA`.

3. **`TIPOPRECO` retornava como string do PostgreSQL** — A comparação `'1' === 1` falhava silenciosamente, impedindo a atualização do `prvenda` via tipo ZFM.

## Solução

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/calcularPrecos.ts` | Reescrita da função `recalcularPrecosProduto` |
| `src/pages/api/entradas/[id]/confirmar-preco.ts` | Removida condição `margemAtual > 0` |
| `src/pages/api/entrada/recebimento/finalizar.ts` | Removida condição `margemAtual > 0` |
| `src/pages/api/produtos/add.ts` | Ajuste na chamada de `recalcularPrecosProduto` |
| `src/pages/api/produtos/update.ts` | Ajuste na chamada de `recalcularPrecosProduto` |
| `src/pages/api/entrada-xml/resetar-nfe.ts` | Adicionada reversão de custo médio e preços |
| `migrations/006_add_unique_dbformacaoprvenda.sql` | Unique constraint `(CODPROD, TIPOPRECO)` |

### Nova lógica do `recalcularPrecosProduto`

Replica a procedure legada `ATUALIZAR_PRECO_MARGEM` do Oracle:

1. **Lê** os registros existentes da `DBFORMACAOPRVENDA` para o produto
2. **Para cada registro**, recalcula `PRECOVENDA` usando a `MARGEMLIQUIDA` já salva + novo custo
3. **Preserva** todos os campos existentes (MARGEMLIQUIDA, ICMS, PIS, COFINS, comissão, taxaCartao)
4. **Se não existir** registro na DBFORMACAOPRVENDA, não cria (comportamento legado)

#### Fórmula de cálculo

```
custoBase = prcustoatual * (dolar == 'S' ? txdolarcompra : 1)
precoComMargem = custoBase * (1 + MARGEMLIQUIDA / 100)
fatorDespesas = 100 - (ICMS + PIS + COFINS + COMISSAO + TAXACARTAO)
precoFinal = precoComMargem / (fatorDespesas / 100) + IPI
```

### Interface `DadosProduto` simplificada

Antes (campos nunca preenchidos corretamente):
```typescript
interface DadosProduto {
  codprod, prvenda, prcompra, prcustoatual, dolar, txdolarcompra,
  margem, margempromo, margemfe, margempromofe, margemzf, margempromozf,
  icms, ipi, pis, cofins, percsubst, comdifeext, comdifeext_int, comdifint
}
```

Depois (só o necessário — margens e impostos vêm da DBFORMACAOPRVENDA):
```typescript
interface DadosProduto {
  codprod: string;
  prcompra?: number;
  prcustoatual?: number;
  dolar?: string;
  txdolarcompra?: number;
}
```

### Resetar NFe

O endpoint `resetar-nfe.ts` agora também reverte:
- **Custo médio** — calcula o custo anterior pela fórmula inversa do custo médio ponderado
- **Preços de venda** — recalcula a DBFORMACAOPRVENDA com o custo revertido

### Migration

```sql
ALTER TABLE db_manaus."DBFORMACAOPRVENDA"
  ADD CONSTRAINT dbformacaoprvenda_codprod_tipopreco_uk
  UNIQUE ("CODPROD", "TIPOPRECO");
```

Já executada no banco de produção em 30/01/2026.

## Endpoints afetados

### POST `/api/entradas/[id]/confirmar-preco`

Fluxo ao marcar "Atualizar Preço de Venda":
1. Calcula custo médio ponderado do produto
2. Atualiza `prcustoatual` no `dbprod`
3. Chama `recalcularPrecosProduto` que lê margens da DBFORMACAOPRVENDA e recalcula preços
4. Se existir formação tipo 1 (ZFM), atualiza `dbprod.prvenda`

### PUT `/api/entrada/recebimento/finalizar`

Mesmo fluxo quando `atualizarPrecos = true`.

## Testes realizados

### Teste 1 — Produto sem formação na DBFORMACAOPRVENDA
- Entrada 25, produtos 424214, 420329, 420331, 422787
- Custo médio atualizado corretamente
- Log: "sem registros em DBFORMACAOPRVENDA, nada a recalcular"
- Comportamento correto (legado não cria formações que não existem)

### Teste 2 — Produto com formação na DBFORMACAOPRVENDA
- Entrada 26, produto 403758 (margem 0 no dbprod, mas MARGEMLIQUIDA 50% e 40% na DBFORMACAOPRVENDA)
- Custo: 117.94 -> 123.10
- Tipo 0 (Balcão): 200.00 -> 271.54 (margem 50% preservada)
- Tipo 1 (ZFM): 180.00 -> 190.43 (margem 40% preservada)
- `prvenda`: 215.45 -> 190.43 (atualizado via ZFM)

### Teste 3 — Endpoint finalizar
- Mesma entrada 26 em status EM_RECEBIMENTO
- 2 preços atualizados com sucesso
- Romaneio automático criado
