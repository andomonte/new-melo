# Divergências / adaptações da tradução CALCULO_IMPOSTO (Oracle → PL/pgSQL)

> Regra: **traduzir, não melhorar.** Comportamento mantido idêntico ao Oracle; aqui ficam só as
> adaptações de linguagem/infra (sem equivalente direto) e o que ainda não foi portado.
> Nenhuma correção de lógica foi feita silenciosamente.

## Adaptações de linguagem/infra (comportamento preservado)

1. **Estado de package → RECORD de contexto explícito.** O Oracle usa variáveis públicas
   (`RowUF_Origem/Destino`, `CIDADE_*`, `RowProd`, `RowNCM`, `DadosOrigem/Destino`, `ProdImportado`,
   `BaseReduzida`, `RowRegraCredor`) carregadas por `INICIALIZACAO` e lidas pelas demais funções.
   PL/pgSQL não tem estado de package → criado o tipo `db_manaus.ctx_calculo_imposto` e a função
   `_inicializar_contexto(...)`, e o contexto é **passado como parâmetro** para `validar_ipi`/etc.
   (migrations/010).

2. **Colunas de `dbuf_n` em maiúsculo/aspas** no PG (`"UF"`, `"ICMSINTERNO"`, `"ICMSEXTERNO"`,
   `"ZONA_ISENTIVADA"`). Uso `"..."` — equivalente ao acesso Oracle `RowUF.Uf` etc.

3. **`CARREGAR_NCM`** no Oracle faz `SELECT ... FROM dbprod` (não de `dbclassificacao_fiscal`), então
   `RowNCM.Ipi = dbprod.ipi`, `RowNCM.Agregado = dbprod.percsubst`, `RowNCM.Pis/Cofins = dbprod.pis/cofins`.
   Traduzido lendo `dbprod` direto (fiel ao original).

4. **`CIDADE_Origem` (município da empresa)**: Oracle usa `dadosempresa.municipio = dbmunicipio.descricao`
   com `SELECT INTO` (levantaria NO_DATA_FOUND se não achar). Adaptado para **subquery escalar** (retorna
   NULL se não achar) — só muda o modo de falha, não o resultado quando há match. *(A revisitar se algum
   caso depender do erro.)*

5. **`NVL`→`COALESCE`**, **booleans** Oracle→PG nativos, **`cursorgenerico.TIPOCURSORGENERICO` (REF CURSOR)**
   → cursor/loop nativo do PL/pgSQL (usado a partir do Bloco 2b em `LEGISLACAO_ICMS`).

## Ainda NÃO portado (levanta exceção explícita — nunca resultado errado silencioso)

- **`_inicializar_contexto`**: só o caminho **SAIDA** normal (venda; origem=empresa, destino=cliente).
  `ENTRADA`/`ENTRADA_COMPRAS` e as operações especiais de SAIDA (DEVOLUCAO_COMPRA/TRANSFERENCIA,
  REMESSA_GARANTIA_FABRICA, REMESSA_CONSERTO, EXTRAVIO_AVARIA_*) → `RAISE EXCEPTION` (FASE 4 / cobertura).
- **`BaseReduzida`**: no contexto está `false` por enquanto (só é usada no cálculo de ICMS — Bloco 2b).
  Será portada junto com o ICMS (checa NCM 85437099/85319000+codmarca 01094, e codprod 397302).
- **`RowRegraCredor`** (`Cobrar_Ipi_Importado`): só existe em ENTRADA (origem=fornecedor); em SAIDA fica
  NULL. Os ramos ENTRADA de `validar_ipi` foram traduzidos, mas só serão exercitados quando o contexto
  ENTRADA for portado.

## Estado da validação (harness Oracle × PG)

- **Bloco 1** (`mesma_zfm`/`mesma_alc`): 20/20 IGUAL.
- **Bloco 2a** (`_inicializar_contexto` SAIDA + `validar_ipi`): 16/16 IGUAL (4 produtos × 4 clientes).
- **Bloco 2b** (`produto_icms` + `legislacao_icms` + `validar_icms`): 32/32 IGUAL (4 produtos × 4 clientes × 2 inscrições 04/07).
- **Bloco 3** (`validar_cfop_saida`): 24/24 IGUAL (4 produtos × 3 clientes × 2 cenários ST). `validar_cfop_entrada` fica p/ FASE 4.
- **Bloco 4a** (`derivado_petroleo` + `calcular_icms`): 16/16 IGUAL (base/valor ICMS). Ramos ENTRADA_COMPRAS de base reduzida omitidos (escopo ENTRADA/FASE 4).
- **Bloco 4b** (`_legislacao_icms_leiid` + `mva_produto_legislacao` + `calcular_icms_subst`): 14/14 IGUAL (ST: base/valor/MVA + Zerar_SUBST N×S). `mva_derivado_petroleo` = stub (produtos de petróleo → FASE 4). Fórmula `LEI_MVA_AJUSTADA` avaliada por SQL dinâmico (placeholders nomeados substituídos por valores). **Ajuste 3 fechado:** Zerar_SUBST='S' zera ICMS_Int/Ext/MVA (não muda CST/CFOP).

- **Bloco 5** (`ncm_monofasico` + `calcular_pis_cofins_saida`): 16/16 IGUAL. `Calcular_PIS_COFINS_Compra`/`PIS_COFINS_VENDA` = FASE 4.
- **Bloco 6** (`tipo_operacao_saida` + `validar_cstipi` + `calcular_impostos_saida`): **8 casos × 17 campos IGUAL** (ponta-a-ponta Oracle `Calcular_Impostos` × PG). Equivalência do núcleo clássico provada. `Tipo_Operacao_Saida` só o caso comum (VENDA/transf/devolução: UF_Iguais + Pode_ST=true); nuances de Pode_ST por operação especial e o ramo ENTRADA = FASE 4.
- **Bloco 7** (`calcular_ibs_cbs` ISOLADO): 16/16 IGUAL. Reforma IBS/CBS (informativo). Depende de `dbuf_n.ibs`/`dbmunicipio.ibs` (migration 018, migradas do Oracle). **Bug preservado** por fidelidade: no CST '000' o Oracle soma `valor_ibs_uf + alíquota_ibs_mun` em `gibscbs_vibs` (provável erro; efeito nulo hoje pois ibs_mun=0). Os ~80 params mono*/trib*/credpres* da reforma ficam p/ quando entrar em vigor (função é o ponto de plugue isolado).

## FASE 2 — CONCLUÍDA ✅
Toda a procedure `CALCULO_IMPOSTO` (caminho SAIDA) portada para PL/pgSQL (migrations 009–019) com **equivalência provada Oracle × Postgres** em todos os blocos. Pendente de cobertura (FASE 4): caminho ENTRADA/ENTRADA_COMPRAS, operações especiais (devolução/garantia/remessa/conserto/extravio), `mva_derivado_petroleo`, e os ramos de base reduzida do ENTRADA_COMPRAS.

### ⚠️ Achado de DADOS (não de tradução): dbmunicipio truncado
Ao portar PIS/COFINS descobrimos que `db_manaus.dbmunicipio` no PG estava **truncado em 1000 linhas (0 de AM)**, vs 5572 no Oracle (62 AM) — a migração anterior capou a tabela. Isso quebrava a branch ZFM (cidade destino MANAUS → CST 06). **Corrigido** re-sincronizando do Oracle (migration 015). Demais tabelas de dependência: diferenças pequenas são drift normal entre os dois DEVs (dbprod 388857 vs 385580, dbclien +7, etc.) — não truncamento; `dadosempresa` tem 2 linhas no PG (uso `LIMIT 1`). **Recomendação:** antes do go-live, validar completude de dados de todas as tabelas de referência, não só a existência.

### Adaptação: SQL dinâmico da fórmula de MVA
`MVA_PRODUTO_LEGISLACAO` no Oracle usa `EXECUTE IMMEDIATE` sobre `LEI_MVA_AJUSTADA` com binds posicionais. No PG: substituo os placeholders nomeados (`:MVA_ST_ORIGINAL`→mva_orig/100, `:ALQ_INTER`→icms_ext/100, `:ALQ_INTRA`→icms_int_dest/100) pelos valores e executo a expressão aritmética resultante. Se surgir fórmula com placeholder de nome novo, revisitar.
