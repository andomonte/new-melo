# Perguntas ao contador — NF-e de nacionalização (importação ZFM)

Objetivo: fechar as definições fiscais para **emitir e transmitir ao SEFAZ** a NF-e de entrada de
importação (nota de nacionalização) da MELO (distribuidora de autopeças, Zona Franca de Manaus).

Contexto técnico: a nota é NF-e modelo 55, **tpNF=0 (entrada)**, **emitente = MELO**, **destinatário =
exterior** (idEstrangeiro, UF=EX), **CFOP série 3**, com **grupo DI + adição + grupo II por item** e
**origem 1** (estrangeira). Os valores de II/IOF/AFRMM/despesa aduaneira/base do II vêm da DI; os demais
impostos são calculados. O que está entre colchetes é o que o sistema assume hoje — **confirmar ou corrigir**.

---

## A. Enquadramento da operação
1. **CFOP padrão** da nota: `3.102` (importação p/ comercialização) é o correto para a revenda? Há casos de `3.101` (industrialização) ou `3.949`?
2. **Natureza da operação** (texto `natOp`): qual o padrão? [hoje: "IMPORTACAO DIRETA P/ COMERCIALIZACAO"]
3. **Forma de importação** (`tpIntermedio`): a MELO importa por **conta própria (1)**, conta e ordem (2) ou encomenda (3)? Sempre a mesma?

## B. Destinatário exterior (quando a DI tem vários exportadores)
4. Padrão **uma nota por DI** (vários exportadores na mesma nota, `cExportador` por item) está correto, ou a contabilidade exige **uma nota por exportador**?
5. **`cExportador`**: usar o **código do cadastro** do fornecedor estrangeiro (como no legado) ou o nome? Qual `cPais` e `idEstrangeiro` usar quando há vários?

## C. ICMS
6. O **ICMS de importação** é calculado **"por dentro"** — `BC = (VA + II + IPI + PIS + COFINS + Siscomex + AFRMM + despesas) / (1 − alíquota)`? Qual **alíquota interna do AM**?
7. Na ZFM, a nota sai com **ICMS desonerado/isento**? Se sim, usar `vICMSDeson` + motivo da desoneração? Qual **CST** de ICMS (com origem 1)?
8. **Antecipação / DIFAL** se aplica à nota de nacionalização, ou só nas saídas?

## D. II / IPI / PIS / COFINS
9. **II e IPI** ficam **suspensos (= 0)** na entrada para revenda na ZFM — confirmar que vão **zerados** na nota (grupo `<II>` com `vII=0`) e qual **CST de IPI** (50/51).
10. **PIS/COFINS-importação**: **incidem** (valores reais) e devem aparecer na nota? Com qual **CST** (01, 50…)? Entram no total como `vPIS`/`vCOFINS`?
11. **Siscomex, AFRMM, despesas aduaneiras, IOF**: entram em qual campo do total — **`vOutro` (Outras Despesas)**? É esse o padrão da MELO?

## E. Totais / vNF
12. **Composição exata do `vOutro`**: II + IOF + despesa aduaneira + Siscomex + AFRMM + PIS/COFINS? Quais entram?
13. **Fórmula do `vNF`** confirmada: `vProd − vDesc − vICMSDeson + vFrete + vSeg + vOutro + vII + vIPI`?
14. **`vProd` de cada item**: é o **valor aduaneiro (CIF) em R$** pela taxa do dólar da DI, ou outro valor?

## F. Reforma tributária (IBS/CBS) — obrigatório desde 03/08/2026
15. A nota de nacionalização já deve **preencher IBS/CBS** (`CST` + `cClassTrib` por item) desde já?
16. **Crédito presumido de IBS** na importação para **revenda presencial na ZFM (50%)**: aplicar na nota? Como registrar?
17. Preencher o **grupo ZFM do leiaute** (`gALCZFMCBS`)?

## G. Custo do estoque
18. Custo do item = **VA + II + IPI (não recuperável) + despesas rateadas**, deixando **de fora os tributos recuperáveis** (ICMS, PIS/COFINS, IBS/CBS)? Confirmar o **regime** (lucro real com crédito?).

## H. Numeração / série / ambiente
19. **Série** da nota de nacionalização (série própria? série 2?) e **numeração** (sequência própria ou compartilhada com as vendas)?
20. **Emitente**: matriz AM, com qual **IE** (inscrição 07)? Certificado e-CNPJ da MELO.
21. Validar primeiro em **homologação**, depois produção — ok?

## I. Operacional
22. **Entrega fracionada** existe para importação (nota mãe + remessas por carga)?
23. Alguma **NCM excluída do benefício ZFM** entre os produtos importados (bloqueia a isenção)?

---

### O que já está pronto no sistema (para contexto do contador)
- Montagem do XML com grupo DI/adição/II, destinatário exterior, CFOP série 3, origem 1 — **validado em preview** (não transmitido).
- Rateio de II por item e os dois modos de emissão (por DI / por exportador).
- Falta apenas **fechar as definições acima** para calcular os totais finais, assinar e **transmitir ao SEFAZ**.
