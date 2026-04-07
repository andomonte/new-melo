# Documento de Entrega Para Teste – Desenvolvimento de Sistema

**Projeto:** Sys Melo
**Cliente:** Melo Distribuidora de Peças
**Versão do Documento:** 1.0
**Data:** 22/12/2025
**Responsável pela Entrega:** Alison Silva (DevAlissu)

---

## 1. Objetivo do Documento

Este documento tem como objetivo formalizar a **entrega do módulo de Compras para testes do cliente**, organizada por submódulos, descrevendo funcionalidades implementadas, escopo, critérios de aceite, orientações de teste e registro de validação.

O módulo de Compras é composto por três submódulos principais:
- **Requisições de Compra** - Criação e gerenciamento de solicitações de compra
- **Ordens de Compra** - Gerenciamento de pedidos aprovados
- **Entrada por XML/NFe** - Processamento de notas fiscais e entrada no estoque

---

## 2. Escopo da Entrega

Nesta entrega, o cliente receberá acesso aos módulos abaixo para **testes funcionais e validação**:

| Submódulo | Status | Descrição |
|-----------|--------|-----------|
| Requisições de Compra | ✅ Implementado | Criação, edição, aprovação e workflow completo |
| Ordens de Compra | ✅ Implementado | Gerenciamento de pedidos e integração com requisições |
| Entrada por XML/NFe | ✅ Implementado | Upload, associação e geração de entrada |

**Funcionalidades fora do escopo** deste documento não devem ser consideradas para validação nesta fase.

---

## 3. Ambiente de Testes

| Item | Valor |
|------|-------|
| **URL do Sistema** | https://melodeploy-production.up.railway.app/login |
| **Ambiente** | (x) Teste ( ) Homologação ( ) Staging |
| **Usuário de Teste 1** | KARLA / Senha: KARLA |
| **Usuário de Teste 2** | MARIO / Senha: MARIO |
| **Período de Testes** | 22/12/2025 à 08/01/2026 |

### 3.1 Acesso ao Módulo

1. Fazer login com usuário de teste
2. No menu lateral, acessar **Comprador**
3. Selecionar o submódulo desejado:
   - Requisições de Compra
   - Ordens de Compra
   - Entrada por XML/NFe

---

## 4. Módulos Entregues para Teste

---

# 4.1 Submódulo 01 – Requisições de Compra

## 4.1.1 Objetivo do Submódulo

Permitir que os usuários criem, editem e gerenciem **requisições de compra**, com fluxo de aprovação completo, controle de itens e integração com ordens de compra.

## 4.1.2 Funcionalidades Implementadas

| # | Funcionalidade | Descrição |
|---|----------------|-----------|
| 1 | Criar Requisição | Nova requisição com fornecedor, comprador, itens |
| 2 | Editar Requisição | Modificar requisições pendentes ou rejeitadas |
| 3 | Duplicar Requisição | Criar nova baseada em existente |
| 4 | Gerenciar Itens | Adicionar, editar, remover produtos |
| 5 | Submeter para Aprovação | Enviar requisição para análise |
| 6 | Aprovar Requisição | Aprovar e gerar ordem automaticamente |
| 7 | Reprovar Requisição | Rejeitar com motivo obrigatório |
| 8 | Cancelar Requisição | Cancelar requisição em andamento |
| 9 | Visualizar Histórico | Timeline de alterações |
| 10 | Exportar Excel | Download da requisição em planilha |
| 11 | Ações em Lote | Aprovar/reprovar múltiplas requisições |
| 12 | Filtros Avançados | Busca por status, data, fornecedor, etc. |
| 13 | Controle de Budget | Visualização do orçamento disponível |

## 4.1.3 Fluxo de Uso (Resumo)

### Fluxo 1: Criar Nova Requisição

**Passo 1:** Na tela principal de Requisições, clicar no botão **"Nova Requisição"**

> **Figura 1** - Tela Principal de Requisições de Compra
>
> *Tela de listagem com tabela de requisições, botão "Nova Requisição" no canto superior direito, filtros e opções de busca.*

**Passo 2:** Preencher os dados obrigatórios no modal:

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Tipo da Requisição | Sim | Selecionar tipo (Consumo, Venda Casada, etc.) |
| Fornecedor | Sim | Buscar por código ou nome |
| Comprador | Sim | Selecionar comprador responsável |
| Entrega em | Sim | Local de entrega (filial) |
| Destinado para | Sim | Destino final (filial) |
| Previsão de Chegada | Não | Data prevista de recebimento |
| Condições de Pagamento | Não | Ex: "30/60/90 dias" |
| Observação | Não | Texto livre |

> **Figura 2** - Modal de Nova Requisição
>
> *Modal com formulário de criação contendo campos de tipo, fornecedor (autocomplete), comprador, locais de entrega/destino, previsão de chegada e observações.*

**Passo 3:** Clicar em **"Adicionar Produtos"** para incluir itens

> **Figura 3** - Modal de Adicionar Produtos
>
> *Modal de busca de produtos com campos de filtro (código, descrição, marca), tabela de resultados com checkbox para seleção múltipla.*

**Passo 4:** Após adicionar produtos, o contador mostrará a quantidade

> **Figura 4** - Contador de Produtos no Modal
>
> *Botão "Editar Produtos (X)" mostrando quantidade de itens adicionados, permitindo editar quantidades e preços.*

**Passo 5:** Clicar em **"Salvar"** para criar a requisição

> **Figura 5** - Confirmação de Criação
>
> *Toast de sucesso "Requisição criada com sucesso" e modal fechando automaticamente.*

---

### Fluxo 2: Gerenciar Itens da Requisição

**Passo 1:** Na lista de requisições, clicar no menu de ações (⋮) e selecionar **"Gerenciar Itens"**

> **Figura 6** - Menu de Ações da Requisição
>
> *Dropdown com opções: Ver, Editar, Gerenciar Itens, Submeter, Duplicar, Histórico, Exportar Excel, Excluir.*

**Passo 2:** O modal de gerenciamento possui 3 abas:

| Aba | Função |
|-----|--------|
| Buscar Produtos | Pesquisar e adicionar novos produtos |
| Carrinho (Itens) | Visualizar e editar itens adicionados |
| Sugestão Automática | Recomendações do sistema |

> **Figura 7** - Modal de Gerenciamento de Itens
>
> *Modal com abas superiores, tabela de itens com colunas: Código, Descrição, Marca, Quantidade, Preço Unitário, Preço Total, Ações. Totalizador no rodapé.*

**Passo 3:** Para cada item, é possível:
- Editar quantidade e preço (ícone de lápis)
- Remover item (ícone de lixeira)
- Adicionar observação

---

### Fluxo 3: Submeter e Aprovar Requisição

**Passo 1:** Requisição em status **Pendente (P)**

**Passo 2:** Clicar em ações (⋮) → **"Submeter"**

> **Figura 8** - Ação de Submeter Requisição
>
> *Menu dropdown com opção "Submeter" destacada, disponível apenas para status Pendente.*

**Passo 3:** Status muda para **Submetida (S)** - Aguardando aprovação

**Passo 4:** Usuário aprovador acessa requisição e clica em **"Aprovar"**

> **Figura 9** - Ação de Aprovar Requisição
>
> *Menu dropdown com opções "Aprovar" e "Reprovar" disponíveis para usuários com permissão.*

**Passo 5:** Sistema gera **Ordem de Compra automaticamente**

> **Figura 10** - Confirmação de Aprovação com OC
>
> *Toast "Requisição aprovada com sucesso. Ordem de Compra #XXX gerada."*

---

### Fluxo 4: Ações em Lote

**Passo 1:** Selecionar múltiplas requisições usando os checkboxes

> **Figura 11** - Seleção Múltipla de Requisições
>
> *Tabela com checkboxes na primeira coluna, indicador "X requisição(ões) selecionada(s)" no topo.*

**Passo 2:** Barra de ações em lote aparece com botões disponíveis

> **Figura 12** - Barra de Ações em Lote
>
> *Barra superior com informação "5 requisição(ões) selecionada(s) - Status: Pendente" e botões [Submeter] [Limpar Seleção].*

**Observação:** Só é possível selecionar requisições do **mesmo status**.

---

### Fluxo 5: Visualizar Histórico

**Passo 1:** Clicar em ações (⋮) → **"Histórico"**

> **Figura 13** - Modal de Histórico da Requisição
>
> *Timeline vertical mostrando: Data/Hora, Status Anterior → Status Novo (com cores), Usuário responsável, Comentários/Motivo.*

---

## 4.1.4 Status da Requisição

| Código | Status | Cor | Descrição | Ações Disponíveis |
|--------|--------|-----|-----------|-------------------|
| P | Pendente | Amarelo | Rascunho em edição | Editar, Submeter, Excluir |
| S | Submetida | Azul | Aguardando aprovação | Aprovar, Reprovar, Cancelar |
| A | Aprovada | Verde | Aprovada, OC gerada | Ações do Sistema |
| R | Rejeitada | Vermelho | Rejeitada | Editar e Resubmeter |
| C | Cancelada | Cinza | Cancelada | Visualizar apenas |

> **Figura 14** - Diagrama de Transição de Status
>
> ```
> [PENDENTE] ──Submeter──> [SUBMETIDA] ──Aprovar──> [APROVADA]
>      │                       │                        │
>      │                       ├──Reprovar──> [REJEITADA]
>      │                       │                   │
>      │                       └──Cancelar──> [CANCELADA]
>      │
>      └──Excluir──> (Removida)
>
> [REJEITADA] ──Editar + Submeter──> [SUBMETIDA]
> ```

## 4.1.5 Colunas da Tabela

| Coluna | Descrição |
|--------|-----------|
| Selecionar | Checkbox para seleção múltipla |
| Requisição | Número identificador (ex: REQ-2024-001) |
| Data Requisição | Data de criação |
| Status Requisição | Badge colorida com status |
| Fornecedor | Código - Nome do fornecedor |
| Comprador | Código - Nome do comprador |
| Ordem de Compra | Número da OC (se gerada) |
| Status O.C. | Status da ordem de compra |
| Previsão de Chegada | Data prevista |
| Local de Entrega | Filial de recebimento |
| Ações | Menu de ações (⋮) |

> **Figura 15** - Tabela de Requisições com Colunas
>
> *Tabela completa mostrando todas as colunas configuráveis, com cabeçalhos clicáveis para ordenação e ícones de seta.*

## 4.1.6 Regras de Negócio

| # | Regra | Descrição |
|---|-------|-----------|
| RN01 | Campos obrigatórios | Tipo, Fornecedor, Comprador, Entrega e Destino são obrigatórios |
| RN02 | Produtos obrigatórios | Mínimo 1 produto para salvar |
| RN03 | Edição restrita | Só pode editar em status Pendente ou Rejeitada |
| RN04 | Aprovação gera OC | Ao aprovar, ordem de compra é criada automaticamente |
| RN05 | Permissão de aprovação | Apenas usuários com função APROVAR_REQUISICOES_COMPRA |
| RN06 | Seleção em lote | Apenas requisições do mesmo status podem ser selecionadas |
| RN07 | Duplicação | Requisição duplicada inicia como Pendente |
| RN08 | Histórico obrigatório | Toda mudança de status é registrada com usuário e data |
| RN09 | Reprovar com motivo | Ao reprovar, comentário é obrigatório |
| RN10 | Budget | Sistema alerta quando budget mensal é excedido |

## 4.1.7 Critérios de Aceite

Para que o submódulo seja considerado **aprovado**, é necessário que:

| # | Critério | Verificação |
|---|----------|-------------|
| CA01 | Criar requisição | Preencher campos e salvar com sucesso |
| CA02 | Adicionar produtos | Buscar e adicionar pelo menos 3 produtos |
| CA03 | Editar requisição | Modificar campos e salvar |
| CA04 | Submeter requisição | Status muda de P para S |
| CA05 | Aprovar requisição | Status muda para A e OC é gerada |
| CA06 | Reprovar requisição | Status muda para R com motivo |
| CA07 | Ações em lote | Selecionar múltiplas e executar ação |
| CA08 | Histórico | Visualizar timeline de alterações |
| CA09 | Filtros | Buscar por status, fornecedor, data |
| CA10 | Exportar | Baixar Excel com dados |

## 4.1.8 Limitações Conhecidas

| # | Limitação | Impacto |
|---|-----------|---------|
| L01 | Seleção em lote por status | Não permite misturar status diferentes |
| L02 | Budget mensal | Apenas visualização, não bloqueia criação |
| L03 | Substituição de itens | Disponível apenas em Ordens de Compra |

## 4.1.9 Observações do Cliente

*(Espaço destinado ao cliente para comentários, dúvidas ou solicitações de ajuste)*

```
___________________________________________________________________________

___________________________________________________________________________

___________________________________________________________________________
```

## 4.1.10 Validação do Cliente

- **Status do Submódulo:** ( ) Aprovado ( ) Aprovado com ressalvas ( ) Reprovado
- **Responsável pela Validação:** ________________________________
- **Data:** ____/____/________
- **Assinatura:** _______________________________________________

---

# 4.2 Submódulo 02 – Ordens de Compra

## 4.2.1 Objetivo do Submódulo

Gerenciar **ordens de compra** geradas a partir de requisições aprovadas, permitindo acompanhamento, configuração de pagamento, substituição de itens e integração com entrada de NFe.

## 4.2.2 Funcionalidades Implementadas

| # | Funcionalidade | Descrição |
|---|----------------|-----------|
| 1 | Listar Ordens | Visualizar todas as ordens com filtros |
| 2 | Ver Itens | Detalhamento dos produtos da ordem |
| 3 | Exportar PDF | Gerar documento PDF da ordem |
| 4 | Exportar Excel | Download em planilha |
| 5 | Pagamento Antecipado | Registrar pagamento antes do recebimento |
| 6 | Verificar Pagamento | Grid de parcelas e status |
| 7 | Ver Histórico | Timeline de alterações |
| 8 | Alterar Previsão | Modificar data de chegada |
| 9 | Substituir Item | Trocar produto por outro |
| 10 | Fechar Item | Finalizar item sem mais pendência |
| 11 | Baixar Pendência | Reduzir quantidade pendente parcialmente |
| 12 | Cancelar Ordem | Cancelar ordem aberta |

## 4.2.3 Fluxo de Uso (Resumo)

### Fluxo 1: Visualizar Ordens de Compra

**Passo 1:** Acessar o submódulo **Ordens de Compra** no menu

> **Figura 16** - Tela Principal de Ordens de Compra
>
> *Tabela de ordens com colunas: Ordem, Requisição, Data, Status, Fornecedor, Comprador, Valor Total, Ações.*

**Passo 2:** Utilizar os filtros para buscar:
- Por número da ordem ou requisição
- Por fornecedor ou comprador
- Por status
- Por período

> **Figura 17** - Filtros de Ordens de Compra
>
> *Barra de filtros com campo de busca textual, filtros avançados em dropdown.*

---

### Fluxo 2: Ver Itens da Ordem

**Passo 1:** Clicar em ações (⋮) → **"Ver Itens"**

> **Figura 18** - Modal de Itens da Ordem
>
> *Modal com tabela de itens: Código, Descrição, Quantidade Pedida, Quantidade Atendida, Pendência, Preço Unitário, Preço Total.*

**Passo 2:** Verificar:
- Quantidade pedida vs. atendida
- Pendências de recebimento
- Valores por item

---

### Fluxo 3: Configurar Pagamento

**Passo 1:** Clicar em ações (⋮) → **"Pagamento Antecipado"**

> **Figura 19** - Modal de Pagamento Antecipado
>
> *Modal com campos: Status do Pagamento, Data, Valor, Comprovante, Observações.*

**Passo 2:** Preencher dados do pagamento antecipado (se aplicável)

**Passo 3:** Para verificar parcelas, clicar em **"Verificar Pagamento"**

> **Figura 20** - Grid de Parcelas de Pagamento
>
> *Tabela com parcelas: Número, Data Vencimento, Valor, Status (Pendente/Pago/Vencido) com badges coloridas.*

---

### Fluxo 4: Substituir Item

**Passo 1:** Clicar em ações (⋮) → **"Substituir Item"** (apenas status Aberta)

> **Figura 21** - Modal de Substituição de Item
>
> *Lista de itens da ordem com checkbox, após selecionar mostra busca de novo produto.*

**Passo 2:** Selecionar item(ns) a substituir

**Passo 3:** Buscar e selecionar novo produto

**Passo 4:** Confirmar substituição

> **Figura 22** - Confirmação de Substituição
>
> *Resumo mostrando: Produto Original → Novo Produto, com quantidades e valores.*

---

### Fluxo 5: Baixar Pendência

**Passo 1:** Clicar em ações (⋮) → **"Baixar Pendência"** (apenas status Aberta)

> **Figura 23** - Modal de Baixa de Pendência
>
> *Lista de itens com pendência, campo para informar quantidade a baixar, validação de máximo permitido.*

**Passo 2:** Informar quantidade a dar baixa (parcial)

**Passo 3:** Confirmar - quantidade atendida é atualizada

---

## 4.2.4 Status da Ordem de Compra

| Código | Status | Cor | Descrição |
|--------|--------|-----|-----------|
| A | Aberta | Verde | Em andamento, permite alterações |
| B | Bloqueada | Laranja | Temporariamente bloqueada |
| C | Cancelada | Vermelho | Cancelada permanentemente |
| F | Fechada | Azul | Finalizada, sem pendências |
| P | Pendente | Amarelo | Aguardando processamento |

> **Figura 24** - Badges de Status das Ordens
>
> *Exemplos visuais de cada badge colorida por status.*

## 4.2.5 Colunas da Tabela

| Coluna | Descrição |
|--------|-----------|
| Ordem | Número identificador da OC |
| Requisição | Número da requisição de origem |
| Data Ordem | Data de criação |
| Status Ordem | Badge com status atual |
| Pagamento Configurado | SIM/NÃO se tem configuração |
| Fornecedor | Código - Nome |
| Comprador | Código - Nome |
| Previsão Chegada | Data prevista |
| Local Entrega | Filial de recebimento |
| Valor Total | Soma dos itens |
| Ações | Menu de ações (⋮) |

## 4.2.6 Regras de Negócio

| # | Regra | Descrição |
|---|-------|-----------|
| RN01 | Origem única | OC só é criada a partir de requisição aprovada |
| RN02 | 1:1 com requisição | Uma requisição gera uma ordem |
| RN03 | Herança de dados | Fornecedor, comprador, itens vêm da requisição |
| RN04 | Edição restrita | Só permite alterações em status Aberta (A) |
| RN05 | Substituição | Produto substituído mantém rastreabilidade |
| RN06 | Baixa parcial | Não pode baixar 100% (usar Fechar Item) |
| RN07 | Histórico | Toda ação é registrada com usuário e data |
| RN08 | Financeiro | Não cancela ordem com pagamento confirmado |

## 4.2.7 Critérios de Aceite

| # | Critério | Verificação |
|---|----------|-------------|
| CA01 | Listar ordens | Visualizar todas as OCs geradas |
| CA02 | Ver itens | Abrir modal com detalhamento |
| CA03 | Exportar PDF | Baixar documento formatado |
| CA04 | Histórico | Visualizar timeline |
| CA05 | Alterar previsão | Modificar data com sucesso |
| CA06 | Substituir item | Trocar produto corretamente |
| CA07 | Baixar pendência | Reduzir quantidade parcialmente |
| CA08 | Verificar pagamento | Visualizar grid de parcelas |

## 4.2.8 Limitações Conhecidas

| # | Limitação | Impacto |
|---|-----------|---------|
| L01 | Sem criação manual | OC só via aprovação de requisição |
| L02 | Cancelamento | Não cancela com financeiro pago |

## 4.2.9 Observações do Cliente

```
___________________________________________________________________________

___________________________________________________________________________
```

## 4.2.10 Validação do Cliente

- **Status do Submódulo:** ( ) Aprovado ( ) Aprovado com ressalvas ( ) Reprovado
- **Responsável pela Validação:** ________________________________
- **Data:** ____/____/________
- **Assinatura:** _______________________________________________

---

# 4.3 Submódulo 03 – Entrada por XML/NFe

## 4.3.1 Objetivo do Submódulo

Permitir o **upload de XMLs de Notas Fiscais Eletrônicas**, associação com ordens de compra, configuração de pagamento e **geração de entrada no estoque**.

## 4.3.2 Funcionalidades Implementadas

| # | Funcionalidade | Descrição |
|---|----------------|-----------|
| 1 | Upload de XML | Importar arquivo(s) XML de NFe |
| 2 | Visualizar NFe | Ver dados completos da nota |
| 3 | Processar NFe | Iniciar fluxo de associação |
| 4 | Associar Itens | Vincular itens NFe com OCs |
| 5 | Sugestões Automáticas | IA para sugerir associações |
| 6 | Configurar Pagamento | Definir parcelas e formas |
| 7 | Gerar Entrada | Criar entrada no estoque |
| 8 | Gerar Cobrança | Configurar pagamento sem entrada |
| 9 | Filtros Avançados | Busca por status, fornecedor, etc. |
| 10 | Exportar Excel | Download de dados |

## 4.3.3 Fluxo de Uso (Resumo)

### Fluxo 1: Upload de XML

**Passo 1:** Na tela de Entrada por XML, clicar no botão **"Upload XML"**

> **Figura 25** - Tela Principal de Entrada por XML/NFe
>
> *Tabela com NFes recebidas, botões "Upload XML" (azul) e "Gerar Entrada" (verde) no header.*

**Passo 2:** Arrastar arquivos ou clicar para selecionar

> **Figura 26** - Modal de Upload de XML
>
> *Área de drag & drop, lista de arquivos selecionados com botão de remover individual, botão "Enviar".*

**Passo 3:** Clicar em **"Enviar"**

> **Figura 27** - Feedback de Upload
>
> *Spinner durante upload, toast de sucesso "XML(s) enviado(s) com sucesso", ou lista de erros se houver.*

**Passo 4:** NFe aparece na lista com status **"Recebida"**

---

### Fluxo 2: Processar NFe (Associar Itens)

**Passo 1:** Na NFe com status "Recebida", clicar em ações (⋮) → **"Processar"**

> **Figura 28** - Menu de Ações da NFe
>
> *Dropdown com opções: Ver, Processar, Excluir (varia conforme status).*

**Passo 2:** Modal de confirmação de dados abre primeiro

> **Figura 29** - Modal de Confirmação de Dados da NFe
>
> *Campos: Operação, Fornecedor, Comprador, Transportadora, checkboxes de configuração (Cálculo custo, Devolução, NFe Complementar).*

**Passo 3:** Após confirmar, abre o modal de **Associação de Itens**

> **Figura 30** - Modal de Associação de Itens
>
> *Lista de itens da NFe com: Código, Descrição, Quantidade, Valor, Status de Associação (badges). Botões de ação por item: Buscar Produto, Sugestões, Remover.*

**Passo 4:** Para cada item, associar com Ordem de Compra:

**Opção A - Sugestão Automática:**
- Clicar no ícone de lâmpada (💡)
- Sistema sugere OCs compatíveis com score de confiança

> **Figura 31** - Sugestões Automáticas de OC
>
> *Lista de ordens sugeridas com: Número OC, Fornecedor, Produto, Quantidade Disponível, Score (%). Botão "Selecionar".*

**Opção B - Busca Manual:**
- Clicar no ícone de busca
- Pesquisar produto no cadastro
- Selecionar OC disponível

> **Figura 32** - Busca Manual de Produto
>
> *Modal de busca com filtros, tabela de produtos encontrados, seleção de OC para associar.*

**Passo 5:** Após associar todos os itens, status muda para **"Associação Concluída"**

> **Figura 33** - Itens Totalmente Associados
>
> *Todos os itens com badge verde "Associado", botão "Próximo" habilitado.*

---

### Fluxo 3: Configurar Pagamento

**Passo 1:** Com itens associados, próximo passo é configurar pagamento

> **Figura 34** - Modal de Configuração de Pagamento
>
> *Campos: Banco, Tipo de Documento (Boleto, Duplicata, etc.), Valor de Entrada, Tabela de Parcelas.*

**Passo 2:** Sistema sugere parcelas baseado no XML (se disponível)

> **Figura 35** - Parcelas Sugeridas do XML
>
> *Tabela com parcelas extraídas do XML: Número, Data Vencimento, Valor. Opção de editar ou criar manualmente.*

**Passo 3:** Validação: Soma das parcelas + entrada = Valor Total NFe

**Passo 4:** Confirmar configuração

---

### Fluxo 4: Gerar Entrada

**Passo 1:** Após configurar pagamento, clicar em **"Gerar Entrada"**

> **Figura 36** - Modal de Dados Complementares
>
> *Campos: Número do Selo (opcional), Data do Selo, Número de Conhecimento (obrigatório), Observações.*

**Passo 2:** Preencher dados complementares obrigatórios

**Passo 3:** Visualizar resumo final

> **Figura 37** - Resumo da Entrada
>
> *Total de itens associados, Total de pedidos vinculados, Quantidade total, Valor total. Botões "Cancelar" e "Gerar Entrada".*

**Passo 4:** Clicar em **"Gerar Entrada"**

> **Figura 38** - Confirmação de Entrada Gerada
>
> *Toast "Entrada #XXXX gerada com sucesso!", NFe muda para status "Processada" (verde).*

**Passo 5:** Modal de Romaneio pode abrir para distribuição em armazéns

> **Figura 39** - Modal de Romaneio (Distribuição)
>
> *Seleção de armazém de destino para cada item ou lote.*

---

## 4.3.4 Status das NFes

| Status | Cor | Descrição | Ações Disponíveis |
|--------|-----|-----------|-------------------|
| RECEBIDA | Azul | XML importado | Processar, Excluir |
| EM_ANDAMENTO | Amarelo | Processamento iniciado | Continuar, Excluir |
| ASSOCIACAO_CONCLUIDA | Roxo | Itens associados | Gerar Cobrança, Gerar Entrada |
| PROCESSADA | Verde | Entrada gerada | Ver apenas |
| ERRO | Vermelho | Erro no processamento | Ver, Excluir |

> **Figura 40** - Status das NFes na Tabela
>
> *Exemplos de badges coloridas para cada status na coluna "Status".*

## 4.3.5 Colunas da Tabela

| Coluna | Descrição |
|--------|-----------|
| Número NFe | Número da nota fiscal |
| Série | Série da NFe |
| Chave NFe | Chave de acesso (44 dígitos truncados) |
| Emitente | Razão social do fornecedor |
| Data Emissão | Data de emissão da nota |
| Valor Total | Valor total da NFe (R$) |
| Status | Badge colorida com status |
| Data Upload | Data de importação |
| Ações | Menu de ações (⋮) |

> **Figura 41** - Tabela de NFes com Formatação
>
> *Tabela completa mostrando todas as colunas, valores formatados (moeda), datas formatadas, badges de status.*

## 4.3.6 Regras de Negócio

| # | Regra | Descrição |
|---|-------|-----------|
| RN01 | Arquivo XML | Apenas arquivos .xml são aceitos |
| RN02 | Tamanho máximo | 5MB por arquivo |
| RN03 | Duplicação | Não permite importar mesma chave duas vezes |
| RN04 | Associação obrigatória | Todos os itens devem ser associados |
| RN05 | Pagamento obrigatório | Deve configurar antes de gerar entrada |
| RN06 | Validação de soma | Parcelas + entrada = Valor NFe |
| RN07 | Conhecimento | Número de conhecimento obrigatório |
| RN08 | Progressão salva | Pode continuar de onde parou |
| RN09 | Divergências | Sistema alerta sobre diferenças de preço |
| RN10 | Status final | Após entrada, NFe fica como "Processada" |

## 4.3.7 Critérios de Aceite

| # | Critério | Verificação |
|---|----------|-------------|
| CA01 | Upload XML | Importar arquivo com sucesso |
| CA02 | Visualizar NFe | Ver dados completos |
| CA03 | Processar NFe | Iniciar fluxo de associação |
| CA04 | Associar itens | Vincular todos os itens |
| CA05 | Sugestões | Sistema sugere OCs automaticamente |
| CA06 | Configurar pagamento | Definir parcelas |
| CA07 | Gerar entrada | Criar entrada no estoque |
| CA08 | Status atualizado | NFe muda para "Processada" |
| CA09 | Filtros | Buscar por status, fornecedor |
| CA10 | Continuar | Retomar processamento interrompido |

## 4.3.8 Limitações Conhecidas

| # | Limitação | Impacto |
|---|-----------|---------|
| L01 | Apenas XML | Não aceita outros formatos |
| L02 | Manual | Upload manual (sem SEFAZ integrado no frontend) |
| L03 | Associação 1:N | Um item NFe pode associar a múltiplas OCs |

## 4.3.9 Observações do Cliente

```
___________________________________________________________________________

___________________________________________________________________________
```

## 4.3.10 Validação do Cliente

- **Status do Submódulo:** ( ) Aprovado ( ) Aprovado com ressalvas ( ) Reprovado
- **Responsável pela Validação:** ________________________________
- **Data:** ____/____/________
- **Assinatura:** _______________________________________________

---

## 5. Integrações Entre Módulos

> **Figura 42** - Diagrama de Integração do Módulo de Compras
>
> ```
> ┌─────────────────────────────────────────────────────────────────────┐
> │                     MÓDULO DE COMPRAS                               │
> ├─────────────────────────────────────────────────────────────────────┤
> │                                                                     │
> │  ┌─────────────────┐         ┌─────────────────┐                   │
> │  │   REQUISIÇÃO    │         │  ORDEM COMPRA   │                   │
> │  │   DE COMPRA     │────────▶│                 │                   │
> │  │                 │ Aprovar │                 │                   │
> │  │ Status: P→S→A   │  gera   │ Status: A→F    │                   │
> │  └─────────────────┘   OC    └────────┬────────┘                   │
> │                                       │                            │
> │                                       │ Associa                    │
> │                                       ▼                            │
> │                              ┌─────────────────┐                   │
> │                              │  ENTRADA NFe    │                   │
> │  ┌─────────────────┐        │                 │                   │
> │  │   UPLOAD XML    │───────▶│ Itens ↔ OCs    │                   │
> │  │                 │        │                 │                   │
> │  └─────────────────┘        └────────┬────────┘                   │
> │                                       │                            │
> │                                       │ Gerar                      │
> │                                       ▼                            │
> │                              ┌─────────────────┐                   │
> │                              │    ESTOQUE      │                   │
> │                              │    (Entrada)    │                   │
> │                              └─────────────────┘                   │
> │                                                                     │
> └─────────────────────────────────────────────────────────────────────┘
> ```

---

## 6. Resumo de APIs Disponíveis

| Módulo | Quantidade | Principais Endpoints |
|--------|------------|---------------------|
| Requisições | 19 | /api/requisicoesCompra/* |
| Ordens | 18 | /api/ordens/* |
| NFe | 5 | /api/nfe/* |
| Entrada XML | 31 | /api/entrada-xml/* |
| Compras Geral | 13 | /api/compras/* |
| **Total** | **86 APIs** | - |

---

## 7. Próximos Módulos (Planejamento)

| Módulo | Descrição | Status |
|--------|-----------|--------|
| Dashboard de Compras | Gráficos e KPIs | Planejado |
| Relatórios | Relatórios gerenciais | Planejado |
| Integração SEFAZ | Manifestação automática | Em desenvolvimento |

---

## 8. Considerações Finais

A validação deste módulo é essencial para o avanço das próximas etapas do projeto. O módulo de Compras é **central para as operações** da empresa, responsável por:

1. **Centralizar solicitações** de compra com workflow de aprovação
2. **Controlar pedidos** junto a fornecedores
3. **Processar notas fiscais** recebidas
4. **Gerar entradas** no estoque de forma automatizada
5. **Garantir rastreabilidade** de todo o processo

Eventuais ajustes identificados durante o período de testes deverão ser registrados e alinhados conforme o processo de gestão de mudanças acordado.

---

**Documento encerrado.**

---

*Gerado em: 22/12/2025*
*Versão: 1.0*
*Responsável: Alison Silva (DevAlissu)*

---

## Anexo A - Glossário

| Termo | Significado |
|-------|-------------|
| NFe | Nota Fiscal Eletrônica |
| OC | Ordem de Compra |
| XML | Extensible Markup Language (formato do arquivo) |
| DANFE | Documento Auxiliar da NFe |
| SEFAZ | Secretaria da Fazenda |
| Budget | Orçamento mensal de compras |
| Requisição | Solicitação de compra interna |

## Anexo B - Permissões Necessárias

| Perfil | Criar | Editar | Aprovar | Cancelar |
|--------|-------|--------|---------|----------|
| COMPRAS | Sim | Próprias | Não | Próprias |
| COMPRADOR ADMIN | Sim | Todas | Não | Sim |
| DIRETOR | Sim | Todas | Sim | Sim |
| ADMINISTRAÇÃO | Sim | Todas | Sim | Sim |
| ADMINISTRADOR | Sim | Todas | Sim | Sim |

## Anexo C - Referência de Figuras

| Figura | Descrição | Localização |
|--------|-----------|-------------|
| 1 | Tela Principal de Requisições | Seção 4.1.3 |
| 2 | Modal de Nova Requisição | Seção 4.1.3 |
| 3 | Modal de Adicionar Produtos | Seção 4.1.3 |
| 4 | Contador de Produtos | Seção 4.1.3 |
| 5 | Confirmação de Criação | Seção 4.1.3 |
| 6 | Menu de Ações | Seção 4.1.3 |
| 7 | Gerenciamento de Itens | Seção 4.1.3 |
| 8 | Ação Submeter | Seção 4.1.3 |
| 9 | Ação Aprovar | Seção 4.1.3 |
| 10 | Confirmação com OC | Seção 4.1.3 |
| 11 | Seleção Múltipla | Seção 4.1.3 |
| 12 | Barra de Ações em Lote | Seção 4.1.3 |
| 13 | Modal de Histórico | Seção 4.1.3 |
| 14 | Diagrama de Status | Seção 4.1.4 |
| 15 | Tabela de Requisições | Seção 4.1.5 |
| 16-24 | Ordens de Compra | Seção 4.2 |
| 25-41 | Entrada por XML/NFe | Seção 4.3 |
| 42 | Diagrama de Integração | Seção 5 |
