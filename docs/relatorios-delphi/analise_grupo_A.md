# Análise — Grupo A (Vendas / Comissão / Metas)

Data da análise: 2026-11-02. Só leitura (Oracle `GERAL` via DATABASE_URL2, PG `db_manaus` via DATABASE_URL).

## Como ler este documento

- **[C] confirmado**: li no fonte (.pas/.dfm/dcu), no `all_source`/`all_arguments`/`all_errors` do Oracle ou consultei o PG.
- **[I] inferido**: dedução sem prova direta (por exemplo, o nome da procedure deduzido pela assinatura dos parâmetros).
- Dumps de apoio gerados no scratchpad: `pkgA\*.sql` (fontes PL/SQL completos: COMISSAO, RELATO, PRENOTA, CONSULTAPRODUTO, PERFIL_GPP, SUPER_MASTER, VENDAS_OPERACOES, ESTOQUE_SUPRIDO, PRODUTO_SEM_DEMANDA, EXTRATO_VENDEDOR, COMISSAO_CLIENTE, COMISSAO_TOTAL_CLIENTE, PROCEDURE_VENDA_CLIENTE, FILTRO_CODVENDEDOR_NOVO, FATURA_NAVEGA_PRODUTOS_FATURA) e `pgcheckA.out` (existência, linhas e data máxima das tabelas no PG).

## Achados transversais (valem para vários relatórios)

1. **O Oracle está congelado em 2026-08-15** [C]: `max(data)` de dbfatura, dbvenda, dbvenda_desbloqueada_historico e dbacao(DBENT).
2. **O PG não tem o histórico de itens nem o de vendedor por venda** [C]:
   - `dbfatura` tem 179.444 linhas (até 2026-10-30), mas `dbprodfat` só tem 192 linhas, todas de faturas a partir de 2026-08-06. Nenhum item de fatura anterior a 2026-08 foi migrado.
   - `dbvvend` tem 1.197 linhas, das quais só 257 casam com `dbvenda` (152.722 vendas). O vendedor e o flag operador/externo por venda praticamente não existem no PG.
   - O web grava o vendedor em `dbvenda.codvend` e em `dbitvenda.codvend`, e liga fatura a venda por `fatura_venda` (593 linhas).
   - Consequência: todo relatório do grupo que usa `dbprodfat` ou `dbvvend` precisa ser **reescrito** sobre o modelo web. Para períodos anteriores a 2026-08 ele sai vazio, a menos que se migre `dbprodfat`/`dbvvend`.
3. **Objetos Oracle INVALID** [C] (`all_objects.status` + `all_errors`):
   - **PACKAGE BODY `PERFIL_GPP` está INVALID** (ORA-00942 na linha 535 e em outras: a view `VW_PERFIL_VENDA` não existe). [I] Qualquer chamada ao package falha (ORA-04063). Assim, **Metas por Perfil e Metas por Cliente estão quebradas no Delphi hoje**.
   - `COMISSAO_CLIENTE`, `COMISSAO_TOTAL_CLIENTE` e `FILTRO_CODVENDEDOR_NOVO` estão INVALID (erro ORA-00942 em `vwRelVendCliGpp`). Porém a view existe e está VALID, recriada em 2026-08-17. [I] Provavelmente recompilam sozinhas na próxima chamada.
4. **Não existe .dfm** de FrmRelatorioComissao, FrmRelatorioGeral, FrmPerfilGpp nem FrmMasterConsulta. Também não há exe com os recursos DFM.
   - Nesses forms, o `StoredProcName` foi deduzido assim: params usados no .pas/.dcu (`ParamByName`) → busca em `all_arguments` → conferência dos campos que o .pas lê contra o SELECT da procedure.
   - Cada caso está marcado [I-forte] (assinatura + colunas batem) ou [I].
5. **O `.dcu` de UniRelatorioGeral é mais novo que o `.pas`** [C]: o dcu tem strings de multi-armazém (`cad_armazem_produto`, `VARM_ID`, combo `cmbExt_Armazem`) que não aparecem no .pas. Na aba Extrato de Itens, vale o dcu.
6. **Impressão no Delphi** [C]: tudo é texto montado em memória (`frmRelatorioDinamicoZ.AppendRx` + `rptGenerico.Print`, ou `VDOPrinter`), com exportação `SaveToXLS` do grid DevExpress ou `dmConsulta.Copia_Para_Excel`. Não há layout QuickReport/FastReport próprio, então no web basta grid + Excel/PDF genérico.

---

### Comissão do Vendedor — FrmRelatorioComissao (modo "Vendedor")

- **Objetivo:** o vendedor logado vê o próprio resumo de comissão do período (só o bloco de totais).
- **Filtros (front Delphi)** [C]:
  - Data inicial (default dia 1 do mês) e data final (default hoje).
  - Vendedor: fixo no do usuário e somente leitura. Vem de `dbusuario.cod_vend` do usuário logado; o usuário `0101` é forçado a `00003`, hard-coded em `mnuComissaoVendedorClick`.
  - Se o usuário não for vendedor, aparece mensagem e a tela não abre.
- **Saída** [C]: mesmo grid do modo Gerencial, mas filtrado em `Cliente='TOTAL_GERAL'`, ou seja, só as linhas de totalização. Imprimir e Excel ficam desabilitados.
- **Fonte de dados** [C]: `COMISSAO.COMISSAO_VENDEDOR(vdt1, vdt2, vcodvend, vUName, curdados)`. No `FormClose` chama `COMISSAO.LIMPAR_DBCOMISSAO(vUName)`. Lógica no bloco Gerencial abaixo.
- **Tabelas / Web / Complexidade / Bloqueios:** iguais aos do bloco Gerencial abaixo. Complexidade **P** se o Gerencial for feito, porque é só um filtro sobre o mesmo resultado.

### Relação para Comissão por Vendedor › Relatório Gerencial / Relatório Financeiro — FrmRelatorioComissao

- **Objetivo:** comissão por vendedor detalhada por cliente e documento (D1, NF, FAG): total vendido, prazo médio, margem, % e valor de comissão, com bloco de totais. O Financeiro é igual ao Gerencial, só que sem a coluna Margem.
- **Filtros (front Delphi)** [C]:
  - Data inicial (dia 1 do mês) e data final (hoje).
  - Código do vendedor (5 dígitos, com lookup `dmConsulta.Consulta(5)`). Não é obrigatório na tela, mas a procedure precisa dele: com `00000` não carrega `xRowVendedor`.
  - `SetPermission('Gerencial'|'Financeiro')`.
- **Saída** [C]:
  - Grid `dxDBGrid` com colunas criadas dinamicamente a partir do cursor: Cliente (agrupador, `GroupIndex 0`), Documento, Tipo Doc., Data, Total Venda (R$), Prazo Médio ("a Vista" ou "sem Cobranca"), Margem de Custo (%) (só Gerencial), Comissão (%), Total Comissão (R$). As colunas COL_ID, CODDOCUMENTO e NOMEUSR ficam ocultas.
  - Linhas finais `TOTAL_GERAL`: TOTAL D1, TOTAL NF, TOTAL FAG; TOTAL VENDA ATIVO (com prazo, margem e % médios); totais por grupo de produto com % diferenciado (ativo e passivo); TOTAL VENDA PASSIVO; TOTAL VENDIDO; TOTAL COMISSÃO; COMISSÃO SEM COBRANÇA; SALDO DE COMISSÃO; VENDEDOR.
  - Impressão em texto via VDOPrinter, com quebra por cliente. Excel `.xls`.
- **Fonte de dados** [C]:
  - Entrada: `COMISSAO.COMISSAO_VENDEDOR` → `Carrega_TabelaAux`.
  - `Carrega_TabelaAux` apaga e reinsere a tabela de trabalho `DBCOMISSAO` filtrada por `nomeusr`, a partir do cursor `Comissao_Vendas`. Ao final adiciona os totais e os blocos `TotalGpProdDif` (ordem 0 = ativo, 1 = passivo).
  - `Comissao_Vendas` faz uma UNION de 9 blocos:
    - Faturas (`tipodoc='V'`, `tipofat<>'2'`, `tipodest='C'`, não canceladas, cliente `claspgto<>'F'`): telemarketing como operador (`dbvvend.operador='S'`); 2º vendedor normal e 2º vendedor tmk (via `vwRelVendCliGpp`, só até 31/12/2022); vendedor da fatura fora da carteira 2º vendedor (até 2022) e "normal" após 2022.
    - D1 (`dbvenda.tipo='1'`): operador, 2º normal, 2º tmk e normal.
    - **Venda ativa:** `venda.tele='N'` ou `venda.codusr` pertence ao vendedor.
  - **% comissão** (`Aliquota_Comissao`), por item, em cadeia de prioridade:
    - `dbfatura.comdift`/`comdifn` → `dbitvenda.comissao_operador` → `dbitvenda.comissaovend` → `dbprod_comissao.comdifint`/`comdifext`/`comdifext_int` → `dbvend.comtele`/`comnormal`.
    - Há exceções hard-coded: vendedores `00263` e `00169`, faturas ≤ 31/12/2020 com 1,5% / 2% / 4%, `codcv in ('002','004','005','007','016','020')` e `codcli='99999'` = 3%.
  - **Prazo médio:** `PRAZO_MEDIO` = média de `dbpzfat.prazo`. Se a fatura não tem recebimento (`Verifica_Recebimento`: `dbreceb` direto, por `codgp` ou por `dbgpfaturareceb`), o prazo é -1 ("sem cobrança") e o valor entra em "comissão sem cobrança".
  - **Margem:** `(total / custo − 1) × 100`, com o custo em dólar convertido por `dbcalc.dlrcom` quando `dbprod.dolar='S'`.
- **Tabelas** [C] (PG `db_manaus`):

| Tabela | No PG? | Observação |
|---|---|---|
| dbfatura | sim | 179k linhas, até 2026-10-30; colunas `comdift`/`comdifn` ok |
| dbprodfat | sim, quase vazia | 192 linhas, só faturas web desde 2026-08 |
| dbvvend | sim, esparsa | 1.197 linhas |
| dbvenda | sim | 152k |
| dbitvenda | sim | `comissaovend`, `comissao_operador` e `origemcom` existem |
| dbprod, dbclien, dbvend, dbcalc, dbgpprod, dbreceb, dbusuario | sim | — |
| dbpzfat | sim, quase vazia | 17 linhas |
| dbvendgpp | sim | 673 linhas |
| **dbprod_comissao** | **não existe** | Oracle: 396.035 linhas |
| **dbgpfaturareceb** | **não existe** | — |
| **dbclivend** | **não existe** | Oracle: 249 linhas; sem ela não há `vwRelVendCliGpp` |
| **vwRelVendCliGpp** | **não existe** | — |
| **dbcomissao** | **não existe** | Tabela de trabalho; dispensável no web (calcular em memória ou CTE) |

- **Web hoje** [C]: existe "Comissão de Vendedor" (`src/components/corpo/admin/relatorios/comissao`, `src/pages/api/comissao/{extrato,fechar,reabrir}.ts`, `src/lib/comissao/calcularComissao.ts`). **Não é port deste relatório.**
  - O comentário diz que espelha `UniRelFatura.pas / Gerarx_ComissaoVendedorSintetico`.
  - Regra web: % = `comdif` ou % do item limitado (LEAST) ao % do vendedor, senão % do vendedor. Base: fatura via `fatura_venda` + `dbitvenda`. Grava razão em `fin_comissao_mov` (128 linhas) e tem fechamento mensal.
  - Não tem: D1, 2º vendedor, prazo médio, margem, comissão sem cobrança, `dbprod_comissao` nem as exceções hard-coded.
- **Complexidade:** **G**. Regra PL/SQL extensa (cerca de 600 linhas úteis), 9 ramos, exceções hard-coded e duas tabelas de regra não migradas. Além disso há conflito de regra com a comissão web já existente.
- **Bloqueios/dúvidas:**
  - (1) Decidir se o relatório web atual substitui este ou se é preciso reproduzir o COMISSAO_VENDEDOR. As regras divergem.
  - (2) Migrar `dbprod_comissao`, `dbclivend` e `dbgpfaturareceb`, ou abandonar a regra.
  - (3) Sem `dbprodfat`/`dbvvend` históricos não dá para conferir web × Delphi em períodos antigos.
  - (4) O 2º vendedor foi cortado em 31/12/2022 no próprio PL/SQL: confirmar se essa regra ainda importa.

### Relação para Comissão por Cliente — FrmConsulta_comissao_por_cliente

- **Objetivo:** para um cliente e período, listar as faturas (só as que vieram de Cautela ou Pré-pedido), os itens da fatura e os vendedores que comissionam em cada fatura, com % e valor.
- **Fonte do form:** **.pas ausente** [C]. Só existem .dfm e .dcu. A lógica de montagem é inferida pelos nomes de métodos no dcu: `filtravendaclientes`, `Incluir_RxComissao_Vendedor`, `Incluir_Grupo_Comissao`, campos `kback`/`tipo`.
- **Filtros (front Delphi)** [C pelo dfm]:
  - Data inicial (`dt1`) e final (`dt2`). [I] Defaults provavelmente dia 1 do mês e hoje, como nos outros forms.
  - Cliente (máscara `99999`, lookup).
  - Nº formulário (opcional, filtra com `LIKE 'x%'`).
  - Check "Visualizar Total da Comissão".
- **Saída** [C pelo dfm]: aba "Vendas por Cliente" com 3 grids.
  - Faturas: Tipo Nota, Documento, Cód. Fatura, Data.
  - Itens da Fatura: Nro. Venda, Referência, Descrição, Marca, Qtd, Preço.
  - Vendedor: Código, Vendedor, Data Venda, Documento, Valor, Comissão %, Valor Comissão, com sumário do total de comissão.
  - Botões Visualizar, Imprimir (texto via `frmRelatorioDinamicoZ`, referenciado no dcu) e Sair.
- **Fonte de dados** [C], StoredProcName vindos do dfm:
  - `PROCEDURE_VENDA_CLIENTE(vdt1, vdt2, vNroForm, vCodCliente)`: SQL dinâmico concatenado, com risco de injeção. Busca faturas não canceladas do cliente, `tipofat` 1/3, vindas de `dbvenda.tipo in ('C','P')` via `dbfecharvendas`.
  - `FATURA_NAVEGA_PRODUTOS_FATURA(vcodfat)`: itens (`dbprodfat`, `dbprod`, `dbmarcas`, `dbvenda`).
  - `FILTRO_CODVENDEDOR` e `FILTRO_CODVENDEDOR_NOVO(vcodvenda, vnroform)`: vendedores da venda/fatura, via `vwRelVendCliGpp`.
  - `COMISSAO_CLIENTE(vcodfat, vcodprod, vcodvenda)` e `COMISSAO_TOTAL_CLIENTE(vcodfat)`: mesma UNION de `Comissao_Vendas`, mas por fatura e para todos os vendedores, usando `COMISSAO.Aliquota_Comissao`.
  - `FATURA.NAVEGA_PRAZOFAT(vcodfat)`: prazos.
- **Tabelas:** as mesmas do bloco Gerencial acima, mais `dbfecharvendas` (PG: 47 linhas) e `dbmarcas` (ok). Os mesmos bloqueios: `dbprodfat`/`dbvvend` sem histórico; `dbprod_comissao`, `dbclivend` e `vwRelVendCliGpp` ausentes.
- **Web hoje:** nada equivalente. `src/pages/api/faturamento/detalhes-venda.ts` e a consulta de faturas mostram itens, mas não a comissão por cliente.
- **Complexidade:** **M/G**. M se reaproveitar o motor de comissão que for definido no item anterior; G se for preciso replicar o `Aliquota_Comissao` isoladamente.
- **Bloqueios/dúvidas:**
  - .pas ausente: as regras de tela (como o check "Total" muda a saída, como os grupos com % diferenciado entram) só podem ser inferidas.
  - Três procedures INVALID no dicionário (provavelmente recompiláveis).
  - O relatório só considera Cautela/Pré-pedido (`dbfecharvendas`). Confirmar se esse recorte ainda faz sentido no web.

### Lista de Preço — FrmRelatorioGeral / tabListaPreco

- **Objetivo:** listar referência, descrição e preço de todos os produtos de um grupo ou de uma marca, na faixa de preço escolhida.
- **Filtros (front Delphi)** [C]:
  - Radio Grupo/Marca (default Grupo).
  - Código (5 dígitos, lookup de grupo ou marca).
  - Tipo de preço (obrigatório): Pr. Venda, Pr. Balcão, Revenda 1 (PRREV30), Revenda 2 (PRRV30), B. Vista (PRBV30), P. Velho (PRPV30).
  - Desconto %: **só é impresso no cabeçalho, não é aplicado ao preço** [C].
- **Saída** [C]: grid (Ref, Descr, Preço). Impressão em texto, 2 produtos por linha, com preview. Excel.
- **Fonte de dados:** `RELATO.LISTA_PRECO_PRODUTO(vCodigo, vTipo)` [I-forte: params `vTIPO`/`vCODIGO` e campos `PRVENDA`, `PRBALCAO`, `PRREV30`… batem]. Faz `SELECT P.Ref, P.Descr, P.PrVenda, Pr.PrBalcao, Pr.Prrev30, Pr.Prrv30, Pr.Prbv30, Pr.Prpv30 FROM dbprod P, dbpreco Pr`, filtrando por `codmarca` (M) ou `codgpp` (G), ordenado por ref.
- **Tabelas** [C]:
  - `dbprod` existe.
  - **`dbpreco` não existe** no PG. No Oracle tem 396.270 linhas.
  - Nenhuma tabela do PG tem as colunas `prbalcao`, `prrev30` etc.
  - O web usa `dbformacaoprvenda (CODPROD, TIPOPRECO, PRECOVENDA, …)`, com 3,17 milhões de linhas.
- **Web hoje:** não há tela de lista de preço. Há `src/pages/api/formacao-preco/*` e `src/pages/api/produtos/listaEnriquecida.ts`, que podem ser base.
- **Complexidade:** **P**. Uma consulta, desde que se mapeie "tipo de preço Delphi" para `dbformacaoprvenda.TIPOPRECO`.
- **Bloqueios/dúvidas:** definir o de-para das 6 faixas de preço Delphi para os `TIPOPRECO` do web. [I] Pode não haver correspondência 1:1.

### Saída de NEstocado — FrmRelatorioGeral / tabNaoEstocado

- **Objetivo:** ver quem comprou (e a que preço) produtos de uma referência ou prefixo, normalmente itens não estocados, no período.
- **Filtros (front Delphi)** [C]:
  - Período (dia 1 do mês até hoje).
  - Referência (obrigatória; `LIKE 'ref%'`; `*` ou vazio é ignorado).
  - Check Cliente + código do cliente (opcional).
  - **Vendedores (`dbusuario.cod_vend` preenchido) são barrados** com mensagem (`SaidadeNE1Click`).
- **Saída** [C]: grid gridNaoEstocado com Código, Ref, Descrição, Data, Nº Venda (tipo + nrovenda), Cliente, Pr. Unit, Qtd. Rodapé "Total de itens encontrados". Não há impressão nem Excel no código.
- **Fonte de dados** [C]: SQL direto (`dmConsulta.Consulta_Produto`), concatenado:
  `SELECT P.CODPROD, P.REF, P.DESCR, V.DATA, V.TIPO||V.NROVENDA, C.CODCLI||C.NOME, I.PRUNIT, I.QTD FROM DBPROD P, DBVENDA V, DBITVENDA I, DBCLIEN C WHERE REF LIKE :ref% AND V.CANCEL='N' AND V.DATA BETWEEN … [AND V.CODCLI=:cli] ORDER BY REF, DATA`
- **Tabelas** [C]: `dbprod`, `dbvenda`, `dbitvenda` e `dbclien` existem no PG com as colunas. Dados de venda até 2026-10-19.
- **Web hoje:** nada específico.
- **Complexidade:** **P**.
- **Bloqueios:** nenhum técnico. Reproduzir a restrição "vendedor não acessa" via permissão.

### Gerenciais › Extrato de Itens — FrmRelatorioGeral / tabExtItem

- **Objetivo:** extrato de movimentação de um produto no período (entradas, vendas, garantias, acertos, inventário, transferências), com saldo e preço médio de venda.
- **Filtros (front Delphi)** [C]:
  - Período (dia 1 do mês até hoje).
  - Produto (lookup por referência, `dmConsulta.Consulta(13)`).
  - Armazém (combo `cmbExt_Armazem`; existe só no dcu).
- **Saída** [C]:
  - Cabeçalho: descrição, marca, locação, estoque, disponível, transferido (via `cad_armazem_produto` e `cad_armazem_produto_locacao` no dcu).
  - Grid: Data, Documento, Cód. C/F, Nome C/F, Sit (E/S), Qtde, Preço.
  - Totais: entradas, saídas, saldo e preço médio de vendas (exclui documentos que começam com A ou G).
  - Usuário com `rel='N'` vê o preço de entrada zerado.
  - Impressão em texto. Excel.
- **Fonte de dados:**
  - Dcu: `CONSULTAPRODUTO.EXTRATO_ITEM(vcodprod, varm_id, vdt1, vdt2)` [I-forte: dcu tem `VARM_ID`, `VCODPROD`, `VDT1`, `VDT2`].
  - Versão antiga do .pas: `RELATO.EXTRATO_ITEM(vcodprod, vdt1, vdt2)`.
  - O package faz uma UNION de: garantias (`dbgarantiaprod`/`dbitgarantiaprod`), vendas (`dbvenda`/`dbitvenda` com `estoque_virtual='N'` e nº NF via `dbfecharvendas`/`dbfatura`), entradas (`dbent`/`dbitent`/`dbitent_armazem`/`dbcredor` + `quant_filial`), acertos (`dbacerto`), inventário (`dbinventario_melo`) e transferências entre armazéns (`arm_transferencia`/`arm_it_transferencia`/`cad_armazem`). Comportamento especial quando o armazém é 'GERAL'.
- **Tabelas** [C]:

| Tabela | No PG? | Observação |
|---|---|---|
| dbvenda, dbitvenda | sim | — |
| dbent, dbitent, dbcredor | sim | dbent: 2.662 linhas, até 2026-08-07 |
| cad_armazem, cad_armazem_produto, cad_armazem_produto_locacao | sim | — |
| dbitent_armazem | sim, quase vazia | 58 linhas |
| dbgarantiaprod, dbitgarantiaprod | sim, **vazias** | 0 linhas |
| arm_transferencia, arm_it_transferencia | sim, **vazias** | 0 linhas |
| dbinventario_melo | sim, antiga | 47 linhas, até 2011 |
| **dbacerto** | **não existe** | — |

- **Web hoje** [C]: existe `ExtratoItemModal.tsx` (cadastro de produtos) + `src/pages/api/produtos/extrato.ts`. **A API consulta tabelas que não existem no db_manaus** (`dbentradaitens`, `dbentrada`, `dbvendaitens`, `dbtransitens`, `dbdevolucaoitens`, `dbproduto`, `dbcliente`, `dbfornec`; verificado no information_schema). [I] Ela deve falhar ou retornar vazio.
- **Complexidade:** **M**. Muitos ramos, mas é SQL simples; dá para consertar a API existente.
- **Bloqueios/dúvidas:**
  - Decidir as fontes de movimento no web (garantia, transferência, acerto e devolução podem estar em outras tabelas do web).
  - `dbacerto` não migrada.

### Gerenciais › Listagem de Vendas — FrmRelatorioGeral / TabListagemVendas

- **Objetivo:** listar as vendas do período por dia (nº, cliente, valor, vendedor), com total por dia e total geral.
- **Filtros (front Delphi)** [C]:
  - Período (dia 1 do mês até hoje).
  - Todos os clientes, ou um cliente (código + lookup).
  - Tipo de documento: Todos, D1 ('1'), Pré-pedido ('P') ou Cautela ('C').
- **Saída** [C]: grid Data / Nº Venda / Cód / Nome Cliente / Vlr. Venda / Vendedor. Linhas "--- TOTAL DIA:" e "--- TOTAL GERAL:" destacadas. Impressão em texto.
- **Fonte de dados:** `RELATO.FILTRO_VENDAS(vTipoCli, vTipoDoc, vCodCli, vDt1, vDt2)` [I-forte: params `vCodCli`/`vTipoCli`/`vTipoDoc` só existem nela]. Faz `dbvenda` ⋈ `dbvvend` (`operador='N'`) ⋈ `dbclien`, com `cancel='N'`, ordenado por data e nrovenda.
- **Tabelas** [C]:
  - `dbvenda` e `dbclien` ok.
  - **`dbvvend` esparsa no PG.** Usar `dbvenda.codvend`, que existe e está preenchido (101 de 112 vendas em 2026).
- **Web hoje:** nada como relatório. A Central de Vendas lista vendas, mas sem totais por dia.
- **Complexidade:** **P**.
- **Bloqueios:** trocar `dbvvend` por `dbvenda.codvend`; confirmar os tipos de venda do web ('1', 'P', 'C').

### Gerenciais › Produto sem Demanda — FrmRelatorioGeral / TabProdSemDemanda

- **Objetivo:** produtos com estoque que entraram (entrada confirmada) no período e não tiveram nenhuma venda no período, por marca ou grupo.
- **Filtros (front Delphi)** [C]:
  - Período (dia 1 do mês até hoje).
  - Radio Marca/Grupo + código.
  - **Bug:** `VTIPO` é sempre 'M', mesmo com Grupo marcado (as duas ramas do `if` mandam 'M'). Na prática, "Grupo" filtra pelo código como se fosse marca.
- **Saída** [C]: grid (Grupo, Marca, CodProd, Ref, Descr, QtEst, Pr. Compra, Custo Atual; colunas do SELECT). Excel.
- **Fonte de dados** [C]: `PRODUTO_SEM_DEMANDA(vDtIni, vDtFim, vTipo, vCod)` [I-forte pela assinatura única]. SQL dinâmico:
  - `dbprod` (`qtest>0`) ⋈ `dbmarcas` ⋈ `dbgpprod` ⋈ `dbent`(`status='F'`, `dtent` no período) ⋈ `dbitent`;
  - `codprod NOT IN` (vendas não canceladas no período, mesma marca ou grupo).
- **Tabelas** [C]: todas existem no PG (`dbent`: 2.554 confirmadas, até 2026-08-07).
- **Web hoje:** nada.
- **Complexidade:** **P**.
- **Bloqueios:** confirmar se `dbprod.qtest` ainda é o estoque no web ou se deve usar `cad_armazem_produto.arp_qtest`. Corrigir o bug de Grupo.

### Gerenciais › Listagem de Vendas - diária — FrmRelatorioGeral / tabListagem_Vendas_Diarias

- **Objetivo:** listagem item a item das vendas do período, por documento, com situação, total por venda e totais cancelado/válido separados entre "Melo" e "Ferramenta".
- **Filtros (front Delphi)** [C]:
  - Período (dia 1 do mês até hoje).
  - Radio D1, Cautela, Pré-pedido ou Pré-nota.
- **Saída** [C]:
  - Por documento: cabeçalho "---- No. DOCTO" com a situação:
    - vendas: cancelada / aguardando liberação / liberada aguardando faturamento / faturada;
    - pré-nota: emitiu ou não emitiu cupom.
  - Itens: Ref, Marca, Descr, Qtde, Pr. Unit, Pr. Total.
  - Total por venda e totais finais: cancelado e válido. Para D1 e Pré-nota, separa Melo × Ferramenta por **lista hard-coded de `codusr` ('0044','0140','0104','0141','0160','0030','0164')**.
  - Impressão em texto com 4 títulos (D1, Cautela, Pré-pedido, Pré-nota).
- **Fonte de dados:**
  - `RELATO.LISTAGEM_VENDAS(vdt1, vdt2, vtipo)` [I-forte: params + campos `CODVENDA`, `SIT`, `REF`, `DESCMARCA`, `QTD`, `PRUNIT`, `PRTOTAL`, `CODUSR` batem]. Faz `dbvenda` ⋈ `dbitvenda` ⋈ `dbprod` ⋈ `dbmarcas`; `sit` = status, ou 'C' se cancelada.
  - Opção Pré-nota: `PRENOTA.LISTAGEM_PRENOTA(vdt1, vdt2)` [I-forte: campos `CODPRE`, `NROPRE`, `DTCANCEL`, `CODUSR`, `PRLIQUIDO` só batem com o PRENOTA; o `RELATO.LISTAGEM_PRENOTA` devolve `CODORC`/`NROORC`]. Faz `dbprenota` ⋈ `dbitprenota` ⋈ `dbprod` ⋈ `dbmarcas` ⟕ `dbvenda`.
- **Tabelas** [C]:
  - `dbvenda`, `dbitvenda`, `dbprod` e `dbmarcas` ok.
  - **`dbprenota` existe no PG, mas vazia e só com 3 colunas** (`codvenda`, `cancel`, `dtcancel`; faltam `codpre`, `nropre`, `data`, `total`, `codusr`). No Oracle tem 240.778 linhas.
  - **`dbitprenota` não existe.**
- **Web hoje:** nada.
- **Complexidade:** **P** para D1, Cautela e Pré-pedido. A opção Pré-nota depende de migração ou de abandono.
- **Bloqueios/dúvidas:**
  - Pré-nota (balcão/cupom) existe no web?
  - A lista de usuários "Ferramenta" é hard-coded: transformar em parâmetro ou cadastro.

### Gerenciais › Vendas Telemarketing por Vendedor — FrmRelatorioGeral / TabVendasTmk

- **Objetivo:** vendas de telemarketing (`tele='S'`) em que o vendedor informado participa (como operador ou não), mostrando o outro vendedor da venda, com total por dia.
- **Filtros (front Delphi)** [C]:
  - Período (dia 1 do mês até hoje).
  - Vendedor (lookup).
  - Check "Operador": 'S' ou 'N'.
- **Saída** [C]:
  - Grid Data, Nº Venda, Cód/Nome Cliente, Usuário, Total, Cód/Nome Vendedor, com "---TOTAL DIA" e "---TOTAL GERAL".
  - **O loop Delphi descarta as linhas cujo `CodVend` é o próprio vendedor filtrado**: lista o(s) parceiro(s) da venda e só soma esses.
  - Excel (`Copia_Para_Excel`).
- **Fonte de dados:** `RELATO.VENDAS_TELEMKT(vDt1, vDt2, vOperador, vCodVend)`. O comentário no próprio PL/SQL diz "frmRelatorioGeral - Vendas de Telemkt" [C]. Faz `dbvenda` ⋈ `dbvvend` ⋈ `dbclien` ⋈ `dbvend` ⋈ `dbusuario`, para vendas em que `dbvvend.codvend=:v AND operador=:op`.
- **Tabelas** [C]: todas existem, mas **a regra depende de `dbvvend` (vários vendedores por venda + flag operador)**, que no PG está esparsa.
- **Web hoje:** nada.
- **Complexidade:** **M**. A consulta é simples; a dificuldade é o modelo de dados.
- **Bloqueios:** o web registra mais de um vendedor por venda e o papel "operador"? `dbvenda.codvend` e `dbitvenda.codvend` cobrem só 1 vendedor por item. Sem isso o relatório não faz sentido.

### Gerenciais › Faturamento do 2o. Vendedor nos Grupos — FrmRelatorioGeral / tabFaturamentoGrupo

- **Objetivo:** total faturado, por cliente, nos grupos de produto e clientes da carteira do vendedor (o "2º vendedor").
- **Filtros (front Delphi)** [C]: período (dia 1 do mês até hoje) e vendedor (lookup).
- **Saída** [C]:
  - Grid Código, Nome Cliente, Total + rótulo com o total faturado para o vendedor.
  - Impressão em texto. Excel.
  - Toda ação grava log `dmConsulta.Inc_LogRelGerencial(UCod, '14', …)`: 1 = visualizar, 2 = imprimir, 3 = excel.
- **Fonte de dados:** `RELATO.FATURA_VENDEDOR_GRUPO(vDtInicial, vDtFinal, vCodVend)` [I-forte: única com `VDTINICIAL,VDTFINAL,VCODVEND`; campos `CODCLI`/`NOME`/`TOTAL` batem]. Faz `dbfatura` ⋈ `dbprodfat` ⋈ `dbprod` ⋈ `dbvenda` ⋈ `dbclien` ⋈ (`dbVendGpp` × `dbCliVend` do vendedor), com `tipofat<>'2'`, `tipodest='C'`, `cancel='N'`, agrupado por cliente.
- **Tabelas** [C]:
  - `dbvendgpp` ok (673).
  - **`dbclivend` não existe.**
  - **`dbprodfat` sem histórico.**
  - Tabela de log do `Inc_LogRelGerencial` não identificada ([I] algo como `dblogrelgerencial`, que não existe no PG).
- **Web hoje:** nada. O cadastro de vendedores web mexe em `dbvendgpp` (`src/pages/api/vendedores/*`, `data/vendedores/schemas.ts`), mas não na carteira de clientes.
- **Complexidade:** **P** em SQL, mas depende de dados.
- **Bloqueios:** migrar `dbclivend` (carteira cliente × vendedor) ou equivalente no web. Itens de fatura (`dbprodfat`/`fatura_venda`).

### Estoque Suprido — FrmRelatorioGeral / TabSuprido

- **Objetivo:** produtos que estavam zerados (`quantant=0`) e foram supridos por entrada confirmada no período.
- **Filtros (front Delphi)** [C]: período (dia 1 do mês até hoje), enviado como string `yyyymmdd`.
- **Saída** [C]:
  - Grid CODPROD, REF, APLIC_EXTENDIDA, MARCA, QUANTANT, QUANT, DTENT (+ DISP).
  - Impressão em texto. Excel.
  - Bug: o rodapé da impressão reaproveita "TOTAL FATURADO PARA O VENDEDOR".
- **Fonte de dados** [C]: `ESTOQUE_SUPRIDO(vDtInicial, vDtFinal)` [I-forte: assinatura e campos batem exatamente].
  - Faz `dbent`(`status='F'`) ⋈ `dbitent`(`quantant='0'` e `quant − quant_filial > 0`) ⋈ `dbprod` ⋈ `dbmarcas` ⋈ **`dbacao`** (`tabela='DBENT'`, `acao='CONFIRMAR ESTOQUE'`, `obs='COD:'||codent`).
  - A data filtrada é a da ação de confirmação.
- **Tabelas** [C]:
  - Todas existem no PG.
  - **No PG, `dbacao` não tem nenhum registro com `tabela='DBENT'`**: o web não grava a ação "CONFIRMAR ESTOQUE". O filtro por data precisa vir de outro campo (data de confirmação da entrada no web, a identificar).
- **Web hoje:** nada.
- **Complexidade:** **P**.
- **Bloqueios:** definir no web qual campo marca "estoque confirmado" da entrada.

### Metas de venda por Perfil — FrmPerfilGpp

- **Objetivo:** módulo de cadastro + acompanhamento.
  - Perfis (conjuntos de grupos de produto) por filial ("melo": 1 MAO, 2 PVH, 3 REC, 4 FLZ, 5 CCCC, 6 CSAC, 7 JPS).
  - Equipe: gerente → coordenador → vendedor.
  - Metas por grupo e por membro.
  - **Desempenho:** realizado em 3, 6 e 12 meses (total e média) × meta × mês atual, por vendedor, coordenador ou gerente, no período ou em um mês escolhido (últimos 12 meses).
- **Filtros (front Delphi)** [C]:
  - Filial (combo, ou TODAS).
  - Pesquisa de perfil por texto.
  - Mês (combo dos 12 meses anteriores).
  - Seleção do membro da equipe nos grids.
  - Visibilidade dos botões por permissões do usuário (`stoUsuario`: `mpp_nv`, `mpp_equ`, `mpp_ger`, `mpp_ecv`).
- **Saída** [C]:
  - Grids de perfis, grupos, equipe e metas.
  - Painel de desempenho com totais (`AtualizaTotais`).
  - Excel (`btnExcel`, `Save`).
  - É mais tela de gestão do que relatório.
- **Fonte de dados** [C]: **package `PERFIL_GPP`** (nomes deduzidos pelas assinaturas; não há dfm).
  - Navegação/cadastro: `NAVEGA_FILIAL`, `GER_PERFIL_GPP`, `INC/DEL_PERFIL_GPP_DET(_AUX)`, `NAV_PERFIS_GPP(_DET)`, `INC/DEL_MEMBRO_EQUIPE(_PERFIS)`, `NAV_GERENTES/COORDENADORES(_PERFIL)/VENDEDORES`, `NAV_GP_PRODUTOS_PERFIL`, `VALIDA_CADASTRO_GERENTE`.
  - Metas: `GER_PERFIL_GPP_META`.
  - Desempenho: `CONS_DESEMPENHO_VEND_PERIODO/_MES`, `CONS_DESEMPENHO_GERCOO_PERIODO/_MES`.
  - Equipe por perfil: `NAV_PERFIS_EQUIPE`, `DEL_PERFIS_EQUIPE`.
  - O desempenho lê **`VW_PERFIL_VENDA`, que não existe**, além de `VW_PERFIL_FATURA_MELO`, `VW_PERFIL_EQUIPE` e `dbperfil_gpp_metas`.
- **Tabelas** [C]: **nenhuma existe no PG**: `dbperfil_gpp`, `dbperfil_gpp_det`, `dbperfil_gpp_metas`, `dbperfil_vendedor`, `dbperfil_gerente`, `dbperfil_coordenador`, `dbgerente_gpp`, `dbcoordenador_gpp`, `dbvendedor_gpp`. No Oracle: `dbperfil_gpp` 7 linhas, `dbperfil_gpp_metas` 6.234, `dbperfil_vendedor` 88.
- **Web hoje:** nada.
- **Complexidade:** **G**. Módulo CRUD com 25 procedures + views de faturamento, com hierarquia e metas.
- **Bloqueios/dúvidas:**
  - **O package body está INVALID no Oracle (falta `VW_PERFIL_VENDA`)**. [I] A tela já não funciona no Delphi.
  - Confirmar com o usuário se ainda é usado antes de migrar.
  - Nenhuma tabela foi migrada.

### Metas de venda por Cliente — UnitFrmMetasClientes

- **Objetivo:** campanhas de fidelização ("segmentos").
  - Período de vigência por filial; itens do segmento (marcas ou grupos); clientes do segmento.
  - Meta R$ por cliente × linha.
  - Lote promocional.
  - **Acompanhamento Mensal:** valor bruto, devolução, líquido, meta e **pontos** (1 ponto a cada R$100 quando líquido ≥ meta, por mês da campanha).
- **Filtros (front Delphi)** [C pelo dfm]: Melo (filial), segmento, cliente; datas início/fim no cadastro do segmento.
- **Saída** [C]: grids Segmentos, Clientes do segmento, Metas do cliente (Linha, Código, Meta R$), Itens do segmento, Itens do lote, Acompanhamento Mensal (MELO, SEGMENTO, LINHA, CODCLI, NOME, VALORBRUTO, DEVOLUCAO, VALORLIQUIDO, META, PONTOS).
- **Fonte de dados** [C] (StoredProcName no dfm):
  - Segmentos e itens: `PERFIL_GPP.CONS/INC/ALT/DEL_SEGMENTO`, `CONS/INC/DEL_ITENS_SEGMENTO`.
  - Clientes e metas: `CONS/INC/DEL_CLIENTE_SEGMENTO`, `CONS/INC_METAS_CLIENTE`.
  - Lote promocional: `CONS/INC_LOTE_PROMOCIONAL`, `DEL_ITEM_LOTE_PROMOCIONAL`.
  - `ACOMPANHAMENTO_MENSAL`: lê a tabela `dbcliente_fideliza`. A função `PONTOS_CLIENTE` calcula sobre `dbfatura`/`dbprodfat`/`dbcampconf_2014`/`dbmetascampconf_2014`/`dbcfop_saida`.
  - Produtos: `NFE_ENTRADA.CON_PROD`.
- **Tabelas** [C]: nenhuma existe no PG (`dbcampseg_2014`, `dbcampconf_2014`, `dbmetascampconf_2014`, `dbcliente_fideliza`, `dblote_promocional`, `dbcfop_saida`). No Oracle, `dbcampseg_2014` tem só 4 segmentos, **o último terminando em 2015-01-10**.
- **Web hoje:** nada.
- **Complexidade:** **G**, se fosse migrar.
- **Bloqueios:**
  - **Usa o mesmo package `PERFIL_GPP` INVALID**: [I] quebrado no Delphi.
  - Dados de campanha parados desde 2015.
  - **Candidato forte a NÃO migrar** (confirmar com o usuário).

### Acompanhamento de Vendas — FrmMasterConsulta

- **Objetivo:** painel gerencial com dois modos.
  - **(a) Faturamento:** por Região × Grupo de Faturamento × Cliente, com drill-down.
  - **(b) Vendedor:** objetivo × atingido por vendedor (com gerente e coordenador), faixas de meta (01–05), normal × telemarketing, % e drill-down por grupo/marca.
- **Filtros (front Delphi)** [C]:
  - Data inicial (dia 1 do mês) e final (hoje), validadas (inicial ≤ final).
  - Tipo (combo: 0 = Faturamento, 1 = Vendedor).
  - Vendedor ou check "Todos" (obrigatório no modo Vendedor).
- **Saída** [C]:
  - Grids `dxDBGFaturamento` (região com subtotal "REGIÃO : R$", grupo "DESCR : R$") → `dxDBGDetalhado` (cliente).
  - `dxDBGVendedor`: GERENTE, COORDENADOR, CODVEND, NOME, TOTAL_OBJETIVO, ID_ATINGIDO, TOTAL_ATINGIDO, OBJ_X_NOR, TOTAL_NORMAL, TOTAL_TMK, NOR_X_ATIN, TOTAL_GP, TOTAL_MA → `dxDBGDetalhadoGrupo`.
  - Excel (`SaveToXLS` ou `Copia_Para_Excel`).
- **Fonte de dados** [C] (package `SUPER_MASTER`, VALID; nomes por assinatura, porque não há dfm):
  - `CONSULTAR_REGIAO(pREGIAO, pFATURAMENTO, pFILTRO, pDATA1, pDATA2)`: para cada `DBREGIAO`, monta SQL dinâmico. **`DBREGIAO.CONTEUDO` é um trecho de WHERE gravado na tabela.**
    - Faturas e vendas ⋈ `dbbairro` ⋈ `dbgpprod` ⋈ `DBGRUPO_FATURAMENTO_SEGMENTO`/`DBGRUPO_FATURAMENTO` ⋈ `DBVENDEDOR` ⋈ `DBCOORDENADOR` ⋈ `DBREGIAO_GERENTE`.
  - `CALCULA_VEND_TMP(pDATA1, pDATA2, pCODVEND, pCODUSR, pEXPLODIR)`:
    - Para cada vendedor (`dbvend` ⋈ `dbvendedor` ⋈ `dbcoordenador` ⋈ `dbgerente`, `codcv<>'001'`), chama **`COMISSAO.TotalTipoVenda2`**.
    - Separa normal × tmk e compara com `dbvend.valobj/valobjm/valobjf/valobjsf`.
    - Grava em `DBVENDEDOR_TMP` por `codusr`.
    - Com `pEXPLODIR='SIM'`, detalha por grupo/marca com `dbvendedor_meta`/`dbvendedor_meta_marca` → `dbvendedor_tmp_gpp/_marca`.
  - `spTOTAIS` é declarado, mas só fechado no código.
- **Tabelas** [C]:
  - `dbvendedor` (76), `dbvendedor_tmp` (47), `_gpp` e `_marca` existem.
  - `dbvend` tem as colunas `valobj*`. `dbbairro` e `dbsegmento` existem.
  - **Não existem:** `dbregiao` (Oracle: 3 linhas), `dbregiao_gerente`, `dbgrupo_faturamento`, `dbgrupo_faturamento_segmento`, `dbcoordenador`, `dbgerente`, `dbvendedor_meta` (Oracle: 717), `dbvendedor_meta_marca` (Oracle: 1.178).
  - `dbprodfat` e `dbvvend` sem histórico.
- **Web hoje:** nada. `src/components/corpo/vendas/dashboard` é outro painel.
- **Complexidade:** **G**. Hierarquia gerente/coordenador, regiões com WHERE dinâmico vindo do banco, reaproveita a regra `COMISSAO.TotalTipoVenda2`, tabelas temporárias por usuário e 8 tabelas não migradas.
- **Bloqueios/dúvidas:**
  - Migrar o cadastro "Super Master" (regiões, grupos de faturamento, gerentes, coordenadores, metas) ou redesenhar.
  - O WHERE dinâmico em `dbregiao.conteudo` precisa virar regra estruturada no web.

### Vendas Desbloqueadas — frmRelatorioVendaDesbloqueada

- **Objetivo:** auditoria das vendas que estavam bloqueadas (margem/crédito) e foram desbloqueadas: quem, quando, de qual máquina, totais e margens.
- **Filtros (front Delphi)** [C]:
  - Período (dia 1 do mês até hoje).
  - Todos ou um cliente.
  - Fatura: Faturadas, Não Faturadas ou Todas (default Todas).
  - Tipo de venda: Venda, Garantia, Devolução ou Todas (default Todas).
  - Localizar Nº venda.
- **Saída** [C]:
  - Grid dinâmico: Nro. Venda, Cliente, Total Venda, Total Compra, Margem Compra(%), Total Médio, Margem Médio(%), Data, Hora, Usuário, Usuário da Rede, IP, Máquina, STATUS.
  - **As colunas de rede/IP/máquina e o botão "Ver Usuários" só aparecem se o perfil do usuário for 'DIRETORIA'**. "Ver Usuários" lista quem tem `Ven_Desb='S'` por setor.
  - Duplo clique abre o detalhe da venda: vendedor/operador, itens com Ref, Marca, Grupo, Qtd, Pç.unit, Pç.Rev30, % desconto concedido, Pç.compra, % s/ compra, Pç.médio, % s/ médio, e margens totais.
  - Impressão via VDOPrinter. Excel.
- **Fonte de dados** [C]:
  - `VENDAS_OPERACOES.HISTORICO_DESBLOQUEADAS(vTipo, vCodCli, vFatura, vTipoVenda, vdt1, vdt2)`: `DBVENDA_DESBLOQUEADA_HISTORICO` ⋈ `dbvenda` ⋈ `dbclien` ⋈ `dbusuario` ⋈ `dbprodfat` ⋈ **`XAUD_DBVENDA`** (`status_anterior='B'`), agrupado. Vários ramos `IF` por combinação de filtros.
  - `VENDAS_OPERACOES.ITVENDA_BLOQUEADA(vCodVenda)`: `dbitvenda` ⋈ `dbprod` ⋈ `dbmarcas` ⋈ **`dbpreco`** ⋈ `dbgpprod`.
  - `VENDAS.VENDEDOR_VENDA`, `PKG_PERFIL_USUARIO.PERFIL_USUARIO/CONSULTA_SETOR`, `VENDAS_OPERACOES.CONSULTA_USUARIOS`.
  - O histórico é alimentado pelo trigger `TRG_AUD_DBVENDA` e pelo package `VENDAS_OPERACOES`.
- **Tabelas** [C]: **não existem no PG** `dbvenda_desbloqueada_historico` (Oracle: 483.095 linhas, até 2026-08-15), `xaud_dbvenda` e `dbpreco`.
  - O web libera venda bloqueada em `src/pages/api/vendas/analise-liberacao.ts` (`UPDATE dbvenda SET status='N'`) e registra em **`dbanalise_liberacao` (id, codvenda, resultado, motivo, usuario, dt_inicio, dt_conclusao; 11 linhas)**. Não guarda totais, margens, IP nem máquina.
- **Web hoje:** tela "Vendas Bloqueadas" (`src/components/corpo/vendas/bloqueadas`, `ModalAnaliseLiberacao.tsx`) faz a liberação. Não há relatório histórico.
- **Complexidade:** **M**. Relatório novo sobre `dbanalise_liberacao` + cálculo de margem ao vivo. Paridade total (IP/máquina, histórico antigo) exige migrar as tabelas de auditoria.
- **Bloqueios/dúvidas:**
  - Histórico Oracle não migrado.
  - O web não registra margens e máquina na liberação; [I] seria preciso gravar um snapshot no momento da liberação.
  - Faltam o de-para de "perfil DIRETORIA" e da permissão `Ven_Desb` no web.

### Saída de Produto por Vendedor — frmExtratoVendedor

- **Objetivo:** quantidade de uma referência vendida por vendedor no período, separada em D1, Operador (tmk) e Externo.
- **Filtros (front Delphi)** [C]:
  - Período (dia 1 do mês até hoje).
  - Referência (obrigatória, lookup `Consulta(13)`).
- **Saída** [C]:
  - Grid agrupável Vendedor / Tipo de Venda / Quantidade (+ NROFORM e MARCA calculados por linha via `EXTRATO_DETALHADO_ZOOM`, mas o cursor não traz CODVENDA, então o NROFORM fica vazio).
  - Excel.
- **Fonte de dados** [C]: `EXTRATO_VENDEDOR(vREF, vdt1, vdt2)`. UNION de:
  - D1: `dbvenda.tipo='1'` ⋈ `dbitvenda` ⋈ `dbvvend` ⋈ `dbvend`;
  - Operador: fatura ⋈ `dbprodfat` com `venda.tele='S'` e `operador='S'`;
  - Externo: `tele='N'` e `operador='N'`.
  - Exclui os clientes `'03341','04487','00002'` (hard-coded).
- **Tabelas** [C]: todas existem, mas **dependem de `dbvvend` e `dbprodfat`**, sem histórico no PG.
- **Web hoje:** nada.
- **Complexidade:** **P** em SQL; **M** considerando a adaptação ao modelo web (vendedor e operador por venda).
- **Bloqueios:** mesmo problema de `dbvvend`/operador. Lista de clientes excluídos hard-coded (o que são 03341/04487/00002? [I] clientes internos ou da própria Melo).

---

## Tabela resumo

| Relatório | Form/Aba | Complexidade | Bloqueio principal | Web existe? |
|---|---|---|---|---|
| Comissão do Vendedor (modo vendedor) | FrmRelatorioComissao | P (depois do Gerencial) | Mesmo motor do Gerencial | Parcial: "Comissão de Vendedor" com regra diferente |
| Relação Comissão por Vendedor – Gerencial/Financeiro | FrmRelatorioComissao | G | Regra COMISSAO (9 ramos + exceções); `dbprod_comissao`/`dbclivend`/`dbgpfaturareceb` ausentes; diverge da comissão web | Parcial, regra diferente (`src/pages/api/comissao`) |
| Relação para Comissão por Cliente | FrmConsulta_comissao_por_cliente | M/G | .pas ausente; procs INVALID; mesmas tabelas de regra | Não |
| Lista de Preço | FrmRelatorioGeral/tabListaPreco | P | `dbpreco` inexistente; de-para p/ `dbformacaoprvenda.TIPOPRECO` | Não (há APIs de formação de preço) |
| Saída de NEstocado | FrmRelatorioGeral/tabNaoEstocado | P | Nenhum | Não |
| Extrato de Itens | FrmRelatorioGeral/tabExtItem | M | `dbacerto` ausente; tabelas vazias; API web atual aponta p/ tabelas inexistentes | Sim, mas quebrada (`api/produtos/extrato.ts`) |
| Listagem de Vendas | FrmRelatorioGeral/TabListagemVendas | P | Trocar `dbvvend` por `dbvenda.codvend` | Não |
| Produto sem Demanda | FrmRelatorioGeral/TabProdSemDemanda | P | Bug Grupo/Marca; estoque por armazém? | Não |
| Listagem de Vendas – diária | FrmRelatorioGeral/tabListagem_Vendas_Diarias | P (+ Pré-nota bloqueada) | `dbprenota` vazia/incompleta, `dbitprenota` ausente; usuários "Ferramenta" hard-coded | Não |
| Vendas Telemarketing por Vendedor | FrmRelatorioGeral/TabVendasTmk | M | Modelo multi-vendedor/operador (`dbvvend`) inexistente no web | Não |
| Faturamento do 2o. Vendedor nos Grupos | FrmRelatorioGeral/tabFaturamentoGrupo | P (SQL) | `dbclivend` ausente; `dbprodfat` sem histórico | Não |
| Estoque Suprido | FrmRelatorioGeral/TabSuprido | P | `dbacao` 'CONFIRMAR ESTOQUE' não gravado pelo web | Não |
| Metas de venda por Perfil | FrmPerfilGpp | G | Package PERFIL_GPP INVALID; 9 tabelas não migradas; uso atual duvidoso | Não |
| Metas de venda por Cliente | UnitFrmMetasClientes | G (ou descartar) | PERFIL_GPP INVALID; campanha parada desde 2015 | Não |
| Acompanhamento de Vendas | FrmMasterConsulta | G | 8 tabelas Super Master ausentes; WHERE dinâmico em `dbregiao`; usa COMISSAO.TotalTipoVenda2 | Não |
| Vendas Desbloqueadas | frmRelatorioVendaDesbloqueada | M | Histórico/auditoria não migrados; web só grava `dbanalise_liberacao` | Parcial: tela de liberação, sem relatório |
| Saída de Produto por Vendedor | frmExtratoVendedor | P/M | `dbvvend`/operador; `dbprodfat` sem histórico | Não |

## Procedures / packages Oracle envolvidos no grupo A

Fonte: [C] = confirmado no dfm ou no PL/SQL; [I] = deduzido pela assinatura.

**COMISSAO** (package, VALID)
- `COMISSAO_VENDEDOR` [C], `LIMPAR_DBCOMISSAO` [C]
- Internas: `CARREGA_TABELAAUX`, `COMISSAO_VENDAS`, `ALIQUOTA_COMISSAO`, `PRAZO_MEDIO`, `VERIFICA_RECEBIMENTO`, `TOTALGPPRODDIF`
- `TOTALTIPOVENDA2`, usada por SUPER_MASTER

**Procedures avulsas do Comissão por Cliente** [C, dfm]
- `PROCEDURE_VENDA_CLIENTE` (VALID)
- `FATURA_NAVEGA_PRODUTOS_FATURA` (VALID)
- `FILTRO_CODVENDEDOR`, `FILTRO_CODVENDEDOR_NOVO` (INVALID)
- `COMISSAO_CLIENTE` (INVALID)
- `COMISSAO_TOTAL_CLIENTE` (INVALID)
- `FATURA.NAVEGA_PRAZOFAT`

**RELATO** (package, VALID)
- `LISTA_PRECO_PRODUTO` [I-forte]
- `FILTRO_VENDAS` [I-forte]
- `LISTAGEM_VENDAS` [I-forte]
- `VENDAS_TELEMKT` [C: comentário no fonte]
- `FATURA_VENDEDOR_GRUPO` [I-forte]
- `EXTRATO_ITEM` (versão antiga do .pas) [I]

**Outros packages e procedures**
- `PRENOTA.LISTAGEM_PRENOTA` [I-forte]
- `CONSULTAPRODUTO.EXTRATO_ITEM` (com `VARM_ID`, versão do dcu) [I-forte]
- `ESTOQUE_SUPRIDO` (procedure) [I-forte]
- `PRODUTO_SEM_DEMANDA` (procedure) [I-forte]
- `EXTRATO_VENDEDOR` e `EXTRATO_DETALHADO_ZOOM` (procedures) [C, dfm]

**PERFIL_GPP** (package; **BODY INVALID**)
- Metas por Perfil [I-forte, por assinatura]: `NAVEGA_FILIAL`, `GER_PERFIL_GPP`, `INC_PERFIL_GPP_DET`, `INC_PERFIL_GPP_DET_AUX`, `NAV_PERFIS_GPP`, `NAV_PERFIS_GPP_DET`, `DEL_PERFIL_GPP_DET`, `INC_MEMBRO_EQUIPE`, `INC_MEMBRO_EQUIPE_PERFIS`, `DEL_MEMBRO_EQUIPE`, `NAV_COORDENADORES_PERFIL`, `VALIDA_CADASTRO_GERENTE`, `NAV_GERENTES`, `NAV_COORDENADORES`, `NAV_VENDEDORES`, `NAV_GP_PRODUTOS_PERFIL`, `GER_PERFIL_GPP_META`, `CONS_DESEMPENHO_VEND_PERIODO`, `CONS_DESEMPENHO_GERCOO_PERIODO`, `CONS_DESEMPENHO_VEND_MES`, `CONS_DESEMPENHO_GERCOO_MES`, `NAV_PERFIS_EQUIPE`, `DEL_PERFIS_EQUIPE`
- Metas por Cliente [C, dfm]: `CONS_SEGMENTO`, `INC_SEGMENTO`, `ALT_SEGMENTO`, `DEL_SEGMENTO`, `CONS_ITENS_SEGMENTO`, `INC_ITENS_SEGMENTO`, `DEL_ITENS_SEGMENTO`, `CONS_CLIENTE_SEGMENTO`, `INC_CLIENTE_SEGMENTO`, `DEL_CLIENTE_SEGMENTO`, `CONS_METAS_CLIENTE`, `INC_METAS_CLIENTE`, `CONS_LOTE_PROMOCIONAL`, `INC_LOTE_PROMOCIONAL`, `DEL_ITEM_LOTE_PROMOCIONAL`, `ACOMPANHAMENTO_MENSAL`, função `PONTOS_CLIENTE`
- `NFE_ENTRADA.CON_PROD` [C, dfm]

**SUPER_MASTER** (package, VALID)
- `CONSULTAR_REGIAO`, `CALCULA_VEND_TMP` [I-forte]

**Vendas Desbloqueadas** [C, dfm]
- `VENDAS_OPERACOES.HISTORICO_DESBLOQUEADAS`, `VENDAS_OPERACOES.ITVENDA_BLOQUEADA`, `VENDAS_OPERACOES.CONSULTA_USUARIOS`
- `VENDAS.VENDEDOR_VENDA`
- `PKG_PERFIL_USUARIO.PERFIL_USUARIO`, `PKG_PERFIL_USUARIO.CONSULTA_SETOR`
- Trigger `TRG_AUD_DBVENDA` (alimenta `XAUD_DBVENDA` e `DBVENDA_DESBLOQUEADA_HISTORICO`)

**Views Oracle**
- `VWRELVENDCLIGPP` (= `dbCliVend` ⋈ `dbVendGpp`)
- `VW_PERFIL_EQUIPE`, `VW_PERFIL_FATURA_MELO`
- `VW_PERFIL_VENDA` (**não existe**)
- `VW_PERFIL_FATURA_CLI` (MV INVALID)

**SQL direto no Delphi (sem procedure)**
- Saída de NEstocado: `dbprod`/`dbvenda`/`dbitvenda`/`dbclien`
- Cabeçalho do Extrato de Itens: `cad_armazem_produto`, `cad_armazem_produto_locacao`
