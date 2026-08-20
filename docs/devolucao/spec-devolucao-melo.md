# Spec — Faturamento de Devolução (porte Delphi → web)

> Status: **mapeamento / desenho** (não implementado). Objetivo: reproduzir no web a
> estrutura que o Delphi "Faturamento de Devolução" (`UniDevolFat.pas`, 2749 linhas) faz
> hoje, para continuarmos a implementação a partir daqui.
>
> Fontes: `Desenvolvimento/Formularios/DEVOLUCAO/UniDevolFat.{pas,dfm}` e
> `.../ALTERAR NF DE DEVOLUCAO/UnitAlt_Nf_Devolucao.pas`.
> ⚠️ O motor fiscal real vive no pacote Oracle `FATURAMENTOS.*` e na DLL nativa
> `enviarNfe.dll` (`processoDevolucaoFatura2`, `processoDevolucaoEntrada`) — **corpos
> ausentes do repositório**. A regra fiscal exata (CFOP definitivo, CST, refNFe, efeitos
> em estoque/financeiro) é reproduzida reusando os motores que o web já tem, não copiada.

---

## 1. Os dois tipos de devolução

A tela é única e opera dois fluxos, escolhidos por checkbox (listagem) / radio (Nova):

| Tipo | Significado | Destinatário | Efeito principal |
|---|---|---|---|
| **FATURA** | Devolução de **VENDA** — o cliente devolve mercadoria que comprou | CLIENTE (`codcli`, consulta clientes) | **Repõe estoque** no armazém escolhido + gera **título de pagamento** (crédito ao cliente) + emite NF-e de devolução |
| **ENTRADA** | Devolução de **COMPRA** — a empresa devolve ao FORNECEDOR mercadoria que entrou por XML | FORNECEDOR (`codcredor`, consulta credores) | **Baixa estoque** (saída ao fornecedor) via pré-pedido → procedência → fatura |

Diferença de ciclo:
- **FATURA** = **síncrono**, via "espelho" de impostos: revisa tributos por item e emite num passo.
- **ENTRADA** = **assíncrono/2 etapas**: cria devolução **pendente** (`status='A'`, gera pré-pedido) → depois **Procedência** decide o destino → fatura.

---

## 2. Fluxo "Nova" (montar a devolução)

1. Escolhe tipo (FATURA/ENTRADA) e **filtro de busca** `cmbFiltro`: `0=CÓDIGO`, `1=NF`, `2=CHAVE` de acesso.
2. **Busca a nota original** — `NAV_DEVOLUCAO_DOCUMENTO(ptipo, pfiltro, pvalor)` → grid de seleção.
3. **Seleciona o documento** → copia cabeçalho (código, nº form/NF, série, data, total, cliente/fornecedor, chave de acesso, CFOP+operação de origem, vendedor/comprador).
   - **Deriva o CFOP de devolução invertendo o 1º dígito** do CFOP de origem:
     `1→5, 2→6, 3→7, 5→1, 6→2, 7→3` (entrada↔saída). O CFOP resultante precisa ter `operacao='DEV'` (validação `CONSULTA_CFOP`).
   - Observação default: `'DEV REF NF <nº>'`.
   - Carrega destinatário (`NAV_DEVOLUCAO_DESTINATARIO`) e itens (`NAV_DEVOLUCAO_ITENS`).
4. **Itens** (grid): `REF, DESCR, MARCA, FONTE, NUMERO, PRUNIT, ARM, QTDORIGINAL, QTDDISPONIVEL, QTDDEVOLVIDA(editável)`.
   - Usuário edita `QTDDEVOLVIDA` por item, ou "Devolver todos" (=QTDDISPONIVEL) / "Zerar todos".
   - **% devolvido** = `100 * QTDDEVOLVIDA / QTDORIGINAL`.
   - **Valida `QTDDEVOLVIDA ≤ QTDDISPONIVEL`** (não sobre a original) → controle de **saldo devolvível acumulado** por nota (permite devoluções parciais em várias vezes).
5. Campos complementares: novo CFOP, **armazém de destino** (só FATURA — pra onde o estoque volta), transportadora, pedido, observação, até 6 mensagens fiscais, frete CIF/FOB, dados de transporte (peso bruto/líquido, espécie, marca, nº volumes), Inscrição 07.

---

## 3. Fluxo "Confirmar"

Validações comuns: total devolvido > 0; qtd ≤ disponível; **destinatário confere CPF/CNPJ + Inscr. Estadual com a nota de origem**; CFOP novo existe e tem `operacao='DEV'`.

### 3a. ENTRADA — gravação direta (pré-pedido pendente)
1. `INC_CAD_CLIENTE_CREDOR` (associa destinatário↔credor).
2. `INC_DEVOLUCAO_DOCUMENTO` → cabeçalho, retorna `PDEV_ID`.
3. `INC_DEVOLUCAO_ITENS` (por item).
4. `DEL/INC_FAT_AUX_DEVOLUCAO` (tabela auxiliar de faturamento).
5. `Processar` → `processoDevolucaoEntrada` (DLL) → gera **pré-pedido** (`status='A'`). Devolução fica **pendente**, aguardando procedência.

### 3b. FATURA — via ESPELHO
1. Monta `FAT_AUX_DEVOLUCAO` (`PAXD_CODVENDA` se fonte='VENDA', `PAXD_CODINT` se fonte='DOC INTERNO').
2. `GER_FAT_AUX_DEVOLUCAO(PDEV_DESTINO='CLIENTE')` → **calcula impostos do espelho** (CFOP, NCM, CEST, CST/base/valor de ICMS, IPI, ST, PIS, COFINS, frete por item).
3. Painel **Espelho** pra revisão; ao "Emitir":
   - `INC_DEVOLUCAO_DOCUMENTO` + `INC_DEVOLUCAO_ITENS`;
   - `VALIDA_NCM` / `VALIDA_CEST`;
   - `ALT_FAT_AUX_DEVOLUCAO` (persiste impostos linha a linha) + `ALT_DEVOLUCAO_TOTAIS`;
   - `Processar` → `processoDevolucaoFatura2` (DLL) → cria **doc interno + fatura + entrada (repõe estoque) + título pgto** e **emite a NF-e de devolução**.

### Procedência (só ENTRADA, 2ª etapa) — quando `dev_status='A'`
- **Procedente** → destino `FORNECEDOR`, `pdev_procedente='S'`, mantém CFOP original.
- **Improcedente** → destino `MELO` (CFOP fixo **5949**, exige CNPJ próprio) / `TRANSPORTADORA` / `TERCEIRO`, `pdev_procedente='N'`, exige novo destinatário + novo CFOP de saída (não-DEV).
- `ALT_DEVOLUCAO_DOCUMENTO` + `GER/ALT_FAT_AUX_DEVOLUCAO` + `ALT_DEVOLUCAO_TOTAIS` → `Processar` (fatura). Rollback lógico reverte pra 'FORNECEDOR' se falhar.

---

## 4. "Documentos Gerados" e "Itens Devolvidos"

- **Documentos Gerados** (`DER_*`, via `NAV_FAT_DEVOLUCAO_REGISTRO`): rastro dos documentos que a devolução originou — `DER_DOCUMENTO` (VENDA/pré-pedido, FATURA/NF-e, ENTRADA de estoque, DOC INTERNO, títulos) + `DER_NUMERO`. **Não é crédito/vale isolado** — é a lista de documentos internos.
- **Itens Devolvidos**: os itens da devolução com `QTDORIGINAL / QTDDEVOLVIDA / %`.

## 5. Imprimir / Excluir
- **Imprimir**: só **ENTRADA pendente** (`status='A'`) → enfileira impressão do **pré-pedido** (fila de vendas, `der_documento='VENDA'`). Não imprime DANFE aqui.
- **Excluir**: só **ENTRADA pendente** → `CANCEL_PROCDEVEL_USR` + `CANCEL_PROCDEVOL`. Concluída não exclui (orienta cancelar a NF/entrada gerada).

---

## 6. Modelo de dados (deduzido dos params — tabelas reais ocultas nas procedures)

| Entidade | Provável tabela Oracle | Colunas-chave |
|---|---|---|
| Cabeçalho | `DBDEVOL` | `DEV_ID` PK, `DEV_TIPODOC` (FATURA/ENTRADA), `DEV_CODDOC` (doc origem), `DEV_CFOP`, `DEV_CODDEST`, `DEV_ARM_ID`, `DEV_STATUS` ('A'=pendente), `DEV_PROCEDENTE` (S/N), `DEV_CODUSR`, `DEV_OBS`, `DEV_TRANSP`, `DEV_FRETE`, `DEV_INSC07`, totais |
| Itens | `DBITDEVOL` | `ITD_DEV_ID` FK, `ITD_CODPROD`, `ITD_ARM_ID`, `ITD_FONTE`, `ITD_CODIGO`, `ITD_QUANT_ORIGINAL/DISPONIVEL/DEVOLVIDA`, `ITD_PERCENTUAL`, `ITD_NREQUIS`, `ITD_NRITEM` |
| Documentos gerados | `DBDEVOL_REGISTRO` | `DER_DEV_ID` FK, `DER_DOCUMENTO`, `DER_NUMERO`, `DER_CODIGO` |
| Auxiliar de impostos (espelho) | `DBFAT_AUX_DEVOL` | tributos completos por item (ICMS/IPI/ST/PIS/COFINS/NCM/CEST/CFOP) |

---

## 7. O que o WEB já tem (reuso)

- **FATURA (devolução de venda)** — 2 fases já existem:
  - Fase 1 `estornar-nfe.ts` → `lib/faturamento/gerarEstorno.ts`: cria a **DI** (`dbfatura.codfatrel`→original), **estorna estoque**, marca original `estorno='S'`. ⚠️ **reverte a nota inteira** (sem parcial).
  - Fase 2 `faturamento/emitir-devolucao.ts`: emite NF-e com `tpNF=0` (entrada), `finNFe=4` (devolução), `<refNFe>`=chave original. ✅ fiscalmente correto.
- **ENTRADA (devolução de compra)** — `components/corpo/comprador/Devolucao/` + `pages/api/devolucao/{list,[id]}.ts`: devolução ao fornecedor a partir de uma entrada.
- **Motor de imposto**: `db_manaus.calcular_imposto_item` (recalcula CST/ICMS/IPI por item).
  ⚠️ `calcular_cfop('DEVOLUCAO_VENDA')` devolve **5102/6102** (saída) — **errado** pra devolução de venda (deveria ser 1202/2202, entrada). **Decisão de porte: derivar o CFOP como o Delphi (inverter o 1º dígito do CFOP de origem)**, não confiar no `calcular_cfop` para devolução.

---

## 8. Gap vs Delphi (o que falta construir)

1. **Tela dedicada unificada** no layout Delphi (lista FATURA+ENTRADA, colunas Devolução/Procedente/Status/Tipo/Nota Devolvida + Documentos Gerados + Itens Devolvidos).
2. **Devolução PARCIAL** (selecionar itens + `QTDDEVOLVIDA`, saldo devolvível acumulado) — hoje o web só reverte a nota inteira.
3. **Derivação automática do CFOP** por inversão do 1º dígito + validação `operacao='DEV'`.
4. **Documentos Gerados** (rastro) e controle de **saldo devolvível** por nota.
5. **ENTRADA**: workflow de **procedência** (procedente/improcedente 5949) — ausente no web.

---

## 9. Proposta de porte web (a implementar na próxima rodada)

**Modelo (novo, espelhando DBDEVOL):**
- `dev_devolucao` (dev_id, dev_tipodoc FATURA/ENTRADA, dev_coddoc, dev_cfop, dev_coddest, dev_arm_id, dev_status, dev_procedente, dev_codusr, dev_obs, dev_codfat_gerada, totais).
- `dev_it_devolucao` (itd_dev_id, itd_codprod, itd_arm_id, itd_fonte, itd_qtd_original, itd_qtd_disponivel, itd_qtd_devolvida, itd_prunit).
- `dev_registro` (der_dev_id, der_documento, der_numero) — Documentos Gerados.
- Saldo devolvível = `QTDORIGINAL − Σ devoluções já registradas` para o item na nota.

**Endpoints:**
- `GET /api/devolucao-fat/buscar?tipo=&filtro=&valor=` (NAV_DEVOLUCAO_DOCUMENTO).
- `GET /api/devolucao-fat/nota/[coddoc]/itens` (itens + saldo devolvível).
- `POST /api/devolucao-fat/espelho` (calcula impostos via calcular_imposto_item, CFOP derivado).
- `POST /api/devolucao-fat/confirmar` (grava dev_* + gera DI parcial estendendo gerarEstorno com itens/qtds selecionados → emite via emitir-devolucao).
- `GET /api/devolucao-fat` (listar) / `DELETE` (excluir pendente).

**Front:** tela `components/corpo/faturamento/Devolucao/` no layout Delphi; reusa a técnica de orquestração do caixa/transferência (grava DI → emite → rollback se falhar).

**Escopo sugerido pra 1ª rodada:** FATURA (devolução de venda) **parcial** com espelho + emissão, reusando `gerarEstorno` (estendido p/ itens parciais) + `emitir-devolucao`. ENTRADA/procedência numa rodada seguinte.
