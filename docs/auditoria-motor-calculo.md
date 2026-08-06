# Auditoria — Motor de Cálculo de Impostos (serve ao Faturamento?)

> Investigação read-only. Fontes: `src/pages/api/impostos/index.ts`, `src/pages/api/impostos/calcular-completo.ts`,
> `src/lib/impostos/calculadoraImpostos.ts`, `src/lib/impostos/types.ts`, `src/pages/api/vendas/*`.
> Comparação de colunas em `db_manaus.dbitvenda` × `db_manaus.dbprodfat`.

## 1. Contrato da API

**Por item:** `POST /api/impostos` (exige cookie `filial_melo`, `index.ts:74-78`).
- **Recebe** (`ImpostoRequest`, `types.ts:290-310`): `codProd, codCli, quantidade, valorUnitario, totalItem?, usarAuto?, tipoMovimentacao?, tipoOperacao?, tipoFatura?, zerarSubstituicao?, usarRegrasOracleProcedimento?, uf_empresa?`.
- **Retorna** (`ImpostoResponse`, `types.ts:313-396`): `cards`, `aliquotas`, `valores`, `campos` (todos os campos p/ `dbitvenda`), `debug`.

Ajustes aceitos de verdade:
- `tipoOperacao` — aceito e **usado** (→ `mapTipoOperacao` → `calcular_cfop`, `index.ts:151,308-316`).
- `uf_empresa`, `usarRegrasOracleProcedimento` — usados (`index.ts:152-153`).
- `zerarSubstituicao` — aceito no tipo, **NÃO passado ao cálculo** (`dados` montado sem ele, `index.ts:144-154`; só ecoa em `debug`, `index.ts:250`) → **ignorado**.
- `tipoMovimentacao`, `tipoFatura` — aceitos no body, **ignorados** (só `debug`).
- `desconto` — **NÃO exposto**; endpoint fixa `desconto: 0` (`index.ts:149`).
- zerar IPI/ICMS, MVA override, imposto antecipado, desconto Suframa, CFOP override direto, IE 04/07 — **não existem** como input.

**Batch:** `POST /api/impostos/calcular-completo` (`types.ts:399-412`): `itens[{codprod, quantidade, valor_unitario, desconto?}], codcli, tipo_operacao, armazem_id, data_emissao`. **Aceita `desconto` por item** e o repassa (`calcular-completo.ts:155`). Sem zerar/mva/suframa/CFOP-por-item.

## 2. `dbitvenda` × `dbprodfat`

Idênticas (SIM/SIM): `cfop, tipocfop, ncm, icms, baseicms, totalicms, icmsinterno_dest, icmsexterno_orig, csticms, mva, basesubst_trib, totalsubst_trib, ipi, baseipi, totalipi, cstipi, pis, basepis, valorpis, cstpis, cofins, basecofins, valorcofins, cstcofins, fcp, base_fcp, valor_fcp, fcp_subst, basefcp_subst, valorfcp_subst, totalproduto, desconto, acrescimo, fretebase, freteicms`.

**Só em `dbitvenda` (faltam em `dbprodfat`):** `aliquota_icms, aliquota_ipi, aliquota_ibs, aliquota_cbs, valor_ibs, valor_cbs, ibs_e, ibs_m, basesubst_trib_ret, totalsubst_trib_ret`.

Conclusão: `dbprodfat` guarda recálculo de ICMS/ST/MVA/IPI/PIS/COFINS/FCP + CFOP + bases/valores; **não** comporta IBS/CBS, alíquota por item, nem os `_ret` de ST.

## 3. Quem escreve imposto em `dbitvenda`

- `finalizarVenda.ts:849` (INSERT) e `postgresql/finalizarVenda.ts:599` — finalização da venda.
- `analise-itens.ts:150/200` — recalcula via `CalculadoraImpostos` e regrava (`aliquota_icms, baseicms, totalicms, mva, aliquota_ipi, baseipi, totalipi, ipi, icms, csticms, cstipi, cfop, tipocfop`).
- **Venda faturada:** NÃO ENCONTRADO guard de `status='F'` — nada impede recalcular itens de venda já faturada (desincroniza o snapshot em `dbprodfat`).

## 4. Entradas do `CalculadoraImpostos`

- Produto (`dbprod`): ncm/clasfiscal, ipi, pis, cofins, strib(origem), cest, isentoipi, monofásico, importado.
- Cliente (`dbclien`): uf, tipo (F/J), iest (IE), icms (contribuinte), cidade.
- Empresa (`dadosempresa`): uf.
- Operação (input): tipo_operacao, data_operacao, quantidade, valor_produto, desconto.
- Overrides opcionais (não expostos por `/index`): ipi_aliquota, pis_aliquota, cofins_aliquota, base_icms_reduzida, percentual_reducao, isento_icms, produto_importado, origem_mercadoria, uf_empresa, uf_cliente, usar_regras_oracle_procedimento.
- SQL: `calcular_cfop`, `buscar_aliquota_icms`, `dbclassificacao_piscofins`, `dbuf_n.ZONA_ISENTIVADA`, IPI por NCM.

**Resposta central:** o motor calcula por item a partir do cadastro; o batch já aceita desconto por item. Mas não tem os ajustes do faturamento (zerar IPI/ICMS/ST, MVA, Suframa, imposto antecipado, CFOP/operação por item) — alguns inexistem e `zerarSubstituicao` não é aplicado. O destino `dbprodfat` não comporta IBS/CBS de um recálculo.
