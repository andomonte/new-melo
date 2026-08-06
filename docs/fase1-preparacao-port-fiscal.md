# FASE 1 — Preparação para portar CALCULO_IMPOSTO (Oracle → PL/pgSQL)

> Objetivo desta fase: mapear dependências, migrar tabelas faltantes, e comparar `calcular_cfop`.
> **Nada foi alterado no Oracle.** Migration aplicada apenas no Postgres DEV. Nada commitado.

## 1. Dependências do `CALCULO_IMPOSTO` (via `all_dependencies`)

Sem VIEWs nem funções/packages externos com lógica — o package é **autocontido** (calcula CFOP,
ST, PIS/COFINS etc. internamente; `LEGISLACAO_ICMS`, `Validar_CFOP_Saida`, `MESMA_ZFM`, `MESMA_ALC`
são funções **internas** dele). Única dependência de package = `CURSORGENERICO`.

### TABELAS de dados (16) — classificação: todas MIGRAR (dados)

| Tabela | Existe no PG? | Linhas (Oracle) | Ação |
|---|:--:|--:|---|
| dbprod | SIM | 388.857 | — |
| dbclien | SIM | 35.748 | — |
| dbmunicipio | SIM | 5.572 | — |
| dbclassificacao_fiscal | SIM | 10.510 | — |
| dbclassificacao_stsankhya | SIM | 880 | — |
| dbclassificacao_protocolo129 | SIM | 163 | — |
| dbclassificacao_piscofins | SIM | 70 | — |
| dbcredor | SIM | 8.019 | — |
| cad_credor_regra_faturamento | SIM | 185 | — |
| cad_legislacao_icmsst | SIM | 16 | — |
| cad_legislacao_icmsst_ncm | SIM | 1.824 | — |
| cad_legislacao_signatario | SIM | 101 | — |
| dadosempresa | SIM | 1 | — |
| dbuf_n | SIM | 28 | — |
| **alc_combinacoes** | **NÃO** | 16 | **MIGRADA** (008) |
| **zfm_combinacoes** | **NÃO** | 9 | **MIGRADA** (008) |

→ **14 já existiam; só 2 faltavam** — `alc_combinacoes` e `zfm_combinacoes` (pares de municípios IBGE
para Área de Livre Comércio / Zona Franca de Manaus — a **base da lógica Suframa/ZFM**).
Migradas em [migrations/008_add_zfm_alc_combinacoes.sql](../migrations/008_add_zfm_alc_combinacoes.sql)
(estrutura + dados; aplicada no DEV: zfm=9, alc=16).

### PACKAGE (1) — `CURSORGENERICO` — classificação: ADAPTAR (trivial)
```sql
PACKAGE cursorgenerico AS
   TYPE TIPOCURSORGENERICO IS REF CURSOR;
END;
```
É só um tipo `REF CURSOR`. No PL/pgSQL o equivalente é o tipo nativo **`refcursor`** (ou cursores
`FOR` locais). **Não há tabela nem lógica para migrar** — apenas usar `refcursor`/cursor local na tradução.

### Adaptações Oracle→PG já previstas (detalhe na FASE 2)
`%ROWTYPE` (usa `RowUF_Origem dbuf_n%rowtype` etc.) → `RECORD` ou `db_manaus.dbuf_n%ROWTYPE` (PG suporta
`%ROWTYPE`); `NVL`→`COALESCE`; `DECODE`→`CASE`; variáveis públicas de package (estado entre
`INICIALIZACAO` e `Calcular_Impostos`) → **sem equivalente direto no PG** (não há estado de package):
será necessário passar o estado explicitamente (RECORD/params) ou usar variáveis de sessão. Ponto de
atenção principal da tradução.

## 2. Comparação `calcular_cfop` (Postgres) × lógica CFOP do Oracle

**Premissa corrigida:** no Oracle **não existe `calcular_cfop` standalone** — o CFOP é interno ao
`CALCULO_IMPOSTO`, na função **`Validar_CFOP_Saida(TipoOperacao, UF_Iguais, MVA, ValorST)`**. A comparação
é entre a função simplificada do web (PG) e essa função interna.

### PG `db_manaus.calcular_cfop(p_tipo_operacao, p_uf_origem, p_uf_destino)`
Mapa fixo `interno ? 5xxx : 6xxx` por operação:
`VENDA→5102/6102`, `TRANSFERENCIA→5152/6152`, `BONIFICACAO→5910/6910`, `DEVOLUCAO→5202/6202`,
`DEMONSTRACAO→5912/6912`, `VENDA_FUTURA→5116/6116`, `CONSERTO→5915/6915`, default→VENDA.
**Não** consulta ST, MVA, protocolo/legislação, NCM, nem ZFM/ALC.

### Oracle `Validar_CFOP_Saida` (VENDA interna, trecho)
```
if LEGISLACAO_ICMS(...,'CONVENIO')  then '5405'
elsif LEGISLACAO_ICMS(...,'PROTOCOLO') then '5405'
elsif LEGISLACAO_ICMS(...,'RESOLUCAO') then '5405'
elsif LEGISLACAO_ICMS(...,'DECRETO')   then '5405'
elsif RowNCM.Agregado > 0              then '5405'
elsif (MVA>0) or (ValorST>0)           then '5403'
else                                        '5102'
-- TRANSFERENCIA: ST? 5409 : 5152 ; DEVOLUCAO_COMPRA: ST? 5411 : 5202 ; etc.
```

### Divergências (NÃO corrigir nesta fase — registrar)
1. **ST/MVA ignorados no PG:** a função PG nunca produz `5403/5405/5409/5411/...`. O Oracle escolhe o
   CFOP conforme houver ST (MVA/ValorST) ou legislação. → é a causa raiz do web dar `5102` onde o
   Oracle dá `5405`/`5403`.
2. **Legislação/protocolo:** PG não checa `LEGISLACAO_ICMS` (CONVENIO/PROTOCOLO/RESOLUCAO/DECRETO) nem
   `RowNCM.Agregado`. Oracle usa isso para 5405.
3. **Estado/contexto:** PG recebe UFs por string; Oracle usa `UF_Iguais` + estado de package
   (`DadosDestino`, `CIDADE_Destino`, `RowNCM`, `xDadosEmpresa`) carregado por `INICIALIZACAO`.
4. **Conjunto de operações:** PG tem VENDA_FUTURA/DEMONSTRACAO/CONSERTO simplificados; Oracle cobre
   DEVOLUCAO_COMPRA, DEVOLUCAO_TRANSFERENCIA, REMESSA_GARANTIA_FABRICA e outras, cada uma com variante ST.
5. **Regra especial RO/00169** (empresa UF='RO' + destino específico → 5102) existe só no Oracle.
6. **ZFM/ALC:** nem entram no `calcular_cfop` PG (as tabelas nem existiam até a migration 008).

**Conclusão FASE 1:** dependências resolvidas (2 tabelas migradas, resto já existe, CURSORGENERICO
trivial). O `calcular_cfop` PG é incompatível com o Oracle e **será substituído** pela lógica interna
traduzida na FASE 2 (não é para "consertar" o `calcular_cfop` atual — a tradução do package o torna
obsoleto). Principal desafio da tradução: **estado de package** (variáveis públicas entre INICIALIZACAO
e Calcular_Impostos) sem equivalente direto no PL/pgSQL.
