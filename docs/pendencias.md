# Pendências - MeloSys

---
## REGRAS CRÍTICAS (aplicar em TODAS as telas)
---

### REGRA 1: NUNCA mostrar `descr` — SEMPRE usar `aplic_extendida`
- Em queries SQL: `COALESCE(dp.aplic_extendida, dp.descr)` como descrição
- No front-end: `produto.aplic_extendida || produto.descr`
- O campo `descr` é resumido/incompleto, `aplic_extendida` é a descrição real usada pelo cliente
- Toda tela que exibe descrição de produto DEVE usar `aplic_extendida`

### REGRA 2: NUNCA dar foco principal ao código (`codprod`) — SEMPRE priorizar referência (`ref`)
- O cliente/usuário trabalha com referência, NÃO com código interno
- Telas que mostram código como coluna principal devem trocar pra referência
- Código pode existir como informação secundária, mas referência é o identificador principal do usuário
- Na busca, referência tem prioridade sobre código
- Em listagens, a coluna referência deve vir antes do código

### REGRA 3: Preferências de tela SEMPRE salvas por usuário
- Toda tela que usa DataTablePadrao DEVE passar `screenKey` e `userName`
- Configurações salvas: colunas visíveis, ordem das colunas, ordenação, filtros, itens por página
- O usuário configura uma vez e o sistema lembra em qualquer dispositivo que ele logar
- Telas sem `screenKey`/`userName` perdem configuração ao recarregar — isso NÃO é aceitável

---

## Padronizações a aplicar em todas as telas

### 1. Aplicar regras críticas (aplic_extendida + ref como principal)
- **Onde já foi feito:** `src/pages/api/promocoes/get.ts`, `src/pages/api/produtos/listaEnriquecida.ts`, modal adicionar itens promoção
- **Onde falta fazer:**
  - `src/pages/api/vendas/postgresql/produto.ts` (tela de venda - busca de produto)
  - `src/pages/api/produtos/get/index.ts` (cadastro de produtos)
  - `src/pages/api/vendas/analise-liberacao.ts` (análise para liberação)
  - `src/pages/api/vendas/get.ts` (central de vendas)
  - `src/pages/api/faturamento/produtos-fatura.ts` (faturamento)
  - Qualquer outra API que retorne `descr` de `dbprod`
  - Todas as telas front-end que mostram `codprod` como principal em vez de `ref`

### 2. Busca: padronizar em todas as telas

#### Como era no Delphi:
- Busca por **prefixo** (`LIKE 'termo%'`) — nunca `%termo%`
- Input único mapeado a **uma coluna por vez** via combobox (Referência OU Aplicação/Descrição)
- Sem operadores booleanos no input — busca direta campo-a-campo
- Campos de busca: `REF`, `APLIC_EXTENDIDA`, `CODPROD`, `NOME`, `CPFCGC`

#### Como deve ser no sistema web (evolução):
- **Enter para buscar** — não buscar ao digitar. Blur busca só se tem 3+ caracteres e ainda não buscou
- **Uma palavra** = busca por prefixo (começa com)
- **Múltiplas palavras** = cada palavra busca "contém" em todas as colunas (não precisa de `%`)
- **Multi-termo inteligente** (já implementado em `buscaComFiltro.ts`):
  - Espaço = AND (todas as palavras): `pneu pirelli` → busca PNEU na descrição E PIRELLI na marca
  - `;` = OR (qualquer uma): `melo;imbo` → marca MELO OU IMBO
  - Combinável: `alavanca fiat;retentor` = (ALAVANCA E FIAT) OU RETENTOR
- **Busca multi-coluna automática** — quando o input tem múltiplas palavras:
  - Cada palavra deve ser buscada em TODAS as colunas relevantes (aplic_extendida, ref, codprod, marca)
  - Ex: `pneu pirelli` → produto que tem "pneu" em aplic_extendida E "pirelli" em marca (ou em qualquer coluna)
  - Isso resolve o caso de buscar produto + marca num único input
- **Prop `filtrarSomenteAoConfirmar={true}`** no DataTablePadrao para filtros rápidos

#### Onde já foi feito:
- `src/pages/api/produtos/buscaComFiltro.ts` — multi-termo com `;` e espaço
- `src/pages/api/produtos/listaEnriquecida.ts` — prefixo sem `%` inicial
- Tela de promoções (lista + modal adicionar) — Enter para buscar + `filtrarSomenteAoConfirmar`

#### Onde já foi feito:
- `src/pages/api/produtos/listaEnriquecida.ts` — regra completa (prefixo, multi-termo, |, ;, ", %)
- Tela de promoções (lista + modal adicionar) — Enter para buscar + `filtrarSomenteAoConfirmar`

#### Onde falta alinhar o INPUT ÚNICO com a regra da promoção:
- `src/pages/api/produtos/get/index.ts` — cadastro de produto (hoje: sempre `%termo%` em 3 colunas)
- `src/pages/api/vendas/postgresql/produto.ts` — tela de venda (hoje: `termo%` simples)
- `src/pages/api/vendas/postgresql/buscarCliente.ts` — busca de cliente
- `src/pages/api/vendas/postgresql/buscarVendedor.ts` — busca de vendedor
- `src/pages/api/compras/fornecedores.ts` — busca de fornecedor
- `src/pages/api/faturamento/` — APIs de faturamento
- Todas as demais APIs de busca do sistema

#### Onde falta alinhar o FILTRO RÁPIDO:
- Verificar que todas as telas que usam DataTablePadrao passem `filtrarSomenteAoConfirmar={true}`
- O filtro rápido já está padronizado via `buscaComFiltro.ts` (contém + multi-termo)

#### Padrão a seguir:
- **Input único**: regra da `listaEnriquecida.ts` (prefixo 1 palavra, multi-termo, |, ;, ", %)
- **Filtro rápido**: manter como está (contém + multi-termo por coluna via `buscaComFiltro.ts`)
- **Buscar só no Enter**: todas as telas com input único devem buscar só no Enter (não ao digitar)
  - Já feito: tela promoção (lista + modal adicionar itens)
  - Falta: cadastro de produto, tela de venda, clientes, fornecedores, etc.
  - Usar `filtrarSomenteAoConfirmar={true}` pra filtros rápidos

### 3. Promoção: colunas no banco ainda não salvas pela API
- **O quê:** As colunas `clientes_vinculados`, `vendedores_vinculados` e `permite_balcao` foram criadas no banco mas a API `add.ts` ainda não salva/lê esses campos
- **Onde:** `src/pages/api/promocoes/add.ts` e `src/pages/api/promocoes/get.ts`

### 4. Sininho de notificação
- **O quê:** Ícone de notificação no menu de vendas para:
  - Vendas bloqueadas aguardando desbloqueio
  - Promoções que estão expirando (exceto as que expiram em 1 dia)
- **Onde:** Layout de vendas / navBar

### 5. Tela de Análise para Liberação (vendas bloqueadas)
- **O quê:** Várias melhorias pendentes da lista original:
  - Coluna margem de venda do item + margem total nos cards
  - Edição de quantidade/preço na tela de análise
  - Botões para adicionar produto e modificar ações complementares
  - Excluir item da venda
  - Menu de ação com botão direito (histórico do item, atalhos)
  - Desmembrar itens do pedido na aba histórico
  - Incluir dados do cliente, vendedor e operador
  - Coluna custo do produto
  - Reordenar cards do cabeçalho

### 6. Na venda: remover promoção ao editar desconto/valor
- **O quê:** Quando o vendedor aplica desconto manual ou edita o valor de um item em promoção, a promoção deve ser removida daquele item (vira venda normal)
- **Onde:** `tableProd.tsx`, `tableProdRef.tsx`, `tableCar.tsx`

### 7. Importar planilha de itens da promoção
- **O quê:** Permitir importar CSV/Excel com itens (inverso do exportar), mesmas colunas do export
- **Onde:** Modal de criar/editar promoção

### 8. Performance de busca: listaEnriquecida vs produtos/get vs stored procedures
- **O quê:** A API `listaEnriquecida` faz JOINs pesados com `DISTINCT ON` em `cmp_produto` e `dbformacaoprvenda` (tabelas inteiras) causando lentidão (5-8s). A API `produtos/get` é rápida (200ms) porque busca só no `dbprod`.
- **No Delphi:** Busca era simples no `dbprod` (prefixo em ref ou aplic_extendida). Marca e preço vinham do próprio `dbprod` (`codmarca`, `prvenda`) ou via stored procedure que já retornava tudo otimizado.
- **Decisão pendente:** Avaliar por tela se precisa da listaEnriquecida (marca descritiva de `cmp_produto` + preço por tipo de `dbformacaoprvenda`) ou se `dbprod` direto basta. Onde precisar dos dados enriquecidos, avaliar se stored procedure no banco (como Delphi) seria mais performático que JOINs no código.
- **Já feito:** Modal adicionar itens promoção trocado de `listaEnriquecida` para `produtos/get`
- **Onde a listaEnriquecida pode ser necessária:** Telas que precisam preço por tipo de cliente (ZFM, Interior, etc.) ou marca descritiva

### 9. Estoque por armazém vs dbprod.qtest
- **O quê:** O estoque real no sistema usa `cad_armazem_produto` filtrado por `arm_id` (armazém). O campo `dbprod.qtest` é o estoque geral mas pode não refletir o armazém específico.
- **Onde está correto:** `/api/vendas/postgresql/produto.ts` - busca de `cad_armazem_produto` com `arm_id`
- **Onde pode estar errado:**
  - `/api/produtos/listaEnriquecida.ts` - usa `p.qtest` do dbprod
  - `/api/produtos/get/index.ts` - usa `p.qtest` do dbprod
  - `/api/promocoes/get.ts` - usa `dp.qtest - dp.qtdreservada` do dbprod
- **Impacto:** Modal de adicionar itens à promoção e tela de editar promoção podem mostrar estoque incorreto se a empresa usa múltiplos armazéns
- **Decisão pendente:** Avaliar se promoção precisa ser por armazém e se o estoque mostrado deve vir de `cad_armazem_produto`

### 10. Índices de performance criados no banco
- **O quê:** Índices criados pra acelerar buscas ILIKE com prefixo e contém
- **Índices criados em db_manaus:**
  - `idx_cmp_produto_codprod` — cmp_produto("CODPROD")
  - `idx_formacao_codprod_tipo` — dbformacaoprvenda("CODPROD", "TIPOPRECO") WHERE "PRECOVENDA" > 0
  - `idx_dbprod_aplic_ext` — dbprod(aplic_extendida text_pattern_ops)
  - `idx_dbprod_ref` — dbprod(ref text_pattern_ops)
  - `idx_dbprod_descr` — dbprod(descr text_pattern_ops)
  - `idx_dbprod_codprod_text` — dbprod((codprod::text) text_pattern_ops)
  - `idx_dbprod_aplic_trgm` — dbprod(aplic_extendida gin_trgm_ops) — extensão pg_trgm
- **Impacto:** Índices de leitura (text_pattern_ops e gin_trgm) não afetam INSERT/UPDATE/DELETE de forma perceptível. O PostgreSQL atualiza os índices automaticamente mas o custo é mínimo pra operações de escrita normais. Pode impactar levemente imports em massa.
- **Onde falta criar:** Nos bancos das outras filiais (db_portovelho, db_boavista) se usarem as mesmas buscas
- **Atenção:** Se tabelas forem recriadas ou migradas, os índices precisam ser recriados

### 11. Tabela de preço para envio ao cliente
- **O quê:** Filtro da tela de venda do Delphi para criar tabela de preço personalizada para enviar ao cliente
- **Referência:** Imagem `WhatsApp Image 2026-07-18 at 10.07.57.jpeg`

### 12. APIs na pasta dbOracle que usam PostgreSQL
- **O quê:** A pasta `src/pages/api/dbOracle/` contém 15 APIs que já foram migradas para PostgreSQL mas permanecem com o nome/caminho antigo do Oracle. Isso causa confusão e dificulta manutenção.
- **APIs afetadas:**
  - `buscarCliente.ts`, `buscarClientecompaginacao.ts`
  - `buscarCredito.ts`, `buscarCreditoTemp.ts`
  - `buscarDocumento.ts`, `buscarEmpresa.ts`
  - `buscarTransporte.ts`, `buscarUltimaVenda.ts`
  - `buscarVendedor.ts`, `buscarVendedorCod.ts`
  - `precoCliente.ts`, `produto.ts`
  - `finalizarVenda.ts`
  - Cópias: `buscarCliente copy.ts`, `finalizarVenda copy.ts`
- **O que fazer:**
  1. Mover para pastas corretas (`/api/vendas/`, `/api/clientes/`, etc.) ou criar `/api/postgresql/` unificada
  2. Atualizar TODAS as referências no frontend (buscar por `/api/dbOracle/`)
  3. Remover arquivos "copy" que são duplicatas
  4. Testar cada endpoint após a mudança
- **Risco:** Alto — muitas telas referenciam esses caminhos. Fazer com busca global e testar tudo.
- **Prioridade:** Média — não causa bug mas causa confusão para qualquer desenvolvedor
