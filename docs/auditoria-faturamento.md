# Auditoria de Paridade — Faturamento (Delphi → Web) · FASE 0

> **Escopo:** relatório read-only. Nenhum código de layout/CSS/componente foi alterado.
> **Fontes:** front `src/components/corpo/faturamento/novoFaturamento/modalFaturamentonota/FaturamentoNota.tsx`;
> backend `src/pages/api/faturamento/*`, `src/pages/api/impostos/*`, `src/lib/impostos/*`;
> Oracle/Delphi: package `FATURAMENTOS` (procs `GERAR_FATURA` → `FATURA_INCLUIR` / `PRODFAT_INCLUIR` /
> `CALCULAR_TOTAIS`) e `TCOBRANCA.COBRANCA_CONFIRMAR`; telas Delphi (abas Escolher Vendas / Cálculos dos
> Produtos / Dados da Fatura / Gerar Cobrança).
> **Convenção:** onde não há evidência no código, está escrito **NÃO ENCONTRADO — confirmar regra**.

---

## 1. Mapa de campos (tela web)

Payload de `POST /api/faturamento/salvar` montado em `FaturamentoNota.tsx:618-644`.

| Campo (UI) | Onde na UI | Origem do valor | No payload `/salvar`? | Usado em cálculo no front? |
|---|---|---|---|---|
| Tipo Documentação (`tipodoc`) | 3461-3473 (select, **disabled**) | `statusVenda.tipodoc` (prop); default `'N'` | Sim (628) | Não |
| Gerar Cobrança (`cobranca`) | 3474-3485 | `statusVenda.cobranca`; default `'S'` | Sim (629) | Controla exibição da seção cobrança |
| Inscrição Estadual | 3490-3497 (**read-only**) | `vendaData.dbvenda.ie_empresa` (da venda) | Não (o exibido); ver `insc07` | Não |
| Natureza da Operação | 3516-3522 | `naturezaOperacao` state; **digitado** | Sim `natureza_operacao` (633) | Não |
| CFOP (cabeçalho) | 3523-3529 | `cfop` state; **digitado** livre | Sim `cfop` (634) | **Não** (campo de passagem) |
| Tipo de Movimentação | 3530-3542 | `tipoMovimentacao`; **escolha do operador** | Sim `tipo_movimentacao` (635) | Não |
| Origem | 3543-3549 | `origem`; **digitado** | Sim `origem` (636) | Não |
| NF-e Ambiente/Finalidade/Forma | 3550-3582 | defaults `'2'/'1'/'1'` | Sim (637-639) | Não |
| Modalidade de Transporte | 3592-3634 | `modalidadeTransporte`; escolha | **NÃO ENCONTRADO no payload** | Habilita campos de volume |
| Pedido | 3636-3642 | `dbvenda.nrovenda` (2737); editável | Sim (623) | Não |
| Transportadora | 3643-3648 | da venda / `'00430'` | Sim (621) | Não |
| Vendedor | 3649-3654 | `dbvenda.codvend` (2744) | Sim (620) | Não |
| Observações | 3667-3673 | `dbvenda.obs` (2738) | Sim (631) | Não |
| Informações Complementares | 3679-3685 | `infoComplementares`; digitado | Sim `info_compl` (640) | Não |
| Informar no corpo da NF | 3687-3693 | `informarNoCorpoNF`; default `false` | Sim `informar_no_corpo_nf` `'S'/'N'` (641) | Não |
| Mensagens NF | 3701-3770 | pré-seleção 223/224/737/693/20 (2898) | **Não** — salvas à parte em `/mensagemNF_salvar` (660) | Não |
| DI de Importação / Base Desc / Base Acr / Terceiro (Avançado) | 3780-3807 | digitados | **NÃO ENCONTRADO no payload** | Não |
| Desconto — Percentual | 4289-4297 | `percDesconto`; digitado | **NÃO ENCONTRADO no /salvar** | **Sim** (3008-3015) |
| Desconto — Valor | 4298-4305 (read-only) | **calculado** de `percDesconto` (3010) | **NÃO ENCONTRADO** | entra em `totalNF` (475) |
| Acréscimo — Percentual / Valor | 4336-4352 | `percAcrescimo` / calc (3019) | **NÃO ENCONTRADO** | **Sim** |
| Frete — Valor | 4362-4369 | `frete`; default `'0'` | **NÃO ENCONTRADO no /salvar** | **Sim** (`totalNF`, parcelas) |
| Volumes (Qtd/Espécie/Marca/Número/Peso B/L) | 4384-4433 | digitados | **NÃO ENCONTRADO no payload** | Não |
| Comissão Diferenciada / Vend. Ext / Vend. Int | 4446-4471 | digitados; default `0.00` | **NÃO ENCONTRADO no payload** | Não |
| Cobrança: Banco / Tipo Fatura / Parcelas / 1ª parcela | 3829-3978 | `formCobranca` | Banco→`cod_conta` (627); resto em `/salvar-cobranca` | parcelas/frete-1ª-parcela |
| Data | (sem input) | `new Date()` hoje (2733) | Sim (622) | Não |
| Cliente | (da venda, 2732) | `dbclien` da venda | Sim (619) + `usuario_associacao` (643) | Não |
| Totais (`totalprod/totalfat/totalnf`) | rodapé | `totalProdutos` / `totalNF` | Sim (624-626) | ver §6 |

**Estados órfãos** (declarados, nunca renderizados nem enviados): `ipi` (172), `icmsSuframa` (174).

**Não existe DTO nem schema de validação** (zod/yup/joi) para o payload de faturamento — **NÃO ENCONTRADO**. O `salvar.ts` desestrutura o body direto (`salvar.ts:14-31`), sem validação de tipos/obrigatoriedade.

---

## 2. Campos ausentes — status por camada (UI / payload / backend)

| Campo Delphi | UI | Payload | Backend (lê/grava) | Coluna existe no PG? |
|---|---|---|---|---|
| **zerarIPI** (`zerar_ipi`) | NÃO ENCONTRADO | NÃO ENCONTRADO | NÃO ENCONTRADO | **Sim** (`dbfatura.zerar_ipi`) |
| **zerarICMS** (`zerar_icms`) | NÃO ENCONTRADO | NÃO ENCONTRADO | NÃO ENCONTRADO | **Sim** |
| **zerarSubstituicao** | NÃO ENCONTRADO | NÃO ENCONTRADO | Só como **input do motor de VENDA** (`ImpostoRequest.zerarSubstituicao`, `types.ts:303`); no faturamento NÃO ENCONTRADO | **Sim** (`zerar_substituicao`) |
| **descontoICMSSuframa** | NÃO ENCONTRADO (só state morto `icmsSuframa`) | NÃO ENCONTRADO | NÃO ENCONTRADO | **Sim** (`descontosuframa`, `totalprodsuframa`) |
| **MVA / impostoAntecipado** | NÃO ENCONTRADO | NÃO ENCONTRADO | `mva` (alíquota) é **copiado** venda→fatura (`salvar.ts:272`); `mva_antecipado`/`impostoAntecipado` NÃO ENCONTRADO | **Sim** (`mva_antecipado`) |
| **inscricaoEstadual (04/07)** | Exibida **read-only** (3490); **sem toggle** 04/07 | `insc07` derivado auto (2827-2833) vai no payload (630) | Gravado literal em `dbfatura.insc07` (`salvar.ts:235`); **não afeta série/numeração/cálculo** (série fixa `'2'`, `salvar.ts:239`) | **Sim** (`insc07`) |
| **tipoMovimentacao (Entrada/Saída)** | Sim, select editável (3530); **escolha do operador** | Sim `tipo_movimentacao` (635) | NÃO ENCONTRADO (não gravado nem usado) | (não há coluna dedicada; ver §5) |
| **operacaoCFOP (lista dependente)** | NÃO ENCONTRADO | NÃO ENCONTRADO | NÃO ENCONTRADO | — |
| **CFOP no cabeçalho** | FormInput **texto livre** (3523); não é auto-preenchido | Sim `cfop` (634) | NÃO ENCONTRADO (não gravado — `salvar.ts` não persiste `cfop1/cfop2/descrcfop`) | **Sim** (`cfop1/cfop2/descrcfop`) |
| **CFOP por item + descrição** | NÃO ENCONTRADO (sem exibição por item) | — | `dbprodfat.cfop` copiado de `dbitvenda.cfop` (`salvar.ts:272`); calculado só no motor de VENDA (`calcular_cfop`) | **Sim** (`dbitvenda.cfop`, `dbprodfat.cfop`) |
| **Totalizador "CFOP usado / valor por CFOP"** | NÃO ENCONTRADO | — | NÃO ENCONTRADO | — |

> Observação-chave: **o schema do Postgres já tem todas as colunas fiscais** (mirror do Oracle) — a lacuna é de **UI + payload + gravação**, não de estrutura de dados.

---

## 3. Origem dos dados — respostas com evidência

### a) `tipoMovimentacao` e `operacaoCFOP` vêm da venda ou são escolha do operador?
- **`tipoMovimentacao`: escolha do operador.** State init `''` (`FaturamentoNota.tsx:105`); único ponto de escrita é `onValueChange={setTipoMovimentacao}` (3534). Nenhum `setTipoMovimentacao(...)` no carregamento da venda (2669-2833). **Não vem da venda.**
- **`operacaoCFOP`: NÃO ENCONTRADO.** Não existe select de operação dependente de `tipoMovimentacao` (nem state, nem componente, nem derivação).
- No **Delphi** a operação é um *picker* ("Operação Saída" com botão `...`, aba Escolher Vendas), cuja lista depende de Entrada/Saída — **divergência**, ver §5.

### b) O CFOP é calculado no backend, ou digitado? O CFOP do cabeçalho (Etapa 2) serve pra quê? Sobrescreve o CFOP por item?
- **CFOP por item: calculado — mas no fluxo de VENDA**, via `calculadoraImpostos.calcularCFOP()` → function SQL `calcular_cfop($1,$2,$3)` (`calculadoraImpostos.ts:409-437`, fallback `interno?'5102':'6102'`). O **faturamento não calcula CFOP** — só copia `dbitvenda.cfop`→`dbprodfat.cfop` (`salvar.ts:272`).
- **CFOP do cabeçalho (Etapa 2): é texto livre digitado** (`FaturamentoNota.tsx:3523-3529`), sem preenchimento automático, **sem efeito no front** (não aparece em nenhum `useEffect`/cálculo — única outra ocorrência é a linha 634 do payload). É **enviado** mas o `salvar.ts` **não o persiste** (não grava `cfop1/cfop2`).
- **Sobrescreve o CFOP por item?** **Não** — hoje é um campo de passagem inerte, então **não há bug de multi-origem hoje**. ⚠️ **Alerta para a Fase de implementação:** se algum dia esse CFOP de cabeçalho passar a gravar/aplicar por item, ele atropelaria o CFOP calculado por item — e itens de **origens/UF diferentes** teriam CFOP errado. Manter CFOP **por item**, nunca um único no cabeçalho.

### c) As flags de zerar imposto atuam no cálculo ou só na emissão?
- **NÃO ENCONTRADO no faturamento** (nem no cálculo — que não existe no faturamento — nem na emissão: `emitir.ts` monta o XML do snapshot/payload sem condicional de zerar). A única flag de zerar do sistema é `zerarSubstituicao`, **parâmetro do motor de VENDA** (`types.ts:303`), que atuaria no **cálculo da venda**. **Confirmar com o cliente** em que momento o Delphi zera (provável: recalcula a base no ato de faturar — regra não reproduzida no web).

### d) A escolha da inscrição estadual altera cálculo ou é só cabeçalho da NF?
- **No web: só dado, e ainda derivado automaticamente.** `insc07` é deduzido de `ie_empresa` (`'07'`→`'S'`, senão `'N'`, 2827-2833), gravado em `dbfatura.insc07` e **não influencia série/numeração/cálculo** (`salvar.ts`; a série é fixa `'2'`).
- **No Delphi altera a SÉRIE:** `FATURA_INCLUIR` deriva `serie` a partir de `vINSC07='S'` + 12º dígito do CGC da empresa (`'2'`/`'3'`/`'1'`). **Divergência de efeito** — ver §5.

---

## 4. Motor de cálculo — investigação (seção 6 do pedido)

### a) Existe endpoint de cálculo tributário? É o mesmo da venda?
- **Faturamento: NÃO ENCONTRADO** endpoint de cálculo (`faturamento/calcular*`, `resumo*`, `impostos*` inexistentes).
- **Existe um motor real e separado:** `POST /api/impostos` → `CalculadoraImpostos` (`src/lib/impostos/calculadoraImpostos.ts`), que calcula ICMS/ST/IPI/PIS/COFINS/FCP/IBS/CBS + CFOP via functions/views SQL. **É o motor da VENDA. O faturamento NÃO o invoca** (grep por `/api/impostos`/`CalculadoraImpostos` em `components/corpo/faturamento` = NÃO ENCONTRADO).
- **Dois caminhos, regras divergentes:** Venda = recalcula de verdade e grava em `dbitvenda`. Faturamento = apenas **fotografa** a venda e **soma** para exibir.

### b) O endpoint aceita parâmetros de ajuste?
- O que alimenta o rodapé (`/api/faturamento/detalhes-venda`) aceita **só `nrovenda`** (`detalhes-venda.ts:13-22`). **Não** aceita zerar/desconto/mva/cfop/frete. O motor de venda (`ImpostoRequest`) aceita `zerarSubstituicao`, `tipoMovimentacao`, `tipoOperacao`, `uf_empresa` — mas **não** `zerarIPI/zerarICMS`, `mva`, `frete`, e o faturamento não o chama.

### c) O cálculo é no backend ou há aritmética no front? (candidatos a migrar)
Aritmética fiscal **em JavaScript no front** (`FaturamentoNota.tsx`), a migrar para o backend:
1. `totalNF` (fallback): `totalProdutos - desconto + acrescimo + frete` (474-476)
2. **Desconto por %**: `(percDesconto/100) * totalProdutos` (3008-3015)
3. **Acréscimo por %**: `(percAcrescimo/100) * totalProdutos` (3017-3024)
4. Consolidação (soma) de totais de várias vendas (2707-2724, 2767-2776)
5. Fallback de totais por `dbvenda` (2791-2816)
6. Fallback de totais por itens: `prunit*qtd`, somas de imposto (2964-2984)
7. **Média ponderada de alíquota ICMS** por base (3063-3083)
8. **Média ponderada de alíquota IPI** por base (3085-3105)
9. Rateio de parcelas: `valorLiquido / nº parcelas` (488-489); frete na 1ª parcela (507-509); `totalNF / nº parcelas` (`salvar-cobranca`, 750)
10. **IBS Municipal/Estadual com default hardcoded `0.50`** quando o backend não envia (3130-3131) ⚠️

### d) Os valores do rodapé vêm de snapshot ou de cálculo? Onde ficam?
- **Snapshot da venda via endpoint.** `dadosResumoFinanceiro = vendaData?.resumoFinanceiro` (470); `vendaData` vem de `GET /api/faturamento/detalhes-venda?nrovenda=...` (2691-2704). O `detalhes-venda.ts` **lê `dbitvenda`** (colunas já calculadas na venda) e apenas **agrega** (somatório + média ponderada em JS, `detalhes-venda.ts:420-548`); **não recalcula imposto** nem consulta tabela de tributação.
- Detalhe: `totalGeral`/`totalImpostos` **excluem ICMS deliberadamente** e marcam IBS/CBS como "fase de pesquisa" (`detalhes-venda.ts:536-548`) — **divergência de regra** a validar.
- Armazenamento: os totais são apenas exibidos e, ao salvar, gravados **como recebidos** em `dbfatura` (`salvar.ts:222-231`).

### e) Existe rateio de desconto/acréscimo por item para recompor bases?
- **NÃO ENCONTRADO** (nem front nem backend do faturamento). `salvar.ts` copia `desconto/fretebase/acrescimo/freteicms` já existentes por item, sem redistribuir; `detalhes-venda.ts` só soma no nível da venda e arredonda item a item (sem acerto de centavos / *largest-remainder*).
- **No Delphi existe** rateio em `CALCULAR_TOTAIS`: distribui frete/desconto/acréscimo por item com **"sobra no 1º item, `round(valor/nº_itens, 2)` nos demais"**, e recompõe base ICMS + ICMS-ST sobre frete (PB/PE) e os totais do cabeçalho. **Regra não reproduzida no web.**

---

## 5. Conclusão — 3 blocos

### 🔴 Lacunas confirmadas (existe no Delphi, não no web)
1. **Zerar IPI / ICMS / Substituição** — sem UI, sem payload, sem backend (colunas existem no PG). Delphi: aba Escolher Vendas.
2. **Desconto ICMS Suframa** (`descontosuframa`/`totalprodsuframa`) — inexistente no web (state `icmsSuframa` é morto).
3. **MVA / Imposto Antecipado** — sem UI/payload/gravação (só a alíquota `mva` por item é copiada da venda).
4. **`operacaoCFOP`** (lista de operações dependente de Entrada/Saída) — inexistente no web.
5. **CFOP por item + descrição na tela** e **totalizador "CFOP usado / valor por CFOP"** — inexistentes (Delphi: aba Cálculos dos Produtos + Totais Gerais).
6. **`CALCULAR_TOTAIS`**: rateio de frete/desconto/acréscimo por item, recomposição de base ICMS/ST e recálculo dos totais do cabeçalho (incl. IBS/CBS/VNFTOT) — não portado. O web grava totais crus do front.
7. **Gravação dos campos fiscais do cabeçalho** (`zerar_*`, `mva_antecipado`, `descontosuframa`, `cfop1/cfop2/descrcfop`, `tipodest`, `origem`, `info_compl`, `tiponf`) — o `salvar.ts` grava só 17 colunas; esses ficam de fora mesmo já existindo no schema.
8. **Trilha de auditoria fiscal** — não há persistência de valores **originais** da venda + **finais** da fatura + objeto de ajustes + usuário responsável.

### 🟡 Divergências de modelagem (existe nos dois, semântica diferente)
1. **Inscrição Estadual 04/07** — Delphi: **rádio de escolha** do operador que **altera a série**. Web: **derivado automaticamente** de `ie_empresa`, read-only, **sem efeito** (série fixa `'2'`).
2. **CFOP do cabeçalho** — Delphi: operação escolhida que **calcula** o CFOP. Web: **texto livre digitado**, enviado mas **não gravado nem usado** (campo inerte).
3. **`tipoMovimentacao`** — Delphi: Entrada/Saída que **muda a lista de operações e o cálculo**. Web: select enviado, mas **backend não usa** (o motor de venda até aceita o parâmetro, mas o faturamento não o chama).
4. **Motor tributário** — venda usa `CalculadoraImpostos` (recalcula); faturamento usa `detalhes-venda` (só soma o snapshot) — e ainda **exclui ICMS do total** e trata IBS/CBS como informativo.
5. **Série** — Delphi deriva de INSC07+CGC; web fixa `'2'`.
6. **`nroform`/numeração** — Delphi filtra por insc07+tiponf+serie+data; web usa MAX global.

### ❓ Perguntas para o cliente (o código não responde)
1. **Zerar IPI/ICMS/ST:** em que momento o Delphi zera — recalcula a base **no ato de faturar**, ou só marca a flag e a emissão ignora o tributo? Precisamos da regra exata (afeta base, valor e total).
2. **MVA / Imposto Antecipado:** o que exatamente recalculam no faturamento e para quais UFs/operações?
3. **Desconto ICMS Suframa:** qual a regra de cálculo e sobre qual base (produtos Suframa)?
4. **`tipoMovimentacao` + `operacaoCFOP`:** confirmar a lista oficial de operações (Entrada/Saída) e o mapeamento operação→CFOP. É escolha do operador mesmo, ou deveria vir da venda?
5. **Inscrição Estadual 04/07:** deve voltar a ser **escolha** do operador (mudando a série), ou o web pode manter a derivação automática? Qual a regra de série por IE?
6. **Totais do rodapé:** o ICMS deve entrar no "Total da NF"? Como tratar IBS/CBS (hoje "fase de pesquisa")?
7. **Rateio:** confirmar a regra de arredondamento do Delphi (sobra no 1º item) e se é isso que a Receita espera.
8. **Ajustes no faturamento:** quando o operador muda operação/zera imposto/aplica desconto, o esperado é **reprocessar os itens** (novo cálculo) — confirmar que hoje o Delphi refaz o cálculo tributário nessa aba.

---

## 6. Observações para a Fase de implementação (NÃO executar agora)

- Não há motor de cálculo no faturamento; qualquer ajuste (zerar/mva/suframa/desconto/frete/operação) **precisa de um endpoint que reprocess os itens** a partir do snapshot original da venda + ajustes — **nunca** do resultado anterior.
- A aritmética fiscal do §4c deve **sair do front** e ir para o backend.
- **Nenhuma regra tributária nova deve ser deduzida** — as regras do Delphi (zerar, MVA, Suframa, rateio, CFOP por operação) só serão implementadas após o cliente confirmar as perguntas do §5.
- O CFOP deve permanecer **por item**; o campo de CFOP no cabeçalho não deve sobrescrever os itens.
