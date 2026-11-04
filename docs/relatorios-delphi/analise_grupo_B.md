# Análise de migração: Relatórios do GRUPO B (Faturamento / Análises)

Legenda: **[C]** = confirmado (li o fonte, o DFM ou o PL/SQL, ou consultei o banco) · **[I]** = inferência.
Datas de referência: Oracle legado com dados até 15/08/2026; PG `db_manaus` com dados até 30/10/2026.

Artefatos que gerei (pasta `gB/` do scratchpad):
- `gB/src/*.sql`: fonte PL/SQL baixado do Oracle (owner GERAL) de todos os packages e procedures citados abaixo. Prefixo `B`=body, `S`=spec, `P`=procedure.
- `gB/dfm_AnaliseDetalhada.txt`, `gB/dfm_TfrmAnaliseVendas.txt`, `gB/dfm_TFrmAnaliseCustoFaturamento.txt`, `gB/dfm_TfrmRelFatura.txt`, `gB/dfm_TfrmCMV.txt`: **DFMs recuperados do executável** `Desenvolvimento/Geral/ProjGeral.exe.bak` (recurso binário TPF0 convertido em texto pelo script `gB/dfmbin.py`). Assim foi possível ler os forms que não tinham fonte.
- `gB/px.py PKG PROC...` extrai uma procedure de dentro de um package em `gB/src`.

---

## Constatações transversais (valem para quase todos os relatórios)

1. **Tipos de documento que deixaram de existir no legado [C, Oracle]:**
   - `dbvenda.tipo='C'` (cautela): última em **21/11/2013**.
   - `tipo='1'` (D1): última em **03/08/2009**.
   - `tipo='2'` (D2): última em **17/10/2001**.
   - Desde 2025, 100% das vendas são `tipo='P'`.
   - `dbfatura.tiponf='B'`: última em **2006**.
   - `dbsugestaovendas`: último mês gravado é **12/2005**.

   Muitas procedures fazem UNION com esses ramos (D1, cautela, NF série B). Esses ramos hoje retornam vazio e **podem ser descartados na migração**. Alguns relatórios ou abas inteiras já estão mortos (ver cada bloco).
2. **O histórico transacional no PG está incompleto [C]:**
   - `dbfatura`: 179 mil cabeçalhos, de 2024 a 30/10/2026.
   - `dbprodfat` (itens da fatura): **só 192 linhas, todas a partir de 06/08/2026**. No Oracle são 733 mil desde 2025.
   - `dbvvend` (vendedor/operador da venda): 1.197 linhas, das quais só 257 casam com `dbvenda`. No Oracle são 284 mil desde 2025.
   - `dbfecharvendas`: 47 linhas (Oracle: 2,4 milhões).
   - `dbent`: 2.662 linhas, só de 2025 (Oracle: 187 mil).
   - `dbitvenda`/`dbvenda`: 2024–2025 completos, 2026 quase vazio (112 vendas).

   Consequência: **todo relatório baseado em item de fatura (dbprodfat) ou em vendedor/operador (dbvvend) sai vazio ou errado no PG para períodos anteriores a ago/2026**. É o bloqueio nº 1 do grupo e precisa de decisão: migrar o histórico desses itens ou aceitar o relatório só "daqui para frente".
3. **O web passou a gravar essas tabelas [C]:**
   - `dbprodfat`: `pages/api/faturamento/salvar.ts`, `lib/faturamento/gerarEstorno.ts`.
   - `dbvvend`: `pages/api/vendas/finalizarVenda.ts` e `postgresql/finalizarVenda.ts`.
   - `dbfecharvendas`: `pages/api/faturamento/fechar-vendas.ts`.
   - `dbent`: `lib/compras/gerarEntradaDbent.ts`, `pages/api/entradas/criar-manual.ts`.

   Existe também uma tabela nova `fatura_venda` (593 linhas, desde 08/2025) que liga fatura e venda. Os relatórios precisam decidir se usam `dbprodfat.codvenda`, `dbfecharvendas` ou `fatura_venda`.
4. **Tabelas que não existem no PG [C]:**
   - `dbcfop_saida` (14 linhas no Oracle; usada em CMV e CLM).
   - `dbclivend`, e por isso não existe a view `vwRelVendCliGpp` (= `dbCliVend` × `dbVendGpp`).
   - `dbdocinterno`.
   - `dbfncli` (telefones; alternativa no PG: `dbclien_contatos.fone`).
   - `dbprazo_pst` (412 linhas no Oracle).
   - `dbinfprod`, `dbclivend_tmk`.
   - As TMP do package de Análise Detalhada: `tmpvendedor*`, `tmpclientevend10`, `tmpgrupomarcavend11` etc.
5. **Padrões do Delphi que não devem ser copiados:**
   - Vários forms montam SQL por concatenação e executam via a procedure genérica `FILTRO(vFiltro)` [C]: frmAnaliseFaturamento, TeleMkt, CLM. Os packages `RELATORIOS.*` (CMV) e `ANALISE_DET_BANCO` recebem um pedaço de WHERE pronto (`vFiltro`) [C]. No web isso deve virar filtros parametrizados.
   - Há laços N+1: uma chamada de procedure por produto (Análise de Vendas, parte 2) ou por venda (`RELATO.OPERADORVENDA`, no Ranking) [C/I].
   - Várias procedures usam `UNION` onde deveria ser `UNION ALL`. Isso deduplica linhas idênticas, o que pode ser um bug de valor no legado [C].
6. Quase todo form chama `dmConsulta.Inc_LogRelGerencial(...)` (log de uso por relatório: código '09' AnaliseFat, '10' TeleMkt, '11' AnaliseVendas) [C]. Não achei tabela de log correspondente no PG [C], nem a `dblog_rel_gerencial` no Oracle [C]. O nome real da tabela não foi identificado.
7. Saídas no legado [C/I]:
   - Grid DevExpress (dxDBGrid, com agrupamento e somatório no rodapé) ou DBGrid.
   - Impressão por QuickReport (AnaliseVendas, AnaliseFaturamento) ou ZReport/`frmRelatorioDinamicoZ` (RelFatura; confirmado no .dcu) ou VDOPrinter (CMV).
   - Excel via `dmConsulta.Copia_Para_Excel` ou `TdxDBGrid.SaveToXLS`.
   - TXT posicional (CLM).
8. **Web hoje [C]:**
   - `/admin/relatorios` (`src/components/corpo/admin/relatorios/index.tsx`) é placeholder; só existe `relatorios/comissao`.
   - Equivalências parciais:
     - **Consulta de Faturas** (`src/components/corpo/faturamento/ConsultaFatura/ConsultaFatura.tsx`) tem filtro "com/sem cobrança" sobre `dbfatura.cobranca`, mais export Excel/PDF (`pages/api/faturamento/exportar-excel.ts`, `exportar-pdf.ts`).
     - **Dashboard de Vendas** (`src/components/corpo/vendas/dashboard`, APIs em `pages/api/vendas/dashboard/*`: top-clientes, top-products, vendas-mensais, kpis) lê só `dbvenda/dbitvenda/dbprod/dbclien`.
   - Não existe CMV, ranking de vendedores nem análises por grupo/marca.

---

### Relatório CLM — frmPstFatura (form único)
- **Objetivo:** gera os arquivos TXT de sell-out da marca **PST** (codmarca `01094`, confirmado no Oracle [C]) para enviar ao fabricante: clientes, faturamento diário e notas/produtos de um dia. A marca ainda vende: 1.839 itens faturados desde 2025 [C].
- **Filtros (front Delphi) [C]:**
  - Uma data (`edtPeriodoIni`; o laço por período está comentado, então é sempre 1 dia).
  - Rádio Normal / Garantia (troca as procedures `*_PST` pelas `*_PST_GR`).
  - Checkboxes "Faturamento Diário", "Produtos Faturados por NF" e "Clientes", todos marcados por padrão. Pelo menos um é obrigatório.
- **Saída [C]:** grava em `C:\Arquivos_PST\` os arquivos `CLIEP4<aamd>.txt`, `FATDP4<aamd>.Txt` e `FATNP4<aamd>.Txt`, em layout **posicional fixo** (FormatRel/StrZero: nome 35, endereço 35, cidade 35, CEP 10, bairro 35, UF 3, 'BRA', fone 16, CNPJ 16, IE 18, CPF 11, número 10, complemento 10, cod. município 7, …). Mostra uma lista das datas sem venda PST. O grid serve só de visualização.
- **Fonte de dados [C]:**
  - Conexão própria: TDatabase alias `DBMELO_MAO`, usuário GERAL.
  - Procedures: `NAVEGA_FATURAMENTO_DIARIO_PST`, `NAVEGA_CLIENTES_FATURA_PST`, `NAVEGA_PRODUTOS_FATURADOS_PST`, `TELEFONE_CLIENTE_PST`, `PST_LOC_PRAZO`, `NAVEGA_CLIENTES_FAT_PST_GR`, `NAVEGA_FAT_DIARIO_PST_GR`, `NAVEGA_PRODUTOS_FAT_PST_GR`, `FILTRO` (SQL dinâmico) e `MELO.NAVEGA` (dados da empresa/CGC).
  - Regra: faturas `tipofat='1'`, `cancel='N'`, `cfop1 IN (select cfop from dbcfop_saida)`, produtos da marca 01094. Exclui os clientes internos `03341, 04487, 03775, 00002, 99999` e os de `dbclien_filial`. Faz UNION com D1 (ramo morto).
  - O vendedor PST é resolvido no Delphi: `dbvvend` com operador='S', depois `dbclivend` com codvend em `('00098','00096','00067')`, depois o vendedor da fatura. O prazo vem de `dbprazo_pst`, com regra especial para os grupos 00623/00624. Há trechos comentados com DB links de PVH/REC/FLZ.
- **Tabelas [C]:**
  - Existem no PG: dbfatura, dbprodfat (**só desde 08/2026**), dbprod, dbclien, dbclien_filial (8 linhas), dbmarcas, dbvenda/dbitvenda/dbvvend (ramo D1, morto), dadosempresa.
  - **Faltam no PG:** `dbcfop_saida`, `dbfncli` (telefones), `dbprazo_pst` (412 linhas no Oracle), `dbclivend`.
  - `dbpst_import` existe no PG com 0 linhas.
- **Web hoje:** nada.
- **Complexidade:** **M**. A consulta é simples, mas o layout posicional de 3 arquivos (cerca de 3.300 linhas de Pascal com 5 blocos repetidos por filial) precisa ser replicado byte a byte. No web, a saída vira download (zip) em vez de gravar em `C:\`.
- **Bloqueios/dúvidas:**
  - Validar com o usuário se a PST ainda exige esse arquivo.
  - Faltam 3 tabelas.
  - Itens de fatura no PG só a partir de ago/2026.
  - Só o `~pas` (backup) está disponível; confirmar que é a versão compilada.

### Cautelas em Aberto — frmRelFatura / tabCautelas_Aberto + TabCautela_Aberto_Cliente
- **Objetivo:** listar os itens de vendas (cautelas/pré-pedidos) ainda não faturados (`status<>'F'`), por vendedor ou por cliente, com o valor total em aberto.
- **Filtros [C]:**
  - Aba Vendedor: código do vendedor (`meCA_Codigo`, com lookup), data inicial e final.
  - Aba Cliente: código do cliente (`mCA_CodCliente`), DT1/DT2.
  - Obrigatoriedade [I]: o código parece obrigatório, porque as procedures filtram por ele.
- **Saída [C]:** dxDBGrid agrupado por venda (NROVENDA oculto no grupo), colunas Referência, Marca, Qtde, Pr.Unitário, Total Item e Descrição, soma de TOTALITEM no rodapé e "Total Geral R$". A aba Vendedor tem 3 sub-abas (Vendedor Principal / 2º Vendedor / Operador). Botões Visualizar, Imprimir (ZReport) e Excel.
- **Fonte de dados [C]:**
  - Aba Vendedor:
    - `CAUTELA_EM_ABERTO_NOVA`: tipo 'C', `tele='N'`, `dbvvend` operador='N', excluindo grupos de outros vendedores via `vwRelVendCliGpp`.
    - `CAUTELA_ABERTO_NOVA_2VENDEDOR`: grupos/clientes do vendedor via `vwRelVendCliGpp`.
    - `CAUTELA_ABERTO_NOVA_OPERADOR`: `dbvvend` operador='S'.
  - Aba Cliente: `RELATO.CAUTELA_ABERTO(VTIPOFILTRO 'T'|'C'|'V', VDT1, VDT2, VOPERADOR, VCODIGO)`, com `v.tipo in ('C','P')`, `status<>'F'`, `cancel='N'`.
- **Tabelas [C]:**
  - dbvenda, dbitvenda, dbvvend (**histórico não migrado**), dbprod, dbmarcas, dbclien, dbvend.
  - `vwRelVendCliGpp` não existe (falta `dbclivend`; `dbvendgpp` existe com 673 linhas).
- **Web hoje:** nada específico. A tela de vendas bloqueadas/central de vendas lista vendas, mas não é um relatório de pendentes por vendedor [I].
- **Complexidade:** **P–M**. Uma query só; a dificuldade está na regra de "2º vendedor" (carteira cliente×grupo).
- **Bloqueios/dúvidas:**
  - **As 3 sub-abas por vendedor usam só `tipo='C'`, que não existe desde 2013: hoje retornam vazio.** Só a aba Cliente (que inclui `tipo='P'`) ainda tem conteúdo.
  - Definir o que é "em aberto" no web. Os status de `tipo='P'` são F, I, 1, 0, L, N…; o legado considera tudo `<>'F'`.
  - Falta `dbclivend` e a view.
  - O valor de `VOPERADOR` enviado pelo Delphi é desconhecido (o .pas não existe) [I: provavelmente 'N'].

### Faturas sem Títulos de Cobrança — frmRelFatura / TabTitulo_sem_Cobranca
- **Objetivo:** encontrar faturas emitidas que ficaram sem cobrança gerada (`dbfatura.cobranca='N'`), para o financeiro gerar os títulos.
- **Filtros [C]:**
  - Período (`dtFST_inicio`/`dtFST_fim`). O DFM traz padrão 01–31/01/2009, mas o form deve ajustar no Show [I].
  - Cliente opcional (checkbox `rbFST_Cliente` + código).
  - Documento: Todos / F.A.G. / N.F. (rádio).
- **Saída [C]:**
  - dxDBGrid com Data, Fatura, Formulário, Cód. Cliente, Cliente, Total Fat. e Vendedor (oculto).
  - Botões Visualizar, Imprimir e Excel.
  - O botão "Vendedor" abre o painel "Clientes por Vendedor" (resumo com qtde, total NF, total fat. e total prod. por vendedor), com Excel próprio.
- **Fonte de dados [C]:**
  - `FATURA_SEM_TITULO_REL(vDtInicial, vDtFinal, vCodCli, vTipo '1' cliente | '2' todos | '3' cliente+tipofat, vTipoFat)`. Regra: `cancel='N'`, `tipodest='C'`, `tipofat<>'2'`, `cobranca='N'`, `nvl(cfop1,'0') IN ('5102','5403','5405','6108','6404','6403','6102','0')`, ordenado por vendedor e cliente.
  - Painel por vendedor: `CONS_FATURASEMTITULO(vini, vfim)` (mesma regra, agrupada por vendedor).
  - Detalhe: `CONS_VENDNOTASEMTITULO(vini, vfim, vend)`, que usa `CLIENTE_KICKBACK`.
- **Tabelas [C]:** dbfatura (cobranca, cfop1 e totais existem; dados até 30/10/2026; 4.703 faturas com `cobranca='N'` em 2026), dbclien, dbvend, cliente_kickback (171 linhas). Tudo presente no PG.
- **Web hoje [C]:** **parcial.** A Consulta de Faturas tem o filtro "sem cobrança" (`ConsultaFatura.tsx` linhas 217-221) e export Excel/PDF. Faltam a lista fixa de CFOP, a ordenação/quebra por vendedor e o resumo por vendedor.
- **Complexidade:** **P.**
- **Bloqueios/dúvidas:**
  - A lista de CFOP está fixa no código: confirmar se ainda vale (em 2026 os CFOPs dominantes são 5405 e 5102, já incluídos [C]).
  - Pode virar um "preset" da Consulta de Faturas em vez de tela nova.

### Produtos para N.E. — frmRelFatura / tabProdutoNE
- **Objetivo [I]:** listar os produtos que saíram sem nota fiscal "cheia" (FAG, `tipofat='3'`, e NF série B), por grupo, com quantidade e valor, para emitir uma Nota de Entrada/regularização. O nome sugere isso; o .pas não existe para confirmar.
- **Filtros [C]:** período (`dtPNE_Inicio`/`Fim`); grupo de produto (`mePNE_CodGpp` + lookup) ou checkbox "Todos os Grupos".
- **Saída [C]:** dxDBGrid agrupado por GRUPO com Código, Referência, Descrição, Quantidade, Preço Unitário e Total Item; somatório de TOTAL e contagem por grupo; total geral num label. Botões Visualizar, Imprimir e Excel. O Delphi consolida no RxMemoryData (variáveis `dolar_atual`, `valor_dolar`, `prcompra_atual`, `prunit_atual` no .dcu) [C]. Isso indica [I] que o preço unitário exibido é de **custo** (`prcompra` convertido pelo dólar), e não o preço de venda.
- **Fonte de dados [C]:** `RELATO.PRODUTOS_PARA_NE(vdt1, vdt2, vtipo 'T'|'G', vcodigo)`: itens de `dbprodfat` com `cancel='N'`, `tipodest='C'` e `((tipofat='1' and tiponf='B') or tipofat='3')`. No ramo 'T' exige `p.est='S'` (o ramo 'G' não exige; inconsistência do legado).
- **Tabelas [C]:** dbprodfat (**só desde 08/2026 no PG**), dbprod (prcompra, dolar, est existem), dbfatura, dbgpprod.
- **Web hoje:** nada.
- **Complexidade:** **P** (consulta), **M** se a regra de preço/dólar do Delphi tiver de ser deduzida.
- **Bloqueios/dúvidas:**
  - A parte `tiponf='B'` está morta desde 2006; hoje é só FAG (129 mil faturas `tipofat='3'` até 08/2026 no Oracle [C]).
  - A regra do Pr.Unitário está no Delphi, que não tem fonte.
  - Faltam os itens históricos no PG.

### Resumo Doctos Grupo/Marca — frmRelFatura / tabResumo_Doctos_Grupo_Marca
- **Objetivo:** listar os documentos (NF ou FAG) de um período que contêm produtos de uma marca ou de um grupo, com o total daquela marca/grupo em cada documento.
- **Filtros [C]:** período (Dtinicial/Dtfinal); Marca **ou** Grupo (rádio + código + lookup); documento N.F. ou F.A.G. (rádio).
- **Saída [C]:**
  - GridMarca: CODCLI, NOME, CODFAT, TOTALFAT, DATA, NROFORM, TIPOFAT.
  - GridGrupo: CODCLI, NOME, CODFAT, TOTALITEM, DATA, NROFORM, TIPOFAT.
  - O Delphi monta quebras por cliente, documento e produto, com totais (`totaldoc`, `totalcli`, `totalprod`, `Tgeral`) [C, nomes de variáveis no .dcu].
  - Impressão via ZReport (`ImprimirFatura_Doc_Marca/Grupo`).
- **Fonte de dados [C]:**
  - `FATURAMENTO_POR_DOC(vdtinicial, vdtfinal, vTipoDoc, vCodmarca)`: soma `qtde*prunit` de `dbprodfat` por fatura, para `tipofat=vTipoDoc`, `cancel='N'` e produtos da marca.
  - `FATURAMENTO_POR_DOC_GRUPO(...)`: o mesmo por grupo, quebrando por marca.
- **Tabelas [C]:** dbfatura, dbprodfat (**só desde 08/2026**), dbprod, dbmarcas, dbgpprod, dbclien.
- **Web hoje:** nada.
- **Complexidade:** **P.**
- **Bloqueios/dúvidas:** os dados de item no PG.

### Ranking de Vendedores — frmRelFatura / TabRankVendedor
- **Objetivo:** ranking do faturamento por vendedor no período, separando venda Normal e Tele, comparando com o valor-objetivo do vendedor (% atingido).
- **Filtros [C]:** período (`dtRank_inicio`/`Fim`); modo "Completo" ou "apenas Percentual Atingido".
- **Saída [C]:** grid com CODVEND, NOME, VALOROBJ, VALORNORMAL, VALORTELE, PERCATINGIDO (TOTAL oculto, usado para ordenar). Impressão via ZReport e Excel. Há coloração por posição (`gridRankDrawColumnCell`).
- **Fonte de dados:**
  - [C] `RELATO.RANKVEND_PRODFATURADOS(vdt1, vdt2)`: itens de fatura (`tipofat<>'2'`, `tipodest='C'`, `cancel='N'`) com `venda.tele`, `fat.codvend` e `codvenda`.
  - [C] `RELATO.RANKVEND_PRODD1` (D1, ramo morto).
  - [C] `RELATO.OPERADORVENDA(vCodVenda) → vCodVend` (operador='S').
  - [I] A totalização é feita **no Delphi**, sem fonte: variáveis `totalD1`, `totalFag`, `totalTele`, `totalNormal`, `totalNF`, `totalNfA`, `totalNfB`, `totalObj`, `PercAtingido`, `CodVendReal`, `CodOperador`. Pelo uso de OPERADORVENDA, o Delphi deve chamar a procedure **por venda** para creditar a parte tele ao operador.
  - [I] O objetivo vem de `dbvend.valobj` (a coluna existe no Oracle e no PG; também há `valobjf/valobjm/valobjsf`). Não confirmado.
- **Tabelas [C]:** dbfatura, dbprodfat (**só desde 08/2026**), dbvenda, dbvvend (**histórico não migrado**), dbprod, dbgpprod, dbvend (valobj existe).
- **Web hoje:** nada (o Dashboard de Vendas tem top-clientes/top-produtos, não ranking de vendedor vs. meta).
- **Complexidade:** **M**. A regra de crédito Normal × Tele × operador está no Delphi sem fonte e terá de ser reconstruída (ver também `ANALISE_TELEMARKETING.RANKING_VENDEDOR`, que dá uma pista).
- **Bloqueios/dúvidas:**
  - Lógica sem fonte.
  - Definição de meta: o Oracle tem `DBVENDEDOR_META` e `DBVENDEDOR_META_MARCA`, que **não existem no PG** [C].
  - Dados de item e `dbvvend` históricos ausentes.

### Relatório de Notas sem cobrança — frmRelFatura / TabNotaSemCobranca ("Detalhamento Notas sem cobrança")
- **Objetivo:** detalhar as notas sem cobrança cuja venda é de Telemarketing ou de Externo, com o vendedor e o usuário que fez a venda.
- **Filtros [C]:** período (`dtDNsCInicial`/`Final`); rádio Telemarketing (padrão) / Externo.
- **Saída [C]:** dxDBGrid com Nro. Form, Data, Cliente, Vendedor, T. Fatura, T. Nota, Tp. Vendedor, Tp. Nota, Usuário (CODFAT oculto). Botões Visualizar e Excel.
- **Fonte de dados [C]:** `NOTASSEMCOBRANCA(cursordados, vTipo = dbvenda.tele 'S'/'N', vDtIni, vDtFim)`. Regra: faturas `cancel='N'`, `tipodest='C'`, `tipofat<>'2'`, `cobranca='N'` e a mesma lista de CFOP. Liga a fatura à venda via `dbfecharvendas` (`status='1'` e `data` no período), depois `dbvvend` (`decode operador S/N` → TELEMARKETING/EXTERNO) e `dbusuario` (codusr da venda). Usa `DISTINCT`.
- **Tabelas [C]:** dbfatura, dbclien, dbvend, dbvenda, **dbfecharvendas (só 47 linhas no PG)**, **dbvvend (histórico não migrado)**, dbusuario.
- **Web hoje:** parcial (Consulta de Faturas com "sem cobrança"), sem a dimensão tele/externo nem o usuário.
- **Complexidade:** **P.**
- **Bloqueios/dúvidas:**
  - Ligação fatura→venda: o legado usa `dbfecharvendas`, o web também tem `fatura_venda` [C]. Definir qual é a fonte da verdade.
  - Sem histórico de dbvvend/dbfecharvendas no PG.

### Resumo de Documentos — frmRelFatura / tabResumoDoc
- **Objetivo:** para um cliente, listar no período todos os documentos (NF, FAG, D1, D2, documento interno) e as vendas que os originaram, opcionalmente com os itens.
- **Filtros [C]:** período (`dtDoc_inicio`/`Fim`); cliente (`meDoc_CodCli` + lookup); Documento Todos/F.A.G./N.F.; checkbox "Mostrar Itens" (padrão marcado). Obrigatoriedade [I]: o cliente é obrigatório na prática, porque todas as queries filtram `codcli=vcodcli`.
- **Saída [C]:** DBGrid com REF, MARCA, QTD, PRUNIT, TOTAL, DESCR. O Delphi monta um RxMemoryData com quebras por documento e venda e totais (`GerarxResumoDoc`, `GeraRelatorio_ResumoDoc`). Imprimir e Excel.
- **Fonte de dados [C]:** `RELATO.RESUMO_DOCUMENTO(vdt1, vdt2, vTipoDoc 'T'|'F'|'N', vItem 'S'|'N', vCodCli)`. União de:
  - NF: `tipofat` 1 ou 2, `nroform` com prefixo 'NF'.
  - FAG: `tipofat='3'`, prefixo 'F'+codfat.
  - D1/D2: dbvenda tipo '1'/'2' (mortos).
  - Documento interno: `tipodoc='I'` via `dbDocInterno`.

  Sem itens: cabeçalhos com o total da venda. Com itens: `pf.qtde*pf.prunit`.
- **Tabelas [C]:** dbfatura, dbprodfat (**só desde 08/2026**), dbvenda, dbitvenda, dbprod, dbmarcas, dbclien. **`dbdocinterno` não existe no PG**, embora o PG tenha cerca de 11 mil faturas `tipodoc='I'` em 2025.
- **Web hoje:** nada equivalente. A Consulta de Faturas filtra por cliente, mas não mostra o vínculo venda×documento nem os itens.
- **Complexidade:** **P–M.**
- **Bloqueios/dúvidas:**
  - Falta `dbdocinterno`.
  - Ramos D1/D2 mortos.
  - Faltam os itens de fatura históricos.

### Projetar Vendas — frmRelFatura / tabProjetarVendas
- **Objetivo:** projetar a meta de venda de um vendedor para um mês a partir dos 3 meses anteriores (por grupo de produto e por cliente×grupo), aplicar um % de crescimento, editar à mão e **gravar a projeção**.
- **Filtros [C]:** mês para previsão (`DataIniV`); vendedor (`meProjV_CodVendedor` + lookup).
- **Saída [C]:**
  - Sub-abas:
    1. Projeção para Grupo: Código, Grupo, Total Mês1/2/3, Média, Projetar Venda (editável).
    2. a) Projeção para Cliente: Cliente, Grupo, Previsão, Média, Total Mês1-3 e Total Faturado de cada mês.
    2. b) Grupos a partir do cliente: total por grupo e por cliente.
    - Consultar Projeção: grupo e valor projetado.
  - Controles: combo base (Mês1/Mês2/Mês3/Média) + % → botões "Projetar Vendas/Cliente/Grupos". Popup "Excluir linha". Botões Salvar Projeção, Imprimir e Excel.
- **Fonte de dados [C]:**
  - `TEMP.VENDCLI_GRUPO_MARCA(vCodVend, vDt1, vDt2, vTipoGrupo 'C'|'G')`: soma `dbprodfat` (`tipofat<>'2'`, `tipodest='C'`, `cancel='N'`) mais D1, **pela carteira do cliente (`dbclien.codvend`)**, e não pelo vendedor da fatura. O Delphi chama a procedure uma vez por mês (`dataini1..3`; `Prepara_Projetar_Vendas*`).
  - Gravação: `VENDEDOR.EXISTE_SUGESTAO_VENDA`, `VENDEDOR.DEL_SUGESTAO_VENDA(vCodVend, vMes)` e `VENDEDOR.INC_SUGESTAO_VENDA(vCodVend, vCodGpp, vValor, vMes)` em `dbSugestaoVendas`.
  - Consulta: `TEMP.NAVEGA_SUGESTAOVENDA`.
  - Também declarados no DFM: `ANALISE_TELEMARKETING.VENDEDOR_VENDAS_REAL` e `VENDEDOR_TOTAL_FATURADO`, usados nas colunas "Total Faturado" [I].
- **Tabelas [C]:** dbfatura, dbprodfat (**só desde 08/2026**), dbprod, dbclien (codvend existe), dbgpprod, dbsugestaovendas (existe no PG, 46 linhas, mês no formato 'MM/YYYY').
- **Web hoje:** nada.
- **Complexidade:** **M**. A tela é interativa, com edição em grid, recálculo e gravação; além disso, **grava dados** (não é só leitura).
- **Bloqueios/dúvidas:**
  - **`dbsugestaovendas` não recebe gravação desde 12/2005 no Oracle [C]: funcionalidade aparentemente abandonada. Recomendo confirmar com o usuário antes de migrar.**
  - Os dados de item no PG.

### ICMS Diferencial de Entrada — frmRelFatura / tabICMSEntrada (menu Fiscais)
- **Objetivo:** estimar o ICMS diferencial/antecipado a pagar sobre as notas de entrada de origem 'A' no período.
- **Filtros [C]:** período de entrada (`dtICMS_Inicial`/`Final`).
- **Saída [C]:** DBGrid com Fornecedor (NOME), NROFORM, TOTALNF, VLRICMS_PAGO, VLRICMS_APAGAR, TOTALPROD, DTENT, DTSELO; 4 totais no rodapé (total NF, total prod, ICMS pago e ICMS a pagar, conforme variáveis no .dcu). Botões Visualizar e Excel.
- **Fonte de dados [C]:** `ICMS_DIFERENCIAL_ENTRADA(vDtInicial, vDtFinal)` com `dbent e` × `dbcredor c`. Filtros: `dtent` no período, `status<>'C'`, `origem='A'`. Fórmulas: `vlricms_pago = totalprod*icms/100`; **`vlricms_apagar = ((totalprod + totalprod*0.3)*0.17) - vlricms_pago`** (MVA de 30% e alíquota de 17% fixos no código).
- **Tabelas [C]:** dbent (todas as colunas existem; **PG só tem 2.662 entradas de 2025, contra 180.827 com origem 'A' no Oracle até 08/2026**), dbcredor (ok).
- **Web hoje:** nada encontrado. Existe o módulo de entradas/fiscal; não verifiquei relatório de ICMS de entrada [I].
- **Complexidade:** **P.**
- **Bloqueios/dúvidas:**
  - Fórmula com MVA 30% e 17% fixos, provavelmente desatualizada (validar com o fiscal).
  - Histórico de `dbent` incompleto no PG.

### Análise de Faturamento — frmAnaliseFaturamento (form multi-abas próprio)
- **Objetivo:** painel gerencial de faturamento com 5 abas:
  1. **Vendedor**: faturamento + vendas do vendedor agrupados por Grupo/Marca/Cliente, com custo atual e custo de compra (margem); sub-abas detalhado por grupo, por vendas (itens), por usuário e volume de compras por cliente.
  2. **Cliente**: grupo/marca comprados e itens vendidos a um cliente.
  3. **Grupo ou Marca**: clientes, vendedores e detalhado de um grupo ou marca.
  4. **Grupo (Detalh.)**.
  5. **Ranking**: clientes, marcas e grupos.
- **Filtros [C]:**
  - Cada aba tem o seu período (DataIni/DataFim).
  - Aba Vendedor: vendedor obrigatório (mensagem "Escolha o código do VENDEDOR"), agrupar Grupo/Marca/Cliente, ordenar por descrição ou total.
  - Aba Cliente: cliente, Grupo/Marca, checkbox "clientes zerados".
  - Aba Grupo/Marca: código do grupo ou da marca, ordenar por nome ou total.
  - Aba Ranking: ordenar por total ou nome.
  - Data inicial maior que a final é bloqueada.
- **Saída [C]:** dxDBGrid/DBGrid por aba, com somatórios em labels (`Calcule_Somatorio`). Imprimir (QuickReport) e Excel por aba.
- **Fonte de dados [C]:**
  - Aba Vendedor (macro): **SQL dinâmico montado no Delphi e executado via `FILTRO`**. Une faturamento (`dbfatura`+`dbprodfat`, `tipofat<>'2'`, `tipodest='C'`, `cancel='N'`, `fat.codvend=X`) com vendas D1/D2 (`dbvenda` tipo '1'/'2' + `dbvvend` operador='N'). Em seguida soma a parte "como operador" via `ANALISE_TELEMARKETING.VENDEDOR_OPERADOR`. Custo = `qtde*prod.PrCustoAtual` e `qtde*prod.PrCompra` (**custo atual do cadastro, não o histórico**).
  - Detalhe: `ANALISE_FATURAMENTO.VENDEDOR_DETALHADO` (chamado com TIPO 'FAT', 'D1' e 'MKT').
  - Volume de compras: `ANALISE_FATURAMENTO.VOLUME_COMPRAS_CLIENTE` (classe, telefone).
  - Cliente: `ANALISE_FATURAMENTO.CLIENTE_GRUPO_MARCA` e `CLIENTE_GRUPO_MARCA_DETALHADO`.
  - Grupo/Marca: `ANALISE_FATURAMENTO.GRUPO_MARCA` e `GRUPO_MARCA_TELEMKT` (VTIPOGRUPO 'C' clientes / 'V' vendedores) e `GRUPO_MARCA_DETALHADO`.
  - Grupo detalhado: `ANALISE.FATURAMENTO_DETALHADO_GRUPO`.
  - Ranking: `ANALISE_FATURAMENTO.RANKING_CLIENTE`, `RANKING_MARCA`, `ANALISE.OBTER_PROD_FATURADOS` e `OBTER_PROD_D1` (ranking de grupo).
  - Também declarado: `TEMP.VENDCLI_GRUPO_MARCA`.
- **Tabelas [C, via all_dependencies]:**
  - Usadas: DBFATURA, DBPRODFAT, DBPROD, DBGPPROD, DBMARCAS, DBCLIEN, DBVENDA, DBITVENDA, DBVVEND, DBVEND, DBUSUARIO, DBCCLIEN (existe no PG), DBFNCLI (**não existe no PG**), DBCALC.
  - No PG: dbprodfat só desde 08/2026; dbvvend sem histórico.
- **Web hoje:** parcial e indireto. O Dashboard de Vendas tem top clientes/produtos e vendas mensais a partir de `dbvenda` (`pages/api/vendas/dashboard/*`), sem visão por vendedor/grupo/marca nem custo.
- **Complexidade:** **G**. São cerca de 15 consultas distintas, 5 abas com sub-abas, mistura de procedures com SQL dinâmico, regras de operador/tele e cerca de 4.800 linhas de Pascal.
- **Bloqueios/dúvidas:**
  - Dados de item e `dbvvend` ausentes no PG.
  - `dbfncli` ausente.
  - Margem calculada com custo atual (decidir se mantém).
  - Ramos D1/D2 mortos.
  - Sugestão: reescrever como um único "Analisador de faturamento" parametrizado (dimensão × filtro).

### Análise Detalhada do Faturamento — frmAnaliseDetalhadaFaturamento (fonte .pas/.dfm ausentes; DFM recuperado do exe)
- **Objetivo [C pelo DFM]:** análise histórica de faturamento e recebimento em 7 abas:
  1. **HISTÓRICO**: por Ano ou por Dias; colunas por mês com Produtos Faturados, Notas Faturadas, D1+NFP, D1+NFC, D1+Boleto.
  2. **BANCOS**: títulos/boletos com legenda Enviado/Pago/Atrasado, totais por banco (Bradesco/BB/Itaú/Carteira) e um construtor de filtro por campo e operador.
  3. **DADOS GERAIS**: valor NF/FAG/D1/total e boletos por banco.
  4. **GRUPO/MARCA**.
  5. **CLIENTE**: cliente, cliente×produto, cliente×vendedor.
  6. **VENDEDOR**: vendedor, vendedor×cliente, vendedor×produto, clientes não atendidos.
  7. Voltar.
- **Filtros [C pelo DFM]:**
  - Ano (`edtAno`) ou dias (seleção com "Marcar/Desmarcar Todos").
  - RadioGroup Ano/Dias.
  - Em BANCOS: campo (Banco, Cód./Nome Cliente, Data Emissão/Pagamento/Vencimento, Enviado, Pago, Conta, Dias de Atraso, Forma de Faturamento), operador (=, <>, >, <, >=, <=) e valor.
  - Em GRUPO/MARCA: Grupo Produto/Marca, adicionar/remover vários códigos.
  - Em CLIENTE e VENDEDOR: busca por código ou nome.
- **Saída [C pelo DFM]:** dxDBGrids por aba, labels de totais, "Copiar para o Excel". Sem impressão.
- **Fonte de dados [C]:**
  - Procedures avulsas:
    - `ANALISE_DETALHADA_FATURA_MES(vano)`: UNION de D1 (morto), NFP (`totalprod` com desconto), NFC (`totalnf`) e BOLETOS (`dbreceb.valor_pgto` das faturas do ano), agrupado por 'yyyy/mm'.
    - `ANALISE_DETALHADA_FATURA_DIAS`.
    - `ANALISE_DET_FATURAMENTO_OP`.
    - `ANALISE_DET_DADOS_GERAIS_MES/_DIA`.
    - `ANALISE_DET_BANCO(vopcao 'FILTROPOR'|'CONSULTAMES'|'CONSULTADIA', vvalor, vfcarteira)`: **monta SQL dinâmico com o WHERE vindo do front**, em `dbreceb × dbclien`, calcula dias de atraso e decodifica banco e forma de faturamento.
  - Package `ANALISE_DETALHADA_FAT` (3.657 linhas): `CONSULTA_CLIENTE`, `CONSULTA_CLIENTE_PROD`, `CONSULTA_CLIENTE_VEND`, `CONSULTA_VENDEDOR`, `CONSULTA_VENDEDOR_CLIENTE`, `CONSULTA_VENDEDOR_PROD`, `CONSULTA_VENDEDOR_CLIENTE_NAO`, `CONSULTA_VENDEDOR_TMP`, `CONSULTA_GRUPOMARCA_CLIENTE`, `CONSULTA_GRUPOMARCA_VEND`, `DATA_DESCOMPACT`, `LIMPA_TABELA`. As consultas fazem **`TRUNCATE`/`INSERT` em tabelas TMP** (TMPVENDEDOR, TMPVENDEDORCLIEN, TMPVENDEDORPROD, TMPVENDEDORCLIENMAO, TMPCLIENTEPROD, TMPCLIENTEVEND10, TMPVENDEDOR10, TMPGRUPOMARCACLIENTE, TMPGRUPOMARCAVEND11) com `EXECUTE IMMEDIATE`, e as limpam por usuário (NOMEUSR).
  - Existe uma cópia `ANALISE_DETALHADA_FAT2` (3.661 linhas; também tem TOTAL_OBJETIVO). Não sei se alguma tela a usa.
  - Também usado: um TQuery `QryClienteValorD1` com SQL montado em runtime.
- **Tabelas [C]:**
  - Usadas: dbfatura, dbprodfat (**só desde 08/2026**), dbvenda, dbitvenda, dbvvend (**sem histórico**), dbclien, dbprod, dbgpprod, dbmarcas, dbvend, dbusuario, dbcalc e dbreceb (ok no PG, 1,98 milhão de linhas até 30/10/2026).
  - **Faltam:** dbclivend, dbclivend_tmk, vwRelVendCliGpp e todas as TMP.
- **Web hoje:** nada.
- **Complexidade:** **G**. O form não tem fonte (o comportamento dos eventos teria de ser deduzido só pelo DFM e pelas procedures), o package é enorme e baseado em TMP com DML, e são 7 abas.
- **Bloqueios/dúvidas:**
  - Sem .pas.
  - O package grava TMP (no PG o equivalente seria CTE ou tabela temporária de sessão).
  - Falta `dbclivend`.
  - Avaliar se o usuário ainda usa o relatório ou se "Histórico" e "Bancos" bastam (estes são simples: P–M isoladamente).

### Análise de Faturamento - Telemarketing — FrmAnaliseFaturamentoTeleMkt
- **Objetivo:** medir o faturamento de um vendedor separando venda direta da venda "como operador de telemarketing", comparar o valor faturado com o valor real do vendedor e ranquear clientes, marcas, grupos e vendedores de tele.
- **Filtros [C]:**
  - Aba Vendedor: período, vendedor (obrigatório), agrupar por Grupo/Marca/Cliente, ordenar por total ou descrição, checkbox "Clientes não atendidos".
  - Aba Ranking: período.
- **Saída [C]:**
  - Aba Vendedor, sub-aba "Valor Real": Código, Descrição, Venda Direta (R$), "...Como operador (R$)", Total.
  - Sub-aba "Valor Faturado x Valor Real": Total Faturado, Total Vendedor, Total Telemarketing (diferença). Totais gerais.
  - Aba Ranking: sub-abas Clientes, Marca, Grupo e Vendedor.
  - Imprimir (QuickReport) e Excel.
- **Fonte de dados [C]:**
  - Faturado: SQL dinâmico via `FILTRO` (dbfatura+dbprodfat+dbvenda, `fat.codvend=X`).
  - Real: `ANALISE_TELEMARKETING.VENDEDOR_OPERADOR` e `VENDEDOR_NAO_TELE`.
  - Ranking: `ANALISE_TELEMARKETING.RANKING_CLIENTE`, `RANKING_MARCA`, `RANKING_GRUPO` e `RANKING_VENDEDOR`. O último soma `dbprodfat` com `dbvvend.operador='S'` mais D1 com `tele='S'`.
  - Clientes não atendidos: `ANALISE_TELEMARKETING.CLIENTES_VENDEDOR`.
- **Tabelas [C]:** DBFATURA, DBPRODFAT, DBVENDA, DBITVENDA, DBVVEND, DBVEND, DBPROD, DBGPPROD, DBMARCAS, DBCLIEN. Todas existem no PG, mas **dbprodfat e dbvvend estão sem histórico**. O campo `dbvenda.tele` existe e tem uso real (em 2025 o Oracle tem 111 mil vendas tele='S' e 62 mil 'N') [C].
- **Web hoje:** nada.
- **Complexidade:** **M**. São cerca de 7 consultas; a regra central é "operador='S' ⇒ crédito tele".
- **Bloqueios/dúvidas:**
  - `dbvvend` histórico (essencial aqui).
  - UNION sem ALL nas procedures.
  - Conversar com o usuário se não dá para fundir com a Análise de Faturamento.

### Análise de Vendas — frmAnaliseVendas (.pas existe; DFM recuperado do exe)
- **Objetivo:** três análises de produto:
  1. **Produtos Não Vendidos** de uma marca/grupo no período (com estoque zero ou maior que zero).
  2. **Produtos Vendidos** no período (ranking por quantidade).
  3. **Não vendidos (Custos)**: produtos com estoque, entrada com custo num período e sem venda em outro período, com o valor parado (pr.compra × qtd).
- **Filtros [C]:**
  - Aba 1: Marca **ou** Grupo (obrigatório, com código), nível de estoque `=`/`>` (padrão '='), período.
  - Aba 2: período, grupo e/ou marca opcionais (TIPO_PARAMETRO '0' nenhum, '1' grupo, '2' marca).
  - Aba 3: Marca/Grupo, período de entrada e período de saída.
- **Saída [C]:**
  - Aba 1: REF, PRODUTO, MARCA, Estoque, Locação, Pr.Compra, Custo Atual; contadores "produtos da marca/grupo" e "total não vendidos".
  - Aba 2: Referência, Produto, Aplicação Extendida, Marca, Quant., Locação, Pr.Compra, Custo Atual.
  - Aba 3: Referência, Produto, Pr.Compra, Custo Atual, Pr.Médio, Quant., Pr.Compra×Quant.; total geral.
  - Impressão QuickReport (3 relatórios) e Excel.
- **Fonte de dados [C]:**
  - `ANALISE.PRODUTO_NAO_VENDIDOS_PARTE1(FILTRO_POR_MG, TIPO_FILTRO_ESTOQUE, CODIGO)` lista os produtos. Para **cada produto**, chama `ANALISE.PRODUTO_NAO_VENDIDOS_PARTE2(CODIGOP, DATAINI, DATAFIM)`, que faz `count` em dbitvenda/dbvenda com `cancel='N'` (N+1; no web vira NOT EXISTS).
  - `ANALISE.PRODUTOS_VENDIDOS(DataInicial, DataFim, vCodGrupo, vCodMarca, TIPO_PARAMETRO)`: soma `dbitvenda.qtd` com `cancel<>'S'`, **excluindo os clientes fixos `04487, 03341, 00002, 05634`**.
  - `ANALISE.PROD_SEM_VENDAS_CUSTOS(Tipo, vCODIGO, DtEntradaIni/Fim, DtSaidaIni/Fim)`: produtos com `qtest>0`, entrada `temcusto='S'` no período e sem venda no período de saída.
  - Observação: as análises olham a **venda** (`dbvenda`), não a fatura.
- **Tabelas [C]:**
  - Ok no PG: dbprod (local, prcompra, prcustoatual, prmedio, aplic_extendida, qtest), dbmarcas, dbgpprod.
  - dbvenda/dbitvenda: ok para 2024–2025, quase vazio em 2026.
  - dbent/dbitent (temcusto, quant): só 2025 no PG.
- **Web hoje:** parcial. O Dashboard de Vendas tem top-products (`pages/api/vendas/dashboard/top-products.ts`), mas sem filtro de grupo/marca, sem "não vendidos" e sem custo de estoque parado.
- **Complexidade:** **P–M**. São três queries diretas; a primeira precisa ser reescrita sem N+1.
- **Bloqueios/dúvidas:**
  - Lista de clientes excluídos fixa no código.
  - Histórico de vendas de 2026 e de entradas no PG.

### Custo de Mercadoria Vendida — frmCMV (o handler abre `TfrmCMV`; `FrmAnaliseCustoFaturamento` está **comentado** no `mnuAnaliseCustoFaturamentoClick`)
- **Objetivo:** CMV por Marca ou Grupo de produto no período, comparando:
  - compras (C.COMPRAS);
  - faturado (FATURADO);
  - custo do faturado (C.FATURADO) e margem (M.FATURADO %);
  - inventário atual;
  - faturado em outros CFOPs;
  - pré-pedidos em aberto.

  Duplo clique abre o detalhamento por produto.
- **Filtros [C]:**
  - Período (`dtInicial`/`dtFinal`).
  - Agrupar por MARCA / GRUPO DE PRODUTO.
  - Visualizar REAL (R$) / QUANTIDADE.
  - Construtor de filtro com várias condições (OR): Marca, Grupo Prod., Grupo Func., Comprador, Segmento, Informativo (combo de `INFPROD_NAVEGA`), Cliente.
- **Saída [C]:**
  - dxDBGrid com DESCRIÇÃO, C.COMPRAS, FATURADO, C.FATURADO, M.FATURADO(%), INVENTÁRIO, FATURADO OUTROS e PRÉ-PEDIDO; somatórios no rodapé.
  - Labels: Total de Compra, Total de Faturamento, Total de Custo Faturado e Margem Faturamento×Custo (%).
  - Painel de zoom por produto (Excel).
  - Excel e impressão (VDOPrinter).
- **Fonte de dados [C]:** package `RELATORIOS`:
  - `CMV_FATURAMENTO(vDtInicio, vDtFim, vFiltro, vTpGroup 'M'|'G', vTipo 'REAL'|'QUANTIDADE')`:
    - Faturado = `p.qtde*p.prunit` das faturas `cancel='N'`, `tipodoc='V'`, `tipodest='C'`, `cfop1 IN (select cfop from dbcfop_saida)`, ligando `dbprodfat` a `dbitvenda` por codvenda+codprod+nrequis+nritem.
    - **Custo:** a partir de 17/08/2016 usa `iv.qtd*iv.prcompra` (custo gravado no item da venda); antes disso usa `prod.prcompra`, convertido pela taxa do dólar quando `prod.dolar='S'`.
    - Margem = (FATURADO/C_FATURADO − 1)×100.
  - `ENTRADAS`: `dbent`×`dbitent`, `(quant - quant_filial)*prunit` (com dólar), `status<>'C'` e CFOPs de entrada fixos `('1403','1102','1409','1152','2403','2102','2409','2152','0')`.
  - `INVENTARIO`: `qtest*prcompra` atual (**snapshot de hoje, não na data**).
  - `CMV_FATURAMENTO_NVENDA` → FATURADO_OUTROS (CFOP `NOT IN dbcfop_saida`).
  - `CMV_VENDA_NFATURADA` → PRÉ-PEDIDO (`dbvenda` `status<>'F'`).
  - Drill por produto: `CMV_FATURAMENTO_PRODUTO`, `INVENTARIO_PRODUTO`, `ENTRADAS_PRODUTO`.
  - Auxiliares: `SEGMENTO_CONSULTA`, `INFPROD_NAVEGA`.
  - Todas recebem um **pedaço de WHERE pronto** do front (`vFiltro`, por exemplo `(m.codmarca in ('x','y')) OR ...`) e montam SQL dinâmico.
- **Tabelas [C]:**
  - dbfatura, dbprodfat (**só desde 08/2026**), dbitvenda (prcompra, nrequis e nritem existem), dbvenda, dbprod (dolar, txdolarcompra, qtest, codgpf, inf existem), dbmarcas, dbgpprod, dbent/dbitent (quant_filial existe; **só 2025**), dbsegmento e dbgpfunc (existem).
  - **Faltam:** `dbcfop_saida` (essencial, 14 CFOPs no Oracle), `dbinfprod` e a tabela de comprador (não localizei `dbcomprador` no PG; existe API `pages/api/compradores`, não verifiquei a tabela).
- **Web hoje:** nada.
- **Complexidade:** **M–G**. São 5 consultas + drill, filtro composto e regra de custo com corte por data e dólar. Exige reescrever o construtor de filtro de forma parametrizada.
- **Bloqueios/dúvidas:**
  - Criar ou migrar `dbcfop_saida` (ou usar `dbcfop_n` com flag).
  - Item de fatura histórico.
  - O inventário é sempre atual (decidir se mantém).
- **Fora de alcance:** `FrmAnaliseCustoFaturamento` (procedures `ANA_CUSTO_FATURADO`, `ANA_CUSTO_VENDAS`, `ANA_CUSTO_COMPRAS`, `ANA_CUSTO_COMPRAS_NEST` e o package `ANALISE_CUSTO`; DFM recuperado em `gB/dfm_TFrmAnaliseCustoFaturamento.txt`) **não é alcançável pelo menu** [C]. Não precisa migrar.

---

## Tabela resumo

| Relatório | Complexidade | Bloqueio principal | Web existe? |
|---|---|---|---|
| Relatório CLM (PST) | M | Layout TXT posicional; faltam `dbcfop_saida`, `dbfncli`, `dbprazo_pst`; itens de fatura só desde 08/2026 | Não |
| Cautelas em Aberto | P–M | Abas por vendedor usam `tipo='C'` (morto desde 2013); falta `dbclivend`/`vwRelVendCliGpp`; `dbvvend` sem histórico | Não |
| Faturas sem Títulos de Cobrança | P | Nenhum de dados (dbfatura completa); lista de CFOP fixa | **Parcial**: Consulta de Faturas, filtro "sem cobrança" |
| Produtos para N.E. | P (M se reproduzir preço/dólar) | Regra de preço no Delphi sem fonte; dbprodfat só desde 08/2026; série B morta | Não |
| Resumo Doctos Grupo/Marca | P | dbprodfat só desde 08/2026 | Não |
| Ranking de Vendedores | M | Totalização Normal/Tele/operador no Delphi sem fonte; meta (valobj?/DBVENDEDOR_META não migrada); dbvvend/dbprodfat | Não |
| Relatório de Notas sem cobrança | P | dbfecharvendas (47 linhas) e dbvvend sem histórico; decidir dbfecharvendas × fatura_venda | Parcial (Consulta de Faturas) |
| Resumo de Documentos | P–M | Falta `dbdocinterno`; ramos D1/D2 mortos; dbprodfat | Não |
| Projetar Vendas | M | Grava `dbsugestaovendas`, sem uso desde 2005 (provável descontinuar); dbprodfat | Não |
| ICMS Diferencial de Entrada | P | dbent no PG só 2025 (2,6 mil contra 180 mil no Oracle); fórmula 30%/17% fixa | Não |
| Análise de Faturamento | G | 5 abas e cerca de 15 consultas, SQL dinâmico; dbprodfat/dbvvend sem histórico; falta dbfncli | Parcial (Dashboard Vendas: top clientes/produtos) |
| Análise Detalhada do Faturamento | G | Sem .pas/.dfm (DFM recuperado do exe); package de 3,6 mil linhas com TMP+DML; falta dbclivend | Não |
| Análise de Faturamento - Telemarketing | M | dbvvend (operador) sem histórico no PG | Não |
| Análise de Vendas | P–M | N+1 a reescrever; vendas 2026 e entradas fora de 2025 ausentes no PG | Parcial (Dashboard: top-products) |
| Custo de Mercadoria Vendida (frmCMV) | M–G | Falta `dbcfop_saida`; dbprodfat; filtro dinâmico; inventário só atual | Não |

## Procedures / packages Oracle do grupo (owner GERAL; fonte salvo em `gB/src/`)

**Packages:**
- `RELATO`: PRODUTOS_PARA_NE, RESUMO_DOCUMENTO, CAUTELA_ABERTO, RANKVEND_PRODFATURADOS, RANKVEND_PRODD1, OPERADORVENDA. O DFM também declara COMISSAOVENDEDOR, PERC_COMISSAO_VENDEDOR, RELCLIVENDGPP e BANCOVENDAS_*, de abas fora do escopo.
- `TEMP`: VENDCLI_GRUPO_MARCA, NAVEGA_SUGESTAOVENDA.
- `VENDEDOR`: INC_SUGESTAO_VENDA, DEL_SUGESTAO_VENDA, EXISTE_SUGESTAO_VENDA.
- `ANALISE_FATURAMENTO`: RANKING_CLIENTE, RANKING_MARCA, GRUPO_MARCA, GRUPO_MARCA_TELEMKT, VENDEDOR_DETALHADO, VOLUME_COMPRAS_CLIENTE, CLIENTE_GRUPO_MARCA, CLIENTE_GRUPO_MARCA_DETALHADO (o body também tem VENDEDOR, VENDEDOR_OPERADOR, CUSTO_SINTETICO etc.).
- `ANALISE_TELEMARKETING`: VENDEDOR_OPERADOR, VENDEDOR_NAO_TELE, RANKING_CLIENTE, RANKING_MARCA, RANKING_GRUPO, RANKING_VENDEDOR, CLIENTES_VENDEDOR, VENDEDOR_VENDAS_REAL, VENDEDOR_TOTAL_FATURADO.
- `ANALISE`: FATURAMENTO_DETALHADO_GRUPO, OBTER_PROD_FATURADOS, OBTER_PROD_D1, PRODUTO_NAO_VENDIDOS_PARTE1, PRODUTO_NAO_VENDIDOS_PARTE2, PRODUTOS_VENDIDOS, PROD_SEM_VENDAS_CUSTOS.
- `ANALISE_DETALHADA_FAT` (e a cópia `ANALISE_DETALHADA_FAT2`): CONSULTA_CLIENTE, CONSULTA_CLIENTE_PROD, CONSULTA_CLIENTE_VEND, CONSULTA_VENDEDOR, CONSULTA_VENDEDOR_CLIENTE, CONSULTA_VENDEDOR_PROD, CONSULTA_VENDEDOR_CLIENTE_NAO, CONSULTA_VENDEDOR_TMP, CONSULTA_GRUPOMARCA_CLIENTE, CONSULTA_GRUPOMARCA_VEND, DATA_DESCOMPACT, LIMPA_TABELA.
- `RELATORIOS`: CMV_FATURAMENTO, CMV_FATURAMENTO_PRODUTO, CMV_FATURAMENTO_NVENDA, CMV_VENDA_NFATURADA, INVENTARIO, INVENTARIO_PRODUTO, ENTRADAS, ENTRADAS_PRODUTO.
- `MELO.NAVEGA` (dados da empresa, no CLM).
- `ANALISE_CUSTO` (só do form inalcançável FrmAnaliseCustoFaturamento).

**Procedures avulsas:**
- frmRelFatura: ICMS_DIFERENCIAL_ENTRADA, FATURAMENTO_POR_DOC, FATURAMENTO_POR_DOC_GRUPO, CAUTELA_EM_ABERTO_NOVA, CAUTELA_ABERTO_NOVA_2VENDEDOR, CAUTELA_ABERTO_NOVA_OPERADOR, FATURA_SEM_TITULO_REL, NOTASSEMCOBRANCA, CONS_FATURASEMTITULO, CONS_VENDNOTASEMTITULO.
- Análises: GRUPO_MARCA_DETALHADO, FILTRO (executor genérico de SQL), ANALISE_DETALHADA_FATURAMENTO, ANALISE_DETALHADA_FATURA_MES, ANALISE_DETALHADA_FATURA_DIAS, ANALISE_DET_FATURAMENTO_OP, ANALISE_DET_DADOS_GERAIS_MES, ANALISE_DET_DADOS_GERAIS_DIA, ANALISE_DET_BANCO.
- CMV: SEGMENTO_CONSULTA, INFPROD_NAVEGA.
- CLM: NAVEGA_FATURAMENTO_DIARIO_PST, NAVEGA_CLIENTES_FATURA_PST, NAVEGA_PRODUTOS_FATURADOS_PST, TELEFONE_CLIENTE_PST, PST_LOC_PRAZO, NAVEGA_CLIENTES_FAT_PST_GR, NAVEGA_FAT_DIARIO_PST_GR, NAVEGA_PRODUTOS_FAT_PST_GR.
- Fora do menu: ANA_CUSTO_FATURADO, ANA_CUSTO_VENDAS, ANA_CUSTO_COMPRAS e ANA_CUSTO_COMPRAS_NEST (FrmAnaliseCustoFaturamento).

**View:** `VWRELVENDCLIGPP` = `dbCliVend CV × dbVendGpp VGpp` on `CV.CodVend = VGpp.CodVend`. Não existe no PG, e `dbclivend` também não [C].
