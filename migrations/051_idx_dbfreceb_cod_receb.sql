-- 051 — Índice em dbfreceb(cod_receb)
--
-- dbfreceb (movimentos de recebimento) NÃO tinha índice em cod_receb, apesar de ser
-- a coluna de junção com dbreceb usada em TODO lugar (comprovante, cálculo de juros,
-- JUROS_RECEBIDO, saldo aberto). Sem ele, qualquer LATERAL/subquery por cod_receb faz
-- seq scan da tabela inteira (milhões de linhas) → lentidão/timeout.
--
-- Necessário para o cálculo correto do saldo aberto = valor_pgto - (valor_rec - juros_recebido),
-- onde juros_recebido = soma de dbfreceb (tipos de juros) por título.
--
-- CONCURRENTLY: não trava escrita durante o build. Rodar FORA de transação.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dbfreceb_cod_receb ON dbfreceb (cod_receb);
