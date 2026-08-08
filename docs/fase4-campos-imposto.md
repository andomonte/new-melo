# FASE 4 — Campos que alteram o cálculo de imposto (validação Delphi/Oracle)

> Objetivo desta fase: **mapear/validar fielmente** como cada campo da tela de Faturamento
> do Delphi altera o cálculo, antes de portar. Nada implementado aqui — é o levantamento.
> Fontes: Oracle DEV `all_source` (`CALCULO_IMPOSTO`, `CARREGA_PRODFATAUX`, `FATURAMENTOS`)
> e Delphi `Desenvolvimento/Formularios/FATURAMENTO/UniFrmFaturamentoUnificado.pas`.

## 1. Cadeia de chamada (quem calcula)

```
Tela Delphi (UniFrmFaturamentoUnificado.pas)
  │  monta spCarrega_ProdFat com os flags da tela
  ▼
CARREGA_PRODFATAUX (proc Oracle)      ← tela; grava DbProdFatAux (staging)
  │  PRÉ-COMPUTA por item: xIPI, xICMS, xTotalProduto, xCFOP (aplica ZERAR/SUFRAMA/INSC)
  ▼
CALCULO_IMPOSTO.Calcular_Impostos(9 IN + IN OUT)   ← cálculo puro
  (gêmeo definitivo: FATURAMENTOS.CARREGA_PRODFATAUX, lê DbItVenda/DbItDocInterno)
```

**Ponto crítico:** dos 6 grupos de flag da tela, **só 2 vão direto** para `Calcular_Impostos`
(`Zerar_SUBSTITUICAO`, `MVA_ANTECIPADO`). Os demais (`ZERAR IPI`, `ZERAR ICMS`,
`DESCONTO ICMS SUFRAMA`, `Insc. Estadual`) atuam **no caller**, ajustando `Aliquota_IPI`,
`Aliquota_ICMS` e `Total_Produto` **antes** da chamada. Portar 100% = replicar essa
pré-computação do caller + expor os params que hoje o entry-point fixa.

## 2. Os 9 parâmetros IN de `Calcular_Impostos`

`Tipo_Movimentacao(1)`, `TipoFatura(2)`, `TipoOperacao(3)`, `Zerar_SUBSTITUICAO(4)`,
`Aliquota_IPI(5)`, `Aliquota_ICMS(6)`, `Total_Produto(7)`, `Base_Produto(8)`, `MVA_ANTECIPADO(9)`.

## 3. Tabela: campo da tela → parâmetro → efeito → status no port

| Campo da tela | Param | Literal/valor | Efeito (fiel Oracle) | Onde age | Status no port PG |
|---|---|---|---|---|---|
| **Tipo Movimentação** | 1 `Tipo_Movimentacao` | `'ENTRADA'` / `'SAIDA'` (tela nunca envia `ENTRADA_COMPRAS`) | seleciona caminho SAÍDA×ENTRADA (CFOP, IPI, ICMS, base) | direto | ✅ SAIDA · ❌ ENTRADA (`_inicializar_contexto` RAISE) |
| **Operação/CFOP** | 3 `TipoOperacao` | ver §5 | ramifica CFOP, IPI, ICMS, ST em `Validar_*`/CFOP | direto | ✅ VENDA · ⚠️ transf/devolução parciais · ❌ remessas/garantia/conserto/extravio |
| **Tipo Documentação** | 2 `TipoFatura` | `'FAG'` / `'NOTA_FISCAL'` | `NOTA_FISCAL` habilita ramo de base/IPI (linha 658) | direto | ✅ (entry-point aceita, default NOTA_FISCAL) |
| **Insc. Estadual (AM)** | — (indireto) | `'04'` / `'07'` | entra em `Validar_ICMS(insc, cfop)` → alíquota ICMS; `TRANSFERENCIA`+`'04'` ⇒ zera IPI | caller | ✅ passado a `validar_icms` · ❌ regra IPI transf+04 |
| **ZERAR IPI** | 5 `Aliquota_IPI` | checkbox `'S'`/`'N'` | `'S'` ⇒ `xIPI:=0` **e** `CSTIPI:='99'`; senão `Validar_IPI` | caller | ❌ não exposto (entry fixa Validar_IPI) |
| **ZERAR ICMS** | 6 `Aliquota_ICMS` | checkbox `'S'`/`'N'` | `'S'` ⇒ `xICMS:=0`; senão `Validar_ICMS` | caller | ❌ não exposto |
| **ZERAR SUBSTITUIÇÃO** | 4 `Zerar_SUBSTITUICAO` | `'S'`/`'N'` | `'S'` ⇒ zera ICMS_int/ext e MVA (não muda CST/CFOP) | **direto** | ✅ lógica em `calcular_icms_subst` · ❌ não exposto no entry |
| **DESCONTO ICMS SUFRAMA** | — → afeta 6 e 7 | checkbox `'S'`/`'N'` | Se `'S'` **E** `substr(strib,1,1) NOT IN ('1','2','6','7')`: (a) `xICMS:=0`; (b) `Total_Produto := round(qtd*prunit*(100 − Validar_ICMS)/100, 2)`. **`Base_Produto` fica cheio** | caller | ❌ não exposto |
| **MVA + IMPOSTO ANTECIPADO** | 9 `MVA_ANTECIPADO` | número (ex. `40.00`) ou `0` | valor do campo MVA **só se** checkbox marcado E campo≠vazio; senão `0`. `MVA_ANTECIPADO>0` ⇒ `MVA := MVA_ANTECIPADO/100` | direto | ✅ lógica em `calcular_icms_subst` · ❌ não exposto no entry |
| **CFOP manual (OUTROS)** | — (indireto) | texto livre | `xCFOP` em `Validar_ICMS`; passado no param `CFOP` (IN OUT) | caller | ❌ não exposto |

### Base_Produto × Total_Produto (params 7/8) — regra fiel
- `Base_Produto(8)` = **sempre** `qtd*prunit` cru (nunca descontado).
- `Total_Produto(7)` = `qtd*prunit`, **reduzido só pelo desconto Suframa** quando aplicável.
- Desconto comum (à vista) **não** entra na base fiscal (confirmado — só Suframa reduz).

## 4. Regras de cálculo dependentes dos flags (dentro de `Calcular_Impostos`)

- **Zerar SUBSTITUIÇÃO** (`Calcular_ICMS_Subst`, L1175): `ICMS_Interno_Destino=0`, `ICMS_Externo_Origem=0`, `MVA=0`.
- **MVA_ANTECIPADO** (L1187): se `>0` ⇒ `MVA := MVA_ANTECIPADO/100` (tem prioridade sobre petróleo/legislação/agregado).
- **CST ICMS** (`ICMS_CST`, L3313 — função pública, chamada **pelo caller**, não dentro de Calcular_Impostos):
  strib[1] + sufixo: `EX`→40; ICMS>0&ST>0&baseReduzida→70; ICMS>0&ST>0→10; ICMS=0&ST>0→30;
  ICMS>0&baseReduzida→20; ICMS>0→00; **Suframa='S'→40**; cfop 5949→40; petróleo/protocolo&ICMS=0→60;
  cfop 6915/6916→50; senão→40.
- **CST IPI**: `ZERAR IPI='S'` ⇒ `'99'` (setado no caller).

## 5. Literais de `TipoOperacao` (preservar grafia exata)

**SAÍDA:** `VENDA`, `TRANSFERENCIA`, `DEVOLUCAO_COMPRA`, `DEVOLUCAO_TRANSFERENCIA`,
`REMESSA_BONIFICACAO`, `REMESSA_EXPOSICAO`, `REMESSA_DEMOSTRACAO`*, `REMESSA_ARMAZEM`,
`REMESSA_GARANTIA_FABRICA`, `REMESSA_CONSERTO`, `SIMPLES_REMESSA`, `REMESSA_GARANTIA_CLIENTE`,
`EXTRAVIO_AVARIA_FABRICA`, `EXTRAVIO_AVARIA_CLIENTE`, `RETORNO_REMESSA_GARANTIA`,
`RETORNO_REMESSA_CONSERTO`, `OUTROS`.

**ENTRADA:** `COMPRA`, `TRANSFERENCIA`, `DEVOLUCAO_VENDA`, `DEVOLUCAO_TRANSFERENCIA`,
`ENTRADA_BONIFICACAO`, `RETORNO_EXPOSICAO`, `ENTRADA_DEMOSTRACAO`*, `ENTRADA_ARMAZEM`,
`RETORNO_GARANTIA_CLIENTE`, `RETORNO_GARANTIA_FABRICA`, `RETORNO_CONSERTO`, `OUTROS`.

\* grafado sem "N" no fonte (`DEMOSTRACAO`) — literal a preservar.

`EXTRAVIO_AVARIA_*` também pedem código de **Terceiro** na tela.

## 6. Ressalvas (fiel ao estado atual do Oracle DEV)
- Trechos da condição Suframa (`Percsubst=0`, `Derivado_Petroleo`, `PROTOCOLO_1785`) estão
  **comentados** no fonte atual → hoje inativos; replicar como comentado.
- Tela nunca envia `ENTRADA_COMPRAS` (esse é do setor de Compras / entrada de NF-e, outro caller).

## 7. O que falta portar (escopo FASE 4)

1. **Expor no entry-point** `calcular_imposto_item` os params hoje fixos: `zerar_ipi`,
   `zerar_icms`, `zerar_substituicao`, `desconto_suframa`, `mva_antecipado`, `cfop_manual`,
   e replicar a **pré-computação do caller** (xIPI/xICMS/xTotalProduto) fielmente.
2. **CST ICMS** — portar `ICMS_CST` e chamá-la no entry-point (hoje devolve `''`).
   Idem `CSTIPI='99'` quando zerar IPI.
3. **Operações especiais SAÍDA** — remessas/garantia/conserto/extravio/retornos em
   `validar_cfop_saida`, `Validar_IPI`, `Validar_ICMS`, ST (hoje só VENDA garantido).
4. **Caminho ENTRADA** — `_inicializar_contexto` (origem=fornecedor), `validar_cfop_entrada`,
   e ramos ENTRADA/ENTRADA_COMPRAS de IPI/ICMS/base reduzida/RegraCredor.
5. **Regra IPI** `TRANSFERENCIA` + Insc `'04'` ⇒ zera IPI (caller).
6. **FCP / tipocfop** — confirmar se o Oracle os deriva nesta cadeia (não vistos até aqui;
   FCP não apareceu em `Calcular_Impostos`).

### Prioridade sugerida
- **P1 (fecha o faturamento de SAÍDA):** itens 1, 2, 5 — flags + CST + transf/04. Baixo risco, alto valor.
- **P2:** item 3 (operações especiais de SAÍDA).
- **P3:** item 4 (ENTRADA completa) — maior, exige contexto de fornecedor.

## 8. FASE 4 P1 — IMPLEMENTADO E VALIDADO ✅ (migration 021)

`db_manaus.icms_cst(ctx, desconto_suframa, cfop, valor_icms, valor_icms_subst)` portado de `ICMS_CST`.
`db_manaus.calcular_imposto_item` reescrito: novos params `p_zerar_ipi`/`p_zerar_icms`/`p_desconto_suframa`/`p_cfop_manual` (+ os já existentes `p_zerar_substituicao`/`p_mva_antecipado`) e novo OUT `csticms`. Replica a pré-computação do caller (xIPI/xICMS/xTotal), Total reduzido só na Suframa (Base cheio), regra transf/dev-transf+AM+Insc'04'→IPI 0, e chama `icms_cst` após o cálculo. CST IPI mantido de `validar_cstipi` (o preset '99' do caller é sobrescrito no Oracle = morto).

**Validação Oracle(caller+ICMS_CST) × PG: 32/32 IGUAL** — 8 cenários (baseline, zerar IPI/ICMS/subst, Suframa, MVA=40, transf+04, Insc07) × 4 produtos, 8 campos/caso (cfop, ICMS, ST, MVA, IPI, PIS, cstipi, csticms).

**Compatibilidade:** novos params IN têm DEFAULT → as chamadas existentes de 10 args (/api/impostos, finalizarVenda, analise-itens) seguem válidas; ganham o OUT `csticms` (hoje ainda mapeado como '' no venda-flow — adotar é passo opcional).

### Integração (A) — FEITO ✅
- **B (venda grava csticms):** `/api/impostos`, `finalizarVenda`, `analise-itens` adotaram `r.csticms` (antes '').
- **A1 (backend):** `src/pages/api/faturamento/salvar.ts` — quando a operação é VENDA, RECALCULA cada item via `calcular_imposto_item` (helper `gravarItensFatRecalculado`) com os flags do payload e grava `dbprodfat` (inclui IBS/CBS, antes NULL). Operações não portadas (P2) mantêm o snapshot de dbitvenda (sem regressão). **Idempotente:** VENDA sem flags = mesmo resultado da venda.
- **A2 (UI):** `FaturamentoNota.tsx` — grupo "Ajustes de Imposto" na Etapa 2 (checkboxes Zerar IPI/ICMS/Substituição, Desconto ICMS Suframa, Imposto Antecipado + campo MVA); flags no payload individual (o caminho "grupo/agrupamento" só agrupa faturas existentes, não recria dbprodfat).
- **A2b (Movimentação/Operação — fiel ao Delphi, dois níveis):** substituída a lista plana errada (Venda/Devolução/Transferência/Remessa/Bonificação) por: **Tipo de Movimentação** (SAÍDA/ENTRADA, default SAÍDA vindo da venda) + **Operação** dependente com os literais EXATOS do fonte (OPERACOES_SAIDA/OPERACOES_ENTRADA). Payload envia `tipo_movimentacao` (SAIDA/ENTRADA) e `tipo_operacao` (VENDA/TRANSFERENCIA/...). `salvar.ts`: `resolverTipoOperacaoFat(mov, op)` → só `SAIDA`+`VENDA` recalcula; demais (saída especial/ENTRADA) = snapshot (P2/P3).
- Validado: recalc baseline de uma venda real = valores salvos; `zerar ICMS` zera; csticms/IBS/CBS preenchidos.

### Insc. Estadual (A) — FEITO ✅
`FaturamentoNota.tsx`: radio **Insc. Estadual 04/07** no grupo "Ajustes de Imposto", **pré-selecionado pela IE da empresa** (`ieEmpresa.startsWith('07')`, estado `inscFat` sincronizado nos 2 pontos de derivação) e **selecionável** (como no Delphi). O payload envia `insc07` a partir do `inscFat`; o recalc do `salvar.ts` usa esse valor. **Decisão do usuário:** a VENDA continua fixa em `'04'` (não deriva). Efeito real: intra-AM 04→ICMS 20% vs 07→12%; interestadual não muda. (Duas IEs da empresa: 053374665→04, 070000867→07.)

### Ainda pendente
- **CFOP manual** como override de recálculo não tem controle dedicado (o campo CFOP existe mas hoje não alimenta o motor no recalc — `cfopManual` é passado mas o front manda o CFOP de texto).
- **P2:** operações especiais de SAÍDA (recalc só cobre VENDA). **P3:** ENTRADA. **CALCULAR_TOTAIS** (rateio frete/desc/acréscimo) = frente própria.
