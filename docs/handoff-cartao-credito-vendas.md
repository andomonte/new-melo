# Handoff — Cartão de Crédito na Venda (paridade com Delphi)

**Objetivo:** implementar, na nova tela de vendas web, o fluxo de **cartão de crédito** com paridade ao Delphi, de modo que o **faturamento** reconheça a venda como cartão e gere a cobrança corretamente.

**Fonte da verdade:** código Delphi (`Desenvolvimento/…`) + packages Oracle (`GERAL`). Todas as regras abaixo foram extraídas de lá (referências no fim).

---

## 1. Regra canônica (a mais importante)

O sistema **inteiro** identifica "venda no cartão de crédito" por uma convenção de texto no campo **`dbvenda.obsfat`**:

> Os **17 primeiros caracteres** de `obsfat` devem ser **exatamente** `CARTAO DE CREDITO`
> (MAIÚSCULO, **sem acento**, com o "DE", 17 chars).

Isso é checado em pelo menos 2 lugares no Delphi/Oracle:
- **Faturamento** — `UniFrmFaturamentoUnificado.pas:1181`
  `if Copy(obsfat, 1, 17) = 'CARTAO DE CREDITO' then vExisteVendaCARTAO := true;`
- **Regra de crédito** — package `REGRAS_VENDAS` (linha 86)
  `substr(nvl(vFormaPgto,'...'), 1, 17) <> 'CARTAO DE CREDITO'`
  (cliente sem limite pode faturar mesmo assim se for cartão — a venda no cartão **não consome** limite de crédito).

### ⚠️ Bug atual do web (corrigir primeiro)
Hoje o web **já grava a forma de pagamento como prefixo do `obsfat`** (commit `d64ef92e`), mas com a string **errada**:
- A UI mostra **"CARTÃO DE CRÉDITO"** (com acento/cedilha) e a lista interna usa **"CARTAO CREDITO"** (sem o "DE") — `src/components/corpo/vendas/novaVendaV2/index.tsx:1339`.
- **Nenhuma das duas** é igual a `CARTAO DE CREDITO`, então `Copy(obsfat,1,17)` **não casa** → o faturamento **não reconhece** a venda como cartão.

**Ação:** ao montar o `obsfat`, quando a forma for cartão de crédito, **normalizar para a string canônica exata** `CARTAO DE CREDITO` (sem acento). Guardar a descrição "bonita" para a UI, mas gravar a canônica no `obsfat`.

---

## 2. O que a VENDA precisa capturar

| # | Item | Delphi equivalente | Situação web |
|---|------|--------------------|--------------|
| 1 | Marcar venda como cartão + gravar prefixo `CARTAO DE CREDITO` no `obsfat` | `check_CredCard` | ⚠️ grava string errada |
| 2 | **Nº de parcelas do cartão** (1x…10x) — **obrigatório** | `cbx_Cartao` | ❌ não existe |
| 3 | **Acréscimo** por parcela aplicado ao total | `spACRESCIMO_CARTAOCREDITO` / `REGRAS_VENDAS` | ❌ não existe |
| 4 | Validação: parcelas ≤ `floor(total / 100)` (mín. R$100/parcela) | `Univenda.pas:2002-2004` | ❌ não existe |
| 5 | Validação da ferramenta/cliente | `spValidaCARTAO_FERRAMENTA` | ❌ não existe |

### 2.1 Parcelamento obrigatório
`Univenda.pas:1871-1877`: se for cartão e o parcelamento não for informado →
`INFORME O PARCELAMENTO DO CARTAO`. O nº de parcelas = índice do combo + 1.

### 2.2 Máximo de parcelas
`Univenda.pas:2002-2004`:
```
xNroParcela := floor(TotalVenda / 100);   // 1 parcela a cada R$100
if xNroParcela = 0 then xNroParcela := 1;
// não permite selecionar mais parcelas que xNroParcela
```

---

## 3. Tabela de ACRÉSCIMO do cartão (exata, do Oracle)

Extraída do package **`REGRAS_VENDAS`** (linhas 228-237). O fator multiplica o valor:
`valor_com_cartao = round(acrescimo * (qtd * prunit), 2)`.

| Parcela | Fator (acréscimo) | % sobre o valor |
|--------:|:-----------------:|:---------------:|
| À vista / boleto | 1.0000 | 0,00% |
| CARTÃO 1x | **1.0270** | 2,70% |
| CARTÃO 2x | **1.0517** | 5,17% |
| CARTÃO 3x | **1.0694** | 6,94% |
| CARTÃO 4x | **1.0875** | 8,75% |
| CARTÃO 5x | **1.1057** | 10,57% |
| CARTÃO 6x | **1.1246** | 12,46% |
| CARTÃO 7x | **1.1434** | 14,34% |
| CARTÃO 8x | **1.1620** | 16,20% |
| CARTÃO 9x | **1.1800** | 18,00% |
| CARTÃO 10x | **1.2000** | 20,00% |

> Observação: o package tem também uma coluna `desconto` (ex.: 0,86…1,00) usada para **produtos "ferramenta"** (grupo `dbgpprod_ferramenta`), que recebem **desconto** em vez de acréscimo. Se o item for ferramenta, usar a coluna `desconto`; senão, `acrescimo`. Ver `REGRAS_VENDAS` proc `FORMA_PAGAMENTO` (linhas 244-318) para o caso por item.

---

## 4. Consequência no FATURAMENTO (fechar o ciclo)

Depois que a venda grava `obsfat = 'CARTAO DE CREDITO …'`:
- O faturamento deve **detectar** (mesmos 17 chars) e **gerar a cobrança como cartão**:
  as **parcelas do cartão viram os títulos** (`dbreceb`), com forma/tipo de cartão e **sem boleto**.
- A venda no cartão **não deve travar por limite de crédito** (a `REGRAS_VENDAS` já isenta — replicar no web).

Campos de apoio no modelo (já existentes no PG):
- `dbreceb` (títulos): `forma_fat`, `tipo`, `banco`, `nro_banco`, `cod_conta`, `dt_venc`, `valor_pgto`.
- `dbfpgto` (baixa/financeiro): `tp_pgto`, `dt_cartao`, `tx_cartao`, `codbc` (taxa/data do cartão na baixa).

---

## 5. Critérios de aceite

1. Selecionar "Cartão de Crédito" na venda **exige** o nº de parcelas (bloqueia sem informar).
2. Nº de parcelas não pode passar de `floor(total / 100)`.
3. O total da venda recebe o **acréscimo** da tabela conforme a parcela escolhida (ferramenta = desconto).
4. Ao salvar, `dbvenda.obsfat` **começa exatamente** com `CARTAO DE CREDITO` (sem acento). Validar com:
   `SELECT substr(obsfat,1,17) FROM dbvenda WHERE codvenda = …;`  → deve retornar `CARTAO DE CREDITO`.
5. No faturamento, a venda é reconhecida como cartão e a cobrança sai em parcelas (sem boleto), sem travar por crédito.

---

## 6. Referências

**Delphi**
- `Desenvolvimento/Formularios/VENDA/Univenda.pas` — `check_CredCard`, `cbx_Cartao` (parcelamento), `spACRESCIMO_CARTAOCREDITO`, `spValidaCARTAO_FERRAMENTA`, validações (linhas ~1871, ~1982, ~2002).
- `Desenvolvimento/Formularios/FATURAMENTO/UniFrmFaturamentoUnificado.pas:1181` — detecção `Copy(obsfat,1,17)='CARTAO DE CREDITO'`.

**Oracle (owner GERAL)**
- Package **`REGRAS_VENDAS`** — tabela de acréscimo/desconto por parcela (linhas 228-237) e proc `FORMA_PAGAMENTO` (244-318); regra de crédito isentando cartão (linha 86).
- Package `PRECO` — cálculo de preço relacionado.

**Web (onde mexer)**
- `src/components/corpo/vendas/novaVendaV2/index.tsx` — forma de pagamento / `formaPagamento` (linhas 899, 978, 1339, 2171). Adicionar: campo de parcelas + acréscimo + normalização do obsfat.
- `src/pages/api/vendas/postgresql/finalizarVenda.ts` e `src/pages/api/vendas/[codvenda].ts` — montagem do `obsfat` (já prefixa a forma; **normalizar para `CARTAO DE CREDITO`**).
- Faturamento (web): ler `obsfat`, detectar cartão, gerar cobrança em parcelas.

---

## 7. Pontos abertos (decidir com o time)
- **Conta/banco do cartão:** para qual `cod_conta`/`banco` os títulos de cartão vão (adquirente)? (No Delphi entra na baixa via `dbfpgto.codbc`/`tx_cartao`.)
- **Taxa da operadora na baixa** (`tx_cartao`): fixa por parcela (tabela acima) ou parametrizável?
- **Vencimentos das parcelas do cartão:** intervalo (30/30) ou data única da operadora?
- Confirmar se a nova venda deve reaproveitar o mesmo componente de parcela do faturar V2.

> Este documento reflete o estado do código/Oracle em 12/08/2026. Regras de acréscimo podem ser parametrizadas no futuro — hoje estão **hardcoded** no package `REGRAS_VENDAS`.
