# Análise Grupo C — Relatórios de Produto / Estoque / Compras (Delphi → Web)

Legenda: **[C]** = confirmado (fonte Delphi, DFM, Oracle all_source ou consulta ao PG); **[I]** = inferência.
Artefatos de apoio em `scratchpad/grpC/`: `src/*.sql` (fontes Oracle extraídas), `*.x` (DFMs resumidos), `pgcheck.js`/`pg*.js` (checagens PG), `ora_*.js`.

## Achados transversais (valem para quase todos os relatórios)

1. **O PG (`db_manaus`) tem só uma fração do histórico do Oracle.** [C] Contagens:
   | Tabela | Oracle | PG | Observação |
   |---|---|---|---|
   | dbprodfat (itens da NF de saída) | 8.520.530 | **192** (só ago–out/2026) | Itens de fatura históricos não migrados; `dbfatura` tem 179 mil cabeçalhos |
   | dbent (entradas) | 187.182 (último 15/08/2026) | **2.662** (só 2025–2026) | |
   | dbvenda | 2.559.215 | 152.722 (2024–2025 + 112 em 2026) | |
   | dbinventario_melo | 114.596 | 47 (último 2011) | |
   | dbitent_armazem | — | 58 | |
   | dbpend | — | 39.602, mas só **98** casam com `dbvenda` | órfãos |
   Qualquer relatório por período que use faturamento/entrada vai sair vazio ou incompleto no PG até o histórico ser migrado (ou até a web gerar dados novos).
2. **Tabelas legadas sem uso recente no Oracle** [C]: `dbacerto` (último registro 2015), `dbentradane`/`dbitentradane`/`dbconhecimentoentne` (2010), `dbgarantiaprod` (2021), `arm_transferencia` (0 linhas), `dbrequis`/`dbitrequis` (**0 linhas**). Nenhuma dessas existe no PG (exceto garantia/transferência, vazias). Recomendação: na web, **omitir os ramos de acerto, entrada NE e garantia** (ou deixá-los opcionais).
3. **Não existem no PG** [C]: `dbpreco` (preços de promoção PRPMAN/PRPBV/PRPPV), `dbacerto`, `dbitdocinterno`, `dbentradane*`, `dbrequis`, `dbitrequis`, `dbcfop_saida`, `dbparametros` (o `DLRCOM` está em `dbcalc.dlrcom`).
4. **APIs web existentes possivelmente quebradas** [C]: `src/pages/api/produtos/extrato.ts` usa `dbproduto`, `dbentrada`, `dbentradaitens`, `dbvendaitens`, `dbfornec`, `dbcliente`… e `src/pages/api/produtos/equivalentes.ts` usa `dbprodequi`/`dbproduto` — **nenhuma dessas relações existe em `db_manaus`** (a menos que `getPgPoolFilial` aponte para outro banco/schema; não verifiquei).
5. **Jobs Oracle de projeção desligados** [C]: `all_jobs` #3 `JOBS.PROJECAO_CURVA_PRODUTO` e #4 `JOBS.PROJECAO_ESTMINIMO_PRODUTO` estão `BROKEN='Y'` (nunca rodaram). São eles que preenchem `dbprod.curva_sugerido` e `qtestmin_sugerido` (usados em Estoque Saturado/Crítico). Ou seja, esses campos estão **parados** também no legado. Só `JOB_DBPROD_CURVA_A` (proc `PROC_DBPROD_CURVA_A`) roda.
6. Padrão de UI do Delphi: grid (TDBGrid/TdxDBGrid) + botão Excel (`Copia_Para_Excel` / `SaveToXLS`) + impressão (QuickReport ou `FrmRelatorioDinamicoZ`, texto matricial). Na web, equivalente natural: tabela + export XLSX + PDF/print.

---

### Produtos em Promoção (aparece 2x no menu) — FPreco / TabPromRel
- **Objetivo:** listar os produtos com preço de promoção cadastrado (>0) de um grupo de produto OU de uma marca; modo "Análise" mostra também a margem sobre o custo. [C]
- **Filtros (front Delphi):** Grupo de Produtos (`meRel_CodGpp`, 5 dígitos, lookup `dmConsulta.Consulta(1)`) **ou** Marca (`meRel_CodMarca`, 5 dígitos). Se os dois vazios, não faz nada; se o grupo estiver preenchido, ele tem prioridade (tipo 'G'), senão marca ('M'). Rádio "Listagem"/"Análise". [C] Os 2 itens do menu (`ProdutosemPromoo1Click` e `mnuProdutosEmPromocaoClick`) escondem TabVisualiza/TabCad/TabAlt e marcam Listagem; o primeiro ainda **esconde a opção Análise** (`rbtnRel_Analise.visible := false`). [C]
- **Saída:** grid `gridRelProm`. Listagem: Referência, Marca, Promoção (`prom_man`), Prom.F.Estado (`prom_bv`), Descrição; rodapé "N produtos em promoção". Análise: Ref, Marca, Pç.Custo, Promoção, %Lucro, Prom.F.Estado, %Lucro F.Estado, (Prom. P.Velho / %), Descrição. Botões: Visualizar, Imprimir (relatório texto via `FrmRelatorioDinamicoZ`, cabeçalho empresa+usuário+data, 135 col.), Copiar para Excel. [C]
- **Fonte de dados:** `RELATO.REL_PROMOCAO_LISTAGEM(vCodGpp, vTipo, cur)` e `RELATO.REL_PROMOCAO_ANALISE(...)`. Regra: `dbProd ⨝ dbPreco ⨝ dbMarcas` onde `pd.codgpp=:cod` (G) ou `pd.codmarca=:cod` (M) e `(pc.prpman>0 or pc.prpbv>0 or pc.prppv>0)`; Análise exige `pd.prcompra>0` e calcula `lucro = (prom/prcompra)*100-100` para man/bv/pv; ordem por `ref`. [C]
- **Tabelas:** dbprod (PG ok), dbmarcas (ok), **dbpreco — NÃO existe no PG** [C]. No Oracle há 122 produtos com promoção >0 [C]. No PG o modelo de promoção é outro: `dbpromocao` (6 linhas), `dbpromocao_item` (13; por codprod/codgpp com desconto %/valor), `dbitpromocao` (47), `dbprod.qtdpromocao/margempromo`. [C]
- **Web hoje:** `/vendas/promocoes` (`src/components/corpo/vendas/promocoes`, API `src/pages/api/promocoes/*`) — cadastro de promoções no modelo novo; não é o relatório. [C]
- **Complexidade:** **P** (SQL simples) — *desde que* se decida a fonte de dados. Se for reescrito sobre `dbpromocao_item` (desconto em vez de preço fixo) vira **M**.
- **Bloqueios/dúvidas:** qual é a "promoção" válida hoje — preços fixos do `dbpreco` legado (sem tabela no PG) ou campanhas `dbpromocao` da web? Colunas "F.Estado"/"P.Velho" (prpbv/prppv = Boa Vista/Porto Velho [I]) fazem sentido ainda?

### Produtos Equivalentes da Marca — frmProdutosEquivalentes
- **Objetivo:** para uma marca, listar todos os grupos de equivalência (`codgpe`) que contenham ao menos um produto dela, mostrando todos os produtos (de qualquer marca) de cada grupo, com estoque e preços. [C]
- **Filtros:** Marca (`edtMarca`, 5 dígitos, obrigatório; lookup `dmConsulta.Consulta(1)`). Pós-filtro opcional "Filtrar/Detalhar Marcas": lista de marcas → filtro client-side `CODMARCA = 'x' OR ...` sobre o resultado. [C]
- **Saída:** grid com Gr.Equiv (só na 1ª linha de cada grupo, cores alternadas por grupo via STATUS 0/1), Referência, Marca, Descrição (54 chars), Est (qtest), Pr.Compra, Pr.Fabr, Custo Atual. Contadores: nº de grupos de equivalência e nº de produtos. QuickReport "RELATORIO DE PRODUTOS EQUIVALENTES DA MARCA" (Visualizar/Imprimir), Excel, CTRL+Z zoom do produto. [C]
- **Fonte de dados:** `ANALISE.PRODUTOS_E_EQUIVALENTES(vCODMARCA, cur)`: subquery `distinct codgpe from dbprod where codmarca=:m and codgpe is not null` ⨝ dbprod ⨝ dbmarcas; colunas CodProd, Ref, CodGpe, Marca, Descr, QtEst, PrCompra, PrFabr, PrCustoAtual, CodMarca; `order by codgpe, ref`. [C]
- **Tabelas:** dbprod (ok; `codgpe` preenchido em 100.635 produtos [C]), dbmarcas (ok). Sem lacunas.
- **Web hoje:** `ProdutosEquivalentesModal.tsx` / `ModalEquivalentes.tsx` (equivalentes de UM produto); API `src/pages/api/produtos/equivalentes.ts` usa `dbprodequi`/`dbproduto` inexistentes [C]. Nada por marca.
- **Complexidade:** **P** — uma query, quebra visual por `codgpe`, filtro de marcas no front.
- **Bloqueios/dúvidas:** nenhum técnico. Volume: marcas grandes podem gerar milhares de linhas (paginar/virtualizar).

### Produtos Equivalentes do Grupo — frmProdutosEquivalentesGP
- **Objetivo:** idem acima, mas a partir de um **grupo de produto** (`codgpp`). Form herda de `TfrmProdutosEquivalentes`; só troca rótulos ("Grupo:", "RELATORIO DE PRODUTOS EQUIVALENTES DO GRUPO", coluna "GRUPO"). [C]
- **Filtros:** Grupo (campo `edtMarca` reaproveitado, 5 dígitos, lookup `Consulta(1)`); pós-filtro "Detalhar Grupos" (filtra pelo campo CODMARCA, que aqui contém o codgpp). [C]
- **Saída:** mesma do anterior; a coluna "Marca" mostra a **descrição do grupo** (`g.descr as Marca`). [C]
- **Fonte de dados:** `ANALISE.PRODUTOS_E_EQUIVALENTES_GP(vCODMARCA, cur)`: `distinct codgpe from dbprod where codgpp=:g` ⨝ dbprod ⨝ dbmarcas ⨝ dbgpprod; `p.codgpp as codmarca`. [C]
- **Tabelas:** dbprod, dbmarcas, dbgpprod — todas ok no PG.
- **Web hoje:** nada (ver item anterior).
- **Complexidade:** **P** — implementar junto com o da Marca (mesma tela, parâmetro tipo M/G).
- **Bloqueios/dúvidas:** o `.pas` atual não está disponível (só .dcu + Geral/*.pas); o comportamento vem do fonte em `Geral/` [C]. Provável confusão de rótulos (mostra descrição do grupo na coluna "Marca") — definir se a web mostra marca real + grupo.

### Extrato Produto - Raio-X — frmProduto_RaioX
- **Objetivo:** extrato completo de movimentação de UM produto (todas as datas, sem período) com saldo de estoque corrente linha a linha, por armazém. [C]
- **Filtros:** produto (botão "..." → `dmConsulta.Codigo`); o form abre já com o produto selecionado no FormShow. Só há fonte de backup (`~pas`/`~dfm`). [C] A procedure Oracle exige também `vArm_Id` (armazém) que o `~pas` não passa → a versão compilada atual deve ter um seletor de armazém [I].
- **Saída:** cabeçalho: Referência, Descrição, Marca, Locação, Estoque Físico (`qtest+qtest_filial`), Estoque Disp. (`qtest-qtdreservada`), Estoque Transf. (`qtest_filial`), totais (E) Entradas / (S) Saídas. Grid dinâmico (colunas montadas a partir do cursor — `xSetCollums`): REFERENCIA, ARMAZEM, TIPODOC, DATA, NRO. DOC., CODCF, CLIENTE / FORNECEDOR, TIPO MOV., QUANTIDADE, PRECO, MOVIMENTACAO, SALDO ESTOQUE. Excel (nome de arquivo herdado "ANALISE DE PROJECAO DE COMPRA.xls" → form clonado do de Projeção [I]), Imprimir (VDOPrinter). [C]
- **Fonte de dados:** `CONSULTAPRODUTO.PRODUTO_RAIOX(vCodProd, vArm_Id, cur)` + `FILTRO(vFiltro)` (SQL dinâmico para estoques de `dbprod`). União de: garantias (DbGarantiaProd/DbItGarantiaProd), vendas (`DbVenda.cancel='N' and estoque_virtual='N'`, DbItVenda por `arm_id`), entradas (DbEnt status<>'C' ⨝ DbItEnt ⨝ **DbItEnt_Armazem**; no armazém GERAL soma também `quant_filial`), acertos A/R (DbAcerto, só GERAL), inventário (`dbinventario_melo`, ajuste<>0, SUBTRAIU=S), transferências entre armazéns (Arm_Transferencia/Arm_It_Transferencia, origem N/E/A = saída; destino A = entrada). Saldo = `sum(mov) over (order by data, sit, coddoc)`. Dois ramos (GERAL vs. outro armazém) diferem só nos ramos de acerto/quant_filial. [C]
- **Tabelas (PG):** dbprod ok (qtest_filial, qtdreservada ok); dbvenda/dbitvenda ok (só até 2025 + poucas 2026); dbent/dbitent ok (só 2025–26); dbitent_armazem 58 linhas; cad_armazem ok (GERAL=1001); dbcredor/dbclien ok; dbgarantiaprod/dbitgarantiaprod existem **vazias**; arm_transferencia vazia; dbinventario_melo 47 linhas (Oracle 114 mil); **dbacerto não existe**. [C]
- **Web hoje:** `ExtratoItemModal.tsx` no cadastro de produtos (`/api/produtos/extrato`) — conceito igual, mas a API consulta tabelas inexistentes [C]. `ProdutoDetalheExpandido.tsx` mostra estoques.
- **Complexidade:** **M** — SQL grande (UNION de 7 fontes + window function) mas direto em PG; risco no ponto de saldo inicial (o legado parte de zero e soma tudo desde o início).
- **Bloqueios/dúvidas:** histórico incompleto no PG faz o "SALDO ESTOQUE" não bater com `qtest`; onde a web grava hoje as movimentações (vendas web vão para dbvenda? entradas web para dbent ou `entradas_estoque` [vazia])? Decidir saldo inicial = `qtest − Σmov` (como faz `RELATORIO_PROJECAO.DIAS_COBERTURA`) [sugestão].

### Extrato de Item de Nota Fiscal — FrmRelatorioNotaFiscal / tabExtItem
- **Objetivo:** extrato de entradas e saídas **por nota fiscal** (não por venda) de um produto num período e armazém, com preço médio de venda. [C]
- **Filtros:** Período (Data Inicial/Final), produto ("Localizar Referência…"), Armazém (lista `ARMAZEM.NAV_ARMAZEM_ATIVOS`), exibe Locações (`FILTRO`). Handler `ExtratodeItemdeNotaFiscal1Click` só torna a aba visível. **Não há .pas** (só .dfm) → defaults não confirmados (padrão do sistema: 1º dia do mês até hoje [I]). [C/I]
- **Saída:** grid `gridExtrato`: Data, No. Nota (`CODDOC`=nroform), Cliente/Fornecedor, Operação (E/S), Preço Unitário, Quantidade. Rodapé: (E) Entradas, (S) Saídas, Saldo de Movimento, Preço Médio de Venda (R$), Estoque Físico, Estoque Disp. Botões Visualizar, Imprimir, Excel. [C]
- **Fonte de dados:** `CONSULTAPRODUTO.EXTRATO_ITEM_NOTA_FISCAL(vcodprod, varm_id, vdt1, vdt2, cur)`: entradas (DbEnt ⨝ DbItEnt ⨝ DbItEnt_Armazem; no GERAL + `quant_filial`) agrupadas por data/nota/credor/preço; saídas = Dbfatura ⨝ Dbprodfat (cfop 5/6/7xxx, `f.cancel='N'`) ⨝ DbItVenda (arm_id) quando `pf.codint is null`, e ⨝ **DbItDocInterno** quando é documento interno. [C]
- **Tabelas (PG):** dbfatura ok; **dbprodfat 192 linhas (Oracle 8,5 mi)**; dbitvenda ok; **dbitdocinterno não existe**; dbent/dbitent/dbitent_armazem parciais; dbcredor/dbclien ok. [C]
- **Web hoje:** nada específico (a tela de faturamento tem espelho da NF, mas não extrato por item).
- **Complexidade:** **M** — SQL moderado; principal custo é a dependência de dados.
- **Bloqueios/dúvidas:** **sem itens de NF históricos no PG** (dbprodfat) → relatório inútil para períodos antigos. Precisa saber em que tabela a web grava itens faturados (dbprodfat só tem ago/2026+). Doc interno (codint) sem tabela.

### Extrato Detalhado — frmExtratoDetalhado
- **Objetivo:** extrato de movimentação de **todos os produtos de uma marca** num período (garantias, vendas, entradas, acertos). [C]
- **Filtros:** Período (default 1º dia do mês corrente → hoje), Marca (`edtMarca`, obrigatório na prática). [C]
- **Saída:** grid: Marca, Referência, Ref. Original, Descrição, Data, Documento, Cod. Cliente, Nome, Operação (E/S), Quantidade, Preço, Nro. Formulário (NF da venda, calculado linha a linha via `EXTRATO_DETALHADO_ZOOM` → `dbfecharvendas ⨝ dbfatura`). Só Excel (SaveToXLS); sem impressão. [C]
- **Fonte de dados:** procedure avulsa `EXTRATO_DETALHADO(vCodMarca, vDtInicial, vDtFinal, cur)` — UNION (com distinct) de garantias, vendas (`v.cancel='N'`), entradas (`status<>'C'`), acertos A e R, filtrando `p.codmarca`; `order by data`. `EXTRATO_DETALHADO_ZOOM(vCodVenda)` = `select f.nroform from dbfecharvendas j, dbfatura f where j.codfat=f.codfat and j.codvenda=:v`. [C]
- **Tabelas (PG):** dbprod, dbvenda, dbitvenda, dbclien, dbent, dbitent, dbcredor ok (com lacunas de histórico); dbgarantiaprod vazia; **dbacerto não existe**; **dbfecharvendas só 47 linhas** (o vínculo venda→fatura no PG pode estar em `fatura_venda` (593) ou `dbprodfat.codvenda` [I]). [C]
- **Web hoje:** nada.
- **Complexidade:** **P/M** — SQL simples; trocar o N+1 do zoom por JOIN; definir vínculo venda→NF.
- **Bloqueios/dúvidas:** UNION (não UNION ALL) no legado elimina linhas idênticas — manter? Vínculo venda→NF no PG.

### Pendência de Produtos — frmRelGer_PendenciaProduto
- **Objetivo:** relatório gerencial de itens de venda pendentes (não atendidos) num período, navegável por Referência, Cliente, Vendedor, Grupo e Marca. [C]
- **Filtros:** Período Inicial/Final; em cada aba um filtro local (Referência / Cliente / Vendedor / Grupo / Marca) com "Desfazer filtro". Menu Tag=17 (código de log de relatório gerencial [I]). **Sem .pas** (só .dfm + .dcu). [C]
- **Saída:** 5 abas com o mesmo dataset em memória (`rxCliente`) ordenado/agrupado diferente: colunas REF, MARCA, PRODUTO, GRUPO, CLIENTE, VENDEDOR, TIPO, NROVENDA, DATA, QTDPEND, PRUNIT, TOTAL (=prunit×qtdpend). Botões Filtrar, Imprimir, Excel. [C]
- **Fonte de dados:** `PENDENCIA.RELGERENCIAL_PENDENCIAPRODUTO(DataIni, DataFim, cur)`: DbVenda (cancel='N', data no período) ⨝ DbClien ⨝ DbItVenda ⨝ **DbPend** (codvenda+codprod) ⨝ DbProd ⨝ DbMarcas ⨝ DbGpProd ⨝ DbVvend (`operador='N'`) ⨝ DbVend. [C]
- **Tabelas (PG):** todas existem (dbpend 39.602; dbvvend 1.197 — muito pouco vs. vendas; **só 98 pendências casam com dbvenda**). [C]
- **Web hoje:** nada (há telas de venda/separação que mexem em pendência, mas não relatório).
- **Complexidade:** **P** (1 query + agrupamentos no front).
- **Bloqueios/dúvidas:** integridade `dbpend`↔`dbvenda` e `dbvvend` no PG — com os dados atuais o relatório sai quase vazio. Join com `dbvvend` exclui vendas sem vendedor "não operador".

### Análise de Compra e Vendas — frmAnaliseCompraVendas
- **Objetivo:** por grupo de produto, comparar total vendido (faturado + vendas "D1") com total comprado a custo final (preço − desconto + custo financeiro + IPI + frete do conhecimento, com dólar), gerando coeficiente venda/compra; abas detalhadas de compras e vendas. [C]
- **Filtros:** Período (default 1º dia do mês → hoje; valida ini<=fim); checkbox Grupo + `edtCodGpp` (filtra **no cliente**, apagando linhas de outros grupos nas abas detalhadas). Grava log `Inc_LogRelGerencial(usuario,'12',...)`. [C]
- **Saída:** aba Geral (CODGPP, Grupo, Total Venda, Total Compra, Coeficiente; totais gerais e nº de referências), aba Compras (grupo → ref, entrada, quant, prunit, pr×qtd, desconto/custo desc, IPI/custo IPI, fin/custo fin, frete/custo frete, custo final; agrupado/expansível), aba Vendas (grupo → ref, descr, qtd, vendido), compras de **não estocados** (entrada NE). Impressão texto (3 relatórios: Compras detalhado, Vendas detalhado, Compras e Faturamento) e Excel. [C]
- **Fonte de dados:** **sem .dfm** → os StoredProcName não foram vistos; mas os componentes `sto_Obter_Produto_*` casam com o package `ANALISE` [I, forte]: `OBTER_PROD_FATURADOS(Tipo,DataIni,DataFim)` (dbFatura tipofat<>'2', tipodest='C', cancel='N' ⨝ dbProdFat ⨝ dbVenda ⨝ dbProd ⨝ dbGpProd; Σ qtde×prunit), `OBTER_PROD_D1` (dbVenda tipo '1'/'2', cancel='N' ⨝ dbItVenda; Σ qtd×prunit), `OBTER_PROD_COMPRADO` (DbEnt status<>'C', temcusto='S' ⨝ DbItEnt ⨝ DbProd ⨝ DbGpProd ⟕ DbConhecimentoEnt), `OBTER_PROD_NESTOCADO` (DbEntradaNe/DbItEntradaNE/DbConhecimentoEntNe), `OBTER_PROD_FAT_DETALHADO`, `OBTER_PROD_D1_DETALHADO`. Cálculo do custo é feito no Delphi (Prepara_Geral). Dólar = `stoParametros.DLRCOM`. [C para SQL e cálculo]
- **Tabelas (PG):** dbfatura ok mas **dbprodfat quase vazio**; dbvenda/dbitvenda parciais; dbent/dbitent parciais; dbconhecimentoent 157; **dbentradane* não existem** (e no Oracle param em 2010 → descartar); DLRCOM em `dbcalc.dlrcom`. [C]
- **Web hoje:** nada equivalente (Dashboard de compras `/comprador` tem gráficos de compras, não o confronto).
- **Complexidade:** **G** — 6 consultas + regra de custo replicada + 3 visões + impressões; dependência forte de dbprodfat.
- **Bloqueios/dúvidas:** confirmar os StoredProcName (DFM ausente); **"D1" soma vendas tipo 1/2 além do faturado → possível dupla contagem** (regra legada a validar com usuário); dados de itens faturados ausentes no PG.

### Análise de Projeção de Compra — FrmRelatorioProjecao (fonte ausente)
- **Objetivo (inferido):** por marca ou grupo (e curva opcional), calcular dias de cobertura (dias em que houve estoque), volume vendido, venda/dia, estoque mínimo sugerido e projeção de cobertura para N dias, e permitir **gravar o novo estoque mínimo**. [I — form sem .pas/.dfm/.dcu; nenhum arquivo em `Desenvolvimento/`]
- **Filtros (inferido pelos parâmetros):** Data Início/Fim, Curva (opcional), Tipo M(arca)/G(rupo) + código, Dias de projeção (`vProjecao`), critério do estoque mínimo `vEstMim` ('P' = usa dias de projeção; senão `dbgpprod.diasreposicao`). [C para a assinatura]
- **Saída:** colunas com alias prontos: REFERENCIA, CURVA, DIAS DE COBERTURA, VOLUME DE VENDAS, VENDAS X COBERTURA, ESTOQUE ATUAL, DIAS PARA REPOSICAO, ESTOQUE MINIMO, PROJECAO DE COBERTURA, EST. MINIMO ATUAL; ordem curva, ref. Provável grid dinâmico + Excel "ANALISE DE PROJECAO DE COMPRA.xls" (nome que sobrou no Raio-X clonado) [I].
- **Fonte de dados:** package `RELATORIO_PROJECAO` (autor MARIO, 2009) [C]: `PROJECAO_COMPRA(vDataInicio, vDataFim, vCurva, vTipo, vFiltro, vProjecao, vEstMim, cur)` (SQL dinâmico; vendas = dbvenda cancel='N', status='F', cliente **não** em `dbclien_filial`; só `p.est='S'`), `DIAS_COBERTURA(codprod, ini, fim)` — função **por produto** que reconstrói o saldo retroativo a partir de `qtest` usando `EXTRATO_ITEM` (garantia, venda, entrada − quant_filial, acertos) e soma os dias com estoque ≤0; `ESTMINIMO_ALTERAR(codprod, estmin, codusr)` (**UPDATE dbprod.qtestmin + log `Usuario.inc_acao_usr`**); `QUANTIDADE_VENDIDA(codprod, dias)`. [C]
- **Tabelas (PG):** dbprod, dbgpprod (diasreposicao ok), dbvenda/dbitvenda, dbclien_filial (8), dbent/dbitent ok; dbgarantiaprod vazia; dbacerto/dbcfop_saida inexistentes. [C]
- **Web hoje:** **Sugestão de Compras** (`src/pages/api/compras/sugestoes/gerar.ts`; usa dbprod.curva, qtestmin, dbitvenda, cmp_it_requisicao, fator de segurança por curva) e `src/pages/api/produtos/sugestao-compra.ts` — mesmo propósito com outra fórmula [C]. 
- **Complexidade:** **G** — UI desconhecida, cálculo de cobertura dia a dia por produto (no PG deve virar CTE/window, não loop por produto), e ação de escrita (alterar estoque mínimo).
- **Bloqueios/dúvidas:** sem fonte do form (layout, defaults, se o usuário edita o est. mínimo na grade). Ligação form↔package é por nome [I]. Avaliar se a "Sugestão de Compras" da web já substitui este relatório antes de migrar.

### Pedidos/Entradas por Comprador — frmRel_Pedidos_por_Comprador
- **Objetivo:** listar, por comprador e período, as ordens de compra emitidas, as entradas (NF de compra) e as entradas NE, com total. [C]
- **Filtros:** Período (Dtinicio/Dtfim), Comprador (3 dígitos, lookup `Consulta(20)`) ou checkbox "Todos os Compradores" (`vTipo='T'`, `vCodComprador='000'`). A aba ativa define qual consulta roda. [C]
- **Saída:** 3 abas: **Pedidos** (Comprador, Nro. Pedido, Estoque=destino, Local Entrega, Data, Fornecedor, Total), **Entradas** (Comprador, Nro. Entrada, Nota Fiscal, Data Entrada, Data NF, Fornecedor, Total), **EntradaNE** (idem). Total geral somado no Delphi. Excel; botão Imprimir invisível. [C]
- **Fonte de dados:** `ORDEM_COMPRA.COMPRADORES_PEDIDOS` (CMP_ORDEM_COMPRA status<>'C' ⨝ CMP_REQUISICAO (id+versão) ⨝ DBCREDOR ⨝ DBCOMPRADORES; total = Σ `cmp_it_requisicao.itr_pr_unitario*itr_quantidade`; destino/entrega = `cad_unidade_melo.unm_sigla`), `COMPRADORES_ENTRADAS` (DBENT status<>'C', totalprod not null ⨝ DBTRANSP ⨝ DBCREDOR ⨝ DBCFOP_N ⨝ DBCOMPRADORES), `COMPRADORES_ENTRADASNE` (DBENTRADANE …). Filtro: `vcodcomprador = CASE vTipo WHEN 'T' THEN vcodcomprador ELSE codcomprador END`. [C]
- **Tabelas (PG):** cmp_ordem_compra (130, até 15/10/2026), cmp_requisicao (164), cmp_it_requisicao (3.269), cad_unidade_melo, dbcredor, dbcompradores, dbtransp, dbcfop_n — todas ok; dbent parcial; **dbentradane não existe** (Oracle parou em 2010 → descartar a aba). [C]
- **Web hoje:** Histórico de compra (`/comprador/historicoCompra`, API `/api/requisicoesCompra/historico-resumo`) e Dashboard de compras — parecidos, não o mesmo recorte por comprador. [C]
- **Complexidade:** **P** — 2 queries simples (sem a aba NE).
- **Bloqueios/dúvidas:** bug no Delphi: em "Todos", para Entradas/EntradaNE ele seta o parâmetro do `SpPedidos` em vez do `SpEntrada` (`vCodComprador` fica nulo → `null = null` → nenhuma linha, a menos que o parâmetro retenha valor) [C no código; efeito I]. JOINs internos com DBTRANSP/DBCFOP_N excluem entradas sem transportadora/CFOP — manter LEFT JOIN na web.

### Relação de Compras por Origem AB (menu INVISÍVEL) — FrmRelComprasOrigemAB
- **Objetivo:** listar itens de entradas com custo no período, separando por origem A/B e CFOP, com total geral em compras. [C]
- **Filtros:** Período; checkboxes Origem A, Origem B; CFOP (checkbox + código 4 díg., lookup). **Sem .pas** — filtros de origem/CFOP aplicados no cliente [I] (a procedure só recebe tipo e datas). [C/I]
- **Saída:** grid: CODENT, DESCR, ORIGEM, CFOP, COMPRADO, CIF, CODIGO; label "Total Geral em Compras". Imprimir, Visualizar. Custo provavelmente calculado como na Análise de Compra (desconto/fin/IPI/frete) [I].
- **Fonte de dados:** procedure `RELATORIO_COMPRAS_ORIGEM_AB(vtipo, DataIni, DataFim, cur)` — só ramo 'G': DbEnt (status<>'C', temcusto='S') ⨝ DbItEnt ⨝ DbProd ⟕ DbConhecimentoEnt; colunas codent, nroform, codprod, ref, quant, prunit, comprado, ipi, custofin, desconto, totalcon, totaltransp, cif, dolar, origem, cfop. [C] (O outer join está invertido: `E.NroCon (+)= Con.Nrocon` [C] — na prática vira inner join com conhecimento, excluindo entradas sem CT-e [I].)
- **Tabelas (PG):** dbent (origem, cfop, temcusto ok), dbitent, dbprod, dbconhecimentoent — existem; dados só 2025–26. [C]
- **Web hoje:** nada.
- **Complexidade:** **P/M**.
- **Bloqueios/dúvidas:** menu invisível no Delphi → **confirmar se ainda é usado antes de migrar**; regra exata (sem .pas) e o significado de Origem A/B.

### Curva ABC — FrmRelCurva_Abc
- **Objetivo:** valor de estoque **real** (`prcompra×qtest`) vs. **ideal** (`prcompra×qtestmin`) por grupo de produto ou por marca, quebrado nas curvas A/B/C/D (+ sem curva), com % por curva no rodapé. [C]
- **Filtros:** radio `rgIven_GM`: Grupo (G) ou Marca (M). Sem período. [C]
- **Saída:** grid: Código, Descrição, Custo Ideal A/B/C/D, Custo Ideal (sem curva), Custo Real A/B/C/D, Custo Real (sem curva), Total Ideal, Total Real; linha final com % de cada curva sobre o total e totais gerais. Excel e Imprimir. [C]
- **Fonte de dados:** componente `spCurva_Abc_Inventario`; sem .dfm, mas casa com a procedure **`CURVA_ABC_IVENTARIO(vTipo, cur)`** (sic) [I forte]: `select gp.descr descricao, p.codgpp codigo, p.curva, sum(prcompra*qtest) custo_real, sum(prcompra*qtestmin) custo_ideal from dbprod ⨝ dbgpprod group by …`; ramo 'M' análogo com dbmarcas. [C]
- **Tabelas (PG):** dbprod (curva preenchida em 389 mil), dbgpprod, dbmarcas — ok. [C]
- **Web hoje:** nada (a web usa `dbprod.curva` só na sugestão de compras).
- **Complexidade:** **P** — 1 query com pivot (`sum(...) filter (where curva='A')`).
- **Bloqueios/dúvidas:** **bugs do legado** [C no código]: (1) as colunas "Custo Real A–D" recebem os valores **ideais** (`custo_real_A := ideal_A`); (2) no ramo Marca a procedure devolve colunas `DESCR/CODMARCA`, mas o Delphi lê `codigo/descricao` → provável erro em runtime [I]. A web deve corrigir (confirmar com usuário). Também não filtra `est='S'`/inativos.

### Estoque Saturado — frmEstoqueSaturado
- **Objetivo:** produtos estocados cujo estoque físico **excede** o estoque mínimo sugerido (excesso), com índice estoque/mínimo e quantidade em pedido. [C]
- **Filtros:** herda de `TfrmCMV` (form base): sem período (escondido); painel "Filtro…" que monta cláusula SQL acumulada: Marca (`m.codmarca in`), Grupo Prod. (`g.codgpp in`), Grupo Func., Comprador (`g.codcomprador in`), Segmento (`g.codseg in`), Informativo (`PROD.INF in`). [C]
- **Saída:** grid: (ocultos codprod/codmarca/codgpp) Marca, Grupo, Referência, Aplicação, Curva Sugerida, Est. Min. Sugerido, Est. Físico, Índice (MenorX), Pedido. Imprimir/Visualizar/Excel do form base. [C]
- **Fonte de dados:** `RELATORIOS.ESTOQUE_SATURADO(vFiltro, cur)` — SQL dinâmico: dbprod ⨝ dbmarcas ⨝ dbgpprod, `est='S' and qtestmin_sugerido is not null and qtestmin_sugerido < qtest and inf not in ('D','S','^')` + vFiltro; `MenorX = qtest/qtestmin_sugerido` (ou qtest se 0); `PEDIDO = Σ dbitrequis.quant` (requis não cancelada, item não 'F', dest 'L'); ordem marca, grupo, curva. [C]
- **Tabelas (PG):** dbprod (`curva_sugerido`, `qtestmin_sugerido` existem; 245 mil com sugerido), dbmarcas, dbgpprod (codseg, codcomprador ok). **dbrequis/dbitrequis não existem — e no Oracle estão vazias → coluna PEDIDO sempre 0 no legado** [C]. Equivalente atual: `cmp_requisicao`/`cmp_it_requisicao` (saldo `itr_quantidade - itr_quantidade_atendida`, como já faz `compras/sugestoes/gerar.ts`) [I].
- **Web hoje:** nada.
- **Complexidade:** **P** — query simples; o filtro dinâmico vira parâmetros (arrays) — **não** repetir a concatenação de SQL.
- **Bloqueios/dúvidas:** `qtestmin_sugerido`/`curva_sugerido` estão **desatualizados** (jobs de projeção quebrados no Oracle) → relatório "funciona" mas com base velha. Decidir se usa `qtestmin` (atual) em vez do sugerido.

### Estoque Crítico — frmEstoqueCritico
- **Objetivo:** inverso do Saturado: produtos com estoque físico **abaixo** do mínimo sugerido. [C]
- **Filtros/Saída:** idênticos ao Saturado (o DFM só troca o caption e o `StoredProcName`). [C]
- **Fonte de dados:** `RELATORIOS.ESTOQUE_CRITICO(vFiltro, cur)` — mesmo SQL com `qtestmin_sugerido > qtest`. [C]
- **Tabelas:** idem Saturado.
- **Web hoje:** nada (a Sugestão de Compras cobre parte da ideia).
- **Complexidade:** **P** — implementar como o mesmo relatório com parâmetro "excesso/falta".
- **Bloqueios/dúvidas:** idem Saturado.

### Produtos que ainda não deram entrada — FrmRel_Prod_nao_deram_entrada
- **Objetivo:** itens de entradas (NF de compra) abertas/finalizadas ainda não alocados ao estoque, a partir de uma data. [C]
- **Filtros:** "Período:" (só data inicial — a procedure recebe apenas `vdataini`); campo "Referência:" (filtro local [I]). **Sem .pas**. [C/I]
- **Saída:** grid: Entrada, Marca, Referência, Aplicação (descr), Quantidade, Data, Comprador. Visualizar, Excel. [C]
- **Fonte de dados:** procedure `REL_ENT_PROD_EM_ABERTO(vdataini, cur)`: dbent ⨝ dbitent ⨝ dbprod ⨝ dbmarcas ⨝ dbcompradores, `e.status in ('A','F') and e.est_alocado = 0 and e.dtent >= :d and it.quant > it.quant_filial`; quantidade = `quant - quant_filial`; ordem marca, data. (Obs.: a coluna "APLICACAO" na verdade é `p.descr` — `p.aplic_extendida` também vem.) [C]
- **Tabelas (PG):** dbent (est_alocado, codcomprador ok), dbitent (quant_filial ok), dbprod, dbmarcas, dbcompradores — ok; hoje 63 entradas A/F com est_alocado=0 no PG. [C] Atenção: a web tem um fluxo novo de recebimento/alocação (`entradas_estoque.est_alocado`, `dbent_recebimento`, `/alocacao`) — vazio hoje [C].
- **Web hoje:** tela `/alocacao` (operacional de alocação) — não é relatório [I].
- **Complexidade:** **P**.
- **Bloqueios/dúvidas:** qual é a fonte de verdade do "alocado" na web (dbent.est_alocado vs. `entradas_estoque`/recebimento)?

---

## Tabela resumo

| Relatório | Complexidade | Bloqueio principal | Web existe? |
|---|---|---|---|
| Produtos em Promoção (x2) | P (M se remodelar) | `dbpreco` não existe no PG; modelo de promoção web é outro (`dbpromocao*`) | Só cadastro `/vendas/promocoes` |
| Produtos Equivalentes da Marca | P | — (volume) | Modal por produto; API `equivalentes.ts` usa tabelas inexistentes |
| Produtos Equivalentes do Grupo | P | — | Não |
| Extrato Produto - Raio-X | M | Histórico incompleto (vendas/entradas/inventário); `dbacerto` ausente; saldo não bate | `ExtratoItemModal` + `/api/produtos/extrato` (tabelas inexistentes) |
| Extrato de Item de Nota Fiscal | M | `dbprodfat` com 192 linhas; `dbitdocinterno` ausente; sem .pas | Não |
| Extrato Detalhado | P/M | `dbacerto` ausente; vínculo venda→NF (`dbfecharvendas` 47) | Não |
| Pendência de Produtos | P | `dbpend` órfão (98 de 39.602 casam com venda); `dbvvend` escasso | Não |
| Análise de Compra e Vendas | G | `dbprodfat` vazio; DFM ausente (procs inferidas); regra de custo/D1 | Não |
| Análise de Projeção de Compra | G | Form sem fonte nenhuma; UI/fluxo desconhecidos; escreve qtestmin | Parcial: Sugestão de Compras |
| Pedidos/Entradas por Comprador | P | Aba EntradaNE sem tabela (descartar); bug "Todos" no legado | Parcial: Histórico/Dashboard de compras |
| Compras por Origem AB (invisível) | P/M | Confirmar se ainda é usado; sem .pas | Não |
| Curva ABC | P | Bugs do legado (real=ideal; ramo Marca) — validar regra | Não |
| Estoque Saturado | P | `*_sugerido` desatualizados (jobs quebrados); PEDIDO via tabela vazia | Não |
| Estoque Crítico | P | idem Saturado | Não (Sugestão de Compras cobre parte) |
| Produtos que não deram entrada | P | Fonte do "alocado" na web | Não (só `/alocacao` operacional) |

## Procedures / packages Oracle do grupo (owner GERAL)

Confirmados pelo DFM/PAS [C]:
- `RELATO.REL_PROMOCAO_LISTAGEM`, `RELATO.REL_PROMOCAO_ANALISE`
- `ANALISE.PRODUTOS_E_EQUIVALENTES`, `ANALISE.PRODUTOS_E_EQUIVALENTES_GP`
- `CONSULTAPRODUTO.PRODUTO_RAIOX`, `CONSULTAPRODUTO.EXTRATO_ITEM_NOTA_FISCAL`, `FILTRO` (SQL dinâmico genérico), `ARMAZEM.NAV_ARMAZEM_ATIVOS`
- `EXTRATO_DETALHADO`, `EXTRATO_DETALHADO_ZOOM` (procedures avulsas)
- `PENDENCIA.RELGERENCIAL_PENDENCIAPRODUTO`
- `ORDEM_COMPRA.COMPRADORES_PEDIDOS`, `ORDEM_COMPRA.COMPRADORES_ENTRADAS`, `ORDEM_COMPRA.COMPRADORES_ENTRADASNE`
- `RELATORIO_COMPRAS_ORIGEM_AB` (avulsa)
- `RELATORIOS.ESTOQUE_SATURADO`, `RELATORIOS.ESTOQUE_CRITICO` (form base `frmCMV` usa ainda `RELATORIOS.CMV_*`, `INVENTARIO`, `ENTRADAS` — fora do escopo), `SEGMENTO_CONSULTA`, `INFPROD_NAVEGA`
- `REL_ENT_PROD_EM_ABERTO` (avulsa)
- Lookups: `PRODUTO.NAVEGA_GPPROD`, `PRODUTO.NAVEGA_PRODUTO`

Inferidos por nome (form sem DFM/fonte) [I]:
- `ANALISE.OBTER_PROD_FATURADOS`, `OBTER_PROD_D1`, `OBTER_PROD_COMPRADO`, `OBTER_PROD_NESTOCADO`, `OBTER_PROD_FAT_DETALHADO`, `OBTER_PROD_D1_DETALHADO` (Análise de Compra e Vendas)
- `RELATORIO_PROJECAO.PROJECAO_COMPRA`, `.DIAS_COBERTURA` (2 overloads), `.EXTRATO_ITEM`, `.ESTMINIMO_ALTERAR` (**escrita**), `.QUANTIDADE_VENDIDA` (Projeção de Compra)
- `CURVA_ABC_IVENTARIO` (avulsa, grafia "IVENTARIO") (Curva ABC)

Relacionados (alimentam campos usados) [C]: `JOBS.PROJECAO_CURVA_PRODUTO` e `JOBS.PROJECAO_ESTMINIMO_PRODUTO` (jobs #3/#4 **BROKEN**; atualizam `dbprod.curva_sugerido`/`qtestmin_sugerido` usando `dbanalise_gpxcurva`), `PROC_DBPROD_CURVA_A` (scheduler job ativo).

Fontes extraídas em `scratchpad/grpC/src/`: ANALISE, CONSULTAPRODUTO, ORDEM_COMPRA, PENDENCIA, RELATO, RELATORIOS, RELATORIO_PROJECAO, JOBS, CURVA_ABC (spec+body) e as procedures avulsas.
