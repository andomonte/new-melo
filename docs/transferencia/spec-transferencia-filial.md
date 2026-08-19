# Especificação: Transferência de Produtos entre Filiais (a partir de Entrada)

> Documento de requisitos para implementação. Escrito para ser lido por um agente de código.
> **Ainda não implementar.** Porte da tela Delphi "Transferência de Produtos Filial"
> (`TRANSFERENCIA_ENTRADA`) para o web, fiel ao fluxo (origem = Entrada) usando o modelo
> novo `arm_transferencia` e reusando o pipeline de faturamento/NF-e.

---

## 0. Regra de ouro

**Reuso máximo, sem reescrever fiscal.** A geração da NF-e de transferência usa os endpoints
prontos (`/api/faturamento/salvar` + `/emitir`), o estoque usa `cad_armazem_produto`, e o
controle usa o modelo já existente `arm_transferencia`/`arm_it_transferencia` (hoje vazios).
Nada de duplicar `emitir.ts`. O rollback reusa a técnica do `/api/caixa/reverter-fatura`.

---

## 1. Stack e convenções

- **Framework:** Next.js (Pages Router) — endpoints em `src/pages/api/transferencia/*`.
- **Banco:** PostgreSQL, schema por filial (`db_manaus`, …). Tabelas em `db_manaus`.
- **Dinheiro/quantidade:** `numeric` (padrão do schema). Datas `timestamptz`/`date`.
- **Transação:** toda geração roda em transação; falha → rollback/compensação.
- **Teste:** `npx tsx` com `BEGIN → operar → ROLLBACK`.

---

## 2. Objetivo

Transferir produtos **recebidos numa Entrada** (compra) da filial de origem para as filiais
de destino (REC/PVH/FLZ/BMO/CSAC/JPS), gerando o documento fiscal correto (**NF-e de
transferência, CFOP 6152 interestadual**) e movimentando o estoque, com rastreio de
**emissão → envio → recebimento**.

**Fidelidade ao Delphi:** a origem é sempre uma **Entrada** (o operador distribui uma compra
recebida). Cada filial destino é um **CLIENTE** — a transferência é uma **VENDA → FATURA →
NF-e** para o `codcli` daquela filial.

---

## 3. Glossário

| Termo | Definição |
|---|---|
| **Entrada** | Compra recebida (`dbent` + `dbitent`); origem dos produtos a transferir. |
| **Filial destino** | Uma das filiais, representada por um **cliente fixo** (`dbclien_filial`). |
| **Transferência** | Cabeçalho (`arm_transferencia`) + itens (`arm_it_transferencia`); uma por filial destino. |
| **NF-e de transferência** | NF-e (CFOP 6152) emitida para o cliente-filial, movendo a mercadoria. |
| **qtd_transferido** | Quantidade da Entrada já destinada a transferência (`dbitent.qtd_transferido`). |

---

## 4. Mapa Filial → Cliente (do Delphi, `Navega_ClienteFilial`)

Cada filial destino é um `codcli` fixo em **`dbclien_filial`**:

| Filial | codcli | UF (aprox.) |
|---|---|---|
| REC (Recife) | 04487 | PE |
| PVH (Porto Velho) | 03341 | RO |
| FLZ (Fortaleza) | 05634 | CE |
| BMO | 27911 | — |
| CSAC | 17142 | — |
| JPS | 20626 | — |

- **`dbclien_filial` (8 linhas) NÃO existe no PG ainda** → migrar do Oracle (`GERAL.DBCLIEN_FILIAL`)
  ou criar um mapa de config. Os clientes em si (04487, 03341…) **já estão** no `dbclien` (migrado).
- Cada cliente-filial tem CNPJ/IE próprio → transferência interestadual → **NF-e 6152**.

---

## 5. Modelo de dados

### 5.1 `arm_transferencia` (já existe — cabeçalho, 1 por filial destino)
`tra_id` (PK), `tra_arm_id_origem`, `tra_arm_id_destino`, `tra_codusr_emissao`,
`tra_codusr_envio`, `tra_codusr_recebimento`, `tra_data`, `tra_transp`, `tra_pedido`,
`tra_obs`, `tra_status`, `tra_cancel`.

**Adicionar (migration):** `tra_codent` (entrada de origem), `tra_codcli_destino` (cliente-filial),
`tra_codfat` (fatura/NF gerada), `tra_vlr_frete`, `tra_codtptransp`. (Só ADD COLUMN, não altera o existente.)

### 5.2 `arm_it_transferencia` (já existe — itens)
`itt_tra_id` (FK), `itt_codprod`, `itt_qtd`. **Adicionar:** `itt_codent`/`itt_nritem` (elo com a Entrada), `itt_prunit`.

### 5.3 Origem (leitura)
- `dbent`/`dbitent` — a Entrada e seus itens; `dbitent.qtd` (recebido) e `dbitent.qtd_transferido` (já destinado).
- `cad_armazem_produto` — estoque por armazém (baixa na origem / entrada no destino).

---

## 6. Máquina de estados (`tra_status`)

```
EMISSAO --gerarNFe--> ENVIADO --receber--> RECEBIDO
   |                     |
   +--------cancelar-----+   (antes de RECEBIDO; NF autorizada exige cancelamento SEFAZ)
```

- **EMISSAO**: cabeçalho + itens criados, ainda montando.
- **ENVIADO**: NF-e autorizada + estoque baixado na origem. Mercadoria em trânsito.
- **RECEBIDO**: filial destino confirmou; estoque entra no destino. (Melhoria sobre o Delphi.)
- **CANCELADO** (`tra_cancel='S'`): desfaz enquanto não recebido.

---

## 7. Casos de uso

### UC-01 — Selecionar Entrada e listar produtos
`GET /api/transferencia/entrada/[codent]/produtos` → itens da Entrada com `ref, descr, marca,
qtd_entrada, qtd_transferido, qtd_disponivel (= qtd - qtd_transferido)`. Porte de `Navega_TransfEntrada`.

### UC-02 — Montar a distribuição
Para cada produto, o operador informa **quantidade** e **filial destino**. Regras:
- `quantidade <= qtd_disponivel` do item da Entrada.
- Agrupa por **filial destino** → uma `arm_transferencia` por filial.
Grava/atualiza `dbitent.qtd_transferido` (porte de `Alt_ItensEntrada`), reversível.

### UC-03 — Gerar transferência (o núcleo)
Por filial destino, numa transação (ver seção 8). Porte de `Filial_Inc_Transferencia`.

### UC-04 — Receber (filial destino)
`PUT /api/transferencia/[tra_id]/receber` → status `ENVIADO→RECEBIDO`, entra estoque no destino,
grava `tra_codusr_recebimento`.

### UC-05 — Cancelar
`DELETE /api/transferencia/[tra_id]` → se `EMISSAO`: só apaga. Se `ENVIADO` com NF autorizada:
exige cancelamento da NF-e na SEFAZ antes (reusar `cancelar-nfe`), estorna estoque, `tra_cancel='S'`.

### UC-06 — Consulta
`GET /api/transferencia?dt1=&dt2=&filial=&status=` → lista (porte de `Vendas_Transferencia`).

---

## 8. Orquestração do "Gerar" (por filial destino)

Reusa o pipeline do faturamento (mesma técnica do "faturar no caixa"):

1. **Cria a VENDA** de transferência para o `codcli` da filial destino
   (`tipo_operacao=TRANSFERENCIA`, itens = produtos destinados, `vlr_frete`, transp).
   *(Equivale ao `VendaNova_Inc`+`INCIT_PRODTRANSF` do Delphi.)*
2. **Fatura** → `POST /api/faturamento/salvar` (`tipo_operacao=TRANSFERENCIA` → CFOP 6152,
   baixa estoque na origem). Retorna `codfat`.
3. **Emite NF-e** → `POST /api/faturamento/emitir` (número reservado + retry 539, igual ao caixa).
4. **Falhou (2 ou 3)?** → reverter (compensação: apaga fatura/venda, estorna estoque, `dbitent.qtd_transferido`).
5. **Sucesso:** grava `arm_transferencia` (`status=ENVIADO`, `tra_codfat`, `tra_codent`,
   `tra_codcli_destino`, transp/frete) + `arm_it_transferencia`; `dbitent.qtd_transferido += qtd`.
6. **Estoque:** a baixa na origem já foi no `salvar`. O **destino só recebe no UC-04** (RECEBIDO).

**Rollback (decisão do usuário no caixa, aplicar igual): NF falhou → desfaz tudo.**

---

## 9. API

| Método | Rota | UC |
|---|---|---|
| GET | `/api/transferencia/entrada/[codent]/produtos` | UC-01 |
| GET | `/api/transferencia/filiais-destino` | mapa filial↔codcli |
| POST | `/api/transferencia/gerar` | UC-03 (orquestra) |
| PUT | `/api/transferencia/[tra_id]/receber` | UC-04 |
| DELETE | `/api/transferencia/[tra_id]` | UC-05 |
| GET | `/api/transferencia` | UC-06 |

### Erros
`ENTRADA_NAO_ENCONTRADA` 404 · `QTD_ACIMA_DISPONIVEL` 422 · `FILIAL_DESTINO_INVALIDA` 422 ·
`NFE_NAO_AUTORIZADA` 422 (com rollback) · `JA_RECEBIDA` 409 · `NFE_AUTORIZADA` 409 (cancelar exige SEFAZ).

---

## 10. Fiscal (validado no Delphi)

- Filial destino = **cliente** (`dbclien_filial`, codcli fixo) com **CNPJ/IE próprio**.
- Transferência = **VENDA → FATURA → NF-e** para esse cliente, **CFOP 6152** (interestadual;
  `naturezaPorOperacao(TRANSFERENCIA)` no `salvar.ts`).
- Uma **NF-e por filial destino** (agrupa os itens daquela filial).
- Impostos: a NF de transferência tem tratamento próprio (ICMS/IBS-CBS) — sai do `calcular_imposto_item`
  com `tipo_operacao=TRANSFERENCIA`; **validar os CST/CFOP resultantes** contra uma NF de transferência real do MELO.

---

## 11. Casos de borda

1. **Distribuir mais que a Entrada tem** → `QTD_ACIMA_DISPONIVEL` (usa `qtd - qtd_transferido`).
2. **Vários produtos p/ várias filiais** → uma `arm_transferencia`+NF por filial destino.
3. **NF-e rejeitada** → reverte tudo (fatura, venda, estoque, qtd_transferido).
4. **Cancelar após NF autorizada** → cancela a NF na SEFAZ primeiro (`cancelar-nfe`), depois estorna.
5. **Receber parcial** → decisão de produto: por ora, recebimento é **total** por transferência (não parcial).
6. **`dbclien_filial` ausente no PG** → migrar as 8 linhas antes de usar.

---

## 12. Critérios de aceite (escrever como testes, BEGIN/ROLLBACK)

- [ ] Selecionar Entrada lista itens com `qtd_disponivel = qtd - qtd_transferido`.
- [ ] Distribuir qtd > disponível → `QTD_ACIMA_DISPONIVEL`.
- [ ] Gerar p/ 1 filial → cria venda(TRANSFERENCIA) + fatura + **NF-e autorizada** + `arm_transferencia(status=ENVIADO)` + baixa estoque origem + `qtd_transferido` atualizado.
- [ ] NF-e rejeitada → **tudo revertido** (fatura/venda/estoque/qtd_transferido).
- [ ] Gerar p/ 2 filiais no mesmo ato → **2** `arm_transferencia` + **2** NF-e.
- [ ] Receber → `ENVIADO→RECEBIDO`, estoque entra no destino, grava operador.
- [ ] Cancelar em EMISSAO → apaga; em ENVIADO com NF autorizada → exige cancelamento SEFAZ.

---

## 13. Fora de escopo (agora)

- Origem **genérica** (por armazém/produto sem Entrada) — Fase 2.
- Recebimento **parcial**.
- Transferência **intra-filial** (entre armazéns da mesma filial) — já coberta por `armazem/transferencia.ts`.

---

## 14. Ordem de implementação sugerida

1. Migrar `dbclien_filial` (8 linhas) + migration `ADD COLUMN` em `arm_transferencia`/`arm_it_transferencia`.
2. UC-01 (listar produtos da Entrada) + UC-02 (montar distribuição, grava `qtd_transferido`).
3. **UC-03 orquestrador** (venda TRANSFERENCIA → salvar → emitir → reverter on fail → grava `arm_transferencia`).
4. UC-04 receber (estoque destino).
5. UC-05 cancelar + UC-06 consulta.
6. **Tela** (grid da Entrada + distribuição por filial + transporte + "Gerar Transferência").
7. Validar CST/CFOP da NF de transferência contra uma nota real do MELO.
