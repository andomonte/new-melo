# CONTEXTO — Sessão 11-14/ago/2026

Inventário completo da sessão de desenvolvimento da Nova Venda V2 (Melo Distribuidora).

---

## Arquivos lidos ou alterados nesta sessão

### Alterados diretamente

| Arquivo | O que mudou |
|---------|-------------|
| `src/components/corpo/vendas/novaVendaV2/index.tsx` | Componente principal da Nova Venda V2. Removidos botões X de todos inputs, adicionado Escape pra restaurar valor, borda azul no focus, setas ←→ navegam entre inputs, dropdowns abrem com Enter/click (não onFocus). Cartão de crédito com parcelas e acréscimo. obsfat read-only montado automaticamente. Regras classe V/D/Z/I. Tipo Movimentação e Tipo Operação (permissão TMO). Documento derivado de tipoOperacao. Forma pagamento antes do prazo, excludentes. Fechamento na semana. Prazo bloqueado com mensagem no input. Badge financeiro no cabeçalho baseado no saldo real. Requisição removida do painel (agora é por item). Validação financeira via API. Mensagens do Delphi. Botão limpar venda. |
| `src/components/corpo/vendas/bloqueadas/ModalAdicionarItemRapido.tsx` | Filtro avançado (Ctrl+F, 17 colunas). Busca por ref/aplicação com radio. F9 removido (equivalentes inline). Requisição por item (checkbox, nrequis, nritem). API de busca trocada de `/api/produtos/get` para `/api/vendas/postgresql/produto` (mesma da V1) com estoque disponível real e filtro por armazém. Props armId e tipoPreco adicionados. |
| `src/components/corpo/vendas/centralVendasV2/index.tsx` | Copiar venda corrigido (abre modal V2, não router V1). Botão Limpar Venda no cabeçalho com confirmação e key pra remontar. |
| `src/pages/api/vendas/postgresql/finalizarVenda.ts` | obsfat normalizado padrão Delphi (CARTAO DE CREDITO 02x, A VISTA (VE)/(V)/(D), sem acento). Acréscimo cartão (tabela Oracle). formaPagamento e parcelasCartao no tipo Body. avistaMotivo. nrequis adicionado no INSERT dbitvenda (faltava). Recontagem dos $params. |
| `src/pages/api/vendas/postgresql/validarCredito.ts` | **NOVO**. Replica REGRAS_VENDAS.SUBMETER_REGRA do Oracle. Verifica: classe I (inativo), Z (judicial), PF outro estado, títulos atrasados (dbreceb), crédito insuficiente. Isenta: cartão, PIX, dinheiro, débito. Classe V/D retorna OK direto. Crédito temporário desbloqueia. |
| `src/pages/api/vendas/[codvenda].ts` | obsfat prefixado com forma pagamento normalizada. Removido depósito bancário. |
| `src/contexts/authContexts.tsx` | refreshPermissoes (recarrega funções/permissões ao F5). Sempre recarrega do banco ao montar (não usa cache). |
| `src/components/common/FiltroDinamico.tsx` | Lido para entender padrão do filtro avançado. Não alterado. |
| `src/data/produtos/produtos.ts` | Lido. Alterado pelo outro agente (campos adicionais). |
| `src/pages/api/produtos/get/index.ts` | Lido para identificar bug do estoque (SUM(arp_qtest) sem subtrair reserva). Alterado pelo outro agente. |
| `src/pages/api/vendas/postgresql/produto.ts` | Lido para comparar com V1. Calcula qtest-reservada e filtra por arm_id. Não alterado (é a referência correta). |
| `src/pages/api/faturamento/salvar.ts` | Lido para verificar se libera reserva. Confirma: decrementa arp_qtest e arp_qtest_reservada. Não alterado. |
| `src/pages/api/vendas/fpagamento.ts` | Lido para entender opções de forma pagamento (tabela dbtipo_documento). |
| `src/pages/api/tipoOperacaoFiscal/index.ts` | Lido. Carrega operações de cad_tipo_operacao_fiscal. |

### Arquivos Delphi lidos (referência)

| Arquivo | O que foi extraído |
|---------|-------------------|
| `Desenvolvimento/Formularios/VENDA/Univenda.pas` | Regras completas: TratarClasPgtoCliente, check_CredCard, check_Avista, Check_Deposito, DscVista, cbx_Cartao, Analise_Financeira, Btn6Click, btnFinalizarVendaClick, SalvaDadosVenda, Filtro1Click, chkNroReq. Atalhos, mensagens, obsfat masks, prazo rules. |
| `Desenvolvimento/Formularios/VENDA/Univenda.dfm` | Itens do cbx_Cartao (01x, 02x, 03x). |
| `Desenvolvimento/Geral/Cliente/SQL/Consulta_Cliente_Codigo.sql` | Status_Cliente vem direto de dbclien.status. |
| `Desenvolvimento/Geral/Cliente/SQL/Cliente_Alt_Status.sql` | UPDATE dbclien SET status = vStatus. |
| `Desenvolvimento/XSistema_Melo2/Classes/UnitDmConsultas.pas` | CLIENTE_DESCR procedure no package CONSULTA. |

### Banco de dados consultado

| Tabela | Consulta |
|--------|---------|
| `dbclien` | Clientes por classe (I/Z/V/D/A/P), status, tipo, uf, limite, debito |
| `dbreceb` | Títulos atrasados por cliente |
| `dbclien_creditotmp` | Crédito temporário |
| `dbtipo_documento` | Formas de pagamento (7 opções: DINHEIRO, CARTÃO CRÉDITO/DÉBITO, CARTEIRA, BOLETO, PIX, OUTROS) |
| `cad_tipo_operacao_fiscal` | 17 operações SAIDA + 12 ENTRADA |
| `cad_armazem_produto` | Estoque por armazém (arp_qtest, arp_qtest_reservada) |
| `dbarmazem` | Armazéns (1001=AM-01, 1002=AM-02, etc) |
| `tb_login_armazem_user` | Armazéns por usuário |
| `tb_login_functions` | Função TMO criada (id=19), vinculada a ADMINISTRAÇÃO |
| `dbitvenda` | Vendas do produto 394309 para análise de reserva |
| `dadosempresa` | UF da empresa (AM) |

### Banco Oracle consultado (via outro agente)

| Package | O que foi extraído |
|---------|-------------------|
| `REGRAS_VENDAS.SUBMETER_REGRA` | Lógica completa: STATUS_CLIENTE (classe I/Z, PF outro estado, crédito temporário) + SEM_LIMITE_FINANCEIRO (títulos atrasados, crédito insuficiente, isenção cartão/à vista/depósito) |

---

## Commits desta sessão

```
d176bd57 feat: API busca V1 no modal itens + mensagens financeiras fixas sem piscar
e7da1edf fix: crash API validarCredito — saldoDisponivel usado antes de declarar para classe V/D
d980dea5 fix: mensagem crédito insuficiente — manter informativa, tirar só sugestões de opções
348123b9 fix: classe V/D isenta de crédito na API + mensagens curtas
71a81230 feat: prazo/forma — quem clica último ganha + prazo bloqueado com mensagem no input
b74c8088 fix: remover depósito, forma pgto só DINHEIRO/PIX/DÉBITO/CRÉDITO, BOLETO travado pelo prazo
f89d1703 fix: PIX, DINHEIRO, DÉBITO isentam crédito na validarCredito (eram só 'A VISTA')
3ebd5987 feat: prazo/forma pagamento excludentes, inputs com digitação e filtro, restaurar onBlur
b80b6668 fix: limpar texto de busca ao sair sem selecionar (forma pgto e transportadora)
d82b143b fix: prazo — Fechamento na Semana e Personalizar no topo do dropdown
1a479c2d feat: unificar prazo/forma pagamento padrão Delphi + fechamento na semana
19039f87 chore: adicionar scripts temp e orçamentos gerados
17fd0ba5 feat: melhorias modal adicionar itens, equivalentes, busca produtos
c91113ed feat: requisição por item (paridade Delphi) + fix nrequis no INSERT dbitvenda
e7f3b87a fix: atalhos padrão Delphi — Ctrl+F para filtro, F9 e menu equivalentes removidos (inline)
ff4f6716 fix: click com mouse abre dropdown em todos inputs
0f92d219 fix: mensagens financeiras claras com valores
9b461eed fix: limpar status financeiro imediatamente ao trocar cliente
43c17ab5 feat: mensagem de restrição na linha de Obs/Requisição
dbceaf35 fix: title no botão finalizar com mensagem do motivo quando desativado
06109e21 fix: status financeiro só da API — sem checks locais duplicados
1a7f01d4 fix: centralizar info financeira no cabeçalho, remover mensagens e saldo duplicados
7f811da3 feat: restrição financeira centralizada no cabeçalho junto aos dados do cliente
e46b37bf feat: validarCredito API — replica REGRAS_VENDAS.SUBMETER_REGRA do Oracle
d03c0551 fix: remover stopImmediatePropagation dos onKeyDown React
34c39f00 feat: Escape restaura valor anterior após double-click/Enter nos inputs
d0c29eeb fix: trocar obsfatTexto por fPagamento na validação de crédito
6eba4ebf feat: validarCredito API — replica REGRAS_VENDAS.SUBMETER_REGRA do Oracle
cb9e0716 fix: remover bloqueio por status='2'
bc940ef9 fix: mensagens de restrição iguais ao Delphi
da60a67d feat: mensagem de restrição visível na tela
007cc831 feat: Obs. Faturamento read-only
527c368a fix: dropdowns não abrem ao focar
064e5c95 fix: mover isCartaoCredito antes de precisaCreditoExtra
6851c8b3 feat: regras completas Delphi — classe V/D/Z, status bloqueado/temp, balcão, obsfat canônico
dda25712 fix: obsfat no padrão exato do Delphi
0f017deb feat: cartão de crédito — parcelas, acréscimo, obsfat canônico, isenção crédito
9d860b33 fix: forma pagamento mostrando só número ao mudar prazo
2e4de862 feat: operações carregadas do banco filtradas por movimentação
984fac16 feat: TMO inputs como dropdown na Linha 1 antes do Prazo
ba9f0ff7 feat: sempre recarregar permissões/funções do banco ao atualizar página (F5)
d5faf07b feat: refreshPermissoes — recarrega funções/permissões/armazéns sem logout
d64ef92e fix: forma de pagamento salva no obsfat da dbvenda
d5a36d98 fix: codcli case-insensitive
7f25cb6d feat: UX inputs — remover X, setas navegam, borda azul focus, documento via tipoOperacao
e85df386 feat: botão limpar venda no cabeçalho + documento padrão 1-VENDA
bcea9980 feat: filtro avançado no modal adicionar itens + copiar venda via modal V2
```

---

## Estado das mensagens financeiras

### Feito
- Badge no cabeçalho do cliente com status financeiro (vermelho/amarelo/azul)
- Mensagem no input de Prazo quando bloqueado (vermelho, italic)
- Mensagens baseadas no saldo real do cliente (não mudam com forma de pagamento)
- Sem piscar ao trocar forma (só limpa ao trocar cliente)
- validarCredito API com todas as regras do Oracle

### O que cada regra mostra

| Regra | Badge topo | Prazo | Botão Finalizar |
|-------|-----------|-------|-----------------|
| Inativo (I) | Vermelho: CLIENTE INATIVO | — | Desabilitado |
| Judicial (Z) | Vermelho: CLIENTE EM COBRANÇA JUDICIAL | — | Desabilitado |
| PF outro estado | Vermelho: CLIENTE PESSOA FÍSICA DE OUTRO ESTADO | — | Desabilitado |
| Títulos atrasados | Vermelho: CLIENTE COM TÍTULO(S) EM ATRASO | — | Desabilitado |
| Classe V/D | Azul: Somente à vista (V) | "Somente à vista" vermelho | Ativo (só à vista) |
| Crédito insuficiente (prazo) | Amarelo: Crédito insuficiente para prazo. Disponível: R$ X | "Sem crédito para prazo" vermelho | Ativo (se à vista/cartão) |
| Normal com crédito | Azul: Liberado — Disponível: R$ X | Editável | Ativo |

### Falta ajustar
- [INCERTO] Verificar se o badge "Liberado" aparece sem cliente selecionado (não deveria)
- Mensagem do prazo deve ficar visível ANTES de clicar no input (hoje pode não aparecer até interagir)
- Validar todos os clientes da tabela de testes com a versão deployada

---

## Ambiente

| Item | Valor |
|------|-------|
| Diretório | `E:\src\next\sistemas\melo_deploy` |
| Porta dev | `3000` (`npx next dev -p 3000`) |
| Remote origin | `https://github.com/andomonte/new-melo.git` (branch main) |
| Remote gitlab | `https://git.melopecas.com.br/melosys-web/sistema-melo.git` (branch feat/producao_melo) |
| Deploy | Vercel — auto-deploy ao push em origin/main |
| Banco PG | `servicos.melopecas.com.br:5432/postgres` (schemas: db_manaus, db_portovelho, db_boavista) |
| Banco Oracle | `201.64.221.132:1524/desenv.mns.melopecas.com.br` (user GERAL) — precisa de .cjs + instantclient_23_4 |
| Node | v20.20.1 (x64, via nvm4w) |
| Oracle Client | `C:\oracle\instantclient\instantclient_23_4` (thick mode, scripts .cjs obrigatório) |

### Comandos

```bash
# Rodar local
cd E:/src/next/sistemas/melo_deploy && npx next dev -p 3000

# Sincronizar e subir
git fetch origin && git fetch gitlab
git pull origin main --rebase
git push origin main
git push gitlab main:feat/producao_melo

# Consultar Oracle (obrigatório .cjs)
node temp/get_regras_vendas.cjs

# Verificar compilação
node -e "const fs=require('fs');const c=fs.readFileSync('src/components/corpo/vendas/novaVendaV2/index.tsx','utf8');let b=0,p=0;for(const ch of c){if(ch==='{')b++;if(ch==='}')b--;if(ch==='(')p++;if(ch===')')p--;}console.log('braces='+b,'parens='+p);"
```

---

## Próximos passos (em ordem de prioridade)

1. **Validar mensagens na Vercel** — testar cada cliente da tabela e confirmar que as mensagens aparecem corretas
2. **API busca produto nas outras telas** — Promoção e Desbloqueio devem usar a mesma API da V1 (estoque real por armazém)
3. **Prazo personalizado** — limitar dias: mínimo 7, máximo 180 no ModalPrazoParcelas
4. **Título aba navegador** — "Venda - Nome do Cliente"
5. **Busca dinâmica** — voltar busca sem Enter no modal adicionar itens
6. **Bug filtro avançado (Ctrl+F)** — verificar o que acontece
7. **Bug setas ↑↓** — travando no modal adicionar itens
8. **Desconto à vista (DscVista)** — checkbox, % por marca GM vs outros, desabilitado com cartão
9. **Validação ferramenta no cartão** — desconto em vez de acréscimo pra grupo ferramenta
10. **Reservas migradas do Oracle** — limpar arp_qtest_reservada inconsistentes
11. **Cancelar venda finalizada** — tela futura, deve liberar arp_qtest_reservada
12. **Venda expirada** — timer 30 min do Delphi
13. **Quantidade por múltiplo** — validar que qty é múltiplo do produto
14. **Promoção** — PMan/PBv/PPv, preço index 13/14/15, comissão

---

## Decisões técnicas tomadas

| Decisão | Motivo |
|---------|--------|
| Criar API `/api/vendas/postgresql/validarCredito` | Replica SUBMETER_REGRA do Oracle. Necessário porque o Oracle não é acessível em produção (Vercel). Lógica extraída do package body REGRAS_VENDAS. |
| Não bloquear por `dbclien.status = '2'` | O campo status no PG é o mesmo do Oracle, mas o btnFinalizarVenda do Delphi NÃO checa status='2' diretamente. A verificação real é pela spSubmeter_Regra que usa classe (I/Z), títulos e crédito. |
| Forma pagamento e prazo excludentes | Padrão Delphi. No Delphi são checkboxes (À Vista, Cartão, Depósito) que desabilitam prazo. No web: escolher forma desabilita prazo, escolher prazo auto-seta BOLETO. |
| obsfat read-only | No Delphi meVenda_Obs tem máscara não editável. O texto é montado automaticamente pelas regras (A VISTA (VE), CARTAO DE CREDITO 02x, etc). |
| BOLETO não aparece na lista de forma pagamento | É implícito pelo prazo. Quando vendedor escolhe prazo, forma trava como BOLETO. |
| Depósito bancário removido | Não existe como opção separada na venda do Delphi atual. |
| Trocar API de busca da V2 pra V1 | V2 usava `/api/produtos/get` que não subtrai reserva nem filtra por armazém. V1 usa `/api/vendas/postgresql/produto` que calcula `qtest - qtdreservada` e filtra por `arm_id`. |
| Badge financeiro baseado no saldo real | Antes dependia da resposta da API (que variava conforme forma de pagamento). Agora usa `saldoCliente` direto pra não piscar. |
| Classe V/D retorna OK direto na API | No Oracle, classe V/D é verificada depois de I/Z/PF, mas antes de crédito. Isenta de qualquer verificação financeira — é sempre à vista. |
| Prioridade das regras na API | I → Z → PF outro estado → títulos atrasados → V/D → crédito. PF outro estado vem ANTES de V/D porque é bloqueio mais forte. |
| Acréscimo cartão hardcoded | Tabela do package REGRAS_VENDAS Oracle: 1x=1.0270, 2x=1.0517... 10x=1.2000. Aplicado no backend (finalizarVenda.ts) ao calcular total. |
| Requisição por item (não por venda) | Paridade Delphi. Cada item pode ter nrequis (15 dig) e nritem (6 dig) diferentes. Checkbox ativa/desativa. |
| Fechamento na Semana | Nova funcionalidade (não existe no Delphi). Opção no prazo, grava "FECHAMENTO NA SEMANA" no obsfat. |
| Função TMO no banco | Criada em tb_login_functions (id=19, sigla TMO). Vinculada ao perfil ADMINISTRAÇÃO (LEANDRO e REGINALDO). |
| refreshPermissoes ao F5 | authContexts.tsx sempre recarrega funções/permissões do banco ao montar, em vez de usar cache do localStorage. |

---

## Clientes para teste

| Regra | codcli | Nome | Classe | Esperado |
|-------|--------|------|--------|----------|
| INATIVO | 02642 | CASA DAS JUNTAS | I | Vermelho: CLIENTE INATIVO |
| JUDICIAL | 04228 | TECNICA DIESEL | Z | Vermelho: COBRANÇA JUDICIAL |
| À VISTA (V) | 02648 | AUTO MECANICA 2001 | V | Azul: Somente à vista |
| À VISTA (V) | 35800 | KAIC TOBIAS | V | Azul: Somente à vista |
| À VISTA (D) | 02864 | (sem nome) | D | Azul: Somente à vista |
| NORMAL com crédito | 02658 | KAMEL LUBRIFICANTES | B | Azul: Liberado R$4.700 |
| SEM CRÉDITO + ATRASO | 02665 | AUTO PECAS ACHO QUE TEM | P | Vermelho: TÍTULO(S) EM ATRASO |
| ATRASO com crédito | 00056 | DEL AUTO PECAS | A | Vermelho: TÍTULO(S) EM ATRASO |
| PF outro estado | 36775 | (sem nome) | F | Vermelho: PF OUTRO ESTADO |
| PF+V outro estado | 36132 | ARTHUR MULT SERVICOS | V | Vermelho: PF OUTRO ESTADO (prioridade sobre V) |
| BALCÃO | 99999 | BALCAO | I | Vermelho: CLIENTE INATIVO [INCERTO: deveria ter tratamento especial?] |

---

## Incertezas

- [INCERTO] Cliente 99999 (BALCÃO) tem `claspgto='I'` no banco. No Delphi tinha tratamento especial (limite R$10.000, só à vista/cartão). Verificar se deveria ser tratado à parte ou se classe I é correto.
- [INCERTO] As 80 reservas do produto 394309 (CT874K3) — vieram da migração do Oracle. Não sei se o faturamento web está liberando reserva corretamente em produção (só vi o código, não testei o fluxo completo).
- [INCERTO] Busca dinâmica (sem Enter) — não sei se já funcionava antes ou se sempre foi com Enter. O usuário disse que era dinâmica.
- [INCERTO] Bug do filtro avançado (Ctrl+F) — usuário relatou mas não descreveu o que acontece.
