# Comparação Oracle (referência) × Motor Web — cálculo de imposto

> Oracle = `CALCULO_IMPOSTO.CALCULAR_IMPOSTOS` (dev `DESENV.MNS.MELOPECAS.COM.BR`, cálculo puro — sem DML).
> Web = `CalculadoraImpostos` (resultados de `docs/casos-teste-fiscal.md`).
> Cadastro Oracle × PG **idêntico** (verificado, item 2). UF empresa = **AM (Zona Franca)**.
> **Convenções (confirmadas):** `Tipo_Movimentacao='SAIDA'`, `TipoFatura='NOTA_FISCAL'`, `TipoOperacao='VENDA'`,
> `Total_Produto = Base_Produto = qtd×unit` (o caller Oracle usa base BRUTA — ver §desconto).

## Como o Oracle é chamado (item 1 / ajuste 2)
Caller no BANCO (`FATURAMENTOS`, fat_body:492-549), não no .pas:
`INICIALIZACAO(SAIDA,VENDA,codprod,codcli,localEntrega)` → zera alíquota se `vZerar_IPI/vZerar_ICMS='S'` →
`Validar_IPI` / `Validar_ICMS` (alíquotas) → `Total_Produto = qtd×unit` (normal) **ou** `qtd×unit×(100−ICMS%)/100` (se Suframa) → `Calcular_Impostos`.

## Tabela comparativa (qtd 10 × R$ 100 = 1000)

| Caso | Campo | **Oracle** | **Web** | |
|---|---|---|---|---|
| (a) 000021 AM contrib | CFOP / ICMS% / baseICMS / ICMS | **5405 / 0 / 0 / 0** | 5102 / 18 / 1000 / 180 | **DIVERGE** |
| (c) 000892 AM (ipi5) | CFOP / ICMS / IPI | **5405 / 0 / 0** | 5102 / 180 / 0 | **DIVERGE** |
| (d-N) 000005 AM ST | CFOP / ICMS / ST(base/val) | **5405 / 0 / 0** | 5102 / 180 / (1717,8 / 189,2) | **DIVERGE** |
| (f) 000021 → RJ | CFOP / ICMS% / ICMS | **6403 / 4 / 40** | 5102 / 12 / 120 | **DIVERGE** |
| (f) 000021 → RJ | ST (base/mva/val) | **2061,4 / 1,0614 / 372,28** | sem ST | **DIVERGE** |
| (f) 000021 → RJ | IPI% / IPI | **0 / 0** | 12 / 120 | **DIVERGE** |
| (g) 000021 AM não-contrib | CFOP / ICMS | **5405 / 0** | 5102 / 180 | **DIVERGE** |
| (h) 000021 AM Suframa | CFOP / ICMS | **5405 / 0** | 5102 / 180 | **DIVERGE** |
| (h) 000021 AM Suframa | PIS / COFINS (CST) | **0 / 0 (CST 06)** | 1,65 / 7,6 | **DIVERGE** |
| (i-imp) 003216 importado AM | CFOP / ICMS | **5405 / 0** | 5102 / 180 | **DIVERGE** |
| (a,c,g) PIS/COFINS | — | ver §pis | igual ao cadastro | parcial |

**Resumo:** praticamente **TODOS os casos DIVERGEM**. O motor web ignora o tratamento de **Zona Franca / ST por protocolo** que é a regra no Oracle para Manaus.

## Item 4 — os três achados, com resultado do Oracle

### a) CFOP
- **AM → RJ (interestadual):** Oracle = **6403** (venda de merc. sujeita a ST, interestadual). Web = 5102.
- **AM intra-estadual (contrib, não-contrib, importado):** Oracle = **5405** (venda de merc. adq./receb. de terceiros, sujeita a ST retido) para TODOS. Web = 5102.
- **Importado intra-AM:** Oracle = **5405** (igual ao nacional intra). Web não diferenciou (5102) — mas o Oracle também não muda o CFOP por origem **neste caso** (a origem entra na alíquota interestadual = 4%, ver f).
- (não-contribuinte de OUTRO estado: não rodado — só tenho não-contrib AM; rodar depois se necessário.)

### b) IPI — de onde e quanto
- A procedure **não deriva** o IPI: usa `Base_Produto × Aliquota_IPI/100`, e a alíquota vem de `Validar_IPI`/`GET_IPI` (cadastro/legislação) — o caller a passa.
- Resultado Oracle para os dois produtos que divergiram no web: **IPI = 0** em ambos (000892 ipi-cadastro 5% e 000021 ipi-cadastro 0%), intra-AM, com **CST IPI 55** (saída ST). Ou seja, no Oracle o IPI intra-AM sai **0** (regime ST/ZFM), não segue o 5% do cadastro nem inventa 12% como o web fez para RJ.
- Para RJ o Oracle deu **IPI 0 / CST 50**; o web deu **12%**. **DIVERGE.**

### c) Suframa e desconto
- **Suframa (cliente 02655):** Oracle → CFOP 5405, **ICMS 0**, **PIS/COFINS 0 (CST 06)** — tratamento ZFM aplicado (zera ICMS e PIS/COFINS). Web → ICMS 18%, PIS/COFINS normais. **DIVERGE.**
- **Desconto reduz a base de ICMS?** No Oracle o caller (`FATURAMENTOS`) passa `Total_Produto = qtd×unit` (**bruto**) no caso normal — o **desconto comum NÃO reduz a base no cálculo por item** (o desconto de cabeçalho é rateado depois em `CALCULAR_TOTAIS`). A **única** redução por desconto no item é o **Desconto ICMS Suframa** (`Total = qtd×unit×(100−ICMS%)/100`). A regra está no **banco (package), não no .pas**.

## Ajuste 3 — Zerar_SUBSTITUICAO N × S (caso d, produto ST 000005)
Intra-AM, `zerar='N'` e `zerar='S'` produziram **saída IDÊNTICA** (CFOP 5405, ICMS 0, ST 0) — porque intra-AM o produto **já sai com ICMS/ST zerados** (ZFM/protocolo), então o flag não tem efeito visível. **Para especificar o mecanismo de "zerar ST" é preciso um caso INTERESTADUAL com ST ativa** (ex.: 000005 → RJ, N × S) — pendente de rodar. Pela leitura do código (`Calcular_ICMS_Subst`), `Zerar_SUBSTITUICAO='S'` zera `ICMS_Interno_Destino`, `ICMS_Externo_Origem` e `MVA` — ou seja, **subtração/zeragem da ST**, não mudança de CST/CFOP; confirmar rodando o caso interestadual.

## Contrato-alvo (ajuste 4) — parâmetros de ENTRADA da procedure
9 params IN: `Tipo_Movimentacao, TipoFatura, TipoOperacao, Zerar_SUBSTITUICAO, Aliquota_IPI, Aliquota_ICMS, Total_Produto, Base_Produto, MVA_ANTECIPADO`.
**Únicos ajustes fiscais explícitos:** `Zerar_SUBSTITUICAO` e `MVA_ANTECIPADO`. **Zerar IPI/ICMS** = caller passa `Aliquota=0` (não há param). **Desconto Suframa** = caller reduz `Total_Produto`. Alíquotas de IPI/ICMS = caller obtém via `Validar_IPI`/`Validar_ICMS` e passa.

## Item 5 — `usarRegrasOracleProcedimento`
No web (`calculadoraImpostos.ts:837,872`) é apenas um **flag de modo** do cálculo JS de PIS/COFINS (usa 1,65%/7,60% fixos quando true, senão valores do produto). **Não há ponte com o Oracle** — sem wiring real com a procedure.

## Observação de método
As alíquotas foram obtidas via `GET_IPI`/`GET_ICMS` (funções públicas do package). O padrão intra-AM 5405/ICMS-0 é consistente em todos os produtos testados (comportamento ZFM). A validação de correção fiscal final ainda depende de uma NF real do Delphi, mas esta comparação já mostra **onde** o web diverge da procedure de referência.
