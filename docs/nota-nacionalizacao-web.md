# Nota de Nacionalização (NF-e de entrada de importação) — Spec de implementação web

Base: validação do Delphi (`UniFrmFaturamentoUnificado`), das procedures Oracle (`FATURAMENTOS`, `ENTRADA_IMPORTACAO`, `DECLARACAO_IMPORTACAO`) e do parser de entrada (`UniDtMd.pas`), out/2026.
Complementa `docs/regras-importacao-zfm.md` (regras A–G, B10) e `docs/auditoria-importacao.md`.

> **Decisão travada:** modo padrão **`POR_DI`** (= Delphi): uma NF-e por DI, com `cExportador`/adição/seq **por item**. `POR_EXPORTADOR` fica como alternativa parametrizável (B10).

---

## 1. Como o Delphi faz (validado)

A nota de nacionalização **não é módulo separado nem XML em Pascal**. O fluxo real:

1. **Faturamento Unificado** abre a nota com `Tipodoc_fatura = 'I'` (importação) e `RdgTipo_MovimentacaoDI = ENTRADA` → **tpNF = 0**.
2. Itens com **CFOP série 3** exigem dados de DI por item (flag `TEMDI`: vermelho sem DI, azul com DI; trava o faturamento se faltar).
3. Por item, a tela grava os dados da DI via `FATURAMENTOS.INCLUIR_DI_AUX` na tabela **`DBPRODFAT_IMPORTACAO`** (grupo DI + adição + grupo II).
4. Os impostos são calculados por `FATURAMENTOS.CARREGA_PRODFATAUX` → pacote **`CALCULO_IMPOSTO`** (mesmo motor das vendas: ICMS "por dentro", IPI, PIS/COFINS, IBS/CBS, crédito presumido ZFM), com flags SUFRAMA.
5. A montagem literal do XML (`<ide>/tpNF`, `<dest>`, `<DI>/<adi>`, `<II>`) e a transmissão ao SEFAZ ficam na DLL externa **`enviarNfe.dll`** (fonte fora do repo). O leiaute é o **padrão NF-e modelo 55** — confirmado tag a tag no parser de entrada `UniDtMd.pas`.

**Conclusões que guiam o web:**
- **II / IOF / AFRMM / despesa aduaneira / base II** vêm **prontos da DI** (no Delphi digitados; no web, do XML parseado) → entram **direto no grupo II** da NF-e, sem recálculo.
- **ICMS / IPI / PIS / COFINS / IBS-CBS** usam o **motor de cálculo que o web já tem** (mesmo das vendas). Não há fórmula de imposto específica de importação a reverter.
- **Origem fiscal 1** (estrangeira) vem do **cadastro do produto**, não da tela; na prática é inferida por CFOP série 3 + DI.
- **MVA de importação** (`ATUALIZAR_MVA_IMPORTACAO`) está **inativo** no Delphi — não replicar.

---

## 2. Estrutura do XML (leiaute NF-e modelo 55) — tags a gerar

### 2.1 Cabeçalho (`ide`)
- `tpNF = 0` (entrada).
- `idDest = 3` (operação com exterior).
- `natOp` = natureza de importação (ex.: "IMPORTACAO DIRETA P/ COMERCIALIZACAO").
- CFOP por item série 3 (3.102 comercialização padrão ZFM; 3.101 industrialização; 3.949 outras).

### 2.2 Destinatário (`dest`) — EXTERIOR
- `idEstrangeiro` (sem CNPJ/CPF), `xNome` = exportador.
- `enderDest`: `UF = EX`, `cMun = 9999999`, `xMun = EXTERIOR`, `cPais` + `xPais`.
- No modo **POR_DI** com vários exportadores: destinatário = exportador "principal"/parametrizável (os `cExportador` reais vão por item no grupo DI). No modo **POR_EXPORTADOR**: destinatário = o exportador da nota.

### 2.3 Item — `prod.DI[]` (grupo DI) + `adi[]` (adição)
Tags confirmadas em `UniDtMd.pas:1704-1762`:

| Tag `<DI>` | Fonte (web) |
|---|---|
| `nDI` | DBPRODFAT_IMPORTACAO.NRODI / parser DI |
| `dDI` | DATADI |
| `xLocDesemb` | LOCAL_DESEMBARACO |
| `UFDesemb` | UF_DESEMBARACO (default AM) |
| `dDesemb` | DATA_DESEMBARACO |
| `tpViaTransp` | VIA_TRANSPORTE |
| `vAFRMM` | VALOR_AFRMM (só marítimo) |
| `tpIntermedio` | FORMA_IMPORTACAO (1 própria / 2 c.ordem / 3 encomenda) |
| `CNPJ` / `UFTerceiro` | só quando conta e ordem/encomenda |
| `cExportador` | CODIGO_EXPORTADOR |

| Tag `<adi>` | Fonte |
|---|---|
| `nAdicao` | NUMERO_ADICAO |
| `nSeqAdic` | SEQUENCIA_ITEM |
| `cFabricante` | CODIGO_FABRICANTE |
| `vDescDI` | (opcional) desconto da adição |
| `nDraw` | (opcional) drawback |

### 2.4 Item — `imposto.II` (grupo II), tags em `UniDtMd.pas:2471-2481`

| Tag `<II>` | Fonte |
|---|---|
| `vBC` | BASE_II |
| `vDespAdu` | DESPESA_ADUANEIRA |
| `vII` | VALOR_II |
| `vIOF` | VALOR_IOF |

### 2.5 Item — `imposto.ICMS` / `IPI` / `PIS` / `COFINS` / `IBSCBS`
- `orig = 1` (estrangeira) no grupo ICMS.
- Calculados pelo motor existente do web (`montarGrupoICMS/IPI/PIS/COFINS/IBSCBS`), com as flags SUFRAMA/ZFM.

### 2.6 Totais (`ICMSTot`)
- `vII` = Σ `VALOR_II` dos itens (hoje fixo `'0.00'` em `gerarXml.ts:480`).
- `vOutro` recebe despesas de importação conforme padrão da contabilidade (ver §5, pendência B9).
- `vNF` pela fórmula do leiaute (inclui vII, vIPI).

---

## 3. Modelo de dados web (default POR_DI) — já parcialmente scaffolded

**O que JÁ existe (não recriar):**
- `dbent_importacao` já tem as colunas de nacionalização **no nível do header** (1 nota por DI = POR_DI): `dt_nacionalizacao`, `nro_nfe_nacionalizacao`, `chave_nfe_nacionalizacao`. Também já tem `inscricao_suframa`, `pais_procedencia`, `recinto_aduaneiro`, `navio`, `data_entrada_brasil`, `tipo_die`.
- `dbent_importacao_it_ent` já tem `numero_adicao` por item.
- O parser já extrai as **adições** (`DieXmlAdicao`: numAdicao, nomeFornecedor, vlIi, vlIpi, vlPisCofins, vlBcIcms, vlIcms, vlIcmsSI, itens) e `cod_cliente` (destinatário da NF de nacionalização) — mas as adições **não são persistidas** hoje (só agregadas no header).

**O que FALTA no modelo (mínimo, aditivo):**
- **`dbent_importacao_adicao`** — persistir a adição + exportador (numero_adicao, cod_exportador/nome/país/idEstrangeiro, cod_fabricante, ncm, bc_ii, despesa_aduaneira, valor_ii, valor_iof, vl_desc_di, n_draw). Resolve A2/A3 e o grupo DI/adi/II.
- Campos de grupo DI **por DI** (header): `local_desembaraco`, `uf_desembaraco` (default AM), `data_desembaraco`, `via_transporte` (tpViaTransp), `forma_importacao` (tpIntermedio), `valor_afrmm` — adicionar ao `dbent_importacao` se ainda não existirem (editáveis na tela; a maioria vem do XML).
- Opcional (histórico/990 itens): `dbent_importacao_nfe` só se precisarmos de >1 nota por DI (POR_EXPORTADOR / quebra). No POR_DI o header basta.

Espelha a `DBPRODFAT_IMPORTACAO` do Oracle (grupo DI + adição + II por item), mas no web o grupo DI é por-DI (header) + adição (tabela) e o II é rateado da adição para os itens na emissão.

---

## 4. Ponto de integração no web

Builder: `src/components/services/sefazNfe/gerarXml.ts` (`det.map`, ~L423-464). Adicionar:
1. `prod.DI` (array com `adi`) quando o item for de importação.
2. `imposto.II` (novo helper `montarGrupoII`).
3. `ICMSTot.vII` = soma de vII (hoje `'0.00'`).
4. Bloco `dest` exterior quando `tpNF=0` + importação.
5. `tpNF=0`, `idDest=3`, CFOP 3.x por item, `orig=1`.

Emissão/transmissão: reutiliza o pipeline atual (`src/pages/api/faturamento/emitir.ts`) — a nota de importação é uma NF-e modelo 55 normal (mesmo DANFE).

---

## 5. Pendências a confirmar com a contabilidade (antes de transmitir)

1. **B9 — composição do `vOutro`**: II + IOF + despesas aduaneiras + Siscomex + PIS/COFINS entram em `vOutro`? Qual o padrão MELO exato.
2. **Destinatário no modo POR_DI** com N exportadores: exportador principal, genérico, ou 1 nota por exportador (POR_EXPORTADOR)?
3. **PIS/COFINS de importação** no total e no custo (F4/D3): recuperável (fora do custo) confirmado?
4. **IBS/CBS + crédito presumido ZFM** (E4): aplicar na nota de nacionalização desde já?
5. **CFOP padrão** (3.102 vs 3.101) por tipo de operação.

---

## 6. Plano de implementação (fases)

- **Fase 1 (sem risco fiscal, local):** modelo de dados (migration das 3 tabelas) + helper `montarGrupoII` + grupo DI/`adi` + `vII` total + `dest` exterior no `gerarXml.ts`, gerando o XML **sem transmitir** (preview/validação de schema).
- **Fase 2:** tela — associar DI aos itens, editar campos DI faltantes, botão "Gerar Nota de Nacionalização" (modo POR_DI), com modal de confirmação (padrão `useConfirmarSalvar`).
- **Fase 3 (após decisões §5):** totais/vOutro conforme contabilidade, IBS/CBS/crédito presumido, transmissão SEFAZ em homologação, DANFE.
- **Fase 4:** modo POR_EXPORTADOR + quebra de 990 itens; entrada de estoque a partir da nota (substitui o "Enviar p/ Entrada XML" provisório).

> **Checkpoint:** implementar Fases 1–2 (determinísticas pelo leiaute) e **parar antes da transmissão** (Fase 3), que depende das decisões fiscais do §5.
