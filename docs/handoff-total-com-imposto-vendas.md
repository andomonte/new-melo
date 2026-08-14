# Handoff — Corrigir "Total c/ Imposto" nas telas de venda (V2 e antiga)

## Objetivo (regra de negócio)
O campo **"Total c/ Imposto"** deve **SEMPRE mostrar o valor que o cliente vai efetivamente pagar** pelo item:
- **Sem imposto por fora** → mostra o próprio subtotal (ex.: `R$ 99,98`).
- **Com IPI e/ou ICMS-ST** → mostra o subtotal **+ IPI + ICMS-ST** (o valor real a pagar).

Ou seja: esse campo é o **valor a pagar**, com ou sem imposto — nunca um número "fantasma".

## Problema atual (o que está errado)
Hoje o "Total c/ Imposto" soma **PIS + COFINS** por cima do subtotal:

```
109,23 = 99,98 (subtotal) + PIS 1,65 + COFINS 7,60
```

Isso está **errado e confunde o vendedor**, porque:
- **PIS e COFINS são "por dentro"** — já estão embutidos no preço (99,98). Somar por cima **conta duas vezes**.
- O `109,23` **não bate com nada real**: a **NF sai 99,98**, e o **cliente paga 99,98** (à vista).
- O vendedor pode achar que o cliente paga 109,23.

Validação feita direto no motor PG `db_manaus.calcular_imposto_item` (ref 82313FLEX, cliente 35800, 2× 49,99, SAÍDA/VENDA):
```
totalproduto = 99,98 | ICMS = 0 | IPI = 0 | ICMS-ST = 0 | PIS = 1,65 | COFINS = 7,60
```

## Regra técnica correta
| Tributo | Natureza | Entra no "Total c/ Imposto"? |
|---|---|---|
| **IPI** (`totalipi`) | por fora | **SIM** (soma) |
| **ICMS-ST** (`totalsubst_trib`) | por fora | **SIM** (soma) |
| ICMS (`totalicms`) | por dentro | NÃO |
| PIS (`valorpis`) | por dentro | NÃO |
| COFINS (`valorcofins`) | por dentro | NÃO |

**Fórmula:** `Total c/ Imposto do item = subtotal_do_item (com desconto) + totalipi + totalsubst_trib`

> É a MESMA regra do `VALOR DA NOTA` da DANFE e da função `src/lib/faturamento/calcularTotaisFatura.ts` (port do CALCULAR_TOTAIS do Delphi): total = produtos + IPI + ST.

## Onde mexer

### 1) `src/lib/calcImposto.ts` (fonte do valor — usado pelas duas telas)
Hoje (linhas ~187-202):
```ts
const valorImpostos = +(
  valorIPI + valorICMS + valorICMS_Subst + valorPIS + valorCOFINS  // ❌ soma PIS/COFINS/ICMS
).toFixed(2);
...
totalComImpostos: +(subtotalItem + valorImpostos).toFixed(2),
```
Trocar por (só os "por fora"):
```ts
const valorPorFora = +(valorIPI + valorICMS_Subst).toFixed(2);   // IPI + ST
...
totalComImpostos: +(subtotalItem + valorPorFora).toFixed(2),
```
- Manter `valorPIS`, `valorCOFINS`, `valorICMS` no objeto `impostosRs` (para o tooltip informativo), **mas fora da soma do total**.
- `valorImpostos` pode continuar existindo como "carga tributária total (informativo)", mas **NÃO** deve alimentar o `totalComImpostos`.

### 2) Telas (só se tiver soma própria; o ideal é usarem o `impostosRs.totalComImpostos`)
- **V2**: `src/components/corpo/vendas/novaVendaV2/index.tsx` — coluna "Total c/ Imp." (~linha 1410) usa `total_com_impostos` (vem do `calcImposto.ts`). Após o item 1, já fica correto.
- **Antiga**: `src/components/corpo/vendas/novaVenda/tableCar.tsx` — `calcularTotaisComImpostos` (~268) e o fallback `getPercentImpostos` (~258) também somam PIS/COFINS/ICMS. Alinhar à mesma regra (só IPI + ST).

## Tooltip (opcional, recomendado) — "Tributos aprox. (Lei 12.741)"
O imposto **por dentro** (ICMS + PIS + COFINS + IBS/CBS) deve virar **informativo**, não total:
- Mostrar no tooltip/rótulo como `Tributos aprox.: R$ 9,25 (9,25%)` (transparência Lei 12.741).
- **Nunca** somar isso ao valor a pagar.

## O que NÃO mudar
- **A função PG `calcular_imposto_item` está correta** e não deve ser alterada — ela devolve `totalproduto` + cada tributo separado, conforme a regra. A correção é **100% no JS de exibição/soma**, não no cálculo.

## Critério de aceite
| Cenário | Subtotal | "Total c/ Imposto" esperado |
|---|---|---|
| Item sem IPI/ST (ex.: CST 560, CFOP 5405) | 99,98 | **99,98** |
| Item com IPI R$ 5,00 | 100,00 | **105,00** |
| Item com ICMS-ST R$ 8,00 | 100,00 | **108,00** |
| Item com IPI 5,00 + ST 8,00 | 100,00 | **113,00** |
| PIS/COFINS/ICMS quaisquer | — | **não alteram** o total (só tooltip informativo) |

O "Total c/ Imposto" deve **sempre bater com o VALOR DA NOTA** do item (produtos + IPI + ST).

## Telas afetadas
Aplicar nas **duas** (V2 e antiga) para consistência — a confusão existe em ambas hoje.
