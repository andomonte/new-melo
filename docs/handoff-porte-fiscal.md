# Handoff — Porte fiscal SysMelo (venda / faturamento / transferência / devolução)

> Prompt de continuidade para outro programador/agente. Continua um porte
> Delphi(Oracle) → web (Next.js Pages Router + PostgreSQL). **NÃO deduza regra fiscal**:
> transcreva fielmente do fonte Oracle. Leia os docs antes de codar.

## O que JÁ ESTÁ FEITO (não refazer)
- **Motor fiscal PG completo (BLOCO A)**: `db_manaus.calcular_imposto_item(...)` já calcula TODAS
  as movimentações/operações (SAÍDA — venda, transferência, remessas, devoluções, garantia, extravio;
  ENTRADA e ENTRADA_COMPRAS — crédito de PIS/COFINS por regime do fornecedor). Migrations `022`–`026`.
  Fiel ao Oracle. VENDA sem regressão.
- **Colunas fiscais na venda (B1)**: `db_manaus.dbvenda.tipo_movimentacao` (default `SAIDA`) e
  `tipo_operacao` (default `VENDA`) — migration `027`. Alimentam o motor.
- **Catálogo + tela de cadastro**: `db_manaus.cad_tipo_movimentacao` e `cad_tipo_operacao_fiscal`
  (migration `028`, 3 movimentações + 29 operações); CRUD web em
  `src/components/corpo/admin/cadastro/tipoOperacaoFiscal/` + API `src/pages/api/tipoOperacaoFiscal/`
  (usa `@/lib/pg`). Menu Cadastro → “Tipos de Operação Fiscal”.
- **Pendente de validação formal (A4)**: harness Oracle×PG por operação (o client Oracle não
  carregava no ambiente atual — thick mode). Até aqui: transcrição fiel + CFOPs conferidos + VENDA sem regressão.

## Documentos de referência (LEIA)
- `docs/fase4-operacoes-fiscais-e-fluxos.md` — mapa completo: os 3 fluxos (venda / DI / transf-devol),
  regras por operação (CFOP/ICMS/ST/IPI/PIS-COFINS/IBS-CBS) e travas de UI. **Comece por aqui.**
- `docs/fase4-campos-imposto.md`, `docs/auditoria-faturamento.md`.
- Fonte Oracle do motor (a “fonte da verdade” fiscal): `scripts/oracle_calculo_imposto.sql`
  (e `docs/oracle-calculo-imposto.sql`). Package `CALCULO_IMPOSTO`.

## Acessos / ambiente
- **PostgreSQL (dev compartilhado)**: host `servicos.melopecas.com.br:5432`, database `postgres`,
  schema `db_manaus`. App usa `@/lib/pg` `getPgPool()` (search_path `db_manaus,public`, via `DATABASE_URL`).
  Há também `@/lib/pgClient` `getPgPool(filial)` (por filial).
- **Oracle DEV** (só leitura/validação): `GERAL/123 @ 201.64.221.132:1524/desenv.mns.melopecas.com.br`
  (thick mode obrigatório; se `DPI-1047`, o instantclient não está compatível com a versão do Node —
  rode a validação numa máquina onde o client funcione).
- Entry-point do motor:
  `calcular_imposto_item(p_codprod, p_codcli, p_quantidade, p_valor_unitario, p_tipo_movimentacao,
   p_tipo_operacao, p_tipofat, p_insc_estadual, p_zerar_substituicao, p_mva_antecipado,
   p_zerar_ipi, p_zerar_icms, p_desconto_suframa, p_cfop_manual)`.

## Caminhos do Delphi (buscar aqui as regras/telas originais)
Raiz: `Desenvolvimento\Formularios\`
- **Faturamento (motor de tela)**: `FATURAMENTO\UniFrmFaturamentoUnificado.pas`
  (movimentação ~1683; operação CASE ~5573 saída / ~5795 entrada; envio ao motor ~1744/3266).
- **Venda balcão (processa/fatura/roteia)**: `VENDA BALCAO\uniVendaBalcao.pas`
  (bloqueio TRANSF/DEVOLUÇÃO e redirect ~130-143).
- **Venda digitação**: `VENDA\Univenda.pas` (grava `operacao` = combo cb_Doc ~1445; default VENDA ~3028).
- **Alterar venda**: `ALTERAR VENDA\UniAltVenda.pas`.
- **Transferência**: criação `TRANSFERENCIA ENTRADA\UniTransferenciavenda.pas` (form `TFrmTransfVenda`,
  menu **Entradas → Transferência**); consultas/operações `ALTERAR TRANSFERENCIA\UniAltTransferencia.pas`
  (form `TFAltTransf`, “Consultas e Operações para Transferência” — destino do redirect da venda balcão).
- **Devolução**: `DEVOLUCAO\UniDevolFat.pas` (form `TFDevolFat`, menu **Faturamento → Devolução**,
  espelho/emitir NF próprio) e `ALTERAR NF DE DEVOLUCAO\`.
- **DI (Documento Interno — FORA DO ESCOPO)**: criação `PRE-PREDIDO PARA DI\UnitPrePedidoParaDI.pas`
  e `DOCUMENTO INTERNO\UniDocInterno.pas`; faturar é modo “FATURAR DI” dentro do faturamento unificado.
- **Menu principal Delphi**: `PRINCIPAL\UniPrincipal.pas`.
> Obs.: nenhum cálculo fiscal acontece em Delphi — os forms só chamam procs; a regra está no
> package Oracle `CALCULO_IMPOSTO` (já traduzido para o PG).

## Arquivos web relevantes
- Venda: `src/components/corpo/vendas/novaVenda/index.tsx` (+ `novaVendaMobile.tsx`,
  `novaVendaV2/index.tsx`, `selectDocumento.tsx`).
- Gravação da venda: `src/pages/api/vendas/postgresql/finalizarVenda.ts` (+ `dbOracle/finalizarVenda.ts`).
- Faturamento: `src/components/corpo/faturamento/novoFaturamento/modalFaturamentonota/FaturamentoNota.tsx`
  (listas hardcoded `OPERACOES_SAIDA`/`OPERACOES_ENTRADA` ~127-159) e `.../v2/FaturamentoNotaV2.tsx`.
- Gravação da fatura + recalc: `src/pages/api/faturamento/salvar.ts` (`resolverTipoOperacaoFat` — hoje só
  libera SAÍDA/VENDA; demais caem no snapshot).
- Catálogo (fonte dos dropdowns): `src/pages/api/tipoOperacaoFiscal/`.
- Menu/permissão: `src/components/menus/padrao.tsx`; telas em `tb_telas`; permissão por grupo em
  `tb_grupo_Permissao` (grupo→tela). **Usuário precisa re-logar** para novas permissões entrarem.

## PRÓXIMAS ETAPAS (em ordem)

### B — Venda passa a carregar movimentação + operação (sem quebrar nada)
- **B2**: na tela de venda, seletor de movimentação+operação **travado em SAÍDA/VENDA por padrão**,
  visível/editável só para perfil autorizado (usar `permissoes`/`funcoes` do `perfilUserMelo`).
  Popular os dropdowns do **catálogo** (`/api/tipoOperacaoFiscal` + `/movimentacoes`) em vez das listas
  hardcoded. Gravar em `dbvenda.tipo_movimentacao`/`tipo_operacao`.
- **B4**: `finalizarVenda.ts` usar `dbvenda.tipo_movimentacao`/`tipo_operacao` no motor (hoje fixo
  `'SAIDA'/'VENDA'`). Por ora restringir as opções ao que é seguro (VENDA e variações que continuam saída
  de mercadoria vendável).
- **B3 (correções já mapeadas)** em `novaVenda/index.tsx`: (1) guarda para `Number(documento.COD_OPERACAO)`
  virar `NaN`; (2) bug do preview de imposto `COD_OPERACAO === '2' ? 'DEVOLUCAO'` (~609-610): `2` é ORDEM DE
  SERVIÇO, não devolução; (3) parse de 1 dígito no Delphi (`copy(text,1,1)`) — no web garantir multi-dígito.

### C — Faturamento consome a movimentação/operação da venda
- **C1**: `FaturamentoNota.tsx` inicializar movimentação+operação a partir de
  `dbvenda.tipo_movimentacao`/`tipo_operacao` (hoje nasce fixo SAÍDA/VENDA ~113-114).
- **C2**: `salvar.ts` `resolverTipoOperacaoFat` cobrir todas as operações (o motor já suporta).
- **C3**: campos específicos — devolução precisa da **nota original referenciada**; transferência do
  **destino (filial/armazém)**.
- **C4**: permissão para editar movimentação/operação no faturamento.
- Trocar as listas hardcoded do faturamento pela leitura do catálogo.

### D — Tela nova de Transferência (web)  |  E — Tela nova de Devolução (web)
- São **fluxos separados** (como no Delphi), NÃO um modo da tela de venda. Reaproveitar componentes
  (grid de itens, busca de produto/cliente). Transferência: sem cobrança, estoque filial→filial,
  `tipo_operacao='TRANSFERENCIA'`. Devolução: referencia nota original, inverte estoque,
  `tipo_operacao='DEVOLUCAO_*'`. Ambas alimentam o **mesmo faturamento web** (que já recalcula pelo motor).

### G — Convergência de faturamento (pendências antigas)
- **CALCULAR_TOTAIS**: portar rateio de frete/desconto/acréscimo por item + re-soma dos totais do
  cabeçalho (hoje o web grava totais crus do front). Regras no Delphi/Oracle (GERAR_FATURA → CALCULAR_TOTAIS).
- Insc. Estadual 04/07 editável na tela.

### A4 — Sign-off formal do motor (quando o Oracle client funcionar)
- Harness que chama o Oracle `CALCULO_IMPOSTO` (INICIALIZACAO + aliquotas + Calcular_Impostos) e compara
  campo-a-campo com `calcular_imposto_item` do PG, por operação — especialmente os ramos de PIS/COFINS de
  compra (9,25 / 11,50 / 13,10), que dependem de produto+fornecedor específicos.

### F — DI (Documento Interno) — FORA DO ESCOPO
- Só entra se portarem antes o fluxo de pré-pedido/televendas. Não priorizar.

## Regras a respeitar
- **Não alterar cálculo/regra fiscal por conta própria**: transcrever do fonte Oracle
  (`scripts/oracle_calculo_imposto.sql`). O catálogo controla exposição/rótulo/ordem/ativo na UI,
  NÃO a lógica do motor (que é hardcoded por operação).
- **Não commitar** sem o dono pedir. Implementar + testar e parar.
- **Alertas/avisos**: usar o modal central estilizado (`useConfirmarSalvar`), nunca toast no canto.
- **IBS/CBS**: motor isolado/informativo (não obrigatório hoje) — não bloquear nada por causa dele;
  há um TODO de CST de REMESSA_CONSERTO a revisar no refino da reforma.
- Validar cada mudança contra o PG e, quando possível, contra o Oracle.
