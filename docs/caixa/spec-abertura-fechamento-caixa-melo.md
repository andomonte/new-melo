# Especificação: Abertura e Fechamento de Caixa — adaptado ao SysMelo

> Documento de requisitos para implementação futura. Escrito para ser lido por um agente de código.
> **Ainda não implementar.** Adaptação do spec genérico de PDV para a realidade do SysMelo
> (faturamento separado do caixa; caixa é estação de **recebimento**, não de venda).

---

## 0. Regra de ouro deste documento

**Nada do que já está pronto é alterado.** Esta estrutura só **adiciona** tabelas e um gancho
aditivo no `receber.ts`. Permanecem **intocados**:

- `faturamento` (todas as telas e fluxos) — continua gerando título independente do caixa.
- `dbfreceb`, `dbreceb`, `dbcartao`/`FIN_CARTAO`, `dbconta`, `dbcalc`, `dbferiado`.
- `tb_user_perfil` (incl. o `cod_conta` já implantado), `tb_login_user`, login.
- Módulos `src/lib/caixa/*` e `src/lib/compras/*` existentes.

O caixa novo é uma **camada por cima**: uma sessão que envolve os recebimentos e permite
abrir/fechar/conferir. Se esta camada for removida, o sistema volta a funcionar como hoje.

---

## 1. Stack e convenções (nossa realidade)

- **Framework:** Next.js (Pages Router) — endpoints em `src/pages/api/caixa/*`.
- **Banco:** PostgreSQL, **um schema por filial** (`db_manaus`, `db_roraima`, `db_rondonia`, …).
  As tabelas novas são criadas **em cada schema de filial** (igual `tb_user_perfil`, `dbconta`).
- **Pool:** `@/lib/pgClient` `getPgPool(filial)` (por filial). Nunca hardcode de credencial.
- **Dinheiro:** **`numeric(15,2)`** — NÃO centavos-inteiros. Todo o schema legado é decimal
  (dbfreceb, dbreceb, `car_vlrliq numeric(15,2)`); manter consistência evita conversões e bugs.
- **PK:** `bigserial`. Referências a conta usam `cod_conta varchar(4)` (padrão dbconta).
- **Timestamps:** `timestamptz` (UTC).
- **Transação:** toda operação que altera saldo roda dentro de transação (`BEGIN … COMMIT`).
- **Teste:** padrão do projeto — script `npx tsx` com `BEGIN → operar → ROLLBACK`.

---

## 2. Objetivo

Controlar o ciclo de vida do caixa de **recebimento**: registrar o dinheiro presente na abertura
(fundo de troco), rastrear as movimentações do turno (recebimentos, sangrias, suprimentos) e, no
fechamento, comparar o saldo calculado pelo sistema com o dinheiro físico conferido pelo operador,
registrando a diferença (quebra).

**A sessão de caixa é a unidade de auditoria do recebimento:** nenhum **recebimento** pode ser
gravado fora de um caixa aberto. (Diferente do PDV clássico, a **venda/faturamento não é** gated —
ela acontece antes e é independente.)

---

## 3. Glossário

| Termo | Definição no SysMelo |
|---|---|
| **Caixa (conta)** | Uma linha de `dbconta` com nome `CX<FILIAL>_<POSTO>` (ex. `CXMAO_B01`). É o "terminal". |
| **Sessão** | Período entre uma abertura e o fechamento correspondente, ligado a um operador e a uma `cod_conta`. |
| **Operador** | Usuário logado com `cod_conta` em `tb_user_perfil` (vínculo já implantado). |
| **Fundo de troco** | Dinheiro já presente na gaveta na abertura. |
| **Recebimento** | Baixa de título(s) via `receber.ts` — substitui a "venda" do PDV. |
| **Suprimento** | Entrada de dinheiro que não é recebimento (reforço de troco). |
| **Sangria** | Retirada de dinheiro do caixa (cofre, banco, despesa). |
| **Saldo esperado** | Dinheiro que o sistema calcula que deveria estar na gaveta. |
| **Saldo informado** | Valor contado fisicamente pelo operador no fechamento. |
| **Quebra** | `saldo_informado − saldo_esperado`. Positivo = sobra; negativo = falta. |
| **Conferência cega** | Operador informa o contado **sem** ver o esperado. |

---

## 4. Decisões de regra assumidas (defaults — pode inverter)

1. **Uma sessão aberta por `cod_conta`.** No Delphi vários usuários compartilham a mesma conta
   (ex. 8 → `0179`) simultaneamente, sem sessão. Aqui, **um operador segura o caixa por vez** —
   mais controle. *(Inverter = permitir várias sessões abertas por conta → derruba a auditoria; não recomendado.)*
2. **Fiscal fora de escopo.** A NF-e já é emitida no faturamento; o fechamento aqui é
   **financeiro/conferência**, não fiscal. Sem Redução Z.
3. **Estorno de recebimento entra na sessão atual** (nunca reabre sessão fechada).
4. **Cartão/PIX/Cheque não afetam a gaveta** — vão para conferência por forma
   (cartão já cai na conta `0102` via `COBRANCA_CARTAO`, como hoje).

---

## 5. Modelo de dados (3 tabelas novas, por schema de filial)

### 5.1 `caixa_sessao`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | bigserial PK | |
| `filial` | varchar | obrigatório (nome_filial, igual tb_user_perfil) |
| `cod_conta` | varchar(4) FK→dbconta | obrigatório — o caixa/terminal |
| `operador_abertura` | varchar (login) | obrigatório |
| `operador_fechamento` | varchar (login) | nulo enquanto aberto |
| `status` | varchar/enum | `ABERTO`, `EM_FECHAMENTO`, `FECHADO` |
| `aberto_em` | timestamptz | obrigatório |
| `fechado_em` | timestamptz | nulo enquanto aberto |
| `fundo_troco` | numeric(15,2) | `>= 0` |
| `saldo_esperado_dinheiro` | numeric(15,2) | snapshot no início do fechamento |
| `saldo_informado_dinheiro` | numeric(15,2) | preenchido no fechamento |
| `quebra` | numeric(15,2) | preenchido no fechamento |
| `fechamento_forcado` | boolean | default false |
| `observacao_abertura` | text | opcional |
| `observacao_fechamento` | text | opcional |
| `created_at` / `updated_at` | timestamptz | |

**Índice único parcial — a proteção real contra corrida:**

```sql
CREATE UNIQUE INDEX uq_caixa_aberto_por_conta
  ON <schema>.caixa_sessao (cod_conta)
  WHERE status IN ('ABERTO', 'EM_FECHAMENTO');
```

### 5.2 `caixa_movimento` — livro-razão imutável

Registros **nunca** são editados/deletados; correção entra como novo movimento.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | bigserial PK | |
| `sessao_id` | bigint FK | obrigatório |
| `tipo` | enum | `ABERTURA`, `RECEBIMENTO`, `SUPRIMENTO`, `SANGRIA`, `ESTORNO` |
| `forma_pagamento` | enum | `DINHEIRO`, `DEBITO`, `CREDITO`, `PIX`, `CHEQUE`, `OUTRO` |
| `valor` | numeric(15,2) | sempre **positivo**; o sinal vem do `tipo`/`sentido` |
| `sentido` | enum | `ENTRADA`, `SAIDA` — derivado do tipo, persistido p/ agregação |
| `referencia` | varchar | `cod_receb`/título de origem (RECEBIMENTO/ESTORNO) |
| `motivo` | text | obrigatório em `SANGRIA` e `SUPRIMENTO` |
| `operador` | varchar (login) | obrigatório |
| `idempotency_key` | varchar | único por sessão quando presente |
| `criado_em` | timestamptz | obrigatório |

> **Mapa forma_pagamento ↔ formas legadas:** derivar de `forma_pgto`/`forma_fat` do recebimento
> (ex. `01`=DINHEIRO, `42`=PIX, cartão déb/créd, cheque). Manter uma função de mapeamento única.

### 5.3 `caixa_fechamento_forma`

Uma linha por forma no fechamento — confere cartão/PIX/cheque contra maquininha/extrato.

| Campo | Tipo |
|---|---|
| `id` | bigserial PK |
| `sessao_id` | bigint FK |
| `forma_pagamento` | enum |
| `valor_esperado` | numeric(15,2) |
| `valor_informado` | numeric(15,2) |
| `diferenca` | numeric(15,2) |

---

## 6. Máquina de estados

```
(inexistente) --abrir--> ABERTO --iniciarFechamento--> EM_FECHAMENTO --confirmar--> FECHADO
                            ^                                |
                            +-----------cancelar-------------+
```

- `FECHADO` é **terminal**.
- Movimentos só são aceitos em `ABERTO`.
- `EM_FECHAMENTO` congela o saldo esperado (snapshot) — recebimento concorrente é bloqueado.

---

## 7. Cálculo do saldo esperado (função pura, testável)

```
saldo_esperado_dinheiro =
    fundo_troco
  + SUM(movimentos DINHEIRO com sentido = ENTRADA)   -- ABERTURA, RECEBIMENTO em dinheiro, SUPRIMENTO
  - SUM(movimentos DINHEIRO com sentido = SAIDA)      -- SANGRIA, ESTORNO em dinheiro
```

Apenas `forma_pagamento = DINHEIRO` entra. Cartão/PIX/Cheque conferidos em `caixa_fechamento_forma`.
O saldo **nunca** é campo mutável durante o turno — é derivado dos movimentos; único snapshot é no `EM_FECHAMENTO`.

---

## 8. Casos de uso

### UC-01 — Abrir caixa
**Entrada:** `filial`, `cod_conta`, `operador`, `fundo_troco`, `observacao?`
**Pré:** (1) permissão `ABRIR_CAIXA`; (2) `cod_conta` é do operador (`tb_user_perfil.cod_conta`) e **não** está em `CONTAS_BLOQUEADAS` (`receber.ts`); (3) não há sessão `ABERTO`/`EM_FECHAMENTO` para a conta; (4) `fundo_troco >= 0`.
**Fluxo:** transação → cria `caixa_sessao` `ABERTO` → se `fundo_troco > 0`, cria movimento `ABERTURA`/`DINHEIRO`/`ENTRADA` → commit.
**Saída:** sessão com `id`, `aberto_em`.

### UC-02 — Registrar sangria
**Entrada:** `sessao_id`, `operador`, `valor`, `motivo`
**Pré:** sessão `ABERTO`; `valor > 0`; `motivo` não vazio; `valor <= saldo_esperado_dinheiro` (não retira mais do que há); se `valor > limite_sangria_sem_aprovacao` → credencial de supervisor.
**Fluxo:** movimento `SANGRIA`/`DINHEIRO`/`SAIDA`.

### UC-03 — Registrar suprimento
Igual UC-02 com `SUPRIMENTO`/`ENTRADA`, **sem** a checagem de saldo suficiente.

### UC-04 — Vincular recebimento ao caixa (o gate — substitui "venda")
Todo recebimento concluído no `receber.ts` gera, **na mesma transação da baixa**, um ou mais
`caixa_movimento` tipo `RECEBIMENTO` (um por forma, em pagamento misto), com `referencia` = cod_receb/título.
Se **não houver** sessão `ABERTO` para a `cod_conta` do operador → recebimento **rejeitado** com `CAIXA_FECHADO`
(não cria sessão implícita).
Estorno/cancelamento de recebimento → movimento `ESTORNO` de sentido oposto, **na sessão atual**.
**Faturamento não é afetado** — só o recebimento exige caixa aberto.

### UC-05 — Iniciar fechamento
**Entrada:** `sessao_id`, `operador`
**Fluxo:** valida `ABERTO` + permissão `FECHAR_CAIXA` → calcula esperado (dinheiro e por forma) →
grava snapshot `saldo_esperado_dinheiro` e cria linhas `caixa_fechamento_forma` com `valor_esperado` →
status `EM_FECHAMENTO`.
**Saída:** se `conferencia_cega = true`, retorna só as formas **sem** os esperados; senão, com.

### UC-06 — Confirmar fechamento
**Entrada:** `sessao_id`, `operador`, `saldo_informado_dinheiro`, `valores_por_forma[]`, `observacao?`
**Pré:** `EM_FECHAMENTO`; `saldo_informado >= 0`; se `|quebra| > limite_quebra_tolerada` → `observacao` + supervisor.
**Fluxo:** transação → `quebra = informado − esperado` → preenche `valor_informado`/`diferenca` por forma →
`status = FECHADO`, `fechado_em`, `operador_fechamento` → commit.
**Saída:** relatório de fechamento (seção 10).

### UC-07 — Cancelar fechamento
`EM_FECHAMENTO → ABERTO`. Requer supervisor. Descarta snapshots.

### UC-08 — Fechamento forçado (administrativo)
Operador esqueceu de fechar e virou o dia. Apenas perfil admin; `justificativa` obrigatória;
`fechado_em` retroativo permitido desde que **posterior ao último movimento**; log de auditoria;
`fechamento_forcado = true`.

---

## 9. API (`src/pages/api/caixa/`)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/caixa/sessoes` | Abrir (UC-01) |
| `GET` | `/api/caixa/sessoes/atual?filial=&cod_conta=` | Sessão aberta da conta |
| `GET` | `/api/caixa/sessoes/[id]` | Detalhe + totais |
| `GET` | `/api/caixa/sessoes/[id]/movimentos` | Extrato paginado |
| `POST` | `/api/caixa/sessoes/[id]/sangrias` | UC-02 |
| `POST` | `/api/caixa/sessoes/[id]/suprimentos` | UC-03 |
| `POST` | `/api/caixa/sessoes/[id]/fechamento` | UC-05 inicia |
| `PUT` | `/api/caixa/sessoes/[id]/fechamento` | UC-06 confirma |
| `DELETE` | `/api/caixa/sessoes/[id]/fechamento` | UC-07 cancela |
| `GET` | `/api/caixa/sessoes/[id]/relatorio` | Relatório |

`POST`/`PUT` que criam movimento aceitam header `Idempotency-Key` (caixa opera com rede instável;
operador reenvia). Repetição com a mesma chave retorna o resultado original sem duplicar.

### Erros

| Código | HTTP | Situação |
|---|---|---|
| `CAIXA_JA_ABERTO` | 409 | Já há sessão aberta na conta |
| `CAIXA_FECHADO` | 409 | Recebimento/operação exige sessão aberta |
| `CAIXA_EM_FECHAMENTO` | 409 | Movimento tentado durante contagem |
| `CONTA_BLOQUEADA` | 422 | `cod_conta` na lista bloqueada (receber.ts) |
| `SALDO_INSUFICIENTE` | 422 | Sangria maior que o dinheiro em caixa |
| `VALOR_INVALIDO` | 422 | Valor negativo ou zero |
| `MOTIVO_OBRIGATORIO` | 422 | Sangria/suprimento sem motivo |
| `QUEBRA_ACIMA_DO_LIMITE` | 422 | Falta justificativa/aprovação |
| `PERMISSAO_NEGADA` | 403 | Sem a função exigida |

**Permissões:** criar as funções **"Abrir Caixa"** e **"Fechar Caixa"** no sistema de
"Funções do Usuário" já existente (`tb_login_access…`), concedidas por perfil/usuário — mesmo
mecanismo de DESBLOQUEAR VENDA etc.

---

## 10. Relatório de fechamento

1. Cabeçalho: filial, conta (`cod_conta`/nome), operador de abertura e de fechamento, abertura, fechamento, duração.
2. Fundo de troco.
3. Totais por forma: esperado, informado, diferença.
4. Total de recebimentos, quantidade, ticket médio.
5. Lista de sangrias e suprimentos (motivo, valor, hora, operador).
6. Saldo esperado em dinheiro, informado e **quebra em destaque**.
7. Flag de fechamento forçado, se aplicável.

---

## 11. Casos de borda

1. **Recebimento concorrente durante o fechamento** → bloqueado por `EM_FECHAMENTO`; UI avisa o operador.
2. **Duas abas/dispositivos abrindo a mesma conta** → resolvido pelo índice único parcial; 2º recebe `CAIXA_JA_ABERTO`.
3. **Estorno de recebimento de sessão já fechada** → entra na **sessão atual**, `referencia` aponta o recebimento original. Nunca reabrir sessão fechada.
4. **Troca de operador sem fechar** → decisão de produto: **fechar e abrir nova sessão** (default). Um `cod_conta` só tem uma sessão aberta.
5. **Sangria que zera o caixa** → permitida (saldo pode chegar a zero, nunca negativo).
6. **Fundo de troco zero** → válido; não gera movimento de abertura.
7. **Queda de energia com sessão aberta** → ao voltar, consultar `/api/caixa/sessoes/atual` e **retomar** a sessão existente.
8. **Arredondamento** → não deve existir; `numeric(15,2)` em todo o fluxo, nunca `float`.
9. **Conta não é do operador** → abrir só a `cod_conta` que está no `tb_user_perfil` do operador (ou lista permitida). Senão `PERMISSAO_NEGADA`.

---

## 12. Critérios de aceite (escrever como testes — BEGIN/ROLLBACK)

- [ ] Abrir com fundo `R$ 200,00` cria sessão `ABERTO` e movimento `ABERTURA` de `200.00`.
- [ ] Segunda abertura na mesma `cod_conta` retorna `409 CAIXA_JA_ABERTO`.
- [ ] Abrir conta em `CONTAS_BLOQUEADAS` retorna `CONTA_BLOQUEADA`.
- [ ] Recebimento sem caixa aberto é rejeitado com `CAIXA_FECHADO`.
- [ ] **Faturamento funciona normalmente sem caixa aberto** (não é gated).
- [ ] Após abertura `200,00`, recebimento dinheiro `50,00` e sangria `100,00`, saldo esperado = `150,00`.
- [ ] Recebimento no cartão `50,00` **não** altera o saldo esperado em dinheiro (vai p/ conferência de forma).
- [ ] Sangria maior que o saldo em dinheiro → `SALDO_INSUFICIENTE`.
- [ ] Sangria sem motivo → `MOTIVO_OBRIGATORIO`.
- [ ] Iniciar fechamento congela o esperado; novo recebimento → `CAIXA_EM_FECHAMENTO`.
- [ ] Fechar informando `140,00` contra esperado `150,00` grava `quebra = -10,00` e `FECHADO`.
- [ ] Fechar com valor exato grava `quebra = 0,00`.
- [ ] Quebra acima do limite sem justificativa → `QUEBRA_ACIMA_DO_LIMITE`.
- [ ] Sessão `FECHADO` rejeita qualquer movimento novo.
- [ ] Duas sangrias com a mesma `Idempotency-Key` criam **um** movimento.
- [ ] Cancelar fechamento devolve a `ABERTO` e permite novos recebimentos.
- [ ] Fechamento forçado com data anterior ao último movimento é rejeitado.

---

## 13. Fora de escopo

- Integração fiscal (a NF-e é emitida no faturamento; sem Redução Z aqui).
- Conciliação bancária de cartões (D+1/D+30) — o cartão já cai em `0102` via fluxo atual.
- Fechamento consolidado de múltiplas contas (fechamento de loja).
- Contagem de cédulas por denominação — detalhamento opcional futuro do `saldo_informado_dinheiro`.

---

## 14. Ordem de implementação sugerida (quando autorizado)

1. **Migration** das 3 tabelas + índice único parcial, **em cada schema de filial**. (Só adiciona; nada é alterado.)
2. **Serviço de cálculo de saldo** (`src/lib/caixa/saldoSessao.ts`) — função pura, testável isolada.
3. **UC-01 abertura** + **UC-04 gancho no `receber.ts`** (grava `RECEBIMENTO` na transação existente; rejeita se sem sessão).
4. **UC-02 / UC-03** sangria e suprimento.
5. **UC-05 / UC-06** fechamento em duas fases + `caixa_fechamento_forma`.
6. **Relatório** de fechamento.
7. **UC-07 / UC-08** cancelamento e fechamento forçado + log de auditoria.
8. **Funções de permissão** "Abrir/Fechar Caixa" + **Idempotency-Key**.
9. **Tela** no menu (Caixa → Abertura/Fechamento), molde de tela CRUD existente.

---

## 15. O que muda vs. o spec original de PDV (resumo)

| Spec PDV | Aqui |
|---|---|
| Centavos `bigint` | `numeric(15,2)` (consistência com o schema legado) |
| PK `uuid` | `bigserial` + `cod_conta varchar(4)` |
| `terminal_id` | `cod_conta` (o caixa `CX…`) + `filial` |
| Movimento `VENDA` | Movimento `RECEBIMENTO` |
| Venda gated por caixa aberto | **Recebimento** gated; **faturamento intocado** |
| Evento fiscal `caixa.fechado` | Fora de escopo (NF-e no faturamento) |
| Permissões abstratas | Funções "Abrir/Fechar Caixa" no sistema atual |
