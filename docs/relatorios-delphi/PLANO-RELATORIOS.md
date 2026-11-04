# Plano — Relatórios do Delphi no sistema web

Levantamento do menu **&Relatórios** do Delphi (`Desenvolvimento/Formularios/PRINCIPAL/UniPrincipal`) feito em 02/11/2026: fontes dos formulários (`.pas`/`.dfm`, e `.dcu`/`ProjGeral.exe.bak` quando o fonte não existe), packages Oracle (`all_source`, somente leitura) e tabelas do Postgres (`db_manaus`).

Detalhe de cada relatório (filtros, colunas, procedure, tabelas, bloqueios) nos arquivos ao lado:
[analise_grupo_A.md](analise_grupo_A.md) (vendas/comissão/metas) · [analise_grupo_B.md](analise_grupo_B.md) (faturamento/análises) · [analise_grupo_C.md](analise_grupo_C.md) (produto/estoque/compras) · [analise_grupo_D.md](analise_grupo_D.md) (fiscal/contábil/fabricantes).
Em cada bloco, **[C]** = confirmado no fonte/banco, **[I]** = inferido.

---

## 1. Números

| | |
|---|---|
| Itens no menu &Relatórios | **65** com ação (+ "Mapa de Veículos", desabilitado, e "Consulta Avançada aos Pagamentos", item sem ação) |
| Formulários distintos | 46 (vários com várias abas: `frmRelFatura` = 9 relatórios, `FrmRelatorioGeral` = 9) |
| Formulários sem `.pas` | 22 — 6 sem fonte nenhum (lógica recuperada do `.dcu`/exe e do Oracle) |
| Packages/procedures Oracle envolvidos | ~150 (RELATO, ANALISE*, COMISSAO, RELATORIOS, TEMP, SPED, PERFIL_GPP, SUPER_MASTER…) |
| Já existem no web | 0 completos. Parciais: Comissão de Vendedor (regra diferente), Consulta de Faturas (filtro "sem cobrança"), Dashboard de Vendas (top clientes/produtos), Sugestão de Compras, `contas-receber/relatorio.ts` |
| Página `/admin/relatorios` | placeholder vazio |

## 2. Bloqueio nº 1 — histórico no Postgres (confirmado)

O código não é o maior problema: **os dados de item não foram migrados**. Quase todo relatório por item/período sai vazio no PG hoje.

| Tabela | PG (`db_manaus`) | Oracle | Usada por |
|---|---|---|---|
| `dbfatura` (cabeçalho) | 179.444 (2001→hoje) ✅ | — | quase todos |
| **`dbprodfat`** (itens da fatura) | **192** (só o que o web emitiu, desde 08/2026) | 8,5 milhões | ~35 relatórios |
| `dbvenda` / `dbitvenda` | 152 mil / 650 mil ✅ | 2,56 mi | vendas |
| **`dbvvend`** (vendedor/operador por venda) | **1.197** | ~284 mil desde 2025 | comissão, tele, ranking |
| **`dbfecharvendas`** (venda → fatura) | **47** | 2,4 milhões | notas sem cobrança, licitações, SONY… |
| **`dbent` / `dbitent`** (entradas) | ~2,6 mil / 11,8 mil | 187 mil | ICMS dif., ressarcimento, compras, raio-X |
| `dbfreceb` (baixas) | 62 mil — diverge do Oracle | 145 mil só em 2026 | juros mensal, CR contábil |
| `dbfprereceb`, `dbfrecebdatafluxo` | ~vazias | — | diário auxiliar, CR contábil |

> O Oracle de desenvolvimento está congelado em **15/08/2026**. Os relatórios web, rodando só sobre o PG, terão histórico a partir do que for migrado + o que o web gravar daqui para frente.

**Decisão necessária (Fase 0):** fazer carga histórica de `dbprodfat`, `dbvvend`, `dbfecharvendas`, `dbent/dbitent` e reconciliar `dbfreceb` — ou aceitar relatórios "só a partir de 08/2026". Sem a carga, as Fases 2 e 3 não têm como ser validadas contra o Delphi.

Tabelas do Oracle **sem equivalente no PG** que bloqueiam relatórios específicos:
`dbpreco` (preços/promoção — o web usa `dbformacaoprvenda`/`dbpromocao`), `dbcfop_saida`, `dbcfop_excluso`, `dbclasfiscal_lei`, `dbdocinterno`/`dbitdocinterno`, `dbfncli`, `dbclivend` (+ view `VWRELVENDCLIGPP`), `dbprod_comissao`, `dbgpfaturareceb`, `dbprazo_pst`, `dbacerto`, `dbitprenota`, `DBVENDEDOR_META*`, tabelas do Super Master (regiões/gerentes/coordenadores/metas) e as 9 do PERFIL_GPP.

Gravações que o **web ainda não faz** e que relatórios usam: `dbvvend` (vendedor/operador da venda), `dbfecharvendas` só parcialmente (o web usa `fatura_venda`), `dbacao 'CONFIRMAR ESTOQUE'` (Estoque Suprido).

## 3. Lista completa e classificação

Legenda — **Fase**: 1 = dá para fazer já (dados existem); 2 = depende da carga histórica/tabelas da Fase 0; 3 = regra de negócio pesada; **D** = decidir se ainda é usado (sem movimento no próprio Delphi). Complexidade P/M/G conforme as análises.

### Raiz do menu
| # | Relatório | Form | Cx | Fase | Observação |
|---|---|---|---|---|---|
| 1 | Comissão do Vendedor | FrmRelatorioComissao | P* | 3 | mesmo motor do Gerencial (`COMISSAO.COMISSAO_VENDEDOR`) |
| 2 | Lista de Preço | FrmRelatorioGeral | P | 1 | de-para `dbpreco` → `dbformacaoprvenda` |
| 3 | Produtos em Promoção | FPreco | P | 2 | `dbpreco` não existe; decidir modelo de promoção (legado × `dbpromocao`) |
| 4 | Produtos Equivalentes da Marca | frmProdutosEquivalentes | P | 1 | API web `produtos/equivalentes.ts` quebrada |
| 5 | Produtos Equivalentes do Grupo | frmProdutosEquivalentesGP | P | 1 | |
| 6 | Saída de NEstocado | FrmRelatorioGeral | P | 1 | |
| 7 | Relatório CLM (PST) | frmPstFatura | M | 2 | arquivo TXT posicional; faltam `dbcfop_saida`, `dbfncli`, `dbprazo_pst` |

### Gerenciais
| # | Relatório | Form | Cx | Fase | Observação |
|---|---|---|---|---|---|
| 8 | Cautelas em Aberto | frmRelFatura | P–M | D | abas por vendedor usam `tipo='C'`, morto desde 2013 |
| 9 | Extrato de Itens | FrmRelatorioGeral | M | 2 | API web `produtos/extrato.ts` aponta p/ tabelas inexistentes |
| 10 | Extrato Produto – Raio-X | frmProduto_RaioX | M | 2 | idem; `dbacerto` ausente |
| 11 | Extrato de Item de Nota Fiscal | FrmRelatorioNotaFiscal | M | 2 | `dbprodfat`, `dbitdocinterno` |
| 12 | Extrato Detalhado | frmExtratoDetalhado | P/M | 2 | |
| 13 | Faturas sem Títulos de Cobrança | frmRelFatura | P | **1** | `dbfatura` completa; parcial na Consulta de Faturas |
| 14 | Listagem de Vendas | FrmRelatorioGeral | P | **1** | usar `dbvenda.codvend` no lugar de `dbvvend` |
| 15 | Produtos para N.E. | frmRelFatura | P/M | 2 | regra de preço/dólar no Delphi sem fonte |
| 16 | Pendência de Produtos | frmRelGer_PendenciaProduto | P | 2 | `dbpend` órfão (98 de 39,6 mil casam com venda) |
| 17 | Produtos em Promoção (Gerenciais) | FPreco | P | 2 | = item 3 |
| 18 | Resumo Doctos Grupo/Marca | frmRelFatura | P | 2 | `dbprodfat` |
| 19 | Produto sem Demanda | FrmRelatorioGeral | P | **1** | bug Grupo/Marca no legado |
| 20 | Ranking de Vendedores | frmRelFatura | M | 3 | totalização Normal/Tele/operador estava no Delphi sem fonte; meta |
| 21 | Comissão por Vendedor – Gerencial | FrmRelatorioComissao | G | 3 | `COMISSAO` (9 ramos + exceções fixas); difere da comissão web |
| 22 | Comissão por Vendedor – Financeiro | FrmRelatorioComissao | G | 3 | idem |
| 23 | Relação para Comissão por Cliente | FrmConsulta_comissao_por_cliente | M/G | 3 | procs INVALID no Oracle |
| 24 | Relatório de Notas sem cobrança | frmRelFatura | P | 2 | `dbfecharvendas`/`dbvvend`; decidir `dbfecharvendas` × `fatura_venda` |
| 25 | Listagem de Vendas – diária | FrmRelatorioGeral | P | 1 (+2) | parte pré-nota bloqueada (`dbitprenota`) |
| 26 | Resumo de Documentos | frmRelFatura | P–M | 2 | `dbdocinterno` |
| 27 | Vendas Telemarketing por Vendedor | FrmRelatorioGeral | M | 3 | modelo vendedor/operador (`dbvvend`) não existe no web |
| 28 | Metas de venda por Perfil | FrmPerfilGpp | G | D | package `PERFIL_GPP` INVALID no Oracle |
| 29 | Metas de venda por Cliente | UnitFrmMetasClientes | G | D | idem; última campanha em 2015 |
| 30 | Acompanhamento de Vendas | FrmMasterConsulta | G | 3 | 8 tabelas Super Master ausentes |
| 31 | Análise de Faturamento | frmAnaliseFaturamento | G | 3 | 5 abas, ~15 consultas; parcial no Dashboard |
| 32 | Análise Detalhada do Faturamento | frmAnaliseDetalhadaFaturamento | G | 3 | sem fonte; package de 3,6 mil linhas com TMP |
| 33 | Análise de Faturamento – Telemarketing | FrmAnaliseFaturamentoTeleMkt | M | 3 | `dbvvend` |
| 34 | Análise de Vendas | frmAnaliseVendas | P–M | 2 | reescrever N+1 |
| 35 | Custo de Mercadoria Vendida | frmCMV | M–G | 2 | `dbcfop_saida`; filtro dinâmico |
| 36 | Vendas Desbloqueadas | frmRelatorioVendaDesbloqueada | M | 2 | web só grava `dbanalise_liberacao` |
| 37 | Faturamento do 2º Vendedor nos Grupos | FrmRelatorioGeral | P | 2 | `dbclivend` |
| 38 | Análise de Compra e Vendas | frmAnaliseCompraVendas | G | 3 | sem DFM; `ANALISE.OBTER_PROD_*` |
| 39 | Análise de Projeção de Compra | FrmRelatorioProjecao | G | 3/D | sem fonte nenhum; grava `qtestmin`; web tem Sugestão de Compras |
| 40 | Pedidos/Entradas por Comprador | frmRel_Pedidos_por_Comprador | P | 2 | descartar aba Entrada NE |
| 41 | Compras por Origem AB *(invisível)* | FrmRelComprasOrigemAB | P/M | D | menu oculto no Delphi |
| 42 | Curva ABC | FrmRelCurva_Abc | P | **1** | bugs do legado a não copiar |
| 43 | Projetar Vendas | frmRelFatura | M | D | grava `dbsugestaovendas`, sem uso desde 2005 |
| 44 | Estoque Suprido | FrmRelatorioGeral | P | 2 | web precisa gravar `dbacao 'CONFIRMAR ESTOQUE'` |
| 45 | Saída de Produto por Vendedor | frmExtratoVendedor | P/M | 2 | |
| 46 | Estoque Saturado | frmEstoqueSaturado | P | **1** | `curva_sugerido`/`qtestmin_sugerido` parados (jobs Oracle quebrados) |
| 47 | Estoque Crítico | frmEstoqueCritico | P | **1** | idem |
| 48 | Produtos que ainda não deram entrada | FrmRel_Prod_nao_deram_entrada | P | 2 | definir fonte do "alocado" no web |
| 49 | Licitações | FrmConsultaLicitacao | P | D | sem movimento desde 2024 |
| 50 | Produtos por FAG e NF (DI) | FrmTot_Prod_Fag_NF | M | 2 | `dbdocinterno`; vínculo DI no modelo novo de importação |
| 51 | Acompanhamento SONY | FrmConsultaDiariaSony | M | D | 0 vendas desde 2025 |
| 52 | Acompanhamento HBuster | FrmConsultaSemanalHBUSTER | M | D | sem fonte; estoque total = 1 |
| 53 | Acompanhamento SACHS | FrmAcompanhamentoSACHS | P/M | D | sem fonte; 18 itens vendidos desde 2025 |
| 54 | Produtos por Clientes e FAGs | FrmListagemClientesFags | P | 2 | `dbprodfat` |

### Fiscais / Contábil
| # | Relatório | Form | Cx | Fase | Observação |
|---|---|---|---|---|---|
| 55 | ICMS Diferencial de Entrada | frmRelFatura | P | 2 | `dbent`; fórmula 30%/17% fixa |
| 56 | Inventário de Estoque Mensal e Anual | FrmRelEstContabil | M | **1** | `dbprod` completo; só retrato do estoque atual |
| 57 | Inventário de Estoque Mensal *(invisível)* | frmInventarioMensal | — | não migrar | snapshots `PRODUTOS_yyyy_m` não existem |
| 58 | Valores por Classificação Fiscal (Lei 10.485) | FrmClasFiscal | G | 3 | `dbclasfiscal_lei`, `dbcfop_excluso`; 6 abas + 2 cadastros |
| 59 | Acompanhamento Diário Auxiliar (+ SPED ECD) | FrmConsultaDiarioAuxiliar | G | 3/D | 0 linhas em 2026 até no Oracle; gerador SPED sem `.pas` |
| 60 | Acompanhamento Razão Auxiliar | FrmConsultaRazaoAuxiliar | P | 3/D | fundir com o Diário |
| 61 | Relatório de Ressarcimento ICMS | frmRelatorioRessarcimentoicms | M | 2 | `dbprodfat` + entradas |
| 62 | Contas a Receber – Contábil | frmContasR_Contabil | M | 2 | `dbfreceb` divergente; base em `contas-receber/relatorio.ts` |
| 63 | Vendas Fora do Estado | frmRelatorioVendaForaEstado | M | 2 | sem fonte do form |
| 64 | Juros Mensal | frmRelatorioJurosMensal | P | **1** (após conferir `dbfreceb`) | reaproveita `TIPOS_JUROS` do CR |
| 65 | Faturamento Mensal | frmRelatorioFaturamentoContabil | P/M | **1** | `dbcfop_saida` p/ devoluções |
| — | Mapa de Veículos *(desabilitado)* | — | — | não migrar | |

**Resumo:** Fase 1 = 14 · Fase 2 = 26 · Fase 3 = 15 · Decidir = 12 · Não migrar = 1 (os itens 39, 59 e 60 contam em Fase 3 e em Decidir).

## 4. Fases propostas

### Fase 0 — Dados (pré-requisito das Fases 2 e 3)
1. Carga histórica: `dbprodfat`, `dbvvend`, `dbfecharvendas`, `dbent`/`dbitent`; reconciliar `dbfreceb`/`dbfprereceb`.
2. Criar no PG as tabelas de apoio que ainda são usadas: `dbcfop_saida`, `dbcfop_excluso`, `dbclasfiscal_lei`, `dbdocinterno`/`dbitdocinterno`, `dbclivend`, `dbfncli`, `dbprod_comissao`.
3. Fazer o web gravar o que os relatórios leem: vendedor/operador da venda (`dbvvend`), `dbfecharvendas` (ou definir `fatura_venda` como fonte única), `dbacao 'CONFIRMAR ESTOQUE'`.
4. Corrigir já as APIs quebradas `src/pages/api/produtos/extrato.ts` e `equivalentes.ts` (usam `dbproduto`, `dbvendaitens`, `dbentradaitens`, `dbcliente`… que não existem; as reais são `dbprod`, `dbitvenda`, `dbitent`, `dbclien`).

### Fase 1 — Infraestrutura + relatórios com dados completos
**Infraestrutura comum (uma vez):**
- Hub `/admin/relatorios` com catálogo por grupo (Vendas, Faturamento, Produto/Estoque, Compras, Fiscal/Contábil), e permissão por **função** (`tb_login_functions`, siglas `REL_*`, mesmo padrão de `REL_DIARIO_AVISTA`/`CONSULTA_FATURA_CAIXA`).
- Componente padrão de relatório: barra de filtros (período, filial, vendedor/marca/grupo/cliente com os lookups existentes), grade com quebras e totais, exportação **Excel** (exceljs) e **PDF** (jspdf-autotable) — substitui QuickReport/ZReport.
- API por relatório em `src/pages/api/relatorios/<nome>.ts` com **SQL parametrizado** (o legado montava WHERE no front e executava pela procedure `FILTRO` — não copiar).
- Consolidação multi-filial: o Oracle juntava filiais por database link; no web, consultar cada pool de filial (`getPgPoolPorNomeFilial`) e juntar no Node.

**Relatórios:** Faturas sem Títulos (13), Faturamento Mensal (65), Inventário Mensal/Anual (56), Lista de Preço (2), Saída de NEstocado (6), Produto sem Demanda (19), Listagem de Vendas (14) e diária (25, sem pré-nota), Curva ABC (42), Estoque Saturado/Crítico (46/47 — um relatório com parâmetro), Equivalentes Marca/Grupo (4/5), Juros Mensal (64).

### Fase 2 — Relatórios por item/período (após a Fase 0)
Extratos (9, 10, 11, 12), Resumos de documentos (18, 26), Notas sem cobrança (24), Produtos para N.E. (15), Produtos por FAG/NF e Clientes×FAGs (50, 54), CMV (35), Análise de Vendas (34), fiscais de entrada/saída (55, 61, 63), CR Contábil (62), Compras (40, 48), Promoção (3/17), Pendência (16), Estoque Suprido (44), 2º Vendedor (37), Saída por Vendedor (45), Vendas Desbloqueadas (36), CLM (7).

### Fase 3 — Regra de negócio pesada (cada um é um mini-projeto)
- **Comissão** (1, 21, 22, 23): portar `COMISSAO.COMISSAO_VENDEDOR` e **decidir** se substitui a "Comissão de Vendedor" atual do web (regras diferentes).
- **Análises de faturamento** (31, 32, 33, 20, 27): modelo vendedor × operador/tele; Análise Detalhada tem package de 3,6 mil linhas.
- **Compras** (38, 39): avaliar se a Sugestão de Compras do web já cobre a Projeção.
- **Fiscal** (58 Lei 10.485; 59/60 Diário/Razão + SPED ECD).
- **Acompanhamento de Vendas / Super Master** (30).

## 5. Decisões para o negócio
1. **Carga histórica** (Fase 0) — migrar ou relatórios só a partir de 08/2026?
2. **Descontinuar?** Sem movimento no próprio Delphi: Licitações, SONY, HBuster, SACHS, Metas por Perfil/Cliente (package inválido), Projetar Vendas, Cautelas por vendedor, Compras Origem AB, Diário/Razão Auxiliar, Inventário Mensal invisível, Mapa de Veículos.
3. **Comissão:** a regra do Delphi (`COMISSAO`, 9 ramos) ou a regra atual do web?
4. **Promoção:** preços fixos do legado (`dbpreco`) ou o modelo `dbpromocao` do web?
5. **Venda → fatura:** `dbfecharvendas` (legado) ou `fatura_venda` (web) como fonte única?
6. **Meta de vendedor** (Ranking): `dbvend.valobj` ou `DBVENDEDOR_META` (não migrada)?

## 5.1 Decisões tomadas (02/11/2026)
- **Prioridade atual:** itens 2, 3, 4 e 5 da raiz do menu. Itens 6 e 7 ficam para análise posterior.
- **Comissão (itens 1, 21–23):** fora por enquanto.
- **Produtos em Promoção (3/17):** relatório **novo**, sobre o modelo de promoção do web — não reproduz o Delphi (`dbpreco`).
  - Cadastro grava em `dbpromocao` (cabeçalho: período, tipo, desconto PERC/VALO, qtde mínima/máxima total e por cliente, `ativa`, `permite_balcao`, clientes/vendedores vinculados em jsonb) e `dbpromocao_item` (produto ou grupo `codgpp`, desconto do item, `qtd_total_item`, `qtdvendido`, `qtdfaturado`, `origem` N=nacional/importado) — APIs `api/promocoes/add|get|delete`.
  - A venda grava `dbitvenda.id_promocao`/`id_promocao_item` e soma `dbpromocao_item.qtdvendido` (`api/vendas/postgresql/finalizarVenda.ts`).
  - `dbitpromocao`/`dbitpromocaoaux` (47 linhas, legado) **não são usadas pelo web** — ignorar.
  - Lacunas encontradas: `qtdfaturado` nunca é gravado; não há baixa de `qtdvendido` quando a venda é cancelada; nenhuma venda vinculada a promoção até hoje (dados só de teste).

## 6. Bugs do legado a NÃO reproduzir
- Curva ABC: "Custo Real" recebe o valor ideal; ramo Marca com colunas trocadas.
- Pedidos por Comprador: opção "Todos" preenche o parâmetro da consulta errada.
- Compras Origem AB: outer join invertido.
- Produto sem Demanda: filtro Grupo/Marca.
- SQL montado no front (`FILTRO`, `vFiltro` do CMV), laços N+1 e `UNION` sem `ALL`.
- Campos `dbprod.curva_sugerido`/`qtestmin_sugerido` estão parados (jobs Oracle `JOBS.PROJECAO_*` quebrados) — Saturado/Crítico precisam de recálculo próprio no web.
