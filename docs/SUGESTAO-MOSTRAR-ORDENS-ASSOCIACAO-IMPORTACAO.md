# Sugestão: mostrar as ordens de compra na associação da Importação (web)

> Objetivo: trazer para o web o que o Delphi (`UniExecEntrada`) já faz na conferência de
> entrada — **mostrar qual ordem de compra foi encontrada/escolhida por item** e permitir
> **dividir a quantidade de um item entre mais de uma ordem** (rateio) quando a quantidade
> da nota difere do saldo da ordem.

## 1. Modelo validado no Oracle (fonte da verdade)

Pacote `ENTRADASEFAZ` (corpo lido do banco de desenvolvimento).

### 1.1 Seleção das ordens candidatas — `ENTRADASEFAZ.Seleciona_ItPedido`
Filtro efetivo (variante por fornecedor, `vTipo='F'`):

```sql
From cmp_it_requisicao itr, dbProd p, dbMarcas m,
     cmp_ordem_compra orc, cmp_requisicao req, dbcredor c
Where vFiltro = req.req_cod_credor
  and c.cod_credor = req.req_cod_credor
  and orc.orc_req_id = req.req_id and orc.orc_req_versao = req.req_versao
  and req.req_id = itr.itr_req_id and req.req_versao = itr.itr_req_versao
  and orc.orc_status in ('A')                       -- só ordem ABERTA
  and itr.itr_codprod = p.codprod
  and itr.itr_quantidade <> itr.itr_quantidade_atendida   -- saldo > 0
  and p.codmarca = m.codmarca
  and req.req_tipo <> 'EM'                          -- exclui requisição tipo 'EM'
Order by p.ref
```

Colunas devolvidas para a grid: **`orc.orc_id AS codreq`** (= nº da Ordem de Compra),
`itr_pr_unitario`, `(itr_quantidade - itr_quantidade_atendida) AS quant` (saldo),
`ref`, `descr`, `descmarca`, NCM, `prcompra`, `qtest`, IPI/ICMS calculados.

**Chave da ordem = `orc_id`** (um número). `orc_id` resolve `req_id/req_versao`.

### 1.2 Divisão da quantidade entre ordens (rateio) — Delphi `UniExecEntrada`
- Mantém um "restante da NF" (`qtdeNF`), exibido como **"restante/total"**.
- Ao escolher uma ordem, sugere: se restante ≥ saldo da ordem → oferece o saldo inteiro;
  senão → oferece o que resta da NF.
- Valida a parcela contra o **saldo da ordem** e contra o **restante da NF**; grava a
  parcela e faz `qtdeNF := qtdeNF - parcela`. Com restante > 0, repete em **outra** ordem.
- Grava como **tabela de rateio** (1 linha por ordem): `NFE_ENT_DET_PED_AUX`
  chave `(codnfe_ent, nitem, codprod, codpedido)` + `qtdenf` (parcela) + `qtdeped`.
  → Vários `codpedido` para o mesmo item = quantidade dividida.

### 1.3 Baixa do saldo na efetivação — `ENTRADASEFAZ.Inc_ItEntrada`
```sql
saldo := itr_quantidade - itr_quantidade_atendida;       -- por (codprod, req_id, req_versao)
if recebido >= saldo then
   update cmp_it_requisicao set itr_quantidade_atendida = itr_quantidade ...   -- fecha
else
   update cmp_it_requisicao set itr_quantidade_atendida = itr_quantidade_atendida + recebido ...
end if;
Ordem_Compra.Status_Ordem_Compra(orc_id);   -- recalcula/fecha o status da ordem
```
Reversão em `Del_ItEnt` / `Cancel_Ent` (subtrai `itr_quantidade_atendida`).

## 2. Estado atual do web (gaps)

| Item | Oracle/Delphi | Web hoje | Gap |
|---|---|---|---|
| Listar ordens candidatas | `Seleciona_ItPedido` | `itens-pedido.ts` (mesma base) | ok, mas falta filtro `req_tipo <> 'EM'` |
| Mostrar a ordem escolhida por item | grid com `CODREQ` + grid de rateio (`CODPEDIDO/QTDENF`) | só o contador "Itens c/ Pedido N/total" | **não mostra o nº da ordem nem a parcela** |
| Dividir item entre várias ordens | rateio (N linhas por item) | `vincular-pedidos.ts` grava **1 `id_orc` por item** (consumo guloso) | **sem rateio** |
| Baixar saldo (`itr_quantidade_atendida`) | `Inc_ItEntrada` + `Status_Ordem_Compra` | não baixa | fora do escopo da nacionalização (ver §5) |

Persistência atual: `dbent_importacao_it_ent.id_orc` (coluna única por item).

## 3. Proposta de UI (tela Faturas/Pedidos → por item)

1. **Coluna "Ordem"** na lista de itens de cada fatura: mostra o(s) `orc_id` associado(s).
   - Item sem ordem: badge cinza "sem ordem".
   - Item com 1 ordem: `#<orc_id>`.
   - Item com rateio: `#A (qtd) · #B (qtd)` ou um chip "2 ordens" com tooltip do rateio.
2. **Botão/ação "Associar ordem"** por item → abre um painel com a **grid de ordens
   candidatas** (reuso de `itens-pedido.ts`), colunas: `Ordem (orc_id)`, `Saldo`,
   `Pr. Unit`, `Ref`, `Descrição`, `Marca`, `NCM`.
3. **Controle de rateio** espelhando o Delphi:
   - Cabeçalho do painel mostra **"restante/total"** da quantidade do item.
   - Ao escolher uma ordem, sugere a parcela (mín. entre saldo da ordem e restante).
   - Valida parcela ≤ saldo da ordem e parcela ≤ restante; soma à lista de rateio e
     atualiza "restante". Permite adicionar outra ordem enquanto restante > 0.
   - "Remover" uma associação devolve a parcela ao restante.
4. **Indicador de completude**: item fica "verde" quando `restante = 0` (totalmente
   coberto por ordem) — opcional, pois a nacionalização não exige ordem (ver §5).

## 4. Proposta de modelo de dados (web)

Para suportar rateio (espelho de `NFE_ENT_DET_PED_AUX`), criar tabela de vínculo:

```
dbent_importacao_item_ordem (
  id            serial pk,
  id_item       int  → dbent_importacao_it_ent.id,
  orc_id        int,            -- cmp_ordem_compra.orc_id
  codprod       varchar,
  qtd_rateio    numeric,        -- parcela alocada a esta ordem (= QTDENF)
  qtd_ordem     numeric,        -- saldo/qtd da ordem no momento (= QTDEPED, informativo)
  created_at    timestamptz default now()
)
```
- Migração **aditiva** nas 3 filiais (padrão multi-filial).
- `dbent_importacao_it_ent.id_orc` continua para o caso simples (1 ordem), ou é
  deprecado em favor da nova tabela (recomendado: nova tabela como fonte única; `id_orc`
  vira derivado = a única linha quando houver só uma).
- Endpoints:
  - `GET  /api/importacao/[id]/itens-pedido` — já existe; **adicionar** `req_tipo <> 'EM'`.
  - `POST /api/importacao/item/[idItem]/ordens` — grava o rateio (lista de `{orc_id, qtd}`),
    valida soma ≤ qtd do item e cada parcela ≤ saldo da ordem.
  - `DELETE` de uma linha do rateio.

## 5. Baixa de saldo da ORDEM — a associação NÃO é informativa (correção)

> **Importante (corrige entendimento anterior):** "baixar saldo" é da **ORDEM DE COMPRA**
> (`itr_quantidade_atendida`), não do estoque. É o "quanto do pedido já foi atendido".
> O `id_orc` do item **é funcional** — ele é o que baixa o pedido lá na frente.

Cadeia real no web (importação), espelho do Delphi `Inc_ItEntrada` + `Status_Ordem_Compra`:

1. Item com `id_orc` → `importacao/[id]/gerar-entradas.ts` grava em
   `nfe_item_pedido_associacao` (**só se tiver `id_orc`**); não baixa saldo aqui.
2. `entradas/gerar-por-chave.ts` lê essa associação e:
   - `UPDATE cmp_it_requisicao SET itr_quantidade_atendida += qtd` (baixa o saldo da ordem);
   - fecha a ordem (`orc_status='F'`) quando o saldo zera.
3. Estorno em `entradas/[id]/cancelar.ts` e `entrada-xml/resetar-nfe.ts` (subtrai).

**Consequência do estado "Associado sem OC":** um item com `codprod` mas **sem `id_orc`**
nunca entra em `nfe_item_pedido_associacao` → **nenhuma ordem é baixada** → o pedido de compra
fica aberto com **saldo fantasma**. Para a importação (onde tudo foi comprado via pedido) isso
está **errado** — e o gate de emissão hoje nem cobra a ordem (ver §7).

## 6b. Modelo correto (paridade Delphi/nacional)

No Delphi (`UniExecEntrada`) e na entrada nacional do web, a associação é **pela ordem**:
escolhe-se a ordem aberta e **de lá vem o produto** (produto + `id_orc` no mesmo passo). Não
existe "produto associado solto". O botão **🛒 Associar à Ordem** (implementado) segue esse
caminho. Os caminhos **produto-primeiro** (busca de produto / auto "Associar e Vincular") é que
produzem o estado "sem OC".

**Regra de conclusão proposta p/ nacionalização:** um item só está *completo* com `codprod`
**e** `id_orc`. "Associado sem OC" = incompleto. O gate de emissão deve:
- exigir **todos** os itens associados (hoje é `some`, deveria ser `every`);
- exigir `id_orc` em todos os itens que entram em estoque (salvo exceção explícita — ver decisão);
- a UI deve distinguir **"Associado + OC"** (completo, verde) de **"sem OC"** (incompleto, âmbar),
  em vez de ambos lerem "Associado".

**Decisão de negócio pendente:** existe item de importação legítimo **sem** ordem
(bonificação/amostra)? Se não, exigir `id_orc` em todos. Se sim, permitir exceção sinalizada.

## 6. Escopo mínimo para destravar o teste atual

Para o teste imediato (9 itens NINGBO), nada acima é pré-requisito — basta existir **ordem
aberta com saldo** para o credor `05674`. A melhoria de UI (mostrar ordem + rateio) é o
incremento que torna o fluxo igual ao Delphi e evita a "caixa-preta" de hoje.

### Prioridade sugerida / status
1. ✅ **FEITO** — Paridade do filtro `req_tipo <> 'EM'` em `itens-pedido.ts` e `vincular-pedidos.ts`
   (usado `COALESCE(req.req_tipo,'') <> 'EM'` para não esconder ordens de tipo nulo).
2. ✅ **FEITO** — Coluna **"Ordem (OC)"** por item em `ItensTable.tsx` (badge `#<orc_id>` / "sem ordem"),
   e badge de status "Associado + OC". O modal de associação (`ImportarPedidoModal`) já exibe a
   coluna "Pedido" (`orc_id`) e "Qtd Disponível".
3. ✅ **FEITO (via linha-por-ordem)** — Rateio: em `ImportarPedidoModal` a **quantidade por ordem é
   editável** (default = saldo, limitada ao saldo). Pegar parcial de ordens diferentes do mesmo
   produto cria linhas associadas separadas (cada uma com seu `id_orc`) = rateio entre ordens.
4. ⏸️ **DISPENSADO por ora** — Tabela `dbent_importacao_item_ordem` só seria necessária para rateio
   *in-place* (N ordens na MESMA linha, como o Delphi). O web modela rateio como **linha por ordem**
   (consistente com `dividirItem`), então não precisa da tabela nem de migração nas 3 filiais.
   Reconsiderar só se exigirem 1 linha de item com várias ordens.

> **Observação:** a baixa de `itr_quantidade_atendida` continua **não** ocorrendo na nacionalização
> (a nota sai pelo faturamento). A associação à ordem aqui é informativa/rastreável.
