# Regras de Importação — Distribuidora de Autopeças (Manaus / ZFM)

Referência para auditoria do módulo de importação/compras do Sysmelo.
Data base: outubro/2026. Alíquotas e enquadramentos devem ser confirmados com a contabilidade.
Cada regra tem um ID para ser citado no relatório de gaps.

---

## A. Fluxo e entidades esperadas

- **A1** Existe entidade de **Processo/Declaração de Importação** (DI ou DUIMP) com: número, data de registro, local de desembaraço, UF, data do desembaraço, via de transporte, forma de importação (1-conta própria, 2-conta e ordem, 3-encomenda), CNPJ do adquirente/encomendante quando forma 2 ou 3.
- **A2** Existe entidade de **Adição** vinculada à DI: número da adição, sequencial, fabricante, NCM, valor.
- **A3** Cada item da NF de importação está vinculado a uma adição (nAdicao, nSeqAdic, cFabricante).
- **A4** Suporte a **DUIMP** (não só DI), pois a DUIMP está substituindo a DI.
- **A5** Registro da **inscrição SUFRAMA** da empresa e do licenciamento/anuência da importação (condição para benefícios de ZFM e de IBS).
- **A6** Moeda estrangeira e **taxa de câmbio da data de registro da DI/DUIMP**, gravada e imutável após o registro.

## B. NF-e de entrada de importação (nota de nacionalização)

- **B1** tpNF = 0 (entrada), emitida pelo próprio importador.
- **B2** Destinatário = exportador estrangeiro: UF "EX", cMun 9999999, xMun "EXTERIOR", cPais preenchido, idEstrangeiro (sem CNPJ/CPF).
- **B3** CFOP série 3: 3.102 (comercialização) como padrão da distribuidora; 3.101 industrialização; 3.949 outras.
- **B4** Validação: CFOP 3.xxx ⇔ destinatário exterior ⇔ grupo DI preenchido (os três juntos, nunca isolados).
- **B5** Grupo DI completo: nDI, dDI, xLocDesemb, UFDesemb, dDesemb, tpViaTransp, vAFRMM (se marítimo), tpIntermedio, CNPJ/UFTerceiro quando aplicável, cExportador.
- **B6** Grupo II por item: vBC, vDespAdu, vII, vIOF.
- **B7** CST ICMS com origem **1** (estrangeira — importação direta).
- **B8** A origem do produto é derivada da entrada e propagada para as vendas (não digitada manualmente na venda).
- **B9** Totais: vNF segue a fórmula do leiaute (vProd − vDesc − vICMSDeson + vST + vFrete + vSeg + vOutro + vII + vIPI + vServ). PIS, COFINS, Siscomex e ICMS são lançados em vOutro conforme padrão definido com a contabilidade. **Verificar se o padrão está parametrizável.**
- **B10** **DI com múltiplos exportadores → emissão da nota** (padrão confirmado pelo Delphi; pontos fiscais finos a confirmar com a contabilidade):
  - **Padrão `POR_DI` (= legado MELO)**: uma única NF-e para a DI; **`cExportador`, nº da adição e seq. do item vão POR ITEM** (confirmado em `UniFrmFaturamentoUnificado.pas` → proc Oracle `INC_PRODFAT_IMPORTACAO_AUX`, que grava os dados da DI por produto da nota). Cada item com CFOP série 3 exige seus dados de DI (grupo DI + grupo II por item).
  - **Alternativa `POR_EXPORTADOR`**: uma NF-e por **exportador da adição** — bate 1:1 com invoice/contrato de câmbio (contas a pagar) e referencia a adição certa em devolução/avaria. Opção parametrizável, não é como o MELO opera hoje.
  - **Parâmetro de empresa** `modo_emissao_importacao` = `POR_DI` (default) | `POR_EXPORTADOR`. O modelo de dados suporta os dois **sem retrabalho** (ver seção de modelo de dados).
  - **Rateio é sempre no nível da DI, por item, ANTES do agrupamento em notas** (C7). O resíduo de arredondamento (C8) fecha com o **total da DI** (soma de todas as NF-e geradas), nunca nota a nota.
  - **Validação C9 na soma das NF-e da mesma DI** = valores da DI (não por nota isolada).
  - **Limite de 990 itens por NF-e**: se um exportador (ou a DI inteira no modo `POR_DI`) passar de 990 itens, **quebrar automaticamente** em notas adicionais, mantendo o vínculo com a mesma DI e o mesmo critério de rateio/validação.

## C. Cálculo

- **C1** Valor aduaneiro (VA) = (FOB + frete internacional + seguro) × câmbio da DI.
- **C2** Se o Incoterm for CIF, o sistema não soma frete/seguro em duplicidade.
- **C3** II = VA × alíquota II do NCM.
- **C4** IPI = (VA + II) × alíquota IPI do NCM.
- **C5** PIS-importação = VA × alíquota; COFINS-importação = VA × alíquota. Alíquotas vêm do cadastro de NCM (autopeças têm alíquotas específicas — Lei 10.485 / art. 8º Lei 10.865). **Nenhuma alíquota fixa no código.**
- **C6** ICMS importação calculado "por dentro":
  `BC = (VA + II + IPI + PIS + COFINS + Siscomex + AFRMM + demais despesas aduaneiras) / (1 − aliq)`; `ICMS = BC × aliq`.
- **C7** Rateio de frete, seguro, Siscomex e despesas por item, com critério configurável (valor FOB ou peso).
- **C8** Resíduo de arredondamento do rateio jogado no último item, para que a soma dos itens feche exatamente com a DI.
- **C9** Validação: VA total da nota = VA da DI (tolerância de centavos); soma dos itens por adição = valor da adição.
- **C10** Alíquotas com **vigência por data** (a data de registro da DI define a alíquota aplicada).

## D. Zona Franca de Manaus

- **D1** Isenção de II e IPI na entrada para consumo/comercialização na ZFM (DL 288/67).
- **D2** Cadastro de NCMs **excluídos** do benefício ZFM (armas, munições, fumo, bebidas alcoólicas, perfumes, automóveis de passageiros). NCM excluído bloqueia a isenção.
- **D3** PIS/COFINS-importação **incidem** na importação para revenda (a suspensão do art. 14-A da Lei 10.865 é para indústria). Verificar se o sistema não aplica suspensão indevida.
- **D4** **Controle de internação**: saída de mercadoria estrangeira da ZFM para outro estado gera tributos antes isentos. O sistema rastreia a origem (DI/adição) do item vendido.
- **D5** Venda interestadual de produto importado usa alíquota de ICMS de 4% (Resolução do Senado 13/2012), com base na origem 1.
- **D6** AFRMM com regra de não incidência para Norte/Nordeste parametrizável (prazo legal vem sendo prorrogado).
- **D7** Alíquota interna de ICMS do AM parametrizada, não fixa.

## E. Reforma tributária (IBS/CBS) — vigente em 2026

- **E1** NF-e preenche o grupo de IBS/CBS (NT 2025.002): **CST e cClassTrib por item** — obrigatórios; notas sem esses campos são rejeitadas desde 03/08/2026.
- **E2** Alíquotas teste 2026: CBS 0,9% e IBS 0,1%, calculadas em paralelo ao PIS/COFINS.
- **E3** Estrutura preparada para 2027 (CBS plena, extinção de PIS/COFINS) por vigência/parametrização, sem reescrever código.
- **E4** **Crédito presumido de IBS** na importação para **revenda presencial na ZFM**: 50% da alíquota do IBS da importação, deduzido do IBS devido (LC 214/2025, art. 444).
- **E5** **Estorno** do crédito presumido (com acréscimos legais) quando a revenda não for presencial na ZFM — depende do rastreio do item por DI (ver D4/F1).
- **E6** A suspensão de IBS/CBS na importação é só para **indústria incentivada** (LC 214, art. 443). O sistema **não** deve aplicá-la à distribuidora.
- **E7** Grupo ZFM do leiaute (gALCZFMCBS / equivalentes) preenchido quando aplicável, incluindo tributação teórica sem benefício.

## F. Controles posteriores

- **F1** **Saldo por DI/adição**: cada venda baixa o saldo da adição de origem (base para D4, E5 e auditoria).
- **F2** **NF complementar** ou ajuste de custo para despesas que chegam depois (armazenagem, despachante, diferenças), com recálculo do custo médio.
- **F3** **Entrega fracionada**: nota "mãe" da importação + notas de remessa por carga, com controle de saldo.
- **F4** **Custo do estoque** = VA + II + IPI (quando não recuperável) + despesas rateadas. Tributos recuperáveis (crédito de ICMS, PIS/COFINS, IBS/CBS) **não** entram no custo.
- **F5** Importação por conta e ordem / encomenda: tratamento e vínculo com o terceiro (CNPJ, UF).
- **F6** Testes automatizados com pelo menos um caso numérico completo de importação (VA → tributos → rateio → totais → custo).

## G. Modelo de dados proposto para emissão (B10)

> Proposta de modelo, **não implementada**. Objetivo: suportar `POR_EXPORTADOR` e `POR_DI` sem retrabalho, com a **adição** como unidade canônica de quebra. Aproveita as tabelas atuais (`dbent_importacao`, `dbent_importacao_entrada`, `dbent_importacao_it_ent` — esta já tem `numero_adicao`).

### G1. O que já existe

| Tabela | Papel hoje | Observação |
|---|---|---|
| `dbent_importacao` | Cabeçalho da DI | tem `qtd_adicoes`, mas as adições **não** são persistidas como linhas |
| `dbent_importacao_contratos` | Contratos de câmbio | 1:N com a DI |
| `dbent_importacao_entrada` | "Faturas" (agrupamento por fornecedor de negócio) | `fornecedor_nome`, `cod_credor` |
| `dbent_importacao_it_ent` | Itens | já tem `numero_adicao`, `id_fatura`, `codprod`, custos rateados |

### G2. Novas tabelas propostas

**`dbent_importacao_adicao`** — a adição como entidade (resolve A2/A3 e dá o `cExportador` canônico para o agrupamento B10):
```
id                 (PK)
id_importacao      (FK dbent_importacao)
numero_adicao      (bate com dbent_importacao_it_ent.numero_adicao)
seq_adicao
ncm
cod_exportador     -- código/identificador do exportador (cExportador)
exportador_nome
exportador_pais    -- cPais
exportador_id_estr -- idEstrangeiro (sem CNPJ/CPF)
fabricante_cod     -- cFabricante
valor_adicao       -- base da validação C9 por adição
```
Item passa a referenciar a adição por `id_adicao` (além de manter `numero_adicao`), para `nAdicao/nSeqAdic/cFabricante` por item (A3).

**`dbent_importacao_nfe`** — cada NF-e de nacionalização gerada (N por DI):
```
id                 (PK)
id_importacao      (FK)
modo               -- 'POR_EXPORTADOR' | 'POR_DI' (congela o modo usado na geração)
cod_exportador     -- preenchido no modo POR_EXPORTADOR; NULL no POR_DI
seq_nota           -- 1,2,3... quando um exportador/DI estoura 990 itens (quebra automática)
chave_nfe
numero / serie
cfop_padrao        -- 3.102 etc
status             -- rascunho / autorizada / rejeitada / cancelada
vnf, vprod, vii, vipi, vpis, vcofins, vicms, vsiscomex, voutro
```

**`dbent_importacao_nfe_item`** — vínculo item ⇄ nota emitida (quem entrou em qual nota):
```
id                 (PK)
id_nfe             (FK dbent_importacao_nfe)
id_item            (FK dbent_importacao_it_ent)
id_adicao          (FK dbent_importacao_adicao)
n_item_nf          -- nº do item dentro da NF-e (1..990)
```

### G3. Parâmetro de empresa
```
parametro_empresa.modo_emissao_importacao = 'POR_DI' (default, = Delphi) | 'POR_EXPORTADOR'
```
Guardado também em `dbent_importacao_nfe.modo` no momento da geração (histórico imutável do que foi emitido).

### G4. Como os dois modos caem no mesmo modelo
- **POR_DI (default)**: 1 `dbent_importacao_nfe` com `cod_exportador = NULL`; `cExportador` resolvido **por item** (via `id_adicao`); destinatário parametrizável. É o comportamento do Delphi (dados da DI por item da nota).
- **POR_EXPORTADOR**: `GROUP BY cod_exportador` (via `id_adicao → dbent_importacao_adicao.cod_exportador`) → 1 `dbent_importacao_nfe` por exportador. Destinatário = exportador da adição (B2).
- **Quebra de 990**: dentro de cada grupo, particionar os itens em lotes de ≤990 → cada lote vira uma `dbent_importacao_nfe` com `seq_nota` incremental, mesma DI e mesmo exportador.

### G5. Rateio e validação (reforço do B10 / C7–C9)
- O rateio continua em `dbent_importacao_it_ent` (**nível DI, por item, antes do agrupamento**). As tabelas `*_nfe*` **não** recalculam custo — apenas **somam** os itens que entraram em cada nota.
- **C8 (resíduo)** fecha com o total da DI = `SUM(dbent_importacao_nfe.*)` de todas as notas da DI.
- **C9 (validação)** roda na **soma das notas da mesma DI** e na soma por adição (`dbent_importacao_adicao.valor_adicao`), nunca por nota isolada.
