# Vendas Externas — celular/tablet e modo sem internet

Documento de arquitetura (iniciado em 19/11/2026). Público: quem for desenvolver/manter
o módulo. Decisões de negócio confirmadas com o responsável:

| Pergunta | Resposta |
|---|---|
| Aparelhos | Android **e** iPhone/iPad |
| Tempo sem internet | horas a dias (viagem ao interior; às vezes só no hotel à noite) |
| O que funciona sem internet | consultar **estoque**, consultar **dados do cliente**, **fazer venda** (histórico só online) |
| Catálogo | só produtos **com estoque** (com estoque mínimo configurável) |

## 1. Visão geral

Um **app web instalável (PWA)** separado das telas de escritório, na rota `/externo`,
feito para tela pequena (mobile-first). Funciona online como qualquer tela do sistema e,
sem internet, usa um **pacote local** guardado no aparelho (IndexedDB).

```
┌──────────── aparelho do vendedor ────────────┐         ┌──────── servidor ────────┐
│  /externo  (PWA instalada, tela cheia)       │         │                          │
│   ├─ service worker: guarda a tela p/ abrir  │  online │ GET  /api/offline/pacote │
│   │   sem internet                           │ ◀────── │   (em partes, gzip)      │
│   ├─ IndexedDB "melo-externo"                │         │                          │
│   │   produtos · clientes · tabelas aux.     │         │ POST /api/offline/       │
│   │   pedidos (fila) · meta (data do pacote) │ ──────▶ │   enviar-pedido          │
│   └─ fila de envio (1 pedido por requisição) │         │   (idempotente por uuid) │
└──────────────────────────────────────────────┘         └──────────────────────────┘
```

Por que não app nativo agora: reescreveria as telas e exigiria publicar em loja; o PWA
atende Android e iPhone com o mesmo código. Se o iOS der problema de armazenamento, ou
precisar de câmera/GPS/loja, embrulha-se o mesmo `/externo` com Capacitor (nada se perde).

## 2. Pacote offline (o que vai para o aparelho)

Medido em db_manaus (19/11/2026):

| Item | Volume |
|---|---|
| Produtos com disponível ≥ 1 (armazém 1001) | 36.442 (≥3: 26.535 · ≥5: 21.467 · ≥10: 15.087) |
| JSON compacto, 1 tabela de preço | ~3,7 MB (≈ 0,8–1 MB com gzip) |
| Clientes (todos) | 36.234 — carteira média por vendedor: 377 |

Conteúdo:

- **produtos** — `codprod, ref, descr (aplic_extendida), marca, codgpe, disp, dolar, curva`
  + `precos{tipo: valor}` só dos `TIPOPRECO` presentes na carteira do vendedor.
  Fonte = a mesma da busca da Nova Venda (`src/lib/vendas/buscaProduto.ts`):
  `dbprod` + `dbmarcas` + `cad_armazem_produto` (disp = qtest − reservada, não bloqueado)
  + `dbformacaoprvenda` (minúscula, chave CODPROD+TIPOPRECO).
- **clientes** (carteira = `dbclien.codvend` do vendedor) — dados de consulta
  (nome, fantasia, documento, endereço, telefone, email), `prvenda`, `uf`, `claspgto`,
  `status`, `limite`, `debito`, crédito temporário, títulos vencidos (qtd e maior atraso).
- **tabelas auxiliares** — formas de pagamento (`dbtipo_documento`), tabela de prazos
  (`tb_tabela_prazos`), transportes, promoções ativas.
- **meta** — data/hora do pacote, vendedor, filial, armazém, estoque mínimo.

Atualização: **pacote completo** a cada sincronização (as tabelas de produto/preço/estoque
não têm coluna de "alterado em" para delta; o volume é pequeno). Baixado **em partes**
(ex.: 5.000 produtos por chamada) — respostas grandes não passam inteiras pelo nginx de
homologação.

## 3. Venda sem internet

1. Vendedor escolhe cliente da carteira → itens (busca local por referência/descrição/marca,
   preço da tabela do cliente, disponível do pacote) → forma de pagamento/prazo.
2. Validações locais (avisos, não garantia): disponível, limite de crédito, cliente
   bloqueado/inativo/só à vista, preço abaixo da tabela.
3. Pedido salvo no aparelho com **uuid** e número provisório (`EXT-<vendedor>-<seq>`),
   status **Aguardando envio**.
4. Ao voltar a internet, a fila envia **um pedido por requisição** para
   `/api/offline/enviar-pedido`. O servidor:
   - não duplica: o uuid é chave única (reenvio devolve o resultado do primeiro envio);
   - refaz tudo como numa venda normal: preço, estoque (reserva atômica), crédito,
     impostos (`calcular_imposto_item`), número da venda;
   - resultado volta para o aparelho: **Enviado (nº da venda)** ou **Com pendência**
     (ex.: sem estoque, crédito) para o vendedor ajustar e reenviar.
5. **Impostos**: só o servidor calcula (ST/IPI dependem das funções do banco). Sem
   internet o celular mostra o subtotal e "impostos calculados no envio".

## 4. Pontos de atenção

- **iPhone/iPad**: o vendedor deve **instalar na tela inicial** (Compartilhar → Adicionar à
  Tela de Início). O app instalado tem armazenamento próprio; ainda assim o app pede
  `navigator.storage.persist()` e mostra a data do último pacote.
- **Login**: hoje a sessão é um cookie de sessão sem validade (`token_melo`) e o perfil fica
  no `localStorage`. Sem internet o app usa o perfil guardado; o envio exige estar logado.
  Recomendado no futuro: token próprio por aparelho, com validade e revogação.
- **nginx de homologação**: corpos de POST ≥ ~15 KB dão 500 — pedido grande pode passar
  disso. Pedir ao TI para aumentar `client_max_body_size`/buffers antes de usar em campo.
- **Número da venda** no servidor é `MAX+1` sem trava: envios simultâneos podem colidir.
  Tratar junto com o envio idempotente.

## 5. Fases

| Fase | Entrega | Situação |
|---|---|---|
| 0 | Esta arquitetura + endpoint do pacote | em andamento |
| 1 | `/externo` responsivo online (cliente → itens → pagamento → enviar) + instalável (PWA) | |
| 2 | Download do pacote, IndexedDB, consulta de estoque/cliente sem internet | |
| 3 | Venda sem internet, fila e envio idempotente | |
| 4 | Teste de campo com 1–2 vendedores (Android e iPhone) | |

As telas de escritório (Central de Vendas V2 / Nova Venda V2) continuam como estão;
`/externo` reaproveita as mesmas regras e APIs.
