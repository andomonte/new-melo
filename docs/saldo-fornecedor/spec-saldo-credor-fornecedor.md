# Spec — Saldo Credor / Adiantamento a Fornecedor

> **Status:** desenho aprovado, **não implementado**. Este documento fixa as regras combinadas antes de codar (migration → endpoints → tela).
> **Data do desenho:** 21/09/2026 · **Origem:** convergência do fluxo Compras/Contas a Pagar (Delphi → web).
> **Revisão (21/09/2026):** ponto de geração passou a ser **a associação do XML** (não a geração da entrada); ciclo "reservado/disponível" removido; regra do excedente pago × não pago (§5.2); persistência da baixa (forma + conta `0128`) no §7. Baseado na análise do código real do Compras.
> **Decisões (21/09/2026):** forma dedicada `ABATIMENTO DE SALDO` (11); excedente automático (12); entrega parcial = consumo progressivo (13); **escopo por filial da MELO / banco** com cross-filial adiado (10, §4.1). Ver §13.

---

## 1. Problema

Quando a empresa paga a um fornecedor um valor **maior** do que o valor da nota fiscal, sobra um **crédito a favor da empresa** junto àquele fornecedor. Hoje isso não é controlado:

- **No Delphi legado não existe** controle de saldo/adiantamento a fornecedor. Pior: quando se paga acima do título, o excedente é jogado no campo `VALOR_JUROS` do próprio pagamento — vira "juros" que nunca existiram (dado distorcido). Ver `UniContasP.pas` (linhas 2155–2223 e 3680–3693).
- O crédito a favor só existe do lado do **cliente** (Pré-Recebimento / vale-crédito no Contas a Receber) — não há equivalente para fornecedor.

Duas situações geram o crédito:

1. **Antecipado** — o setor de Compras solicita pagamento para adiantar um pedido, **antes** de existir NF/entrada.
2. **Sobra de pagamento** — ao gerar a entrada / receber a nota, o valor já pago é **maior** que o total da NF.

Esse crédito deve poder **abater** títulos futuros do mesmo fornecedor, inclusive **entre filiais** do mesmo grupo.

---

## 2. Glossário

| Termo | Definição |
|---|---|
| **Matriz / Grupo** | Conjunto de credores (`dbcredor`) que são a mesma empresa: mesma **raiz de CNPJ** (8 primeiros dígitos). O saldo mora aqui. |
| **Filial** | Cada `cod_credor` individual dentro do grupo (matriz + filiais compartilham a raiz, mudam o sufixo `/0001`, `/0002`…). |
| **Crédito** | Uma origem de saldo a favor (antecipado ou sobra). |
| **Abatimento** | Consumo (total ou parcial) de um crédito contra um título a pagar. |
| **Saldo do grupo** | Soma dos créditos disponíveis de todas as filiais do grupo. |

---

## 3. Decisões combinadas (travadas)

1. **O saldo é do GRUPO do FORNECEDOR, dentro do banco da filial MELO logada.** Vários `cod_credor` do mesmo fornecedor (mesma raiz CNPJ) somam o saldo. ⚠️ **"Filial" tem dois sentidos** (ver §4.1): *filial do fornecedor* (vários `cod_credor`, mesmo banco → soma) × *filial da MELO* (banco/DB diferente no login → saldo separado, ver decisão 10).
2. **Agrupamento por raiz de CNPJ** (8 dígitos). `codunico` **não serve** (está poluído: um valor agrupa 218 credores sem relação).
3. **Abatimento é manual.** A tela mostra o **saldo total do grupo + o saldo por filial**; o financeiro **seleciona** o(s) crédito(s) e o(s) título(s) e confirma. Não há baixa automática.
4. **O operador escolhe o crédito** (sem FIFO obrigatório). A alocação sugerida pode ser *crédito mais antigo → vencimento mais próximo*, mas a escolha final é do operador.
5. **Somente controle operacional de abatimento.** Sem contrapartida/lançamento contábil nesta fase (fora de escopo — ver §9).
6. **Relatório de créditos não abatidos** (item obrigatório): mostrar os valores pagos que ainda não foram abatidos — principalmente **antecipados sem NF** — com envelhecimento (dias em aberto).
7. **Abater NÃO movimenta caixa/banco.** Registra no título a forma **"Abatimento de Saldo"** e baixa (total ou parcial) o valor devido. Não é desembolso → não entra no Movimento Diário nem na conciliação bancária.
8. **Baixa parcial permitida.** Um crédito pode cobrir parte de um título; o restante é pago normal (dinheiro/boleto) depois. Um título pode ser abatido por vários créditos e um crédito pode abater vários títulos (N:N).
9. **Estorno permitido.** O operador pode desfazer um abatimento: devolve o valor ao `valor_disponivel`, reabre o título e grava **quem/quando/motivo** em `dbacao` (padrão da casa). Motivo é **obrigatório**.
10. **Escopo por filial da MELO (banco/DB).** Cada filial da MELO loga num banco próprio, então o saldo é **por filial** (cada banco tem o seu). Abater saldo de uma filial em título de **outra** filial da MELO = **cross-database → adiado** (validar depois se o sistema consegue enxergar bancos diferentes). O MVP opera dentro do banco da filial logada (hoje, `db_manaus` = Manaus).
11. **Forma do abatimento = "ABATIMENTO DE SALDO" (dedicada).** Forma nova, não-caixa, clara nos relatórios (não reusar `12 – ACERTO`).
12. **Excedente gera crédito AUTOMÁTICO** na associação (sem confirmação do comprador).
13. **Entrega parcial da OC → consumo progressivo.** Cada NF associada abate o antecipado; o crédito só nasce quando a OC encerra com `Σ antecipado > Σ NFs`.

---

## 4. Regra de agrupamento (matriz × filial)

`grupo_key` = chave do grupo dono do saldo.

**Normalização:**
- Limpa não-dígitos de `dbcredor.cpf_cgc`.
- Se **14 dígitos** (CNPJ) → `grupo_key` = **8 primeiros** (raiz).
- Senão (CPF 11 díg. / estrangeiro) → o **documento inteiro** normalizado (pessoa física não tem filial: grupo = ela mesma).

> ⚠️ `cpf_cgc` vem com máscara inconsistente no banco (`04.618.302/000` truncado vs `04618302000189` limpo). A normalização precisa tratar os dois.

**Override:** tabela `credor_grupo` permite forçar um `cod_credor` num grupo específico (CNPJs distintos que a MELO trata como um só fornecedor, ou o contrário). Sem linha de override, vale a raiz calculada.

```sql
CREATE OR REPLACE FUNCTION db_manaus.fn_grupo_credor(p_doc text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p_doc,''),'\D','','g')) = 14
      THEN left(regexp_replace(p_doc,'\D','','g'), 8)
    ELSE nullif(regexp_replace(coalesce(p_doc,''),'\D','','g'), '')
  END;
$$;
```

*(Na aplicação, o `grupo_key` de override tem precedência sobre a função.)*

### 4.1 "Filial" tem dois sentidos (não confundir)

| | O que é | Onde vive | Efeito no saldo |
|---|---|---|---|
| **Filial do fornecedor** | Vários `cod_credor` do mesmo CNPJ (raiz) | Mesmo banco/DB | **Somam** no `grupo_key` (raiz CNPJ) |
| **Filial da MELO** | Unidade da empresa (Manaus, Recife…) — banco/DB próprio no login | **Bancos/DBs diferentes** | Saldo **separado** por filial (decisão 10) |

O `credor_credito`/`credor_credito_uso` são criados e consumidos **dentro do banco da filial MELO logada**. O agrupamento por raiz CNPJ consolida os `cod_credor` do fornecedor **naquele banco**. Compartilhar saldo **entre filiais da MELO** exige o sistema acessar bancos diferentes (padrão multi-filial: *app geral* usa `pg.ts` fixo em `db_manaus`; *Separação* usa `DATABASE_URL_<FILIAL>`; *Caixa* usa mapa hardcoded) — **fora do escopo deste MVP**, a validar depois.

---

## 5. Regras de GERAÇÃO de saldo (crédito)

Cada crédito é uma linha em **`credor_credito`**, com `grupo_key` (dono) + `cod_credor` (filial que gerou), `valor_original` (imutável) e `valor_disponivel` (decrementa a cada abatimento). O crédito nasce **disponível** (status `ABERTO`) — só existe depois de a NF consumir o antecipado (não há ciclo "reservado").

> **Ponto ÚNICO de geração = a ASSOCIAÇÃO do XML** — `src/pages/api/entrada-xml/configurar-pagamento-nfe.ts`.
> Validado no código: na associação o antecipado já é abatido (as parcelas do XML cobrem só `NF − antecipado`, subtração no `ConfiguracaoPagamentoNFeModal.tsx`: `valorRestante = valorNFe − valorEntrada`). **Não** há apuração de sobra na geração da entrada (`src/lib/compras/gerarEntradaDbent.ts` não mexe em `dbpgto`). Portanto o saldo **não nasce na entrada** — nasce quando `antecipado > NF` na associação. *(Corrige a versão anterior desta spec, que colocava o gatilho na geração da entrada.)*

### 5.1 Marcador do antecipado (chave de validação)
Antecipado = `dbpgto` ligado à OC por **`ordem_pagamento_conta` com `numero_parcela = 0`** (carrega o `orc_id`). É a chave canônica que todo o sistema usa e que a geração do crédito também usa.
- Criado por `POST /api/ordens/[id]/configurar-pagamento`. O front (`PagamentoAntecipadoModal`, `useConfiguracaoPagamento`) usa **só** esse caminho.
- ⚠️ O endpoint antigo `ordens/confirmar-pagamento.ts` cria antecipado via `dbpgto_ent` **sem** a parcela 0 — **não é chamado por nenhuma tela (código morto)**. Não reativar; se um dia voltar a ser usado, tem de gravar a parcela 0, senão o crédito não é detectado.

### 5.2 Árvore de decisão no "gerar pagamento" (revisada 22/09/2026)
Sejam `A` = Σ antecipados das OCs associadas (parcela 0) e `NF` = total da nota. O antecipado **pode vir de várias OCs** (associação de N ordens numa NFe) — soma-se tudo.

| Situação | Ação |
|---|---|
| **`A ≤ NF`** | Gera parcelas de `NF − A` (antecipado abate). Sem crédito. *(fluxo atual)* |
| **`A > NF` · antecipados PAGOS** | NF **quitada** pelo antecipado (0 parcelas) + **crédito** do excedente pago = `credor_credito(origem='SOBRA_PAGAMENTO', valor = antPago − NF, status='ABERTO')`. Títulos antecipados **permanecem** (foram pagos). |
| **`A > NF` · antecipados NÃO pagos** | **CANCELA TODOS** os antecipados das OCs associadas (`cancel='S'`, nada é excluído) e gera a cobrança da **NF inteira**: <br>• XML **com** parcelamento → pelas parcelas do XML; <br>• XML **sem** parcelamento → **usuário lança parcela(s) manual(is)**. <br>Sem crédito (nada foi pago). |

**Regra de data (qualquer geração por parcela):** parcela com **vencimento < hoje** → o sistema **obriga o usuário a informar uma data** válida antes de confirmar (bloqueia o "Confirmar"). Corrige o bug do §5.5 (Dias/vencimento no passado → "Dados inválidos").

**Decisões confirmadas (22/09/2026):**
- `A > NF · não pago · XML sem parcelamento` → **usuário lança parcela manual** (Q1 letra b).
- Cancelamento → **cancela TODOS** os antecipados das OCs associadas, não só o excedente (Q2).
- Cancelamento é **`cancel='S'`** (padrão da casa, nada excluído), com rastro em `obs` e `ordem_pagamento_conta.status='CANCELADO'` (Q3).
- **Paga vs não paga** decidido por `Σ valor_pago` dos antecipados (backend, autoritativo). Qualquer pagamento (`antPago > 0`) → ramo PAGO; nenhum → ramo NÃO PAGO.
- *(Substitui a regra anterior "reduzir/baixar o título antecipado", que zerava indevidamente o antecipado de outra OC.)*

**Mudança de código:** relaxar a validação `diferença > 0,10` para aceitar `A > NF`; no ramo NÃO pago, cancelar antecipados e validar `Σ parcelas ≈ NF` (antecipado efetivo = 0); no ramo PAGO, 0 parcelas + crédito.

### 5.3 Origens (`origem`)
- `SOBRA_PAGAMENTO` — excedente pago apurado na associação (**caso principal / MVP**).
- `AJUSTE` — lançamento manual do financeiro (uso futuro).
- `DEVOLUCAO` — devolução de compra que gera crédito (uso futuro).
- *(Removida a origem `ANTECIPADO` como crédito livre: o antecipado é casado com a própria NF na associação; só o excedente vira crédito.)*

### 5.4 Entrega parcial da OC — consumo progressivo (decisão 13)
Uma OC pode receber **várias NFs** (entregas parciais). O antecipado é **consumido progressivamente** a cada associação:
- Cada NF associada abate o saldo do antecipado ainda não consumido daquela OC.
- Enquanto houver antecipado a consumir, cada NF só gera parcelas do que exceder o antecipado remanescente.
- O **excedente (crédito) só nasce quando a OC encerra** com `Σ antecipado > Σ NFs` — ou seja, sobrou adiantamento depois de todas as entregas.
- Controle: acompanhar o antecipado remanescente por OC (via `ordem_pagamento_conta`/`ordem_compra`), não isolar cada NF.

### 5.5 Comportamento atual validado em teste (21/09/2026) e pontos de integração
Reproduzido com antecipado R$ 2.000 (OC 12026070008) vs NF R$ 1.346,47 (ROBERT BOSCH):
1. **`SelecionarPagamentosAntecipados.tsx` (linhas 383-398)** — quando `total selecionado > NF`, mostra caixa **azul** *"excede… o valor antecipado será usado proporcionalmente"* e **deixa prosseguir**. A tal "proporcionalidade" **não existe** (promessa morta). → **Aqui entra a UX do excedente**: trocar a mensagem por *"sobra R$ X → vira crédito do fornecedor"*.
2. **`ConfiguracaoPagamentoNFeModal.tsx`** — gera uma **parcela negativa** (`NF − antecipado = −653,53`), com Dias em branco e vencimento vindo da duplicata do XML (`dbnfe_ent_cobr.dvencdup`, às vezes já vencida).
3. **`configurar-pagamento-nfe.ts`** — ao Confirmar, retorna **"Dados inválidos"**: o schema rejeita a parcela negativa (`z.number().positive()`). (A validação `diferença > 0,10` passa, porque `−653,53 + 2.000 = 1.346,47 = NF`.) → **Aqui entra o backend**: quando `antecipado ≥ NF`, não gerar parcela e criar `credor_credito` do excedente pago.

**Bugs colaterais expostos (itens à parte, não são a feature):**
- **Inconsistência entre as duas telas**: "Selecionar" soma antecipados **por fornecedor** (2.100 → Excesso 753,53); "Configurar" usa só o antecipado da **OC associada** (2.000 → −653,53). Unificar a base do antecipado.
- **Dias/vencimento no passado**: o gerador de parcelas deixa Dias em branco quando o vencimento da duplicata do XML já passou — robustez que afeta até o fluxo normal.

---

## 6. Regras de ABATIMENTO (consumo)

Cada abatimento é uma linha em **`credor_credito_uso`**, ligando um crédito a um título.

**Fluxo (manual, na tela de Saldos de Fornecedor):**
1. Financeiro abre o grupo → vê saldo total + por filial, os **créditos disponíveis** e os **títulos em aberto** do grupo inteiro.
2. Seleciona crédito(s) e título(s). O sistema calcula a alocação (N:N).
3. Confirma no modal (mostra qual crédito → qual título → valor). 
4. Aplicação, **em transação**:
   - Grava `credor_credito_uso(credito_id, cod_pgto_abatido, cod_credor_abatido, valor_usado, username, dt_uso)`.
   - `credor_credito.valor_disponivel -= valor_usado`; `status` vira `PARCIAL` (>0) ou `CONSUMIDO` (=0).
   - No título (`dbpgto`): registra um pagamento com **forma "Abatimento de Saldo"** (novo tipo — ver §7), somando em `valor_pago`. Se cobrir o **saldo todo** → `paga='S'` (**pago**); se cobrir parte → fica **parcialmente abatido** (saldo devedor cai).
5. **Uso cruzado entre filiais** é livre dentro do grupo: `cod_credor` (gerou) pode diferir de `cod_credor_abatido` (título), desde que mesmo `grupo_key`.

**Invariantes:**
- `valor_disponivel` nunca fica negativo (`CHECK` + validação na aplicação).
- A soma dos `valor_usado` de um crédito == `valor_original − valor_disponivel`.
- Abatimento **não gera** movimento em caixa/banco (`dbfpgto` do tipo abatimento fica fora do fluxo de caixa e da conciliação).

---

## 7. Como a baixa por abatimento é gravada (forma + conta)

O abatimento grava **igual a qualquer pagamento** — em `dbpgto` (título) + `dbfpgto` (detalhe da baixa) — porém com forma e conta **fixas** (o operador não escolhe):

| Campo (`dbfpgto`) | Valor no abatimento |
|---|---|
| `tp_pgto` (forma) | **"Abatimento de Saldo"** — forma **não-caixa** |
| `cod_conta` (conta) | **`0128` – CRÉDITO\ACERTO** (`dbconta`, conta de acerto, não-caixa) |
| `valor_pgto` | valor abatido |
| `juros` / `multa` | `0` |
| `dt_pgto` | data do abatimento |
| `dbpgto.valor_pago` | `+= valor abatido` → `paga='S'` se cobriu tudo, senão **parcial** |

E **em paralelo** grava `credor_credito_uso` (lado do saldo), amarrado por `cod_pgto`. Partida dobrada: **título** (`dbfpgto`) + **crédito** (`credor_credito_uso`).

**Base já existente (não inventar):**
- **Forma dedicada `ABATIMENTO DE SALDO`** (decisão 11) — criar em `dbforma_pagto` (não reusar `12 – ACERTO`, para ficar clara/rastreável nos relatórios). No combo do web (`001…007`) entra o item novo `008 – ABATIMENTO DE SALDO`, mapeado para o código dessa forma em `dbfpgto.tp_pgto`.
- `dbconta 0128 = CRÉDITO\ACERTO`. O **antecipado já é lançado nessa conta hoje** (confirmado em tela). Então `0128` funciona como a **conta-corrente de crédito do fornecedor**: o antecipado/sobra **credita** nela; o abatimento **debita** dela contra o título (encontro de débito).

**Não sujar o caixa:** o marcador de "não-caixa" é a **forma** (`Abatimento de Saldo`/`Acerto`). O **Movimento Diário** e o **Fluxo de Caixa** devem **excluir essa forma** → o abatimento grava `dbfpgto` mas **não** aparece como dinheiro entrando/saindo.

---

## 8. Regras de ESTORNO

- Operador desfaz um abatimento a partir do **histórico** do grupo.
- **Motivo obrigatório.**
- Efeito (em transação): remove/estorna o `credor_credito_uso`; `valor_disponivel += valor_usado` (crédito volta a `ABERTO`/`PARCIAL`); reabre o título (desfaz o pagamento de abatimento; se estava `paga='S'`, volta a aberto/parcial).
- **Auditoria:** grava em `dbacao` (quem/quando/motivo), no padrão já usado no cancelamento de cobrança.

---

## 9. Relatório — créditos pagos não abatidos (decisão 6)

Dois recortes complementares:

**(a) Créditos disponíveis não consumidos** — `vw_credor_credito_aberto`: créditos com `status IN ('ABERTO','PARCIAL')`, com `dias_em_aberto = current_date − dt_credito`. Envelhecimento (ex.: alertar > 30 dias).

**(b) Adiantamentos pagos aguardando NF** — recorte sobre `dbpgto` (parcela 0, `paga='S'`, sem NF associada): dinheiro que saiu no antecipado e cuja nota **ainda não foi associada** (não é `credor_credito` ainda — vira crédito só se a NF vier menor que o antecipado). É o "a regularizar" do lado do Compras.

---

## 10. Modelo de dados

### 10.1 `credor_grupo` (override do agrupamento — opcional)
```sql
CREATE TABLE db_manaus.credor_grupo (
  cod_credor  varchar PRIMARY KEY REFERENCES db_manaus.dbcredor(cod_credor),
  grupo_key   varchar NOT NULL,
  obs         varchar,
  username    varchar, createdat timestamptz DEFAULT now()
);
```

### 10.2 `credor_credito` (origem do saldo)
```sql
CREATE TABLE db_manaus.credor_credito (
  id               bigserial PRIMARY KEY,
  grupo_key        varchar NOT NULL,          -- dono do saldo (raiz CNPJ ou override)
  cod_credor       varchar NOT NULL REFERENCES db_manaus.dbcredor(cod_credor), -- filial que gerou
  origem           varchar NOT NULL,          -- SOBRA_PAGAMENTO (MVP) | AJUSTE | DEVOLUCAO
  cod_pgto         varchar,                   -- título antecipado (parcela 0) que originou o excedente (dbpgto)
  codent           varchar,                   -- NF/entrada onde o excedente foi apurado (dbnfe_ent/dbent)
  valor_original   numeric(15,2) NOT NULL CHECK (valor_original > 0),
  valor_disponivel numeric(15,2) NOT NULL CHECK (valor_disponivel >= 0),
  status           varchar NOT NULL DEFAULT 'ABERTO', -- ABERTO|PARCIAL|CONSUMIDO|CANCELADO
  dt_credito       timestamptz NOT NULL DEFAULT now(),
  obs              varchar, username varchar,
  createdat        timestamptz DEFAULT now(), updatedat timestamptz
);
CREATE INDEX ix_credor_credito_grupo  ON db_manaus.credor_credito(grupo_key, status);
CREATE INDEX ix_credor_credito_credor ON db_manaus.credor_credito(cod_credor);
CREATE INDEX ix_credor_credito_pgto   ON db_manaus.credor_credito(cod_pgto);
```

### 10.3 `credor_credito_uso` (abatimento)
```sql
CREATE TABLE db_manaus.credor_credito_uso (
  id                 bigserial PRIMARY KEY,
  credito_id         bigint NOT NULL REFERENCES db_manaus.credor_credito(id),
  cod_pgto_abatido   varchar NOT NULL,        -- título que recebeu o abatimento (dbpgto)
  cod_credor_abatido varchar NOT NULL,        -- filial do título (pode diferir → uso cruzado)
  valor_usado        numeric(15,2) NOT NULL CHECK (valor_usado > 0),
  dt_uso             timestamptz NOT NULL DEFAULT now(),
  motivo             varchar, username varchar,
  createdat          timestamptz DEFAULT now()
);
CREATE INDEX ix_credor_uso_credito ON db_manaus.credor_credito_uso(credito_id);
CREATE INDEX ix_credor_uso_pgto    ON db_manaus.credor_credito_uso(cod_pgto_abatido);
```

### 10.4 Views
```sql
-- Saldo do grupo + por filial (tela)
CREATE VIEW db_manaus.vw_credor_saldo AS
SELECT grupo_key, cod_credor,
       SUM(valor_disponivel) AS saldo_filial,
       SUM(SUM(valor_disponivel)) OVER (PARTITION BY grupo_key) AS saldo_grupo
FROM db_manaus.credor_credito
WHERE status IN ('ABERTO','PARCIAL')
GROUP BY grupo_key, cod_credor;

-- Créditos não abatidos (relatório §9)
CREATE VIEW db_manaus.vw_credor_credito_aberto AS
SELECT c.grupo_key, c.cod_credor, cr.nome, c.origem, c.cod_pgto, c.codent,
       c.valor_original, c.valor_disponivel, c.dt_credito,
       (current_date - c.dt_credito::date) AS dias_em_aberto
FROM db_manaus.credor_credito c
JOIN db_manaus.dbcredor cr ON cr.cod_credor = c.cod_credor
WHERE c.status IN ('ABERTO','PARCIAL')
ORDER BY c.dt_credito;
```

---

## 11. Tela (aprovada em protótipo)

Menu **Financeiro → "Saldos de Fornecedor"** (+ atalho reverso: no Contas a Pagar, selo "tem saldo" na linha do título cujo fornecedor tem crédito, abrindo a tela no grupo).

- **Nível 1 — lista de grupos:** fornecedor (matriz), raiz CNPJ, filiais com saldo, créditos em aberto, **saldo do grupo**. Busca por nome/CNPJ.
- **Nível 2 — detalhe/conciliação:** saldo do grupo + chips por filial; dois painéis (**Créditos disponíveis** × **Contas a pagar em aberto** do grupo); seleção manual; barra com somas e **Abater**; modal de confirmação com a alocação; **histórico de abatimentos** com **Estornar** (motivo obrigatório).

Protótipo interativo (dados fictícios): artefato "Saldos de Fornecedor".

---

## 12. Fora de escopo (por ora)

- **Contabilização** do saldo (conta "Adiantamento a Fornecedores" / contrapartida). Modelado só operacionalmente; o enum de `origem` e as tabelas não impedem evoluir para contábil depois.
- Baixa automática por FIFO (é sempre manual).
- Robô/importação para gerar crédito de fontes externas.

---

## 13. Decisões e pendências

### Decididas ✅ (prontas para codar)
- **Ponto de geração** = associação do XML (`configurar-pagamento-nfe.ts`), quando `antecipado > NF`. Não é na geração da entrada.
- **Excedente pago × não pago**: crédito só sobre a parte **paga**; parte não paga reduz o título antecipado (§5.2).
- **Marcador do antecipado** = parcela 0 em `ordem_pagamento_conta` (fluxo `configurar-pagamento`); `confirmar-pagamento.ts` é código morto, não reativar.
- **Forma** = `ABATIMENTO DE SALDO` dedicada (não reusar `12 – ACERTO`) — §7. **Conta** = `0128` CRÉDITO\ACERTO.
- **Excedente automático** (sem confirmação do comprador) — decisão 12.
- **Entrega parcial** = consumo progressivo na OC (§5.4) — decisão 13.
- **Escopo por filial da MELO** (banco/DB): saldo por filial; MVP opera no banco logado (`db_manaus`) — decisão 10.
- **Auditoria** `username` = usuário logado.

### Implementação (decidido, sem escolha pendente — só executar)
- Excluir a forma `ABATIMENTO DE SALDO` do **Movimento Diário** e do **Fluxo de Caixa**.
- Garantir que a baixa por abatimento não conflite com `entrada_status`/`possui_entrada` no Contas a Pagar.
- Criar a forma `ABATIMENTO DE SALDO` (`dbforma_pagto` + combo web `008`).

### Adiado (fora do MVP) ⏸️
- **Abatimento entre filiais da MELO** (cross-database): validar depois se o sistema consegue enxergar bancos diferentes (decisão 10 / §4.1).

### Bugs colaterais mapeados no teste (fora da feature, tratar à parte) 🐞
- **Inconsistência antecipado entre telas**: "Selecionar Pagamentos" soma por fornecedor × "Configurar Pagamento" usa só a OC associada (§5.5).
- **Dias/vencimento no passado**: gerador de parcelas deixa Dias em branco quando a duplicata do XML vem vencida → "Dados inválidos" (§5.5).
