# Auditoria do módulo de Importação (ZFM) — SysMelo

**Data:** 2026-10-01
**Escopo:** conformidade do código atual com `docs/regras-importacao-zfm.md` (regras A1–F6).
**Método:** leitura do código (read-only, sem alterações) do módulo de importação/compras, emissão de NF-e, cálculo de tributos, cadastros (NCM/produto) e custeio de estoque.
**Importante:** esta auditoria aponta divergências de código vs. especificação. As alíquotas/enquadramentos legais devem ser confirmados com a contabilidade. Itens marcados **(confirmar)** podem ser intencionais — ver seção "Pontos a confirmar".

---

## 1. Sumário executivo (3 achados estruturais)

1. **O módulo de Importação é controle de CUSTO da DI, não emissão fiscal.**
   `src/components/corpo/comprador/Importacao/**` + `src/pages/api/importacao/**` fazem: parse do XML **DIe (SEFAZ-AM)**, rateio de despesas/impostos por item e geração de uma **entrada de estoque** em `dbnfe_ent` — tratando o **fornecedor como emitente** (`gerar-entradas.ts:135`), como se fosse uma NFe recebida. **Não existe emissão da NF-e de entrada de importação** (nota de nacionalização, tpNF=0 pelo importador). → **toda a seção B está ausente** nesse cenário.

2. **Não há motor de cálculo tributário de importação.**
   `xmlParser.ts` **ingere os tributos já calculados** da DIe (vlII, vlIPI, vlPisCofins, vlIcms) e `calcular-custos.ts` apenas **rateia por FOB**. Não há fórmula própria II→IPI→PIS/COFINS→ICMS "por dentro", nem cadastro de alíquota de importação por NCM, nem AFRMM, nem validação de totais. → **C3–C6, C8–C10 ausentes como lógica**.

3. **Dois motores de IBS/CBS paralelos e desconectados.**
   O motor "rico" com lógica ZFM/ALC/suspensão/crédito presumido (`src/utils/calculoIBSCBS.ts` + `src/constants/tributacao2026.ts`) é **código morto** (nenhum fluxo o importa). O motor **vivo** que emite NF-e (`calculadoraImpostos.ts` → `normalizarPayloadNFe.ts` → `gerarXml.ts`) **não tem lógica de ZFM** e emite **CST `000` / cClassTrib `000001` fixos**. → toda a inteligência ZFM existe, mas não é usada na emissão real.

**Placar (45 regras):** ✅ 2 · ⚠️ 14 · ❌ 27 · ❓ 2.

---

## 2. Status por regra

### A — Fluxo e entidades

| Regra | Status | Evidência | O que falta |
|---|:--:|---|---|
| A1 Entidade DI | ⚠️ | `types/importacao.ts:20`; tabela `dbent_importacao` (`post.ts:19`) — tem nro_di, data_di, tipo_die, recinto, país, navio, suframa | local/UF de desembaraço; data de desembaraço codificada; via de transporte como **código**; **forma de importação** (1/2/3); CNPJ adquirente/encomendante |
| A2 Entidade Adição | ❌ | Adição é parseada (`xmlParser.ts:155-172`) mas **não persistida**; só `numero_adicao` achatado no item | tabela Adição (nº, sequencial, fabricante, NCM, valor) vinculada à DI |
| A3 Item ↔ adição | ⚠️ | `numero_adicao` por item (`post.ts:189`) | **nSeqAdic** e **cFabricante** inexistentes |
| A4 DUIMP | ❌ | parser fixo ao layout DIe SEFAZ-AM (`xmlParser.ts:21`); 0 ocorrências de "DUIMP" | suporte a DUIMP |
| A5 SUFRAMA + anuência | ⚠️ | SUFRAMA da empresa gravada (`post.ts:138`) | licenciamento/anuência (LI) como **registro** — hoje `anuencia` é só um **valor** monetário |
| A6 Câmbio imutável | ⚠️ | câmbio gravado (`ContratoCambio`, `post.ts:41`) | **imutabilidade**: contratos são apagados/reinseridos a cada PUT (`[id].ts:242-256`); só trava após status 'E' |

### B — NF-e de entrada de importação  **(ver "Pontos a confirmar" nº 1)**

| Regra | Status | Evidência | O que falta |
|---|:--:|---|---|
| B1 tpNF=0 pelo importador | ❌ | `gerar-entradas.ts` grava `dbnfe_ent` (fornecedor=emitente), não emite NF-e | emissão própria tpNF=0 |
| B2 Destinatário estrangeiro | ❌ | `gerarXml.ts:343-362` sempre CNPJ nacional; cMun `'1302603'` fixo; 0 ocorrências de `idEstrangeiro` | bloco dest. exterior (UF EX, cMun 9999999, cPais, idEstrangeiro) |
| B3 CFOP série 3 | ❌ | CFOP default `'5102'` (`gerarXml.ts:436`); 0 ocorrências de 3102/3101/3949 | CFOPs 3.102/3.101/3.949 |
| B4 Validação CFOP⇔exterior⇔DI | ❌ | nenhuma das três partes existe | validação cruzada |
| B5 Grupo DI no XML | ❌ | 0 ocorrências de nDI/cExportador/vAFRMM/tpViaTransp | grupo DI completo |
| B6 Grupo II por item | ❌ | `det.imposto` só monta ICMS/IPI/PIS/COFINS/IBSCBS (`gerarXml.ts:451-462`) | vBC/vDespAdu/vII/vIOF por item |
| B7 CST ICMS origem 1 | ❌ | origem default `'0'` (`gerarXml.ts:25`) | origem 1 derivada da importação |
| B8 Origem propagada p/ venda | ❌ | `gerar-entradas.ts` não grava origem fiscal | persistir e propagar origem à venda |
| B9 Totais (fórmula leiaute) | ❌ | vII total fixo `'0.00'` (`gerarXml.ts:480`); sem vServ; vOutro não parametrizável | vNF com vII/vServ e vOutro parametrizável (PIS/COFINS/Siscomex/ICMS) |

### C — Cálculo

| Regra | Status | Evidência | O que falta / diverge |
|---|:--:|---|---|
| C1 Valor aduaneiro | ⚠️ | `total_cif = FOB+frete+seguro` (`xmlParser.ts:214`) | sem conceito "VA" nomeado; câmbio usado é `txDolarMedio+0.10`, não o **câmbio da DI** (ver H1) |
| C2 Incoterm CIF sem duplicar | ❌ | sem campo Incoterm; sempre soma frete+seguro | tratamento de Incoterm |
| C3 II = VA×alíq NCM | ❌ | `ii` lido pronto (`calcular-custos.ts:57`) e rateado | cálculo por alíquota de NCM |
| C4 IPI = (VA+II)×alíq | ❌ | idem C3 | fórmula própria |
| C5 PIS/COFINS = VA×alíq (cadastro NCM) | ❌ | `pis_cofins` somado da DIe e rateado | alíquota por NCM, separação PIS/COFINS, regra autopeças (Lei 10.485/10.865). Cadastro NCM tem pis/cofins mas **não alimenta importação** |
| C6 ICMS "por dentro" (+AFRMM) | ❌ | `icmsTotal = icms_st × perc` rateado (`calcular-custos.ts:136-138`) | gross-up `BC/(1−aliq)`; **AFRMM inexistente** |
| C7 Rateio configurável FOB/peso | ⚠️ | rateio por FOB (`calcular-custos.ts:131-142`) | opção por **peso** (peso_liquido gravado mas não usado); **seguro** não entra no rateio de despesa |
| C8 Resíduo no último item | ❌ | itens calculados independentes | ajuste de fechamento com a DI |
| C9 Validação de totais | ❌ | nenhuma validação | VA nota = VA DI; soma por adição = valor da adição |
| C10 Alíquota com vigência | ❌ | sem tabela de alíquota de importação | vigência por data de registro da DI |

### D — Zona Franca de Manaus

| Regra | Status | Evidência | O que falta / diverge |
|---|:--:|---|---|
| D1 Isenção II/IPI ZFM | ❓ | sem lógica explícita; confia no XML (`calcular-custos.ts:57-58`) | validar/aplicar isenção; hoje se a DI trouxer II/IPI, **entram no custo** sem checar |
| D2 NCMs excluídos do benefício | ❌ | não existe lista/bloqueio | cadastro de NCMs excluídos (armas, fumo, bebidas, perfumes, autos) |
| D3 PIS/COFINS incidem na revenda | ⚠️ | não aplica suspensão (bom); mas soma ao custo (`:145`) | parametrizar incidência/crédito; separar PIS/COFINS (ver F4) |
| D4 Controle de internação/rastreio | ⚠️ | `numero_adicao` capturado | **saldo por DI/adição** e baixa na venda (ver F1) |
| D5 Venda interestadual 4% (origem 1) | ❓ | origem '1' só filtra importados na associação (`auto-associar.ts:113`) | regra dos 4% vive no faturamento (fora deste módulo) — **confirmar lá** |
| D6 AFRMM parametrizável | ❌ | 0 ocorrências de AFRMM | campo + regra de não incidência N/NE |
| D7 ICMS interno do AM parametrizado | ⚠️ | zona por UF (`dbuf_n`, `gerarEntradaDbent.ts:312`) | fatores de custo `0.101`/`0.05` **hardcoded** (H3/H4) |

### E — Reforma IBS/CBS

| Regra | Status | Evidência | O que falta |
|---|:--:|---|---|
| E1 CST + cClassTrib por item | ⚠️ | emitidos (`gerarXml.ts:132-133`) mas **defaults fixos** `000`/`000001` (`normalizarPayloadNFe.ts:125-126`); `calculadoraImpostos.ts` não gera esses campos | diferenciação real por operação (ZFM/suspensão/crédito) + validação de bloqueio |
| E2 Alíquotas teste 2026 (0,9/0,1) | ✅ | `tributacao2026.ts:32-33`; PIS/COFINS em paralelo | — (ver hardcode H6) |
| E3 Estrutura p/ 2027 por vigência | ⚠️ | tabela `ALIQUOTAS_TRANSICAO` 2026-2033; SQL `buscar_aliquota_ncm(ncm,ano)` | caminho vivo não consome a tabela de forma consistente; fallback `27.0/10.0` (`calculadoraImpostos.ts:988`) **conflita** com a tabela |
| E4 Crédito presumido IBS importação (50%, art. 444) | ❌ | único "crédito presumido" é regional (7,5/13,5%) e **código morto**; `vCredPres='0.00'` fixo (`gerarXml.ts:503`) | cálculo de 50% da alíq. do IBS da importação deduzido do IBS devido |
| E5 Estorno do crédito presumido | ❌ | inexistente; depende de E4 e F1 | cálculo + gatilho (venda não presencial) + baixa por DI |
| E6 Suspensão só p/ indústria | ✅ | motor vivo **não aplica** suspensão; motor morto condiciona a `isIndustriaIncentivada` (`calculoIBSCBS.ts:377`) | **não há aplicação indevida** à distribuidora (risco é o inverso: ausência de tratamento ZFM) |
| E7 Grupo ZFM do leiaute (gALCZFMCBS) | ❌ | só gIBSUF/gIBSMun/gCBS (`gerarXml.ts:134`) | grupo ZFM + tributação teórica sem benefício |

### F — Controles posteriores

| Regra | Status | Evidência | O que falta |
|---|:--:|---|---|
| F1 Saldo por DI/adição | ❌ | `numero_adicao` é só referência; venda não baixa saldo | saldo por adição + baixa na venda (base p/ D4, E5, auditoria) |
| F2 NF complementar / custo tardio | ❌ | despesas capturadas uma vez e rateadas (`calcular-custos.ts:130`) | NF complementar + recálculo do custo médio |
| F3 Entrega fracionada | ⚠️ | 1 entrada por fatura (`gerar-entradas.ts:79`) | conceito nota-mãe + remessas por carga com saldo |
| F4 Custo = VA+II+IPI+despesas (recuperáveis fora) | ⚠️→❌ | `custoUnitReal = real+desp+icms+pisCofins` (`calcular-custos.ts:145`); `custoEntrada.ts:114-128` soma PIS/COFINS | **ICMS e PIS/COFINS recuperáveis entrando no custo**; flag "recuperável vs não" por tributo/zona (**confirmar regime** — ver nº 3) |
| F5 Conta e ordem / encomenda | ❌ | 0 ocorrências; só `cod_cliente` genérico | modelagem + vínculo terceiro (CNPJ/UF) |
| F6 Teste numérico completo | ⚠️ | único teste é de **venda** (`impostos/__tests__/calcular-completo.test.ts`), exige banco | caso completo de **importação** (VA→tributos→rateio→totais→custo); zero testes de custo/rateio |

---

## 3. Alíquotas e valores HARDCODED (consolidado)

| ID | Local | Valor fixo | Impacto |
|---|---|---|---|
| H1 | `importacao/[id]/calcular-custos.ts:124` | câmbio `txDolarMedio + 0.10` | **custo de todos os itens**; diverge de C1 (deveria ser câmbio da DI) **(confirmar — nº 2)** |
| H2 | `calcular-custos.ts:124` vs `150-154` | custo usa média+0,10; nfUnit usa taxa da DI | **dois câmbios no mesmo cálculo** |
| H3 | `lib/compras/custoEntrada.ts:144-145,152-153` | `PrUnitNF × 0.101` | fator ICMS/ZF fixo (10,1%) no custo |
| H4 | `custoEntrada.ts:148,156` | `PrUnitNF × 0.05` | fator transferência fixo (5%) |
| H5 | `calcular-custos.ts:131` | rateio só por FOB | sem critério por peso |
| H6 | `constants/tributacao2026.ts:32-39` | CBS 0,9 / IBS 0,1 / finais 9,3-18,7-28 | legal, aceitável; sem parametrização em banco |
| H7 | `lib/impostos/calculadoraImpostos.ts:988-989` | `ano===2026 ? 0.10 : 27.0` / `0.90 : 10.0` | **conflita** com `ALIQUOTAS_TRANSICAO` → alíquota errada em 2027+ |
| H8 | `impostos-ibs-cbs/index.ts:172-173` | defaults `27.0/10.0` | idem, quando o SQL falha |
| H9 | `sefazNfe/gerarXml.ts:503-504,510-511` | `vCredPres='0.00'` fixo | crédito presumido nunca emitido |
| H10 | `gerarXml.ts:350,391` | `cMun/cMunFG='1302603'` | município fixo (Manaus) |
| H11 | `gerarXml.ts:436,480,435` | CFOP `'5102'`, vII `'0.00'`, NCM `'00000000'` | defaults de saída |

---

## 4. Divergências de fórmula (vs. seção C da spec)

- **C1/H1:** custo usa `câmbio médio + R$0,10`, não o câmbio da DI. Introduz erro sistemático no custo.
- **C6:** ICMS de importação **não é recalculado "por dentro"** (`BC/(1−aliq)`); é lido pronto da DI e rateado. Sem AFRMM na base.
- **C7:** rateio mistura `invoiceTotal` (numerador) com `totalMercadoria`=FOB proforma (denominador) (`calcular-custos.ts:131`); seguro fora do rateio.
- **F4:** fórmula de custo inclui ICMS e PIS/COFINS (recuperáveis), contrariando "tributos recuperáveis não entram no custo".
- **E3/H7:** duas fontes de verdade de alíquota IBS/CBS (tabela de transição vs. fallback `27/10`) que divergem a partir de 2027.

---

## 5. ⚠️ Pontos a confirmar antes de tratar como erro

1. **Emissão da NF-e de nacionalização é escopo deste sistema?** Hoje a importação é modelada como NFe *recebida* (`dbnfe_ent`, fornecedor=emitente). Se a nota de entrada de importação (tpNF=0) é emitida **fora** (contador/legado), **toda a seção B deixa de ser gap e vira "fora de escopo"**. Se é para ser emitida aqui, é o maior esforço da lista.
2. **O `+R$0,10` no câmbio** (`calcular-custos.ts:124`, comentado como "adicional segurança") é regra de negócio deliberada ou resíduo a remover?
3. **Regime tributário da distribuidora:** PIS/COFINS/ICMS **recuperáveis** (lucro real com crédito → fora do custo, como diz F4) ou **não recuperáveis** (entram no custo)? A resposta decide se F4/D3 são bug ou correto.
4. **O motor "rico" `calculoIBSCBS.ts`** está desconectado de propósito (WIP) ou deveria estar ligado à emissão? Hoje é código morto.

---

## 6. Lista priorizada de ajustes

### Prioridade 1 — Risco de rejeição de NF-e / erro fiscal

| # | Ajuste | Regras | Esforço |
|---|---|---|:--:|
| 1 | **CST/cClassTrib reais por item** (hoje fixo `000/000001`); gerar no `calculadoraImpostos.ts` conforme operação/ZFM; validar antes de emitir | E1 | M |
| 2 | **Origem fiscal do importado** (CST origem 1) derivada da entrada e **propagada à venda**; sem isso a venda interestadual sai com origem/ICMS errados | B7, B8, D5 | M |
| 3 | **Resolver conflito de alíquota IBS/CBS** (`27/10` vs tabela de transição) — fonte única por vigência | E3, H7, H8 | P→M |
| 4 | **Grupo ZFM do leiaute** (gALCZFMCBS) quando aplicável | E7 | M |
| 5 | **Emissão da NF-e de importação** (tpNF=0, dest. exterior, CFOP 3.xxx, grupo DI, grupo II) — **se for escopo (confirmar nº 1)** | B1–B9 | G |

### Prioridade 2 — Custo / margem

| # | Ajuste | Regras | Esforço |
|---|---|---|:--:|
| 6 | **Tirar tributos recuperáveis do custo** (ICMS, PIS/COFINS) conforme regime — **confirmar nº 3** | F4, D3 | M |
| 7 | **Câmbio único = câmbio da DI** (remover `+0.10` e o duplo câmbio) — **confirmar nº 2** | C1, H1, H2 | P |
| 8 | **Parametrizar fatores de custo** `0.101`/`0.05` | D7, H3, H4 | P→M |
| 9 | **ICMS "por dentro" + AFRMM** na base de importação | C6, D6 | G |
| 10 | **Rateio configurável (FOB/peso) + resíduo no último item** | C7, C8 | M |
| 11 | **NF complementar / despesa tardia** com recálculo do custo médio | F2 | M |

### Prioridade 3 — Estrutura / melhorias

| # | Ajuste | Regras | Esforço |
|---|---|---|:--:|
| 12 | **Persistir a Adição** (nº, sequencial, fabricante, valor) + nSeqAdic/cFabricante no item | A2, A3 | M |
| 13 | **Saldo por DI/adição + baixa na venda** (base p/ internação e estorno) | F1, D4 | G |
| 14 | **Crédito presumido de IBS na importação (50%) + estorno** (depende do 13) | E4, E5 | G |
| 15 | **Validações de totais** (VA nota = VA DI; soma por adição) | C9 | P→M |
| 16 | **Cadastro de alíquotas de importação por NCM com vigência** (II/IPI/PIS/COFINS) | C3, C4, C5, C10 | G |
| 17 | **Lista de NCMs excluídos da ZFM** + bloqueio da isenção | D2, D1 | P→M |
| 18 | **Forma de importação (1/2/3) + adquirente/encomendante; conta e ordem/encomenda** | A1, F5 | M |
| 19 | **Imutabilidade do câmbio** pós-registro da DI | A6 | P |
| 20 | **Suporte a DUIMP** | A4 | G |
| 21 | **Teste numérico completo de importação** (VA→tributos→rateio→totais→custo) | F6 | M |
| 22 | **Reconectar ou remover o motor morto** `calculoIBSCBS.ts` | E4, E6 | M |

---

### Legenda
✅ Implementada · ⚠️ Parcial · ❌ Ausente · ❓ Indeterminado (fora deste módulo/depende de confirmação) · Esforço: **P** pequeno · **M** médio · **G** grande.
