# Pendências - MeloSys

## Padronizações a aplicar em todas as telas

### 1. Descrição do produto: usar `aplic_extendida`
- **O quê:** Trocar `dp.descr` por `COALESCE(dp.aplic_extendida, dp.descr)` em todas as queries que retornam descrição de produto
- **Por quê:** O cliente usa a coluna `aplic_extendida` como descrição principal, não `descr`
- **Onde já foi feito:** `src/pages/api/promocoes/get.ts`
- **Onde falta fazer:**
  - `src/pages/api/vendas/postgresql/produto.ts` (tela de venda - busca de produto)
  - `src/pages/api/produtos/listaEnriquecida.ts` (modal adicionar itens promoção)
  - `src/pages/api/produtos/get/index.ts` (cadastro de produtos)
  - `src/pages/api/vendas/analise-liberacao.ts` (análise para liberação)
  - `src/pages/api/vendas/get.ts` (central de vendas)
  - `src/pages/api/faturamento/produtos-fatura.ts` (faturamento)
  - Qualquer outra API que retorne `descr` de `dbprod`

### 2. Busca: só no Enter, começa com (sem % no início)
- **O quê:** Busca não deve disparar ao digitar, só no Enter ou blur. Usar `termo%` em vez de `%termo%`
- **Por quê:** Performance e comportamento esperado pelo usuário (ele coloca % manualmente quando quer "contém")
- **Onde já foi feito:** `src/pages/api/produtos/listaEnriquecida.ts`, modal de adicionar itens promoção
- **Onde falta fazer:**
  - Todas as telas com SearchInput que buscam ao digitar (debounce)
  - APIs que usam `%${termo}%` no ILIKE

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

### 8. Tabela de preço para envio ao cliente
- **O quê:** Filtro da tela de venda do Delphi para criar tabela de preço personalizada para enviar ao cliente
- **Referência:** Imagem `WhatsApp Image 2026-07-18 at 10.07.57.jpeg`
