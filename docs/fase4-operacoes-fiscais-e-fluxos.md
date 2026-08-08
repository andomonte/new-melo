# FASE 4 — Operações fiscais e fluxos de faturamento (mapeamento Delphi/Oracle)

> Levantamento **de referência** para o porte das operações fiscais além de SAÍDA/VENDA.
> Nada implementado aqui — é o retrato fiel do Delphi + motor Oracle, para guiar P2/P3.
> Fontes:
> - Motor: `scripts/oracle_calculo_imposto.sql` / `docs/oracle-calculo-imposto.sql` (package `CALCULO_IMPOSTO`)
> - Tela: `Desenvolvimento/Formularios/FATURAMENTO/UniFrmFaturamentoUnificado.pas`
> - Venda balcão: `Desenvolvimento/Formularios/VENDA BALCAO/uniVendaBalcao.pas`
> - Complementa: `docs/fase4-campos-imposto.md`, `docs/auditoria-faturamento.md`

---

## 0. Conclusão central (a mais importante)

**O cálculo de imposto NÃO acontece em Delphi** — os forms só chamam stored procedures.
Todo o imposto é server-side no package Oracle `CALCULO_IMPOSTO`.

O motor recebe **três** entradas de operação, **todas escolhidas pelo operador** nos
RadioGroups da tela de faturamento (não derivam de `dbvenda.operacao`):

| Entrada do motor | Valores | Origem na tela |
|---|---|---|
| `Tipo_Movimentacao` | SAIDA, ENTRADA, ENTRADA_COMPRAS | `RdgTipo_Movimentacao` (`:1683-1685`) |
| `TipoOperacao` | VENDA, TRANSFERENCIA, DEVOLUCAO_*, REMESSA_*, ... | `RdgTipo_Operacoes_cfop_Saida/Entrada` (CASE `:5572-5599` / `:5794-5807`) |
| `TipoFatura` | NOTA_FISCAL, FAG | `RdgTipo_Documentacao` (`:1677-1679`) |

O campo **"Documento" da venda** (`dbvenda.operacao` → `dboperacao_venda.cod_operacao`:
1-VENDA, 2-ORDEM SERVIÇO, 3-EMPENHO, 4-GARANTIA, 5-TRANSFERÊNCIA, 6-FALTA PRODUTO, 8-AVARIA;
7 pulado, 9-TODAS=filtro) é **classificação comercial / roteamento**, não entra direto no
cálculo. Ele só decide **por qual fluxo/tela** a operação passa. Há um mapeamento
`operacao → TipoOperacao` **no servidor Oracle** (procs `SITUACAO_VENDA` etc., fora do repo).

---

## 1. Os três fluxos que chegam ao faturamento

Todos convergem para as **mesmas procs de cálculo** (`CARREGA_PRODFATAUX` → `CALCULO_IMPOSTO` + DIFAL);
só mudam os controles de UI e os parâmetros movimentação/operação.

| Fluxo | Doc. origem (tabela / TipoDoc) | Tela que GERA o documento | `Tipodoc_fatura` | Portado web? |
|---|---|---|---|---|
| **Venda** | `dbvenda` (`'V'`) | Venda balcão / digitação | `'V'` | ✅ só SAÍDA/VENDA/NF |
| **DI (Documento Interno)** | tabela `DOCUMENTO` (`'I'`) | `PRE-PEDIDO PARA DI/UnitPrePedidoParaDI.pas` (menu "Criar DI Automático") **ou** cadastro manual `DOCUMENTO INTERNO/UniDocInterno.pas` → proc `DOCINTERNO.INC_DOCINTERNO` | `'I'` | ❌ |
| **Transferência** | package `TRANSFERENCIA_ENTRADA` | `TRANSFERENCIA ENTRADA/UniTransferenciavenda.pas` (`spInc_Transferencia.ExecProc`); consulta em `ALTERAR TRANSFERENCIA` | — | ❌ |
| **Devolução** | — | `DEVOLUCAO/UniDevolFat.pas` | — | ❌ |

### 1.1 Roteamento na venda balcão (`uniVendaBalcao.pas:130-143`)
Se a venda é rotulada `'TRANSF'` ou `'DEVOLUCAO'` (pela proc `VENDAS.SITUACAO_VENDA`), a venda balcão
**bloqueia** e manda para a tela específica:
- TRANSFERÊNCIA → "Consultas e Operações (Transferência)" (`ALTERAR TRANSFERENCIA`)
- DEVOLUÇÃO → "FATURAMENTO→DEVOLUÇÃO" (`DEVOLUCAO/UniDevolFat.pas`)

### 1.2 Fluxo DI (Documento Interno) — `UniFrmFaturamentoUnificado.pas`
- Botão "FATURAR DI" → `Iniciar_Fatura_DI` (`:2266`, `Tipodoc_fatura:='I'`)
- Lista DIs via `FATURAMENTOS.CARREGA_DOCUMENTOS(vtipo='I')` (`:2362-2364`)
- Continuar → monta parâmetros (controles sufixo `DI`: `RdgTipo_MovimentacaoDI`, `cboxDI_ZerarIPI/ICMS/...`,
  `meDI_MVA_Antecipado`) e chama `CARREGA_PRODFATAUX` + DIFAL — mesmas procs do fluxo de venda (`:3264-3269`).
- Movimentação pode ser ENTRADA **ou** SAÍDA (`:3204-3206`).

---

## 2. Regras por operação — SAÍDA

`Operacao_cfop` (string) ← `RdgTipo_Operacoes_cfop_Saida.ItemIndex` (`:5572-5599`):
`0 VENDA · 1 TRANSFERENCIA · 2 DEVOLUCAO_COMPRA · 3 DEVOLUCAO_TRANSFERENCIA · 4 REMESSA_BONIFICACAO ·
5 REMESSA_EXPOSICAO · 6 REMESSA_DEMOSTRACAO · 7 REMESSA_ARMAZEM · 8 REMESSA_GARANTIA_FABRICA ·
9 REMESSA_CONSERTO · 10 SIMPLES_REMESSA · 11 REMESSA_GARANTIA_CLIENTE · 12 EXTRAVIO_AVARIA_FABRICA ·
13 EXTRAVIO_AVARIA_CLIENTE · 14 RETORNO_REMESSA_GARANTIA · 15 RETORNO_REMESSA_CONSERTO · 16 OUTROS`

### 2.1 `Tipo_Operacao_Saida` — CFOP fixo + flag `Pode_ST` (`:1815-2035`)
Para VENDA/TRANSFERENCIA/DEVOLUCAO/GARANTIA/EXTRAVIO o CFOP fica `null` (calculado depois);
para as **remessas** o CFOP é **fixado literal** e `Pode_ST := False`.

| Operação (SAÍDA) | Pode_ST | CFOP int. | CFOP interest. | Linhas |
|---|---|---|---|---|
| VENDA | True | null→Validar | null→Validar | 1821-1832 |
| TRANSFERENCIA | True | null→Validar | null→Validar | 1833-1844 |
| DEVOLUCAO_COMPRA | True | null→Validar | null→Validar | 1845-1856 |
| DEVOLUCAO_TRANSFERENCIA | True | null→Validar | null→Validar | 1857-1868 |
| REMESSA_BONIFICACAO | False | 5910 | 6910 | 1869-1880 |
| REMESSA_EXPOSICAO | False | 5914 | 6914 | 1881-1892 |
| REMESSA_DEMOSTRACAO | False | 5912 | 6912 | 1893-1904 |
| REMESSA_ARMAZEM | False | 5905 | 6905 | 1905-1916 |
| REMESSA_GARANTIA_FABRICA | True | null→Validar | null→Validar | 1917-1928 |
| REMESSA_CONSERTO | False | 5915 | 6915 | 1929-1940 |
| SIMPLES_REMESSA | False | 5949 | 6949 | 1941-1952 |
| REMESSA_GARANTIA_CLIENTE | True | null→Validar | null→Validar | 1953-1964 |
| EXTRAVIO_AVARIA_FABRICA | True | null→Validar | null→Validar | 1965-1976 |
| EXTRAVIO_AVARIA_CLIENTE | True | null→Validar | null→Validar | 1977-1988 |
| RETORNO_REMESSA_GARANTIA | False | 5949 | 6949 | 1989-2000 |
| RETORNO_REMESSA_CONSERTO | False | 5949 | 6949 | 2001-2012 |
| else / OUTROS | False | mantém (manual) | mantém | 2023-2031 |

> `RETORNO_*` e `EXTRAVIO_*` **não existem** em `Validar_CFOP_Saida` — prevalece o CFOP fixado aqui (ou nenhum, p/ EXTRAVIO).

### 2.2 `Validar_CFOP_Saida` — só reescreve CFOP quando `Pode_ST` (`:2190-2362`, chamado em `:684-685`)

| Operação | s/ ST int. | c/ ST int. | s/ ST interest. | c/ ST interest. |
|---|---|---|---|---|
| VENDA | 5102 (5405 se convênio/protocolo/agregado; 6108 se dest. F/ISENTO) | 5403 | 6102 | 6403 |
| TRANSFERENCIA | 5152 | 5409 | 6152 | 6409 |
| DEVOLUCAO_COMPRA | 5202 | 5411 | 6202 | 6411 |
| DEVOLUCAO_TRANSFERENCIA | 5209 | 5209 | 6209 | 6209 |
| REMESSA_GARANTIA_FABRICA / CLIENTE | 5949 | 5949 | 6949 | 6949 |
| EXTRAVIO_AVARIA_FABRICA / CLIENTE | 5949 | 5949 | 6949 | 6949 |

### 2.3 ICMS (`Calcular_ICMS` `:811-855`)
Não olha `TipoOperacao` direto — depende de `Aliquota_ICMS` (já zerada se "Zerar ICMS") e do CFOP.
Único ajuste por CFOP: base reduzida 20% se CFOP ∈ (5551, 6651, 1553) (`:838-843`).
ST só se `Pode_ST` (`:645-695`); senão base/valor ST, MVA, ICMS interno/externo = 0 (`:689-695`).
CST ICMS (`ICMS_CST` `:3237-3288`): CFOP 5949→sufixo `40`; 6915/6916→sufixo `50`.

### 2.4 PIS/COFINS saída (`Calcular_PIS_COFINS_Saida` `:2821-2929`)
**Só VENDA é tributada** (CST 01, 1,65%/7,60% — `:2911-2918`; monofásico/AM CST 04/06 zerados `:2854-2887`).
Todo o resto → `else`: **CST 49, tudo zerado** (`:2919-2928`).

### 2.5 IPI saída (`Validar_IPI` ramo SAIDA `:1648-1665`; CST `VALIDAR_CSTIPI` `:2779-2799`)
Depende de `RowProd.Isentoipi`; DEVOLUCAO_COMPRA/DEVOLUCAO_TRANSFERENCIA/REMESSA_GARANTIA_FABRICA/
REMESSA_CONSERTO formam grupo especial (`:1653-1657`). Destino pessoa física → IPI=0 (`:1667-1669`).
CST-IPI: 50 tributado, 51 (Isentoipi='Z'), 55 (zona incentivada 'S'), 99 else.

### 2.6 IBS/CBS saída (`Calcular_IBS_CBS` `:857-1082`, corpo `:960-1080`)
| Condição | CST | CClassTrib |
|---|---|---|
| TipoOperacao = TRANSFERENCIA | 410 | 410002 |
| TipoOperacao = REMESSA_BONIFICACAO | 410 | 410001 |
| CFOP começa com 7 (exportação) | 410 | 410004 |
| REMESSA_CONSERTO / RETORNO_CONSERTO | 200 | 200022 (sem preencher valores) |
| ZFM/ALC específicos (cidades / origem≠Manaus) | 200 | 200022/200024 (com crédito) |
| **resto (inclui VENDA, DEVOLUCAO_COMPRA, REMESSA_EXPOSICAO...)** | 000 | 000001 (IBS-UF/IBS-Mun/CBS calculados `:1050-1079`; CBS zerada se mesma ALC/ZFM) |

---

## 3. Regras por operação — ENTRADA

`RdgTipo_Operacoes_cfop_Entrada.ItemIndex` (`:5794-5807`):
`0 COMPRA · 1 TRANSFERENCIA · 2 DEVOLUCAO_VENDA · 3 DEVOLUCAO_TRANSFERENCIA · 4 ENTRADA_BONIFICACAO ·
5 RETORNO_EXPOSICAO · 6 ENTRADA_DEMOSTRACAO · 7 ENTRADA_ARMAZEM · 8 RETORNO_GARANTIA_CLIENTE ·
9 RETORNO_GARANTIA_FABRICA · 10 RETORNO_CONSERTO · 11 OUTROS`

Motor separa entrada em `:613` (entra em cálculo se `TipoFatura='NOTA_FISCAL'` OU `Tipo_Movimentacao='ENTRADA_COMPRAS'`).

### 3.1 `Tipo_Operacao_Entrada` — CFOP fixo + Pode_ST (`:2037-2188`)
| Operação (ENTRADA) | Pode_ST | CFOP int. | CFOP interest. | Linhas |
|---|---|---|---|---|
| COMPRA | True | null→Validar | null→Validar | 2043-2054 |
| TRANSFERENCIA | True | null→Validar | null→Validar | 2056-2067 |
| DEVOLUCAO_VENDA | True | null→Validar | null→Validar | 2068-2079 |
| DEVOLUCAO_TRANSFERENCIA | True | null→Validar | null→Validar | 2080-2091 |
| ENTRADA_BONIFICACAO | False | 1910 | 2910 | 2092-2103 |
| RETORNO_EXPOSICAO | False | 1914 | 2914 | 2104-2115 |
| ENTRADA_DEMOSTRACAO | False | 1912 | 2912 | 2116-2127 |
| ENTRADA_ARMAZEM | False | 1905 | 2905 | 2128-2139 |
| RETORNO_GARANTIA_FABRICA | True | null→Validar | null→Validar | 2140-2151 |
| RETORNO_GARANTIA_CLIENTE | True | null→Validar | null→Validar | 2152-2163 |
| RETORNO_CONSERTO | False | 1916 | 2916 | 2164-2175 |
| else / OUTROS | False | mantém | mantém | 2176-2184 |

### 3.2 `Validar_CFOP_Entrada` (`:2364-2493`)
| Operação | s/ ST int. | c/ ST int. | s/ ST interest. | c/ ST interest. |
|---|---|---|---|---|
| COMPRA | 1102 | 1403 | 2102 | 2403 |
| TRANSFERENCIA | 1152 | 1409 | 2152 | 2409 |
| DEVOLUCAO_VENDA | 1202 (1411 se ST/protocolo/agregado) | 1411 | 2202 | 2411 |
| DEVOLUCAO_TRANSFERENCIA | 1209 | 1209 | 2209 | 2209 |
| RETORNO_GARANTIA_FABRICA / CLIENTE | 1949 | 1949 | 2949 | 2949 |

Extra: `ENTRADA_COMPRAS` de produto 'MC' (uso/consumo) → CFOP por `VALIDA_CFOP_USUCONSUMO` (`:696-698`).

### 3.3 PIS/COFINS compra (`Calcular_PIS_COFINS_Compra` `:2495-2733`)
**Só calcula se `Tipo_Movimentacao='ENTRADA_COMPRAS'`**; senão CST 08, tudo zerado (`:2508-2517`).
Dentro de ENTRADA_COMPRAS, crédito só para `TipoOperacao in (COMPRA, TRANSFERENCIA)`, ramificando por
regime do fornecedor (Simples '0'→CST 73 zero; Presumido '1'; Real '2') e destino AM (`:2520-2733`).

### 3.4 IPI/CST-IPI entrada (`:1617-1647`, `:2739-2778`)
DEVOLUCAO_VENDA/DEVOLUCAO_TRANSFERENCIA/TRANSFERENCIA como grupo (IPI só se UF diferente `:1620-1623`).
Importado STRIB 1/2/3 + `Cobrar_Ipi_Importado=0` → IPI=0 (`:1626-1628`). CST-IPI entrada: 00, 01('Z'), 05(zona'S'), 49 else.

---

## 4. FAG — operação que zera tudo

Se `TipoFatura ≠ 'NOTA_FISCAL'` e não é `ENTRADA_COMPRAS` → `else` FAG: **todos os impostos zerados,
CFOP nulo** (`:795-808`). Acionado por `RdgTipo_Documentacao.ItemIndex=0` (`:1677-1679`).

---

## 5. Travas de UI (replicar no porte)

- **Troca de movimentação** (`RdgTipo_MovimentacaoClick` `:1428-1446`): ENTRADA força "Gerar Cobrança=Não"
  e desabilita o RadioGroup de cobrança; SAÍDA reabilita. Sempre reseta operação p/ ItemIndex 0.
- **Gerar Cobrança por operação de saída** (`btnOPSaidaClick` `:5607-5617`): só VENDA(0),
  REMESSA_EXPOSICAO(5)/DEMOSTRACAO(6)/GARANTIA_FABRICA(8)/CONSERTO(9) e EXTRAVIO(12,13) permitem cobrança;
  resto trava em "Não".
- **OUTROS** (saída 16 / entrada 11) → abre painel de **CFOP manual** (`pncfop`).
- **EXTRAVIO** (12,13) → abre painel de **Terceiro** (`pnTerceiro`), natureza "EXTRAVIO E AVARIA".
- **Devoluções desabilitadas na tela** de faturamento (itens 2 e 3 dos dois RadioGroups travados em `:966-969`) — feitas em tela própria.
- **Zerar ICMS × Desconto Suframa** mutuamente exclusivos (`:5247-5252`, `:5254-5268`); Suframa só p/ cliente
  com Suframa fora do estado, ou DEV/RETORNO_GARANTIA quando empresa AM (`:5257-5267`).
- **MVA Antecipado** só habilita com "Imposto antecipação" marcado (`:5164-5170`).
- Flags enviados ao motor (`:1749-1768`): `vZerar_IPI`, `vZerar_ICMS`, `vZerar_SUBSTITUICAO`,
  `vDescontoSuframa`, `vMVA_ANTECIPADO`. (Aplicados em `CARREGA_PRODFATAUX` antes do `Calcular_Impostos`.)

---

## 6. Estado do porte web

- ✅ **SAÍDA / VENDA / NOTA_FISCAL** — `db_manaus.calcular_imposto_item` + `salvar.ts`
  (`resolverTipoOperacaoFat` só reconhece SAIDA+VENDA; resto cai no snapshot).
- ❌ **P2 — SAÍDAs especiais** (transferência, remessas, extravio, garantia): portar
  `Tipo_Operacao_Saida` + `Validar_CFOP_Saida` + IBS/CBS por operação + PIS/COFINS zerado.
- ❌ **P3 — ENTRADA / ENTRADA_COMPRAS**: ramo de entrada + crédito PIS/COFINS de compra.
- ❌ **Fluxos de origem** DI / Transferência / Devolução (telas que geram o documento a faturar).

### Pré-seleção de conveniência (opcional, não muda regra)
O web nasce fixo em SAÍDA/VENDA (`FaturamentoNota.tsx:113-114`). Poderia pré-selecionar
movimentação+operação a partir de `dbvenda.operacao` para reduzir erro do operador — **sem** alterar
o cálculo. Requer confirmar a lista real de `dboperacao_venda` no banco (o `CREATE TABLE`/seed não está no repo).

---

## 7. Risco encontrado (verificar no porte)

Em `Calcular_IBS_CBS`, o Oracle soma **valor de IBS-UF com alíquota de IBS-Mun**
(`gibscbs_gibsuf_vibsuf + gibscbs_gibsmun_pibsmun`, linhas ~996/1033/1072) — aparenta ser bug
(deveria ser `_vibsmun`). **Conferir se replicamos no PG**: se sim, é fiel-ao-bug; decidir se corrige
ou mantém para bater com o Oracle.

---

## 8. Pendências não localizadas no repo

- `CREATE TABLE dboperacao_venda` / seed com descrições dos códigos 1-9.
- Corpo das procs `CARREGA_PRODFATAUX` chamadora, `SITUACAO_VENDA`, `PROCESSO_VENDA_TO_BALCAO`,
  `VENDAS_TRANSFERENCIA`, `DOCINTERNO.INC_DOCINTERNO`, `FATURAMENTOS.CARREGA_DOCUMENTOS` — vivem no
  Oracle, não versionadas. Extrair de `all_source` se P2/P3 precisarem.
