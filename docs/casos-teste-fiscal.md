# Casos de Teste Fiscal — o que o motor produz

> **Objetivo:** registrar a saída do `CalculadoraImpostos` para entradas controladas.
> **NÃO conclui se está certo** — a validação depende de comparação com notas do Delphi, que ainda não temos.
> Sistema em **desenvolvimento**; UF da empresa (`dadosempresa.uf`) = **AM** (Zona Franca).

## Método

Rodar o `finalizarVenda` real headless exigiria servidor Next + cookie de auth + baixa de estoque (frágil e com efeitos colaterais). Em vez disso, invoquei **diretamente** o `src/lib/impostos/calculadoraImpostos.ts` (o mesmo motor que `/api/impostos` e `finalizarVenda` usam por baixo) contra o Postgres de dev: transpilei a classe em memória e chamei `calcular(dados)` por cenário. Nenhuma venda/estoque foi gravado — é leitura + cálculo.

> ⚠️ **Caveat de wiring (fato de código, não conclusão):** o cenário "gravado em dbitvenda" depende do caminho. O `finalizarVenda` **usa os impostos do front se vierem** (`finalizarVenda.ts:684-694`) e só chama o motor com `desconto` quando o front **não** manda impostos (`:709-716`). O front (`novaVenda`) calcula via `/api/impostos`, que **fixa `desconto:0`** (`index.ts:149`) e o `calcImposto.ts` **não envia `desconto`** (envia `totalItem`, que o endpoint ignora na base). Ou seja: o **motor** trata desconto, mas o **caminho normal da venda** não o alimenta.

## Produtos e clientes usados (reais, do banco)

| ref | codprod | descr | NCM | dbprod.ipi | dolar | strib |
|---|---|---|---|---|---|---|
| P-min | 000021 | ROLAMENTO | 84824000 | 0 | N | 130 |
| P-ipi | 000892 | ARRUELA DE PRESSAO | 87089990 | 5,00 | N | 060 |
| P-imp | 003216 | ROLAMENTO ESFERA | 87087090 | 5,00 | **S** | 010 |
| P-st | 000005 | FILTRO GM/VOLVO | 84212990 | 0 | S | 060 |

| ref | codcli | nome | UF | tipo | icms (contrib.) | isuframa |
|---|---|---|---|---|---|---|
| C-AM | 08612 | ANTONIO GURGEL DA SILVA | AM | F | **S** | ISENTO |
| C-RJ | 06109 | PNEUS 56 DE RESENDE LTDA | RJ | J | S | ISENTO |
| C-nao | 02639 | SILVIO JOSE DA GAMA BENTES | AM | F | **N** | ISENTO |
| C-suf | 02655 | EMPRESA BRASILEIRA DE DISTRIB. | AM | J | N | **106159011** |

Por quê: P-min foi escolhido por **probe** — varri 40 produtos sem IPI e o primeiro sem ST e sem IPI foi o 000021 (isola o caso mínimo). C-AM/C-RJ/C-nao por UF+contribuinte; C-suf tem inscrição Suframa numérica (o campo `isuframa` guarda a inscrição ou 'ISENTO', não é flag S/N).

## 1. Caso mínimo — o desconto reduz a base? (motor)

Produto 000021 (sem IPI, sem ST) · cliente 08612 (AM, contribuinte) · qtd 10 · unitário R$ 100.

| desconto | baseicms | aliquota_icms | totalicms | valor_item |
|---|---|---|---|---|
| **R$ 0** | **1000** | 18% | 180,00 | 1000 |
| **R$ 100** | **900** | 18% | 162,00 | 900 |

**No nível do MOTOR, a hipótese confirmada é `baseicms = 900` (o desconto reduz a base)** — `valor_total_item = qtd×unit − desconto` (`calculadoraImpostos.ts:79`), e a base de ICMS usa esse valor líquido.

**Porém** (fato de código, ver caveat acima): pelo caminho normal da venda (`/api/impostos` com `desconto:0` + `calcImposto.ts` sem `desconto`), o motor receberia `desconto=0` e produziria `baseicms=1000`. Qual valor é **gravado** depende de o front mandar ou não os impostos ao `finalizarVenda`. **Não concluo qual está correto** — depende da regra do Delphi.

## 2. Suíte de regressão (saída do motor, qtd/unitário nas entradas)

Todos com cliente 08612 (AM, contribuinte), exceto onde indicado. Formato: base/alíquota/valor.

| Caso | Entrada (prod, qtd×unit, desc, cliente) | CFOP | ICMS (base/aliq/val) | ST (tem/mva/base/val) | IPI (aliq/base/val) | PIS/COFINS | IBS/CBS (val) |
|---|---|---|---|---|---|---|---|
| (a) simples s/ desc | 000021, 10×100, 0, AM | 5102 | 1000 / 18 / 180 | não / 0 / 0 / 0 | 0 / 0 / 0 | 1,65 / 7,6 | 1,00 / 9,00 |
| (b) c/ desconto 150 | 000021, 10×100, 150, AM | 5102 | 850 / 18 / 153 | não | 0 | 1,65 / 7,6 | 0,85 / 7,65 |
| (c) produto c/ IPI | 000892 (ipi 5%), 10×100, 0, AM | 5102 | 1000 / 18 / 180 | não | **0 / 0 / 0** | 2,3 / 10,8 | 1,00 / 9,00 |
| (d) produto c/ ST | 000005, 10×100, 0, AM | 5102 | 1000 / 18 / 180 | **sim / 71,78 / 1717,8 / 189,2** (origem VIEW) | 0 | 1,65 / 7,6 | 1,00 / 9,00 |
| (e) redução base 33,33% | 000021 + flag caller, 10×100, 0, AM | 5102 | **666,7** / 18 / 120,01 | não | 0 | 1,65 / 7,6 | 1,00 / 9,00 |
| (f) cliente OUTRA UF (RJ) | 000021, 10×100, 0, **RJ** | **5102** | 1000 / **12** / 120 | não | **12 / 1000 / 120** | 1,65 / 7,6 | 1,00 / 9,00 |
| (g) NÃO contribuinte (AM) | 000021, 10×100, 0, **02639** | 5102 | 1000 / 18 / 180 | não | 0 | 1,65 / 7,6 | 1,00 / 9,00 |
| (h) cliente SUFRAMA (AM) | 000021, 10×100, 0, **02655** | 5102 | 1000 / 18 / 180 | não | 0 | 1,65 / 7,6 | 1,00 / 9,00 |
| (i-nac) nacional | 000892 (dolar N), 10×100, 0, AM | 5102 | 1000 / 18 / 180 | não | 0 | 2,3 / 10,8 | 1,00 / 9,00 |
| (i-imp) importado | 003216 (dolar S), 10×100, 0, AM | **5102** | 1000 / 18 / 180 | não | 0 | 2,3 / 10,8 | 1,00 / 9,00 |
| (j-1) multi item A | 000021, 5×100, 50, AM | 5102 | 450 / 18 / 81 | não | 0 | 1,65 / 7,6 | 0,45 / 4,05 |
| (j-2) multi item B | 000892, 3×200, 60, AM | 5102 | 540 / 18 / 97,2 | não | 0 | 2,3 / 10,8 | 0,54 / 4,86 |

## Observações factuais (para comparar com o Delphi — NÃO são conclusões)

1. **Desconto reduz base no motor** (900/850/450/540 conforme desconto) — mas o caminho da venda pode não alimentar o desconto (ver caveat).
2. **IPI (c):** produto 000892 tem `dbprod.ipi=5,00`, mas o motor devolveu **IPI 0** em venda intra-AM. Já em **(f) venda p/ RJ** o produto 000021 (`dbprod.ipi=0`) devolveu **IPI 12%**. O IPI produzido **não corresponde** ao `dbprod.ipi` e varia por UF de destino — verificar a regra.
3. **CFOP (f, i-imp):** venda **interestadual** (RJ) e venda de **importado** saíram com **CFOP 5102** (o fallback interno). Esperava-se 6xxx p/ interestadual e origem diferenciada p/ importado — o motor não diferenciou. Verificar.
4. **Redução de base (e):** é **flag do caller** (`base_icms_reduzida` + `percentual_reducao`), o motor **não deriva** redução do produto — 33,33% → base 666,7.
5. **ST (d):** motor produziu `tem_st=true, mva=71,78 (origem VIEW), base_st=1717,8, total_st=189,2`. Nos demais produtos testados, sem ST.
6. **Suframa (h) e não-contribuinte (g):** o motor produziu **ICMS cheio (18%)** igual ao contribuinte comum — nenhuma isenção/tratamento ZFM aplicado para o cliente Suframa. Verificar (venda AM→AM Suframa costuma ter tratamento).
7. **PIS/COFINS:** 1,65/7,6 na maioria; **2,3/10,8** para os NCM 8708 (000892, 003216). Verificar de onde vem essa diferença.
8. **IBS/CBS:** informativo, 0,1%/0,9% sobre o valor do item em todos os casos.
9. **Rateio (j):** o motor é **por item** — cada item teve a base reduzida pelo seu próprio desconto; **não há rateio** de um desconto de cabeçalho entre itens.

## Cenários sem candidato

- Nenhum bloqueado por falta de cadastro nesta rodada. Todos os produtos/clientes existem no banco de dev. (Cliente Suframa exigiu ajuste no critério: `isuframa` é a inscrição, não flag S/N.)
