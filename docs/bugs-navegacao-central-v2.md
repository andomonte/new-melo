# Bugs de Navegação — Central de Vendas V2

Todos corrigidos em 19/08/2026.

## ✅ Bug 1: Scroll do dropdown não acompanha setas — CORRIGIDO
- scrollIntoView nos itens do dropdown de vendedor e status

## ✅ Bug 2: Foco vai na célula e não no botão de ação — CORRIGIDO  
- ArrowRight na última coluna foca o botão diretamente
- ArrowLeft saindo da ação devolve foco ao tbody

## ✅ Bug 3: Enter abre primeiro item em vez do menu — CORRIGIDO
- Enter agora clica no último botão da linha (botão de ação)

## ✅ Bug 4: Menu de ação abre longe do botão — CORRIGIDO
- position: fixed + useEffect mede altura real do menu após render
- Abre abaixo se cabe, acima se não cabe
- Alinha pela direita do botão

## Bug 5: Navegação no menu de ação — EM ANDAMENTO
- ↑↓ no menu move a linha do grid junto, deveria mover só dentro do menu
- Depois de navegar no menu, foco trava no datatable e não volta ao menu
- **Fix necessário:** Quando menu está aberto, bloquear navegação do grid

## ✅ Bug 6: Data mostra 00:00 — CORRIGIDO
- Vendas antigas com hora zero mostravam "18/08/2026 00:00"
- Fix: só mostra hora se diferente de 00:00

## Bug 7: Total da venda diferente do total dos itens
- Venda 002439951: itens somam R$ 37,18 mas total é R$ 38,18
- Causa provável: acréscimo de cartão de crédito que foi aplicado no backend (ACRESCIMO_CARTAO na finalizarVenda.ts) antes de removermos
- Dados já gravados no banco — não é bug de exibição, é dado inconsistente
