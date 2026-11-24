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
  + `precos{tipo: valor}` dos `TIPOPRECO` usados pelos clientes da filial.
  Fonte = a mesma da busca da Nova Venda (`src/lib/vendas/buscaProduto.ts`):
  `dbprod` + `dbmarcas` + `cad_armazem_produto` (disp = qtest − reservada, não bloqueado)
  + `dbformacaoprvenda` (minúscula, chave CODPROD+TIPOPRECO).
- **clientes** — **todos** os da filial (desde 23/11; a busca online também acha qualquer
  cliente). Os da carteira (`dbclien.codvend` do vendedor) vêm marcados e aparecem primeiro.
  ~36 mil clientes, partes de 2.000 (~100 KB com gzip cada). Dados de consulta
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

## 5. Implementado (23/11/2026)

**Acesso**
- Link por filial: `/externo/<codigo_filial>` (1 = MANAUS, 2 = RORAIMA, 3 = RONDONIA).
  `/externo` vai para a filial já usada no aparelho ou lista as filiais.
- Login próprio com o usuário e a senha do sistema: `POST /api/externo/login`.
  - Exige **código de vendedor na filial** (`tb_user_perfil.codvend`).
  - Não passa pelo menu nem pela escolha de filial.
- Passe de **7 dias**, assinado pelo servidor (`lib/vendaExterna/token.ts`).
  - É renovado a cada conexão (`/api/externo/renovar`).
  - Usuário bloqueado ou sem código de vendedor perde o acesso na próxima conexão.
- **PIN de 4 dígitos**, criado no primeiro acesso, desbloqueia o app ao abrir, inclusive sem internet.
  - 5 erros obrigam a entrar de novo com usuário e senha.
  - "Esqueci o PIN" faz o mesmo.

**Abrir sem internet**
- Service worker `public/sw-externo.js` (escopo `/externo`), registrado só em produção.
- Guarda a tela (HTML, JS, CSS e ícones). APIs e dados nunca entram no cache.
- Manifesto por filial (`/api/externo/manifest?c=1`): o ícone instalado abre direto no link da filial.

**Dados no aparelho**
- IndexedDB `melo-externo` (`lib/vendaExterna/idb.ts`).
- O pacote é baixado em partes (`lib/vendaExterna/sincronizar.ts`) ao abrir com internet, se não existir ou tiver mais de 6 h, ou pelo botão "atualizar".
- Fonte híbrida (`lib/vendaExterna/fonte.ts`): online quando há conexão; sem conexão, ou se a rede cair no meio, usa o pacote (`fonteLocal.ts`).
  - O crédito local segue a mesma regra do `validarCredito`.

**Pedidos**
- Todo pedido é guardado no aparelho com uuid e número provisório `EXT-<vendedor>-<seq>` (`lib/vendaExterna/fila.ts`).
- Envio, um por vez, para `POST /api/externo/enviar-pedido`. Acontece ao abrir, quando a conexão volta e a cada 2 min.
- O servidor:
  - não duplica pedidos (tabela `venda_externa_pedido`, migration 085);
  - confere de novo o crédito e o preço da tabela atual (abaixo dela, a venda vai bloqueada para análise);
  - grava pela mesma rotina da Nova Venda (`finalizarVenda`, chamada por dentro), com estoque, impostos e número.
- Na aba **Pedidos**, cada pedido aparece como:

  | Situação | O vendedor pode |
  |---|---|
  | Aguardando envio | ajustar, enviar ou excluir |
  | Enviado (nº da venda) | só consultar |
  | Com pendência (motivo) | ajustar e reenviar com o mesmo uuid, ou excluir |
  | Erro | aguardar: o app tenta de novo sozinho |

**Equivalentes (24/11/2026)**
- Equivalente = mesmo grupo `dbprod.codgpe` (mesmo critério do F9 da Nova Venda), com o
  disponível do armazém do vendedor. Servidor: `lib/vendaExterna/equivalentes.ts` e
  `POST /api/externo/equivalentes`; sem internet: produtos do pacote (`fonteLocal.equivalentes`).
- Busca: produto sem estoque mostra "N equivalentes disponíveis"; um toque inclui o equivalente.
- Carrinho: item com quantidade maior que o disponível mostra "Ver equivalentes"; "Trocar" substitui mantendo a quantidade.
- Pacote: parte `semestoque` leva só ref/descrição/marca/grupo dos produtos zerados que têm
  equivalente com estoque (~25 mil em MANAUS). Assim, sem internet, a busca acha a referência e oferece a troca.
- Envio: pendência de estoque lista os itens que faltam e se há equivalente. O aparelho atualiza o disponível do carrinho ao ajustar.

**Orçamento (24/11/2026)**
- Botão "Salvar como orçamento" no Resumo. Não exige forma de pagamento, não reserva estoque e não passa pelo crédito.
- Vai pela mesma fila, com número provisório `ORC-<vendedor>-<seq>`. Envio: `POST /api/externo/enviar-orcamento`,
  que grava pela rota do "Salvar Orçamento" da Nova Venda (`salvar-draft`, chamada por dentro).
  - Validade: `tb_parametros.prazo_validade_orcamento` da filial.
  - Não duplica: o uuid fica em `venda_externa_pedido`, com `payload._tipo = 'ORCAMENTO'`.
- PDF: `POST /api/externo/orcamento-pdf` gera o mesmo PDF da Nova Venda, só de orçamento do próprio vendedor. Na tela: "PDF do orçamento" e depois "Compartilhar" (WhatsApp/e-mail) ou "Abrir".
- Aba Pedidos: filtro Vendas/Orçamentos. Orçamento enviado tem "PDF" e "Virar venda", que carrega os itens numa venda nova; o orçamento continua.

**Vendedor e operador (24/11/2026)** — mesma regra da Nova Venda V2
- Vendedor = vendedor do cliente (`dbclien.codvend`). Se o cliente não tem vendedor, fica quem vendeu.
- Operador = quem fez a venda (código de vendedor do passe), sempre, com `tele = 'S'`.
- O `finalizarVenda` grava os dois em `dbvvend` (operador 'N' / 'S') e em cada item (`codvend` / `codoperador`).
- O servidor aplica a regra no envio (`lib/vendaExterna/vendedorOperador.ts`). Não confia no aparelho, e vale também para pedidos feitos sem internet com dados antigos.

**Configuração no servidor**
- Defina `VENDA_EXTERNA_SECRET` com 16 caracteres ou mais no ambiente.
- Sem ela, o segredo do passe é derivado da `DATABASE_URL`. Funciona, mas trocar a URL do banco derruba todos os passes.

**Roteiro de teste (homologação)**
1. No celular, abra `https://<servidor>/externo/1` com internet, entre e crie o PIN.
   Espere aparecer "Dados do aparelho: dd/mm hh:mm".
2. Instale na tela inicial: no Android, ⋮ → Instalar app; no iPhone, Compartilhar → Adicionar à Tela de Início.
3. Faça um pedido online e confira o número da venda e a venda na Central.
4. Ligue o modo avião, feche o app e abra pelo ícone. Deve pedir o PIN e abrir com o aviso "sem internet".
   Faça um pedido: deve ficar "Aguardando envio".
5. Desligue o modo avião. O pedido deve sair sozinho em até 2 min, ou pelo botão Enviar na aba Pedidos.
6. Pendência: faça sem internet um pedido no boleto para um cliente com títulos em atraso. Ao conectar, ele volta "Com pendência". Ajuste para PIX e reenvie.

## 6. Fases

| Fase | Entrega | Situação |
|---|---|---|
| 0 | Esta arquitetura + endpoint do pacote | feito |
| 1 | `/externo` responsivo online (cliente → itens → pagamento → enviar) + instalável (PWA) | feito |
| 2 | Download do pacote, IndexedDB, consulta de estoque/cliente sem internet | feito (23/11) |
| 3 | Venda sem internet, fila e envio idempotente | feito (23/11) |
| 4 | Teste de campo com 1–2 vendedores (Android e iPhone) | a fazer |

As telas de escritório (Central de Vendas V2 / Nova Venda V2) continuam como estão;
`/externo` reaproveita as mesmas regras e APIs.
