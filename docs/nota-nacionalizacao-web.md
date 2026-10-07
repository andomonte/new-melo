# Nota de Nacionalização (NF-e de entrada de importação) — Spec de implementação web

**Fonte da verdade:** 2 NF-e **reais autorizadas em produção** (cStat 100) emitidas pelo Delphi para a DI `2608858944`:
- `13261004618302000189550010014750661153938937` (nNF 1475066, 259 itens)
- `13261004618302000189550010014750761638380829` (nNF 1475076, 264 itens)

Esses XMLs **substituem** as inferências anteriores (feitas do fonte Delphi). Onde houver conflito, **vale o gabarito**. Complementa `docs/regras-importacao-zfm.md` e `docs/auditoria-importacao.md`.

---

## 0. Fatos provados pelo gabarito

- **Uma DI → N notas.** As duas notas são da **mesma DI** (`nDI=2608858944` em todos os itens, `REF. DI 26/0885894-4` nas duas). A partida é por **grupo de pedidos / NRO DOC**: nota 1 = pedidos 83353/83354/83363 (NRO DOC 001713062); nota 2 = 83356/83359/83360 (NRO DOC 001713073). **Mesmo exportador** (32924) nas duas.
- **Destinatário = o exportador**, que é um **cliente do cadastro** (`dbclien`, tipo X). `cExportador` = `cFabricante` = **`codcli`** do exportador (NINGBO EBI = `32924`). Confirmado na tela de Clientes.
- **1 exportador por nota.** Se um grupo tivesse itens de 2 exportadores, parte em 2 notas (destinatário é único).
- **`vUnCom` = valor fiscal da NF (nf_unit)**, não o custo real.
- **`vOutro` = "Outros Valores"** (`dbent_importacao.outros_valores`, migration 065), rateado **flat por item** dentro da nota. Nota 1 = 1.422,69 × 259; nota 2 = 1.477,12 × 264. **`vNF = vProd + vOutro`** (II/IPI/PIS/COFINS = 0 na ZFM). Total da DI é dividido entre as notas (proporcional ao vProd) e, dentro da nota, igual por item.
- **Itens ordenados por `referência` (dbprod.ref) asc** — não por adição.

---

## 1. Leiaute exato (campo → fonte) — gabarito

### 1.1 `ide`
| Tag | Valor | Fonte web |
|---|---|---|
| cUF | 13 | fixo AM |
| natOp | `COMPRA PARA COMERCIALIZACAO` | fixo (não "IMPORTACAO...") |
| mod / serie | 55 / **1** | série do armazém (arm_serie) |
| tpNF | 0 (entrada) | fixo |
| idDest | 3 | fixo |
| cMunFG | 1302603 | emitente |
| **tpImp** | **2** (paisagem) | fixo |
| tpEmis | 1 | fixo |
| tpAmb | 1 prod / 2 homolog | ambiente |
| finNFe / indFinal | 1 / 0 | fixo |
| **indPres** | **1** | fixo |
| verProc | `MELOSYS NFe 4.00` | fixo |

### 1.2 `emit` — MELO (dadosempresa). `CRT=3`.

### 1.3 `dest` — EXTERIOR (do cadastro do exportador `dbclien`)
| Tag | Gabarito | Fonte |
|---|---|---|
| idEstrangeiro | **vazio** (self-closing) | fixo vazio |
| xNome | NINGBO EBI... | dbclien.nome do exportador |
| enderDest.xLgr/nro/xBairro | `B716, ZHONGSHAN BUILDING` / 369 / `CHINA` | dbclien (endereço real) |
| cMun / xMun / UF | 9999999 / EXTERIOR / EX | fixo |
| **CEP** | 99999999 | fixo |
| cPais / xPais | 1600 / CHINA, REPUBLICA POPULAR | dbclien.codpais → dbpais |
| indIEDest | 9 | fixo |

### 1.4 `det.prod`
| Tag | Gabarito | Fonte |
|---|---|---|
| cProd | `00000000674732` | codprod **zero-pad 14** |
| cEAN / cEANTrib | GTIN real **ou** `SEM GTIN` | dbprod.codbarra (válido) |
| xProd | `1181245 - FILTRO DE COMBUSTIVEL` | **`ref - descr`** |
| NCM | 84212300 | dbprod/item |
| CEST | 0104900 (quando houver) | dbprod.cest |
| CFOP | **3102** | fixo série 3 |
| uCom/uTrib | PC/UN | dbprod |
| qCom/qTrib | 180.0000 | item.qtd |
| vUnCom/vUnTrib | 14.7600 | **nf_unit** |
| vProd | qCom × vUnCom | calc |
| **vOutro** | 1422.69 (flat/item) | outros_valores rateado |
| indTot | 1 | fixo |

### 1.5 `det.prod.DI` + `adi`
`nDI`, `dDI`, `xLocDesemb=MANAUS`, `UFDesemb=AM`, `dDesemb`, `tpViaTransp=1`, `vAFRMM=0.00`, `tpIntermedio=1`, **`cExportador`=codcli do exportador**, `adi{ nAdicao, nSeqAdic, cFabricante=codcli }`. (vAFRMM só sai se marítimo e > 0.)

### 1.6 `det.imposto` (perfil ZFM — da tributação do produto, motor igual venda)
| Grupo | Gabarito |
|---|---|
| ICMS | **ICMS60** (orig **1**, CST 60, vBCSTRet/pST/vICMSSTRet = 0) |
| IPI | `IPINT CST 05` (cEnq 143) **ou** `IPITrib CST 00` zerado (cEnq 999) |
| II | vBC/vDespAdu/vII/vIOF = **0** (ZFM) |
| PIS / COFINS | **PISNT / COFINSNT CST 08** |
| IBSCBS | CST 000, cClassTrib 000001, gIBSUF pIBSUF 0.10, gIBSMun 0, gCBS pCBS 0.90 |

### 1.7 `total`
- `ICMSTot`: tudo 0 exceto `vProd`, **`vOutro`** e `vNF = vProd + vOutro`.
- **`IBSCBSTot`** (vBCIBSCBS, gIBS.vIBSUF, gCBS.vCBS) + **`vNFTot` = vNF + vIBS + vCBS**.
- Confere nota 1: 968.912,27 + 368.477,34 = **1.337.389,61**; +969,00+8.720,26 = **1.347.078,87**.

### 1.8 Demais blocos
`transp.modFrete=9` · **`pag.detPag{tPag:90, vPag:0}`** · **`infRespTec`** (MARIO CESAR FERNANDES) · `infAdic.infCpl` = `PEDIDO: ... OBSERVACAO: REF. DI ... MB/L ... CONTAINER ... NAVIO ... ENTRADA ... FATURA ... ROMANEIO ...`.

---

## 2. Gap: builder web atual × gabarito (tarefas)

Arquivos: [`gerarXmlImportacao.ts`](../src/components/services/sefazNfe/gerarXmlImportacao.ts), [`preview-nacionalizacao.ts`](../src/pages/api/importacao/[id]/preview-nacionalizacao.ts).

| # | Campo | Corrigir |
|---|---|---|
| 1 | natOp | → `COMPRA PARA COMERCIALIZACAO` |
| 2 | tpImp / indPres | → 2 / 1 |
| 3 | dest endereço + CEP | endereço real do exportador (dbclien) + CEP 99999999; idEstrangeiro vazio |
| 4 | vUnCom | → nf_unit (não custo_unit_real) |
| 5 | cProd / cEAN / xProd / CEST | zero-pad14 / GTIN / `ref - descr` / cest |
| 6 | vOutro item + total + vNF | rateio flat de outros_valores; vNF = vProd+vOutro |
| 7 | ICMS/IPI/PIS/COFINS | 60 / 05-00 / NT08 (da tributação do produto) |
| 8 | IBSCBS por item | passar ibscbs no preview |
| 9 | IBSCBSTot + vNFTot | adicionar |
| 10 | pag + infRespTec | adicionar |
| 11 | ordem dos itens | por referência asc |
| 12 | partida de notas | por **grupo de pedidos** (1 exportador/nota) — não POR_DI/POR_EXPORTADOR |

---

## 3. Fluxo de telas e botões (decidido)

- Botão **"Nota de Nacionalização"** → **dois**:
  - **[Prévia da Nota]**: salva DI → calcula custos (gera nf_unit) → monta XML no leiaute §1 → **renderiza DANFE em PDF** (pipeline puppeteer existente) marcado **"SEM VALOR FISCAL"**. Não numera, não transmite, não grava.
  - **[Emitir Nota]** (por grupo de pedidos): valida pré-requisitos → reserva numeração (série do armazém) → monta XML definitivo → assina (A1 node-forge) → **transmite SEFAZ (homologação primeiro)** → autorizado: grava nota + XML/protocolo → dispara a **Entrada**.
- **Confirmar Preço** NÃO é aqui — é na tela **Gerar Entrada** (próxima).
- **Todo item tem ordem** — sem fallback "sem ordem".

---

## 4. Perguntas respondidas (trava)

1. `cExportador`/`cFabricante` = **`codcli`** do exportador (dbclien tipo X). ✅
2. `vOutro` = **`dbent_importacao.outros_valores`** (Dados Gerais), rateio flat por item. ✅ (falta: como dividir o total da DI entre as N notas — proporcional ao vProd.)
3. Partida = **grupo de pedidos da mesma DI** (não DIs diferentes). ✅
4. Emissão: **homologação primeiro**, depois produção. ✅

---

## 5. Plano de implementação

- **P1 — Builder no gabarito:** reescrever `gerarXmlImportacao.ts` para os campos §1 100% determinísticos (ide/dest/prod/DI/total/pag/infRespTec). *(em andamento)*
- **P2 — Wiring do preview:** `preview-nacionalizacao.ts` alimenta vUnCom=nf_unit, cEAN/xProd/CEST do dbprod, impostos (ICMS60/IPI/PIS/COFINS/IBSCBS) da tributação do produto, vOutro rateado, ordem por referência, partida por grupo de pedidos. Validar byte-a-byte contra os 2 XMLs reais.
- **P3 — Prévia (DANFE):** render PDF "SEM VALOR FISCAL".
- **P4 — Emitir (homologação):** numeração + assinatura + transmissão + gravação; depois produção.
- **P5 — Tela Gerar Entrada:** grupo de pedidos → entrada por grupo → Confirmar Preço (média).

> **Checkpoint:** implementar P1–P2 e **validar contra os XMLs reais** antes de transmitir (P4).
