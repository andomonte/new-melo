# Roteiro para aprovação: adiantamento a fornecedor, NF no título e Crédito de Fornecedor

**Data:** 24/11/2026. **Situação:** todas as decisões aprovadas em 24/11. As 4 fases feitas, com as migrations 086 a 091 aplicadas no banco de teste.

**Decisões tomadas (24/11/2026):**
- **D1:** aprovada como proposta. Implementada em `src/lib/compras/tituloCompras.ts`; títulos existentes corrigidos pela migration 086.
- **D4:** título **avulso** (lançado direto no Contas a Pagar, fora do Compras) com conta financeira **2**, **sem NF**: quando for **pago**, vira crédito. Se for pago **com** a NF informada, **não** vira crédito. A conta 4 (adiantamento) segue a mesma regra: pago sem NF vira crédito.
- **D6:** aprovada. Os adiantamentos já pagos e sem NF geram crédito (fase 3).
- **D2:** duplicata do restante da NF = `{duplicata do XML}/{parcela}/{total}`. Quando o XML traz só a sequência (`001`) ou nada, entra o nº da NF: `78239/1/2`, `78239/2/2`. Função `duplicataNota`.
- **D3:** renumerar só os títulos antigos **não pagos** (sem pagamento parcial, fora de remessa SISPAG). Migration 087.
- **D5:** o adiantamento continua título próprio e aparece no histórico da nota (fase 2).
- **Frete (CT-e):** os títulos de frete gravavam a mesma conta sequencial errada. Passam a usar **7 – FRETE NACIONAL**; os existentes foram corrigidos na migration 088.
**Base:** [spec-saldo-credor-fornecedor.md](spec-saldo-credor-fornecedor.md), aprovada em 21/09. As tabelas de crédito já existem (migration 053), mas estão vazias e não têm tela.

---

## 1. O que muda, em resumo

1. O adiantamento passa a ser salvo na conta financeira **4 – ADIANTAMENTO A FORNECEDOR**.
2. A duplicata do adiantamento passa a ser **`OC` + nº da ordem + parcela/total**. Exemplo: `OC12026110045/1/1`.
3. Quando a NF é associada à ordem, o título de adiantamento passa a mostrar **o número da nota** e uma observação.
   - Uma ordem pode ter várias notas. Elas ficam no campo NF separadas por `/`.
   - Em Contas a Pagar aparece a primeira nota seguida de "…". Um clique abre a lista das notas, com o valor de cada uma e quanto o adiantamento cobriu.
4. O adiantamento aparece no histórico da nota, junto com as parcelas do valor restante.
5. **Crédito de fornecedor:** nasce quando um título da conta financeira **4** (ou **2**, ver decisão D4) é **pago sem NF associada**. A nota, quando chega, consome esse crédito. O que sobrar fica como saldo.
6. **Tela nova "Crédito de Fornecedor":** mostra fornecedores, créditos e histórico, e tem a opção **Usar crédito** para baixar títulos do fornecedor ou das filiais dele.

---

## 2. Como está hoje (levantado no banco em 24/11)

| Item | Hoje | Problema |
|---|---|---|
| Conta financeira do adiantamento | Sequência automática (maior conta usada + 1) | Cai em conta errada (JUROS SANTANDER, CARTÃO RECEBIDO…) ou inexistente (nº 304 a 323). Afeta os 50 adiantamentos. |
| Conta financeira das parcelas da NF | Mesma sequência | Mesmo erro. |
| Conta bancária / centro de custo | Fixos em `0001` | No cadastro, `0001` é "DESC.COMISSAO" / "EXTRA". Nas parcelas da NF ficam vazios. |
| Banco | Gravado pelo nome ("MELO COMERCIO") | A listagem procura pelo código e não encontra. |
| Campo NF do adiantamento | Sempre vazio, `tem_nota='N'` | Os 50 adiantamentos estão sem nota, mesmo os que já tiveram NF associada. |
| Campo NF das parcelas da NF | Código interno da nota (`000049641`) | O número real é outro: `78239`. |
| Duplicata | `OC` + código do título + `/01` (`OC27915/01`) | Não traz o nº da ordem. O número é "maior + 1" sem trava, então dois usuários ao mesmo tempo podem gerar o mesmo. |
| Tamanho do campo NF | 20 caracteres | Cabem só 2 notas de 9 dígitos. |
| Tela do adiantamento já configurado | Mostra valor 0,00 e sem vencimento | Não carrega o que foi salvo. A OC 12026110045 tem R$ 1.431,00. |
| Crédito de fornecedor | Tabelas criadas e vazias, sem tela | — |
| Filtro "só adiantamentos" | **Já existe**: Contas a Pagar → Origem Compras → "Pagamento Antecipado" | — |

**Padrão de duplicata no Delphi** (Oracle, últimos 2 anos, 25 mil títulos com NF):

| Formato | Quantidade |
|---|---|
| "parcela/total" (`1/1`, `2/3`) | ~7.400 |
| "NF nº parcela.total" (`NF 100034 1.1`) | ~11.000 |
| "parcela.total" (`1.1`) | ~2.900 |

Os títulos mais recentes do Delphi usam `1/1`, com o campo NF preenchido.

---

## 3. Etapas

### Etapa 1: conta financeira certa
- **Adiantamento** (parcela 0 da ordem): conta financeira **4 – ADIANTAMENTO A FORNECEDOR**.
- **Parcelas do valor restante da NF:** conta financeira conforme a decisão **D1**.
- **Conta bancária e centro de custo:** deixar de gravar `0001` fixo. Ficam vazios, para o Financeiro escolher ao pagar, como num título normal.
- **Banco:** gravar o **código**, não o nome.
- **Correção dos títulos existentes:**
  - os 50 adiantamentos passam para a conta 4;
  - as parcelas de NF passam para a conta da regra D1;
  - antes, um relatório mostra o que será alterado.

### Etapa 2: duplicata
- **Ordem de compra** (adiantamento e parcelas configuradas na OC): `OC{nº da ordem}/{parcela}/{total}`.
  - Exemplos: `OC12026110045/1/1` (adiantamento único); `OC12026110045/1/3`, `/2/3`, `/3/3`.
  - Cabe no campo (até 19 de 20 caracteres).
- **Valor restante da NF** (gerado no Compras ao configurar o pagamento da nota): conforme a decisão **D2**. O campo NF recebe o **número real** da nota.
- **Código do título:** gerado com trava, para não repetir.
- **Títulos já existentes:** conforme a decisão **D3**.

### Etapa 3: NF no título de adiantamento
Quando a NF é associada à ordem e o pagamento da nota é configurado:
- **No título de adiantamento:**
  - **Campo NF:** número da nota. Com várias notas: `78239/78301/78455`. O campo passa de 20 para 200 caracteres.
  - `tem_nota = 'S'`.
  - **Observação:** acrescenta `NF 78239 associada em 24/11/2026: R$ 1.000,00 atendido`.
- **Registro novo, "notas do título":** guarda título, nota (nº, série, chave), valor da nota, valor atendido, data e usuário. É de onde sai o modal.
- **Contas a Pagar, coluna NF:**
  - uma nota → mostra o número;
  - várias → `78239…`. Clique abre o modal com a lista de notas, o valor de cada uma, quanto foi atendido em cada e o saldo do adiantamento.
- **Correção junto:** as parcelas geradas pela NF passam a gravar o número real da nota, não o código interno.

### Etapa 4: adiantamento no histórico da nota
Duas opções (decisão **D5**):
- **A, recomendada:** o adiantamento **continua como título próprio**. Ele já foi pago ou está em pagamento, então número e valor não mudam. Aparece:
  - na nota, em "Pagamentos desta nota", como `Adiantamento OC12026110045/1/1: R$ 1.431,00`, junto com as parcelas do restante;
  - no histórico do título, com cada nota que ele atendeu.
- **B:** o adiantamento **vira a parcela 1** da nota (a duplicata é renumerada para o padrão da nota). Não recomendo: muda um título que pode já estar pago, em remessa ou conciliado, e uma ordem com várias notas não tem uma única "nota dona".

### Etapa 5: crédito de fornecedor (regra nova)
**Quando nasce:** um título é **pago** (total ou parcial) e:
- a conta financeira é **4** (ou **2**, conforme D4); e
- **não tem NF associada**.

Então o crédito é igual ao valor pago, com o fornecedor (grupo pela raiz do CNPJ) e o título de origem.

**Onde o sistema faz isso:** em todas as formas de baixa:
- pagar;
- marcar como pago;
- baixa pelo retorno do banco;
- pagamento em lote.

A regra fica numa rotina única, chamada por todas.

**Quando a NF é associada a uma ordem com adiantamento:**

| Situação do adiantamento | O que acontece |
|---|---|
| Pago (tem crédito) e NF **≤** crédito | A nota consome o crédito no valor da nota. Nenhuma parcela é gerada. O saldo continua como crédito. |
| Pago (tem crédito) e NF **>** crédito | Consome o crédito todo. Gera parcelas só do restante. |
| **Não pago** | Sem crédito. Segue a regra atual: entra como entrada, ou é cancelado se cobrir a nota inteira. |
| Pago **depois** da NF associada | Já tem NF, então **não gera crédito**: o pagamento é da própria nota. |

**Estorno do pagamento** de um título que gerou crédito:
- se o crédito ainda não foi usado, ele é cancelado;
- se já foi usado, o estorno é bloqueado até desfazer o uso.

**O que muda na spec de setembro:** antes, o crédito nascia só da **sobra** no momento da associação. Agora nasce **no pagamento**, e a nota consome. O resultado final é o mesmo. A diferença é que o adiantamento pago **já aparece como crédito** antes de a nota chegar, o que dá visão do dinheiro adiantado.

### Etapa 6: tela "Crédito de Fornecedor" (Financeiro)
- **Lista:**
  - fornecedor (agrupado com as filiais pela raiz do CNPJ);
  - quantidade de créditos em aberto;
  - **saldo**;
  - crédito mais antigo (dias).
  - Busca por nome ou CNPJ.
- **Detalhe do fornecedor:**
  - **Créditos:** origem (adiantamento da OC X, título avulso Y, sobra), valor pago, usado, saldo e data.
  - **Histórico:**
    - o pagamento que gerou cada crédito;
    - as **notas** que consumiram (nº, valor da nota, quanto foi usado);
    - os títulos baixados com crédito;
    - os estornos.
- **Usar crédito:**
  1. O sistema busca os **títulos em aberto do fornecedor e das filiais dele**.
  2. O usuário marca quais baixar e quanto de cada um (parcial permitido).
  3. Confirma.
  - A baixa usa a forma **ABATIMENTO DE SALDO**, que não mexe em caixa nem banco (conta `0128` CRÉDITO\ACERTO, spec §7).
- **Estornar uso:** motivo obrigatório; o valor volta ao crédito.
- **Permissão:** grupo Financeiro (Administração). Ajustar se precisar.
- **Contas a Pagar:** selo "tem crédito" no título de fornecedor com saldo, com atalho para a tela.

---

## 4. Decisões para aprovar

| # | Pergunta | Recomendação |
|---|---|---|
| **D1** | Conta financeira das **parcelas do restante da NF** | Pelo fornecedor: **3 – Fora do Estado** se a UF ≠ AM, **1 – Internacional** se for importação, senão **2 – Fornecedor Local**. |
| **D2** | Duplicata das **parcelas do restante da NF** | Padrão do Delphi: **`parcela/total`** (`1/2`, `2/2`), com o nº real no campo NF. A duplicata do XML (`001`, `002`) vai para a observação. Alternativa: usar a duplicata do XML como número. |
| **D3** | Renumerar duplicatas já existentes (`OC27915/01` → `OC12026110045/1/1`)? | Só títulos **não pagos e fora de remessa**. Os pagos ficam como estão. |
| **D4** | Conta **2 – Fornecedor Local** gera crédito automático quando paga sem NF? | **Cuidado:** título comum de fornecedor local em que ninguém digitou a NF viraria crédito por engano (hoje há 1 caso, R$ 166,68). Recomendo: **conta 4 sempre**; conta 2 **só** quando o título for marcado como "adiantamento" no cadastro avulso (caixa de seleção nova). |
| **D5** | Adiantamento no histórico (A) ou vira parcela da nota (B)? | **A**: continua título próprio e aparece na nota e no histórico. |
| **D6** | Créditos de adiantamentos **já pagos** antes desta mudança | Gerar crédito para os pagos sem NF (hoje: 7 pagos, a conferir 1 a 1 no relatório antes). |

---

## 5. Ordem de entrega

| Fase | Entrega | Mudança no banco |
|---|---|---|
| 1 | Conta financeira 4, banco pelo código, sem conta/centro de custo fixos, duplicata `OC{ordem}/p/t` com trava, tela do adiantamento mostrando o valor salvo, correção dos títulos existentes (com relatório antes) | Script de correção |
| 2 | NF no adiantamento (nº real, várias notas com `/`, observação), registro "notas do título", coluna NF com "…" e modal | Campo NF para 200 caracteres; tabela de notas do título |
| 3 | Crédito no pagamento (contas 4 e 2 conforme D4), consumo pela NF, estorno | Novas origens de crédito em `credor_credito`; registro do consumo por nota |
| 4 | Tela Crédito de Fornecedor (lista, detalhe, histórico, Usar crédito, estorno) e selo no Contas a Pagar | Forma ABATIMENTO DE SALDO (já existe na migration 053) |

As mudanças no banco entram como migrations novas e precisam rodar em produção ao subir.

### Fase 2: o que foi feito (24/11/2026)
- **Migration 089:** `dbpgto.nro_nf` com 200 caracteres; tabela `dbpgto_nota` (notas do título: título, NF, nº, série, chave, tipo ADIANTAMENTO/PARCELA, valor da NF, valor atendido, data, usuário).
- **Correção dos existentes:**
  - 47 parcelas de NF em Manaus, 1 em Roraima e 1 em Rondônia passaram do código interno para o nº real da nota;
  - 3 adiantamentos de Manaus (027890, 027898, 027920) ganharam a nota e `tem_nota='S'`.
  - Cópia em `dbpgto_bkp_089`.
- **Configurar pagamento da NF** (`configurar-pagamento-nfe.ts`):
  - parcelas gravam o nº real e o vínculo;
  - o adiantamento ganha a nota no campo NF (várias com `/`), a observação e o vínculo, sem passar do que sobra dele;
  - a reconfiguração não apaga mais as parcelas de **outra** NF da mesma ordem.
- **Histórico da NF:** mostra a duplicata do adiantamento e quanto ele atendeu da nota.
- **Contas a Pagar:**
  - coluna NF com `78239…` e o modal das notas (`/api/contas-pagar/{id}/notas`);
  - a duplicata no padrão novo não é mais remontada na tela.
- Com a mesma ordem em duas notas, a conferência das parcelas usava o adiantamento inteiro. **Resolvido na fase 3.**

### Fase 3: o que foi feito (24/11/2026)
- **Rotina única** `src/lib/compras/creditoFornecedor.ts` (`sincronizarCreditoTitulo`).
  - Recalcula o crédito do título pelo estado atual. Pode rodar várias vezes sem duplicar.
  - O valor pago vem do histórico `dbfpgto` (sem a forma 45); sem histórico, de `valor_pago`.
  - **Gera crédito:** título de fornecedor pago, sem NF, com conta 4, ou com conta 2 se for avulso (fora do Compras).
  - **Não gera:** pago depois de a NF estar no título.
- **Onde é chamada:**
  - pagar (dentro da transação, com savepoint);
  - marcar como pago;
  - baixa pelo retorno do banco;
  - configurar o pagamento da NF (para os adiantamentos pagos).
  - Na baixa, uma falha do crédito vai para o log e não desfaz o pagamento.
- **Estorno do pagamento** (`cancelar-pagamento`):
  - agora roda em transação e atualiza `valor_pago`;
  - crédito não usado é cancelado;
  - crédito já usado bloqueia o estorno (409 com a mensagem).
  - Editar título pago já era bloqueado.
- **Consumo pela NF** (`configurar-pagamento-nfe`): o adiantamento vale pelo que ainda abate desta NF. Pago: crédito disponível. Não pago: o que não foi usado em outra NF.
  - **NF menor ou igual ao crédito:** a nota quita e consome o crédito. O que sobra continua crédito (não nasce mais o crédito "sobra" à parte).
  - **NF maior:** consome o crédito todo e as parcelas ficam só com o restante. Antes, esse caso era recusado na conferência das parcelas.
  - **Reconfiguração:** devolve o consumo anterior antes de recalcular.
  - **Cancelamento do antecipado não pago:** só cancela título que não atende outra NF.
- **Mesma conta nas telas:** a sugestão de parcelas (`parcelas-sugeridas-v2`) e a seleção manual (`buscar-pagamentos-antecipados`) usam a mesma conta do servidor.
- **Regra (24/11):** no Compras, a nota só usa automaticamente o adiantamento do **próprio pedido**, inclusive a sobra de uma nota anterior. A seleção manual lista só adiantamentos **não pagos**. O crédito de fornecedor vindo de outro pedido ou de título avulso **não aparece no Compras**: é usado na tela Crédito de Fornecedor, por abatimento manual dos títulos em aberto do fornecedor ou das filiais dele. A tela reconhece adiantamento pago também no fluxo automático.
- **Migration 090:**
  - `credor_credito_uso` com `nfe_id` e campos de estorno do uso;
  - um crédito por título;
  - **D6:** 5 créditos em Manaus (4 adiantamentos, R$ 4.359,01, e o avulso de R$ 166,68).
- **Testado no banco** (transação desfeita): adiantamento pago com NF menor, reconfiguração, estorno bloqueado, pagamento e estorno de adiantamento sem NF, pagamento de título que já tem NF, e erro isolado no savepoint.

### Fase 4: o que foi feito (24/11/2026)
- **Tela Financeiro → Crédito de Fornecedor** (`/admin/financeiro/creditoFornecedor`, componente `src/components/corpo/admin/financeiro/creditoFornecedor`):
  - **lista:** fornecedor agrupado com as filiais pela raiz do CNPJ, com saldo, créditos em aberto, crédito mais antigo (dias) e títulos em aberto. Busca por nome ou CNPJ e opção "mostrar zerados";
  - **detalhe:** abas Créditos (origem, título, conta financeira, gerado, usado, saldo, situação), Histórico (geração, notas que consumiram, títulos baixados, estornos) e Filiais.
- **Usar crédito:**
  - lista os títulos em aberto do fornecedor e das filiais, sem os adiantamentos (conta 4);
  - o usuário marca os títulos e o valor de cada um (parcial permitido);
  - consome os créditos do mais antigo para o mais novo;
  - lança no histórico do título com a forma **Z – ABATIMENTO DE SALDO** (inativa: não aparece no "Pagar") e a conta **0128 CRÉDITO\ACERTO**, e atualiza o pago;
  - título em remessa SISPAG não pode ser abatido;
  - a baixa com crédito não gera crédito novo.
- **Estornar uso:**
  - motivo obrigatório;
  - cancela o lançamento, devolve o crédito e refaz o pago do título;
  - estornar esse lançamento pelo histórico do Contas a Pagar também devolve o crédito.
  - O consumo por NF não se estorna na tela: reconfigure o pagamento da NF.
- **Contas a Pagar:**
  - selo **CRÉDITO** no credor que tem crédito no grupo, com atalho para a tela (`?cod_credor=`);
  - o histórico mostra a forma Z como "Abatimento de saldo".
- **Rotas:** `/api/financeiro/credito-fornecedor` (lista, credores, grupo), `/detalhe` (detalhe e títulos), `/usar`, `/estornar`. Rotina em `creditoFornecedor.ts`.
- **Migration 091:**
  - forma Z;
  - `credor_credito_uso.fpg_cof_id`;
  - tela em `tb_telas` com a mesma permissão de Contas a Pagar (Manaus: ADMINISTRAÇÃO, CONTASAPAGAR, FATURAMENTO, financeiro; Roraima e Rondônia: ADMINISTRAÇÃO, FATURAMENTO).
  - Re-logar para ver o menu.
- **Permissão:** checada só no menu, como nas outras telas do financeiro. As rotas não validam o grupo.

## 6. Fora deste roteiro
- **Crédito entre filiais da MELO** (Manaus usar crédito de Roraima): são bancos diferentes; já estava adiado na spec.
- **Contabilização** do adiantamento.
- **Valor das duplicatas do XML:** o campo `dbnfe_ent_cobr.vdup` é inteiro e corta os centavos. É um problema à parte, para corrigir em seguida.
