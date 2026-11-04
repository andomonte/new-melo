# Análise GRUPO D: Fiscal / Contábil / Fabricantes / Licitações

Feito em 2026-11-02, somente leitura. Fontes de PL/SQL extraídas para `scratchpad/grpD/src_*.sql` (e `grpD/vw_fincontabil.txt`).
Convenção: **[C]** = confirmado (fonte Delphi/DFM/DCU ou Oracle all_source/consulta real). **[I]** = inferência.

## Achados transversais (valem para quase todos)

1. **[C] Itens de fatura NÃO estão migrados no PG.** `db_manaus.dbprodfat` tem 192 linhas no total, 145 delas ligadas a faturas de 06/08/2026 a 30/10/2026, ou seja, só o que o sistema web emitiu. O Oracle tem 298.126 itens só em 2026. `dbfecharvendas` no PG tem 47 linhas (Oracle 2026: 64.559). `dbfatura` (cabeçalho) está completo: 179 mil linhas, de 2024 a 30/10/2026.
   Todo relatório por item de NF de saída (Licitações, FAG×NF, SONY, Clientes×FAG, Clas.Fiscal, Ressarcimento, Vendas fora do Estado) **sai vazio no PG para o histórico** enquanto não houver carga de `dbprodfat` + `dbfecharvendas`.
2. **[C] Entradas também estão parciais:** `dbent` tem 2.662 linhas (2025: 2.658, 2026: 4) e `dbitent` tem 11.800 (2026: 9). O Oracle tem 6.376 entradas em 2026. O web grava NF-e de entrada em `dbnfe_ent` (29 mil linhas) e `dbent_importacao*`. Por isso Clas.Fiscal (entradas), Ressarcimento e Vendas fora do Estado (busca da última entrada do produto) ficam sem base.
3. **[C] `dbfreceb` diverge:** em 2026 o PG tem 39.038 linhas e o Oracle 144.930. Só o tipo 25 tem 1.024 no PG contra 45.154 no Oracle. `dbfprereceb` tem 50 linhas no PG (Oracle 1,29 mi). `dbfrecebdatafluxo` tem 250 linhas no PG, a última de 2001 (Oracle 3 mi).
4. **[C] Multi-filial:** no Oracle, quase todos os relatórios fazem UNION com `@LNKMELODBPVH/REC/FLZ/CSAC/JPS/BMO/BVB` (database links). No web cada filial tem pool e schema próprios (`lib/pg.ts` → `getPgPoolFilial`, `tb_filial.schema_db/db_conn_enc`). Para consolidar é preciso iterar as filiais no Node e juntar. Não existe equivalente a dblink.
5. **[C] O Oracle de leitura é uma cópia:** last_ddl de 17/08/2026, `max(dbfatura.data)` = 15/08/2026. Várias procedures estão **INVALID** porque os dblinks remotos não resolvem (ORA-04052): CONSULTA_REL_DIARIO_SONY, CONSULTA_DIARIO_AUXILIAR, CONSULTA_RAZAO_AUXILIAR, RELATORIO_JUROS_RECEBIDO, RELATORIO_FATURAMENTO_CONTABIL, SPED (body), CONSULTA_REL_SEMANAL_HBUSTER, CONSULTA_SACHS_VENDA_ESTOQUE. Não dá para executá-las aqui; a regra foi lida do fonte.
6. **[C] Quatro relatórios estão mortos no próprio legado** (consulta feita no Oracle):
   - Licitações: 0 faturas desde 2024 com o filtro da procedure.
   - SONY: 0 itens vendidos dos grupos 00816/00817 desde 2025.
   - HBUSTER: 338 produtos, estoque total = 1.
   - Diário/Razão Auxiliar: o INNER JOIN com DBFPRERECEB devolve 0 linhas em 2026.

   SACHS é quase morto: 18 itens vendidos desde 2025. Antes de migrar, **confirmar com o usuário se esses relatórios ainda são usados.**
7. **[C] Web hoje:** `/admin/relatorios` (`src/components/corpo/admin/relatorios/index.tsx`) é placeholder. Não existe nada de fiscal, contábil, inventário ou SPED. O que existe e pode ser reaproveitado:
   - `pages/api/contas-receber/relatorio.ts`: tem o layout "recebimento_clientes" sobre `dbfreceb`, com `TIPOS_JUROS = ('18','20','21','22','23','25','26')` (mesmos tipos do Juros Mensal) e exportação PDF/Excel com jsPDF/ExcelJS.
   - Cadastro de Classificação Fiscal (`/admin/cadastros/classificacaoFiscal`, tabela `dbclassificacao_fiscal`): é a tabela de NCM. **Não** é a lista da Lei 10.485 (`DBCLASFISCAL_LEI`).

---

### Licitações (FrmConsultaLicitacao)
- **Objetivo:** listar vendas a órgãos públicos de licitação (CFOP 6108), por item.
- **Filtros (front Delphi) [C]:**
  - Data inicial e final: default hoje; valida inicial ≤ final.
  - `cbxFilial`: ItemIndex 0. Os itens não estão no DFM, mas a procedure aceita MAO/PVH/REC/FLZ.
  - `rgOpcao`: 0 = Todas (vOPCAO='T'); 1 = Venda normal (virtual N, estocado S); 2 = Venda virtual (S/S); 3 = Venda não estocada (N/N).
- **Saída [C]:** grid de 8 colunas (NOME, NROVENDA, NROFORM, DATA, REF, DESCR, QTD, PRUNIT), contador de registros e Excel (`SaveToXLS`, botão só habilitado quando há linhas). Não tem impressão.
- **Fonte [C]:** `CONSULTA_LICITACOES(vEstocado,vVirtual,vData1,vData2,vOpcao,vFilial,vCursor)` (standalone, VALID). SQL dinâmico com sufixo de dblink por filial.
  - Joins: DBCLIEN→DBFATURA→DBFECHARVENDAS→DBVENDA→DBITVENDA→DBPROD.
  - Filtros: `codcc in (00005,00006,00007)`, `C.codvend='00008'`, `cancel='N'`, `cfop1='6108'`; opcionalmente `P.EST` e `V.ESTOQUE_VIRTUAL`.
  - Ordenação: nome, nrovenda.
  - As datas são passadas como string (`DateToStr`) e concatenadas no SQL.
- **Tabelas:**
  - dbclien: OK, com 103 clientes no critério codcc/codvend.
  - dbfatura: OK.
  - dbfecharvendas: **só 47 linhas**.
  - dbvenda / dbitvenda: OK até 2025; 2026 tem 112/223 linhas.
  - dbprod: OK.
  - Colunas `estoque_virtual`, `codcc` e `est` existem.
- **Web hoje:** nada.
- **Complexidade:** **P** (uma query, 4 filtros).
- **Bloqueios/dúvidas:**
  - Falta `dbfecharvendas` histórico.
  - O relatório está morto no legado (0 ocorrências desde 2024).
  - Os itens do combo de filial não estão disponíveis porque não há DFM.

### Produtos por FAG e NF (DI) (FrmTot_Prod_Fag_NF)
- **Objetivo:** confrontar a quantidade faturada em FAG (tipofat 3) com a quantidade em NF ligada a documento interno de DI (tipofat 1). Mostra o saldo por produto e o valor do saldo a preço de compra.
- **Filtros [C]:** data inicial e final (`vData1`/`vData2` AsDate); valida inicial ≤ final. Os defaults não estão no .pas (provavelmente os do DFM).
- **Saída [C]:** grid com Marca, Referência, Descrição, Qtd Fag, Qtd NF, Saldo e Total, mais Excel. A procedure também devolve "Pr Compra", que não está no grid. Sem totais nem impressão.
- **Fonte [C]:** `CONSULTA_TOT_PROD_POR_NF_FAG(vDATA1,vDATA2,vCursor)` (VALID). UNION de dois blocos:
  - Qtd_NF: DBPRODFAT⋈DBFATURA⋈**DBDOCINTERNO** (via `pf.codint`) com tipofat 1 e CFOP1/CFOP2 em (5405,5403,5102,6108,6404,6403,6102).
  - Qtd_Fag: tipofat 3.
  - Agrupa por marca, ref, descr e prcompra. Saldo = Fag − NF; Total = PrCompra × Saldo.
  - Atenção: não filtra `cancel`.
- **Tabelas:**
  - dbprodfat: **quase vazia**; a coluna `codint` existe.
  - dbfatura: OK, com 703 FAG em 2026.
  - **dbdocinterno: NÃO EXISTE no PG.**
  - dbprod e dbmarcas: OK.
- **Web hoje:** nada. **[I]** O web liga DI por `dbfatura.importacao_id` / `dbent_importacao*` (ver `lib/importacao/gerarFaturaNacionalizacao.ts`). O join por `codint/dbdocinterno` teria de ser trocado por `importacao_id IS NOT NULL` (a validar).
- **Complexidade:** **M**. A query é simples, mas é preciso redefinir o vínculo com DI no modelo novo.
- **Bloqueios:**
  - Falta `dbdocinterno` e o histórico de `dbprodfat`.
  - Definir com o usuário o que é "NF (DI)" no sistema novo.

### Acompanhamento SONY (FrmConsultaDiariaSony)
- **Objetivo:** listar diariamente as vendas de produtos SONY (grupos SONY-MULTIMIDIA/FALANTES) de todas as filiais, para enviar ao fabricante.
- **Filtros [C, pelo DFM]:** Data Inicial e Data Final. O form passa ainda `VCODUSR` (usuário logado). Não há .pas (o form só tem DFM); as validações são [I], provavelmente iguais às do FAG/NF.
- **Saída [C]:** grid com Mês, Data, NF, CNPJ, Razão Social, Cidade, UF, Telefone, Produto, Qtd, Custo Unitário (PRUNIT), Prazo Pgto, Faturamento, Origem, Classificação da Venda e Cód. Vendedor, mais Excel.
- **Fonte [C]:** `CONSULTA_REL_DIARIO_SONY(vCursor,vData1,vData2,vCodUsr)`, **INVALID**.
  - Cria e popula a tabela física `TMP_SONY` (DELETE/INSERT por usuário) e depois devolve o SELECT dela.
  - UNION de MAO (codgpp 00816/00817), PVH (00629/00680), REC (CODMARCA 02166/00446) e FLZ (00781/00771).
  - Filtros: tipofat 1, tipodest 'C', cobranca 'S', codgp nulo, classe do vendedor (telemarketing 003/008), mais uma lista fixa de clientes excluídos por filial.
  - Telefone vem de DBFNCLI; prazo vem da função `RETORNA_PRAZO_NF` (lê DBPZFAT, ou "A VISTA" a partir de DBRECEB).
- **Tabelas:**
  - dbvenda, dbitvenda, dbclien, dbgpprod (00816/00817 existem), dbprod, dbfatura, dbvvend, dbvend, dbclassevendedor: existem.
  - dbfecharvendas: **47 linhas**.
  - **dbfncli: NÃO EXISTE** (dbclien no PG não tem coluna de telefone; procurar a tabela de contatos equivalente).
  - dbpzfat: existe, 17 linhas.
  - `TMP_SONY` e `RETORNA_PRAZO_NF` não existem no PG. Não são necessárias, basta uma query direta.
- **Web hoje:** nada.
- **Complexidade:** **M**. Uma query, mas com 4 filiais com códigos de grupo diferentes, listas fixas de exclusão e prazo concatenado.
- **Bloqueios:**
  - Relatório morto (0 vendas SONY desde 2025).
  - Falta a fonte do telefone.
  - Falta o vínculo fatura↔venda (dbfecharvendas).

### Acompanhamento HBuster (FrmConsultaSemanalHBUSTER, sem fonte)
- **Objetivo [I]:** acompanhamento semanal de produtos HBUSTER (marca 01124) com estoque, média de venda, pendência de compra e venda mensal por filial e total.
- **Filtros [I]:** uma data (`vData`), pela assinatura da procedure. O form não tem .pas, .dfm nem .dcu.
- **Saída [I, pelos aliases da procedure]:**
  - Referência e Descrição.
  - Para MAO, PVH, REC e FLZ: Est, Med, Pend e Venda Mensal.
  - Totais: TOTAL EST, TOTAL MED, TOTAL PEND e TOTAL VENDA MENSAL.
  - **[I]** Grid + Excel, como os irmãos.
- **Fonte:** `CONSULTA_REL_SEMANAL_HBUSTER(vCURSOR,vData)`, **INVALID** [C fonte; vínculo form→proc é I pelo nome].
  - Média = AVG(qtd) de DBITVENDA nos 4 meses anteriores ao mês de vData.
  - Pend = SUM(DBITREQUIS.QUANT) com status 'A'.
  - Venda mensal = do 1º dia do mês anterior até vData.
  - Marcas por filial: MAO 01124, PVH 01211, REC 01518, FLZ 01124.
  - Existem também `NAVEGA_NF/ITNF/CLIENTE/VENDEDOR_HBUSTER` (VALID), que parecem ser outra rotina (exportação diária ao fabricante, [I]).
- **Tabelas:**
  - dbprod, dbitvenda, dbvenda: OK.
  - **dbitrequis/dbrequis: NÃO EXISTEM no PG.** O modelo novo é `cmp_requisicao` / `cmp_requisicao_item` (req_status, quantidade, quantidade_atendida). A pendência teria de ser reescrita.
- **Web hoje:** nada.
- **Complexidade:** **M**. São subqueries por produto e por filial, e a pendência de compra tem modelo novo.
- **Bloqueios:**
  - Não há fonte do form.
  - Relatório morto (estoque total HBUSTER = 1).
  - A regra de pendência no modelo `cmp_*` precisa ser definida.

### Acompanhamento SACHS (FrmAcompanhamentoSACHS, sem fonte)
- **Objetivo [I]:** gerar ao fabricante SACHS os arquivos de venda e estoque por filial, com códigos de filial do fabricante 20388201 a 20388205.
- **Filtros [I]:** tipo (V = venda analítica por ref, E = estoque, SV = sintético de venda em valor, SE = sintético de estoque), data inicial e data final.
- **Saída [I]:**
  - V: Data Inicial, Data Final (YYYYMMDD), Filial, Referência, Qtd.
  - E: estoque por referência.
  - SV/SE: mês e valor por filial.
  - **[I]** Grid + Excel/TXT para o fabricante.
- **Fonte:** `CONSULTA_SACHS_VENDA_ESTOQUE(vCURSOR,vTIPO,vData1,vData2)`, **INVALID** [C fonte; vínculo é I].
  - Marca por `M.DESCR LIKE 'SACHS'` (só 00405 SACHS; SACHS PESADO 02069 fica fora).
  - Venda: `V.STATUS='F'`, `cancel='N'`, exclui clientes de `DBCLIEN_FILIAL`.
  - Filiais: MAO, PVH, REC, FLZ, JPS.
- **Tabelas:** dbvenda, dbitvenda, dbprod, dbmarcas e dbclien_filial (8 linhas): existem.
- **Web hoje:** nada.
- **Complexidade:** **P/M**. Quatro queries simples; o custo está no consolidado multi-filial.
- **Bloqueios:**
  - Não há fonte do form (layout de exportação desconhecido).
  - Quase sem uso (18 itens vendidos desde 2025).
  - A filial JPS não existe no web [I].

### Produtos por Clientes e FAGs (FrmListagemClientesFags, só .dcu)
- **Objetivo:** listar os itens de cada FAG (tipofat 3) por cliente, com linha de total por FAG.
- **Filtros [C, strings do DCU]:** data inicial e final (`vData1`/`vData2` SetAsDate); valida inicial ≤ final.
- **Saída [C/I]:**
  - Grid de 7 colunas + Excel.
  - O DCU chama `FullExpand`, por isso **[I]** o grid é agrupado por "Cliente e FAG".
  - A procedure devolve "Cliente e FAG" (`'UF: '||uf||' - '||codcli||' - '||nome||' == Nº FAG:'||codfat`), Marca, Referencia, DESCRICAO, Codprod, Qtde, Pr Unitario e Total.
  - Há uma linha sintética 'TOTAL' por FAG (union).
- **Fonte [C]:** `CONSULTA_TOT_ITEM_POR_FAG(vCURSOR,vDATA1,vData2)` (VALID). DBFATURA tipofat 3 e cancel N, ⋈ DBPRODFAT/DBCLIEN/DBPROD/DBMARCAS.
- **Tabelas:**
  - dbfatura: OK, 703 FAG em 2026.
  - **dbprodfat: sem histórico.**
  - dbclien, dbprod, dbmarcas: OK.
- **Web hoje:** nada (existe `pages/api/faturamento/resumo-gp-pdf.ts`, sem relação direta).
- **Complexidade:** **P**.
- **Bloqueios:** carga de `dbprodfat`.

### Inventário de Estoque Mensal e Anual (FrmRelEstContabil)
- **Objetivo:** gerar o Livro/Relatório de Inventário (estoque existente na data) para a contabilidade e o fisco: NCM, descrição, unidade, quantidade, custo unitário e custo total.
- **Filtros [C]:**
  - Lista de marcas (todas marcadas; **não é usada**, porque `vCodMarca` está comentado na procedure).
  - "Insc. Estadual 07 (Manaus)": checkbox. Se marcado, só produtos de grupo de função Pneu; senão, todos os outros.
  - "Valor do dólar": default 1.80; obrigatório e diferente de zero.
  - "Estoque Contábil": radio 1/2, vai para `dbprod.estoque_contabil`.
  - "DTPeriodo": data, **usada só no cabeçalho** ("ESTOQUE EXISTENTE EM dd de mmmm de yyyy").
  - O rgOrigem MAO/PVH/REC/FLZ está invisível; a filial vem de `DADOS_MELO.UF`.
- **Saída [C]:**
  - Tab2 com grid em memória (rxProdutos): codprod, ref, clasfiscal, descr, marca, un ('PC' se vazio), qtest, custo_unit, custo_total. Remove linhas com custo 0, ordena por descrição, mostra o total de produtos e o custo total.
  - Impressão em texto (QuickReport `rptGenerico`) com cabeçalho de razão social, CNPJ e IE fixos por UF/IE (MAO 04.164.781-5 ou 07.000.086-7, PVH, REC, FLZ) e linha final "CUSTO TOTAL".
  - Excel via `Copia_Para_Excel`.
- **Fonte [C]:**
  - `INVENTARIO_UNIFICADO.NAVEGA_MARCAS`, `.PRODUTOS_INVENTARIO_MARCA_ESQ(vTipo,vIE,vDolar,vEst_Contabil,cursor)` e `.DADOS_MELO` (package VALID).
  - Regra: `dbprod` com est='S', (QtEst−QtdReservada)>0, PrCompra>0.10, estoque_contabil = param, clasfiscal ≠ zeros, codgpf dentro ou fora da lista de 12 grupos Pneu conforme IE.
  - Custo total = PrCompra × qtd, multiplicado pelo dólar quando `P.Dolar='S'`.
  - **É um retrato do estoque ATUAL; não reconstrói estoque histórico na data.**
- **Tabelas:**
  - dbprod: OK (396 mil linhas; colunas qtest, qtdreservada, prcompra, dolar, unimed, clasfiscal, estoque_contabil, codgpf existem). **[C]** No PG todos os produtos têm estoque_contabil='1'.
  - dbmarcas e dadosempresa: OK (dadosempresa tem 2 linhas: MELO e LEÃO DE JUDÁ).
  - **[I]** O PG tem `dbprod_contabil(codprod, prcusto, estoque)`, usado em `lib/compras/custoEntrada.ts`, `lib/compras/custoMedio.ts` e `lib/compras/gerarEntradaDbent.ts`. Pode ser a fonte mais correta do "estoque contábil" no modelo novo; precisa ser validado com o usuário.
- **Web hoje:** nada.
- **Complexidade:** **M**. Uma query, mas tem layout de livro fiscal (cabeçalho por IE/filial), parâmetro de dólar e decisão sobre a fonte do custo e do estoque.
- **Bloqueios/dúvidas:**
  - O legado não é histórico: para o inventário anual em 31/12 alguém precisa rodar no dia. O web deveria guardar um snapshot ou calcular por movimentação?
  - A lista de grupos Pneu está hard-coded.
  - O web usa `dbprod.prcompra` ou `dbprod_contabil.prcusto`?

### Inventário de Estoque Mensal (INVISÍVEL) (frmInventarioMensal)
- **Objetivo:** versão antiga do inventário. Lê **tabelas de snapshot `PRODUTOS_<ANO>_<MES>`** num banco escolhido em `cbBanco` (componente `ibDtBase`, provavelmente InterBase ou Paradox, [I]).
- **Filtros [C]:** data (`dia`, gera o nome da tabela), banco (combo), valor do dólar e origem (MAO/PVH/REC, para o CNPJ no cabeçalho).
- **Saída [C]:** CODPROD, REF, DESCR, MARCA, QTEST, PRCOMPRA, PRMEDIO, TOTAL_PRCOMPRA e TOTAL_PRMEDIO (×VLRDOLAR), DOLAR, ordenado por dólar e descrição. Preview em QuickReport e Excel.
- **Fonte [C]:** SQL inline `SELECT ... FROM MARCAS M, PRODUTOS_yyyy_m P WHERE QTEST>0 AND PRMEDIO>0`. **[C]** Não existe nenhuma tabela `PRODUTOS_yyyy_m` no Oracle GERAL.
- **Tabelas:** snapshots inexistentes nos dois bancos.
- **Web hoje:** nada.
- **Complexidade:** n/a, **recomendo NÃO migrar**: o menu está invisível e a fonte não existe. A ideia de snapshot mensal pode inspirar a solução do item anterior.

### Valores por Classificação Fiscal (FrmClasFiscal): relatório da Lei 10.485/2002 (PIS/COFINS monofásico de autopeças)
O form tem 7 abas. Abas de relatório [C]:

| Aba | Procedure | Regra |
|---|---|---|
| Saídas (Anexos I e II) | `TEMP.CONS_CLASFISCAL_FATURADOS(vClasFiscal,vDt1,vDt2)` | chamada **uma vez por NCM** de DBCLASFISCAL_LEI (ou um NCM digitado) com `like ncm||'%'`. Filtros: NCM do item (`pf.ncm`), p.Est='S', tipofat 1 (tiponf A/C) ou 2, cfop1 sem iniciar por 1/2/3, cfop1 fora de DBCFOP_EXCLUSO. Agrupa por ncm, cfop, NF, data, ref, descr, importado. Totalprod = produto + IPI + ST + frete + acréscimo − desconto |
| Entradas (Anexos I e II) | `TEMP.CONS_CLASFISCAL_ENTRADAS` | DBENT/DBITENT (dtselo no período, status F, origem A, cfop fora de excluso) UNION faturas de entrada de importação (CFOP 3xxx) |
| Saídas (4011/4013) | `CONS_CLASFISCAL_FATURADOS` com '4011%' e '4013%' | Art. 5º, pneus. Impressão sem descrição |
| Entradas (4011/4013) | `CONS_CLASFISCAL_ENTRADAS` | idem |
| Saída 9.25 | `TEMP.FATURADOS_CLASFISCAL925(vDt1,vDt2)` | NCM **fora** da lista da lei (`TEMP.CLASFISCAL_LEI(ncm)=1` quando NÃO encontra, testando prefixos de 8 a 3 dígitos) e fora de 4011/4013 |
| Entrada 9.25 | `TEMP.ENTRADAS_CLASFISCAL925` | idem, mais regime tributário do fornecedor (`dbcredor.regime_tributacao`) |

- **Filtros [C]:**
  - Período por aba (default hoje).
  - "Filtrar": Todas NCM / Especificar NCM (máscara 8 dígitos).
  - "Aquisição": Nacional / Exterior / Todos. É filtro no cliente pelo campo `importado` = `p.dolar`.
- **Saída [C]:**
  - Grid: Data Emissão, Nº Formulário, Descrição, Clas.Fiscal, (CFOP), Pr.Unitário, Qtde, Total Item. Rótulos de total de produtos, total R$ e nº de linhas.
  - Impressão texto (RelatorioDinamicoZ) com cabeçalho "Art. 36 / Art. 5º da Lei 10.485", cidade da filial pelo alias do BDE, **total por página** (quebra a cada 58 linhas) e total geral.
  - Excel.
- **Aba Cadastro [C]:** CRUD da lista de NCMs da lei (`CLASFISCAL_INC/DEL/ALTERAR/NAVEGA` em DBCLASFISCAL_LEI) e de CFOPs excluídos (`TEMP.CFOP_EXCLUSO`, `ALTERAR_`, `EXCLUIR_` e `CONSULTA_CFOP_EXCLUSO` em DBCFOP_EXCLUSO). Também há `spFrete` (TEMP.FRETE) e `spFiltro` (FILTRO, que executa SQL livre) declarados.
- **Tabelas:**
  - **dbclasfiscal_lei: NÃO EXISTE no PG** (Oracle: 64 NCMs).
  - **dbcfop_excluso: NÃO EXISTE** (Oracle: 27 CFOPs).
  - dbprodfat: sem histórico; colunas ncm, totalsubst_trib e fretebase existem.
  - dbfatura: OK (tiponf existe).
  - dbent/dbitent: parciais (colunas ncm, cfop, fis_custo, prunitnf existem).
  - dbcredor.regime_tributacao: existe.
  - O web tem `dbclassificacao_fiscal` (10.513 NCMs, colunas ipi/pis/cofins), mas sem marcação da Lei 10.485.
- **Web hoje:** só o cadastro de NCM (`/admin/cadastros/classificacaoFiscal`). Nada do relatório.
- **Complexidade:** **G**:
  - 6 relatórios mais 2 CRUDs.
  - Dois lados (saída e entrada, incluindo importação).
  - Função de prefixo de NCM.
  - Impressão com total por página.
  - Dependência de carga de dbprodfat/dbitent ou de reescrita sobre dbnfe_ent / dbent_importacao_it_ent.
- **Bloqueios:**
  - Criar e popular `dbclasfiscal_lei` e `dbcfop_excluso` (ou adicionar flag em `dbclassificacao_fiscal` e `dbcfop_n`).
  - Histórico de itens.
  - Definir a fonte de entradas no modelo novo.

### Acompanhamento Diário Auxiliar (FrmConsultaDiarioAuxiliar)
- **Objetivo:** Livro Diário Auxiliar e Razão Auxiliar de Clientes/Fornecedores (contas a receber e a pagar) e geração do **arquivo SPED ECD (leiaute LECD) do livro auxiliar**.
- **Filtros [C]:**
  - Data inicial e final.
  - `cbxLivro`: "Diário Auxiliar" / "Razão Auxiliar".
  - `cbxTipo`: CLIENTES / FORNECEDORES.
  - [C, DCU] A consulta em tela só existe para CLIENTES ("Consulta disponível somente para clientes!"); o SPED aceita os dois. Mensagem "Sem registros para esse filtro!".
- **Saída [C]:**
  - Grid Diário: Data, Fil, Cliente, Documento, Histórico, Tipo, Débito, Crédito. Inclui linhas de "Totais do Cliente :" e "Total Geral :" geradas no SQL.
  - Grid Razão (dxDBConsulta2): Cliente, Fil, Documento, Emissão, Vencto, Moe, Bco, Vlr Lancto, Baixa, Tipo, Valor Rec, Juros Rec, Desconto/Devol, Total Rec.
  - Excel.
  - Botão **SPED** grava TXT com os registros `|0000|LECD|`, 0001, 0007, 0990, I001, I010, I012, I015, I030 (termo de abertura), I050 (plano: 1-1-2-01-001 Duplicatas a Receber / 2-1-3-01-001 Fornecedores), I075, I200, I250, I500, I510 (campos CODCLIEN, NOME, A_RECEBER, RECEBIDO, SALDO), I550, I990, J001, J900, J930 (signatários) e o bloco 9 com contadores.
- **Fonte [C]:**
  - `CONSULTA_DIARIO_AUXILIAR(vDATA1,vDATA2,vCURSOR)` e `CONSULTA_RAZAO_AUXILIAR(...)` (standalone, INVALID por dblink): DBFATURA (tipofat 1, cancel N, CFOP1 em 5102/6102/5403/6403/5405/6404/6108) ⋈ DBRECEB ⋈ **DBFPRERECEB**, UNION de MAO, PVH, REC e FLZ. O razão usa a função `RETORNA_JUROS(cod_receb)` = valor_rec − valor_pgto − Σ dbfprereceb tipos 06/07/08.
  - `SPED.CONSULTA_DIARIO_AUXILIAR(vTIPO,vCursor,vTIPO2)`: dados do cabeçalho a partir de DADOSEMPRESA, com NIRE, contador e diretor (nomes e CPFs) **hard-coded**.
  - `SPED.MONTA_SPED_DIARIO_AUXILIAR(vCursor,vData1,vData2,vTIPO)` (clientes por DBFATURA/DBRECEB/DBFPRERECEB; fornecedores por DBPGTO/DBCREDOR).
  - `SPED.MONTA_SPED_RAZAO_AUXILIAR`.
- **Tabelas:**
  - dbfatura, dbclien, dbreceb (1,98 mi): OK.
  - **dbfprereceb: 50 linhas.**
  - dbpgto: 419 linhas, até 29/10/2026.
  - dbcredor e dadosempresa: OK.
  - `RETORNA_JUROS` não existe no PG.
  - **[C] Mesmo no Oracle o join com DBFPRERECEB devolve 0 linhas em 2026**: o relatório está quebrado no legado.
- **Web hoje:** nada (nem SPED ECD).
- **Complexidade:** **G**. Dois livros, 4 filiais e um gerador de TXT SPED ECD com contadores de bloco 9. O leiaute exato das linhas I200/I250/I550 está só no .dcu (não há .pas); os nomes de registro e campos foram recuperados.
- **Bloqueios:**
  - Não há .pas (a lógica do TXT teria de ser refeita a partir do leiaute oficial da ECD).
  - A base `dbfprereceb` está vazia ou obsoleta.
  - Signatários hard-coded.
  - **Confirmar com a contabilidade se ainda entregam o livro auxiliar por este sistema.**

### Acompanhamento Razão Auxiliar (FrmConsultaRazaoAuxiliar, só .dcu)
- **Objetivo:** versão antiga e isolada do Razão Auxiliar de Clientes.
- **Filtros [C, DCU]:** data inicial e final; valida a ordem; mensagem "Sem registros para esse filtro !".
- **Saída [C/I]:** grid de 14 colunas, as mesmas do grid Razão do form anterior [I], com FullExpand (agrupado) e Excel.
- **Fonte [C]:** `CONSULTA_RAZAO_AUXILIAR(vCURSOR,vDATA1,vDATA2)`, a mesma do item anterior. Ordenação por NOME, DATA; linhas por título com juros e totais.
- **Tabelas:** iguais às do Diário Auxiliar.
- **Web hoje:** nada.
- **Complexidade:** **P** se for feito junto com o Diário Auxiliar, porque é a mesma query. **Recomendo fundir os dois** num relatório só.
- **Bloqueios:** os mesmos (dbfprereceb).

### Relatório de Ressarcimento ICMS (frmRelatorioRessarcimentoicms)
- **Objetivo:** para as NFs de saída de um CFOP (ex.: 6403/6404 interestadual com ST), listar cada item com a NF de entrada mais recente do produto e o custo, para apurar o ressarcimento do ICMS-ST.
- **Filtros [C]:** data inicial e final (valida ordem); **CFOP obrigatório** (4 dígitos, só números, Enter dispara).
- **Saída [C]:**
  - DBGrid: NF_SAIDA, REFERENCIA, DESCRICAO, QTDE, PR_VENDA, CFOP1, DT_ENTRADA, NF_ENTRADA, PC_CUSTO.
  - O cursor traz mais campos: CNPJ, nome, UF, CST, base, ICMS, fornecedor, total_entrada.
  - Excel via `dmConsulta.Copia_Para_Excel`. Sem totais.
- **Fonte [C]:** `RELATORIO_RESSARCIMENTO_ICMS(VDTINICIAL,VDTFINAL,VCFOP,VCURSOR)` (VALID).
  - DBFATURA tipofat 1, cancel N, `pf.cfop in VCFOP`, ⋈ DBPRODFAT/DBCLIEN/DBPROD.
  - Para cada item: `max(codent)` de DBENT/DBITENT com operacao 0/1, status ≠ C e dtent ≤ data da NF (com fallback sem filtro de operação).
  - Depois ⋈ DBENT/DBCREDOR; PC_CUSTO = min(prunitnf) do item na entrada.
- **Tabelas:**
  - **dbprodfat (sem histórico)**; colunas cfop, csticms, baseicms, icms, totalicms existem.
  - dbfatura, dbclien, dbprod: OK.
  - **dbent/dbitent: parciais** (2026 quase vazio); colunas operacao, status, prunitnf existem.
  - dbcredor: OK.
- **Web hoje:** nada.
- **Complexidade:** **M**. Uma query, mas a subquery de última entrada por produto é pesada no PG: precisa de índice em dbitent(codprod) e dbent(dtent), ou de LATERAL.
- **Bloqueios:**
  - Histórico de itens de saída e entrada.
  - Decidir se a entrada vem de `dbent/dbitent` ou de `dbnfe_ent`.

### Contas a Receber - Contábil (frmContasR_Contabil)
- **Objetivo:** gerar o arquivo de lançamentos contábeis dos recebimentos (débito/crédito em contas do plano, histórico padrão, complemento) para importação no sistema contábil.
- **Filtros [C]:** data inicial (default dia 1º do mês) e data final (default hoje).
- **Saída [C]:**
  - Grid: CODCLI, NOME, CPFCGC, DATACAD, LACN_AUTO, DEBITO, CREDITO, DT_PGTO, VALOR, COD_HISTORICO, COMPLEMENTO, CCUSTO_DEBITO, CCUSTO_CREDITO, DOCUMENTO.
  - Totalizador (SummaryGroup).
  - Excel ("RELATORIO RECEBER CONTABIL.xls") e **CSV com ';'** (`SaveToText`), que é provavelmente o arquivo de importação contábil [I].
  - Há uma segunda aba "TabAtualizar" com o mesmo grid e botão CSV.
- **Fonte [C]:** `RELATORIO_CONTASR_CONTABIL(VDTINICIAL,VDTFINAL,VCURSOR)` (VALID).
  - DBRECEB⋈DBFRECEB⋈DBCLIEN⋈DBFORMA_PAGTO, `sf<>'C'`, valor>0, `cod_conta<>'0213'`.
  - Tipos 01-09, 15, 18, 20, 21, 23, 26, 31, 32, 42-44 usam a data `dt_pgto`. Tipos 10, 24, 25 usam a data de **DBFRECEBDATAFLUXO.DATA_FLUXO**.
  - **Mapas fixos tipo→conta:**
    - Débito: 35, 295, 260, 3194, 105/115 (pela cod_conta 0003/0208), 2013, 2625, 2646, 2716, 4403.
    - Crédito: 3948, 4012, ou `DBCLIEN_CONTABILIDADE.CONTA_CONTABIL` (default 9208).
    - Histórico: 9, 8, 10, 11, 32, 101, 300.
  - Complemento = nro_doc − forma − nome.
- **Tabelas:**
  - dbreceb: OK.
  - dbfreceb: existe, mas **diverge do Oracle** (ver item 3 dos achados).
  - dbclien e dbforma_pagto (45): OK.
  - dbclien_contabilidade: OK, 4.671 linhas.
  - **dbfrecebdatafluxo: 250 linhas, a última de 2001.** Os tipos 10/24/25 ficariam vazios.
- **Web hoje:** parcial. `pages/api/contas-receber/relatorio.ts` já lê `dbfreceb` (layout "recebimento_clientes") e exporta PDF/Excel. Falta o mapeamento contábil e o CSV.
- **Complexidade:** **M**. Uma query com CASEs fixos, mais a exportação CSV no layout do contábil.
- **Bloqueios:**
  - Confirmar a carga de dbfreceb e dbfrecebdatafluxo.
  - Confirmar que o plano de contas (códigos 35/295/…) continua valendo.
  - Saber qual sistema contábil importa o CSV.

### Vendas Fora do Estado (frmRelatorioVendaForaEstado, sem fonte)
- **Objetivo [I]:** listar as vendas interestaduais com a NF de entrada de origem de cada item (fornecedor, CNPJ, UF, CST/ICMS desonerado e NCM da entrada), provavelmente para apuração e conferência fiscal de ICMS (benefício ZFM/ST).
- **Filtros [I]:** data inicial e final. Pela assinatura `VDTINICIAL/VDTFINAL` e pelo padrão dos irmãos JurosMensal/ContasR (default dia 1º do mês até hoje).
- **Saída [I]:**
  - Todos os campos do cursor: nota_fiscal, data, CNPJ, nome, uf, referencia, quantidade, prunit, totalprod, cfop, ncm, csticms, baseicms, icms, totalicms, CSTICMS_ATUAL, nota_fiscal_entrada, dtSelo_entrada, CNPJ_fornecedor, fornecedor, uf_fornecedor, prunit_entrada, imcsst_entrada, icmsdeson_entrada, ncm_entrada, total_entrada.
  - Grid + Excel, como os irmãos.
- **Fonte:** `RELATORIO_VENDA_FORA_ESTADO(VDTINICIAL,VDTFINAL,VCURSOR)` (VALID) [C fonte; vínculo é I pelo nome].
  - Mesma técnica do Ressarcimento (última entrada por produto), com CFOP fixo em (6152, 6409, 6102, 6403, 6404, 6108).
  - NCM da entrada vem de DBNFE_ENT_DET ⋈ DBNFE_ENT ⋈ DBNFE_ENT_DET_PED.
- **Tabelas:**
  - **dbprodfat: sem histórico.**
  - **dbent/dbitent: parciais**; colunas fis_icmscst e fis_icmsdeson existem.
  - dbnfe_ent: 29 mil linhas.
  - **dbnfe_ent_det: só 269 linhas.**
  - dbnfe_ent_det_ped: 1.010 linhas.
  - dbcredor: OK.
- **Web hoje:** nada.
- **Complexidade:** **M**. Uma query pesada; dá para compartilhar o motor de "última entrada do produto" com o Ressarcimento.
- **Bloqueios:** não há fonte do form; histórico de itens; NF-e de entrada detalhada quase vazia.

### Juros Mensal (frmRelatorioJurosMensal)
- **Objetivo:** listar os juros recebidos no período, por filial e cliente, marcando os títulos originados de FAG.
- **Filtros [C]:** data inicial (default dia 1º do mês) e data final (default hoje). A tela abre e fecha a consulta no FormShow.
- **Saída [C]:**
  - Grid: FILIAL, CODCLI, NOME, DOCUMENTO, VALOR, DT_PGTO, TIPO_DOC ('FAG' ou vazio).
  - Rodapé com soma (`ShowRowFooter`, SummaryGroup cstSum).
  - FullExpand: **[I]** agrupado por filial.
  - Botões Visualizar, Excel e Imprimir (o Imprimir não tem handler no ~pas).
- **Fonte [C]:** `RELATORIO_JUROS_RECEBIDO(VDTINICIAL,VDTFINAL,VCURSOR)` (INVALID por dblink).
  - DBRECEB⋈DBFRECEB⋈DBCLIEN com `fr.tipo in ('18','20','21','22','23','25','26')`, `sf<>'C'`, valor>0, dt_pgto no período.
  - TIPO_DOC='FAG' se `cod_fat` ou `codgp` aponta para dbfatura tipofat 3.
  - UNION de MAO, PVH, REC, FLZ, CSAC, JPS, BMO e BVB.
  - Ordena por filial, nome, codcli, dt_pgto, documento.
- **Tabelas:**
  - dbreceb e dbclien: OK.
  - dbfreceb: existe, mas **diverge do Oracle**.
  - dbfatura: OK (codgp existe).
- **Web hoje:** parcial. `pages/api/contas-receber/relatorio.ts` já usa os mesmos `TIPOS_JUROS` sobre `dbfreceb`; o caixa tem `JUROS_RECEBIDO` em `pages/api/caixa/dados-recebimento.ts`.
- **Complexidade:** **P**. É a query mais simples do grupo; o único trabalho extra é consolidar as filiais.
- **Bloqueios:** dados de dbfreceb no PG versus Oracle; filiais CSAC/JPS/BMO/BVB não existem no web [I].

### Faturamento Mensal (frmRelatorioFaturamentoContabil)
- **Objetivo:** fechamento do faturamento do **mês anterior** por filial, comparando a visão CONTÁBIL (NF tipofat 1, total da NF) com a FINANCEIRA (tipofat 1 e 3 com tipodoc 'V', totalfat) e mostrando as devoluções de venda do mês.
- **Filtros [C]:** **nenhum**. A procedure não tem parâmetro; a view usa `add_months(sysdate,-1)`. Existe só o `~dfm` (sem .pas nem .dfm atual).
- **Saída [C]:**
  - Grid: MELO (filial), TIPO, TOTAL_PROD, IPI, DESCONTO, ACRECIMO, FRETE (só destfrete 2/3), VL_SUBST_TRIB, TOTAL_NOTA, DEVOLUCAO.
  - SummaryGroup (soma).
  - Botões Visualizar, Excel e Imprimir.
- **Fonte [C]:** `RELATORIO_FATURAMENTO_CONTABIL(VCURSOR)` = `select * from VW_FATURA_FINCONTABIL order by 2,1` (procedure **INVALID**, ORA-00942: a view existe, mas os dblinks não resolvem).
  - A view (1.100 linhas) tem UNION por filial: BVB, FLZ, MAO, PVH, REC.
  - Bloco CONTABIL: `dbfatura` cancel N, tipofat 1, `cfop1 in (select cfop from DBCFOP_SAIDA)`.
  - Bloco FINANCEIRO: tipofat 1/3, tipodoc V, totalfat.
  - DEVOLUCAO = Σ(quant×prunit) de DBENT/DBITENT, status F, com CFOP cuja descrição em DBCFOP_N começa por "DEVOLUÇÃO DE VENDA".
  - Existem também `VW_FATURA_FINCONTABILMES` e `VW_FATURA_FIN_PROJECAO`.
- **Tabelas:**
  - dbfatura: OK (totalprod, totalipi, totalfrete, destfrete, desconto, acrescimo, valoricms_subst, totalfat, tipodoc existem).
  - dbent/dbitent: parciais, afetam a devolução.
  - dbcfop_n: existe (cfop, descr, cfopinverso, excecao).
  - **dbcfop_saida: NÃO EXISTE no PG** (Oracle: 14 CFOPs).
- **Web hoje:** nada.
- **Complexidade:** **P/M**. Só agregados de cabeçalho (os dados de dbfatura estão completos no PG). No web convém **adicionar o filtro de mês/ano**.
- **Bloqueios:** criar ou parametrizar a lista de CFOP de saída; devoluções dependem das entradas.

---

## Tabela resumo

| Relatório | Complexidade | Bloqueio principal | Web existe? |
|---|---|---|---|
| Licitações | P | dbfecharvendas sem histórico; relatório morto (0 desde 2024) | Não |
| Produtos por FAG e NF (DI) | M | dbdocinterno inexistente; vínculo DI no modelo novo (importacao_id?); dbprodfat vazio | Não |
| Acompanhamento SONY | M | morto (0 vendas desde 2025); dbfncli inexistente; dbfecharvendas | Não |
| Acompanhamento HBuster | M | sem fonte do form; dbitrequis→cmp_requisicao; morto (estoque=1) | Não |
| Acompanhamento SACHS | P/M | sem fonte do form/layout; quase sem uso; filial JPS | Não |
| Produtos por Clientes e FAGs | P | dbprodfat sem histórico | Não |
| Inventário Estoque Mensal e Anual | M | retrato só do estoque atual; fonte de custo (dbprod vs dbprod_contabil); layout de livro | Não |
| Inventário Estoque Mensal (invisível) | — (não migrar) | snapshots PRODUTOS_yyyy_m inexistentes | Não |
| Valores por Classificação Fiscal (Lei 10.485) | G | dbclasfiscal_lei e dbcfop_excluso inexistentes; itens de saída/entrada | Só cadastro de NCM |
| Acompanhamento Diário Auxiliar (+SPED ECD) | G | dbfprereceb vazio (e 0 linhas até no Oracle 2026); gerador SPED sem .pas | Não |
| Acompanhamento Razão Auxiliar | P (junto do Diário) | mesmo do Diário; fundir | Não |
| Ressarcimento ICMS | M | dbprodfat + dbent/dbitent sem histórico; performance da "última entrada" | Não |
| Contas a Receber - Contábil | M | dbfreceb divergente; dbfrecebdatafluxo vazio; plano de contas fixo | Parcial (contas-receber/relatorio.ts) |
| Vendas Fora do Estado | M | sem fonte do form; itens saída/entrada; dbnfe_ent_det quase vazio | Não |
| Juros Mensal | P | dbfreceb divergente; consolidação multi-filial | Parcial (TIPOS_JUROS em contas-receber/relatorio.ts) |
| Faturamento Mensal | P/M | dbcfop_saida inexistente; devoluções dependem de entradas | Não |

**Pré-requisito comum:** carga histórica de `dbprodfat`, `dbfecharvendas`, `dbent`/`dbitent` e conferência de `dbfreceb`/`dbfprereceb`/`dbfrecebdatafluxo` antes de entregar qualquer relatório por item ou contábil.

## Procedures, packages e objetos Oracle do grupo (owner GERAL)

Standalone procedures:
- `CONSULTA_LICITACOES` (VALID)
- `CONSULTA_TOT_PROD_POR_NF_FAG` (VALID)
- `CONSULTA_TOT_ITEM_POR_FAG` (VALID)
- `CONSULTA_REL_DIARIO_SONY` (INVALID; cria e usa a tabela `TMP_SONY`)
- `CONSULTA_REL_SEMANAL_HBUSTER` (INVALID) [vínculo I]; correlatas: `NAVEGA_NF_HBUSTER`, `NAVEGA_ITNF_HBUSTER`, `NAVEGA_CLIENTE_HBUSTER`, `NAVEGA_VENDEDOR_HBUSTER`, `TESTE_HBUSTER`
- `CONSULTA_SACHS_VENDA_ESTOQUE` (INVALID) [vínculo I]
- `CONSULTA_DIARIO_AUXILIAR` (INVALID)
- `CONSULTA_RAZAO_AUXILIAR` (INVALID)
- `RELATORIO_RESSARCIMENTO_ICMS` (VALID)
- `RELATORIO_CONTASR_CONTABIL` (VALID)
- `RELATORIO_VENDA_FORA_ESTADO` (VALID) [vínculo I]
- `RELATORIO_JUROS_RECEBIDO` (INVALID)
- `RELATORIO_FATURAMENTO_CONTABIL` (INVALID) → view `VW_FATURA_FINCONTABIL` (relacionadas: `VW_FATURA_FINCONTABILMES`, `VW_FATURA_FIN_PROJECAO`)
- `CLASFISCAL_INC`, `CLASFISCAL_DEL`, `CLASFISCAL_ALTERAR`, `CLASFISCAL_NAVEGA` (VALID)
- `FILTRO` (VALID; executa SQL livre)

Packages:
- `INVENTARIO_UNIFICADO`: `NAVEGA_MARCAS`, `PRODUTOS_INVENTARIO_MARCA_ESQ`, `DADOS_MELO` (há também `PRODUTOS_INVENTARIO_MARCA`, sem uso).
- `TEMP`: `CONS_CLASFISCAL_FATURADOS`, `CONS_CLASFISCAL_ENTRADAS`, `CONS_CLASFISCAL_PROD_FATURADOS`, `CONS_CLASFISCAL_PROD_ENTRADAS`, `FATURADOS_CLASFISCAL925`, `ENTRADAS_CLASFISCAL925`, função `CLASFISCAL_LEI`, `FRETE`, `CFOP_EXCLUSO`, `ALTERAR_CFOP_EXCLUSO`, `EXCLUIR_CFOP_EXCLUSO`, `CONSULTA_CFOP_EXCLUSO`.
- `SPED` (body INVALID): `CONSULTA_DIARIO_AUXILIAR`, `MONTA_SPED_DIARIO_AUXILIAR`, `MONTA_SPED_RAZAO_AUXILIAR`. Existe uma cópia `SPED_1`.

Funções: `RETORNA_JUROS`, `RETORNA_PRAZO_NF`.

Tabelas Oracle sem equivalente no PG: `DBDOCINTERNO`, `DBFNCLI`, `DBITREQUIS`, `DBREQUIS`, `DBCLASFISCAL_LEI`, `DBCFOP_EXCLUSO`, `DBCFOP_SAIDA`, `TMP_SONY`; snapshots `PRODUTOS_yyyy_m` (inexistentes também no Oracle).
