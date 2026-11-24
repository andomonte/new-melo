import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool, getPgPoolFilial, filialDaRequisicao } from '@/lib/pg';
import { getUserFromRequest } from '@/lib/authHelper';
import { passeDaRequisicao } from '@/lib/vendaExterna/token';
import { poolDaFilial } from '@/lib/estacaoDb';

/**
 * GET /api/offline/pacote — pacote de dados para o vendedor externo trabalhar sem internet.
 * Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
 *
 * Vem em partes (respostas grandes não passam inteiras pelo nginx de homologação):
 *   ?parte=meta                       vendedor, tipos de preço da carteira, contagens
 *   ?parte=produtos&apos=<codprod>&limite=5000&min=1&arm=1001
 *                                     produtos com disponível >= min (paginação por codprod)
 *   ?parte=clientes&apos=<codcli>&limite=2000
 *                                     todos os clientes da filial (colunas + linhas);
 *                                     "carteira" = do vendedor (dbclien.codvend)
 *   ?parte=semestoque&apos=<codprod>&limite=5000&min=1&arm=1001
 *                                     produtos SEM estoque cujo grupo de equivalência tem
 *                                     produto com estoque (só ref/descr/marca/grupo)
 *   ?parte=aux                        formas de pagamento, prazos, transportes, promoções
 *
 * Mesmas fontes da Nova Venda V2 (src/lib/vendas/buscaProduto.ts, buscarCliente.ts).
 * Só leitura.
 */

const LIMITE_MAX = 5000;

/**
 * Produtos sem estoque (disp < min) cujo grupo de equivalência tem produto com estoque.
 * Termina num CTE "base" (colunas de dbprod). Parâmetros: $1 armazém, $2 estoque mínimo.
 */
const SQL_SEM_ESTOQUE_BASE = `
  WITH d AS (
    SELECT arp_codprod AS codprod, SUM(COALESCE(arp_qtest,0) - COALESCE(arp_qtest_reservada,0)) AS disp
      FROM cad_armazem_produto
     WHERE arp_arm_id = $1 AND COALESCE(arp_bloqueado,'N') <> 'S'
     GROUP BY arp_codprod),
  gd AS (
    SELECT DISTINCT p.codgpe FROM dbprod p JOIN d ON d.codprod = p.codprod
     WHERE d.disp >= $2 AND NULLIF(btrim(p.codgpe),'') IS NOT NULL
       AND COALESCE(p.inf,'') <> 'D' AND COALESCE(p.excluido,0) <> 1),
  base AS (
    SELECT p.* FROM dbprod p
      JOIN gd ON gd.codgpe = p.codgpe
      LEFT JOIN d ON d.codprod = p.codprod
     WHERE COALESCE(d.disp,0) < $2
       AND COALESCE(p.inf,'') <> 'D' AND COALESCE(p.excluido,0) <> 1)`;

const COLUNAS_CLIENTE = [
  'codcli', 'nome', 'nomefant', 'cpfcgc', 'tipo', 'ender', 'numero', 'bairro', 'cidade', 'uf', 'cep',
  'complemento', 'contato', 'email', 'iest', 'prvenda', 'claspgto', 'status', 'atraso', 'limite',
  'debito', 'bloquear_preco', 'tipocliente', 'credito_tmp', 'qtd_vencidos', 'valor_vencido',
  'maior_atraso', 'codvend', 'carteira',
];

async function vendedorDaRequisicao(req: NextApiRequest) {
  // Venda Externa: passe do aparelho (Authorization: Bearer) — não depende do cookie
  const passe = passeDaRequisicao(req);
  if (passe) return { login: passe.u, filial: passe.f, codvend: passe.v, doPasse: true };

  const user = getUserFromRequest(req);
  const login = user?.login_user_login;
  const filial = filialDaRequisicao(req);
  if (!login || login === 'SYSTEM') return null;
  const central = getPgPool();
  const r = await central.query(
    `SELECT codvend FROM tb_user_perfil WHERE user_login_id = $1 AND nome_filial = $2 LIMIT 1`,
    [login, filial],
  );
  const codvend = String(r.rows[0]?.codvend || '').trim();
  return { login, filial, codvend, doPasse: false };
}

function inteiro(v: any, padrao: number, max?: number) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return padrao;
  return max ? Math.min(n, max) : n;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });

  const vend = await vendedorDaRequisicao(req).catch(() => null);
  if (!vend) return res.status(401).json({ erro: 'Faça login para baixar o pacote.' });
  if (!vend.codvend) {
    return res.status(422).json({ erro: 'Seu usuário não tem código de vendedor nesta filial.' });
  }

  const parte = String(req.query.parte || 'meta');
  const limite = inteiro(req.query.limite, LIMITE_MAX, LIMITE_MAX) || LIMITE_MAX;
  const apos = String(req.query.apos || '');
  const min = Math.max(1, inteiro(req.query.min, 1));
  const arm = inteiro(req.query.arm, 1001);

  // com passe: schema da filial do passe; sem passe (login do sistema): cookie da filial
  const pool = vend.doPasse ? poolDaFilial(vend.filial) : await getPgPoolFilial(req);
  const client = await pool.connect();
  try {
    // tipos de preço (dbclien.prvenda) usados pelos clientes da filial — o pacote leva
    // todos os clientes, então o produto precisa do preço de cada tabela em uso
    const tiposR = await client.query(
      `SELECT DISTINCT COALESCE(NULLIF(btrim(prvenda::text), ''), '0') AS tipo
         FROM dbclien ORDER BY 1`,
    );
    const tipos: string[] = tiposR.rows.map((r) => String(r.tipo));
    if (tipos.length === 0) tipos.push('0');

    if (parte === 'meta') {
      const [prod, cli, sem] = await Promise.all([
        client.query(
          `SELECT COUNT(*)::int AS n FROM (
             SELECT arp_codprod FROM cad_armazem_produto
              WHERE arp_arm_id = $1 AND COALESCE(arp_bloqueado,'N') <> 'S'
              GROUP BY arp_codprod
             HAVING SUM(COALESCE(arp_qtest,0) - COALESCE(arp_qtest_reservada,0)) >= $2) x`,
          [arm, min],
        ),
        client.query(`SELECT COUNT(*)::int AS n FROM dbclien`),
        client.query(`${SQL_SEM_ESTOQUE_BASE} SELECT COUNT(*)::int AS n FROM base`, [arm, min]),
      ]);
      return res.status(200).json({
        gerado_em: new Date().toISOString(),
        vendedor: vend.codvend,
        login: vend.login,
        filial: vend.filial,
        armazem: arm,
        estoque_minimo: min,
        tipos_preco: tipos,
        total_produtos: prod.rows[0].n,
        total_clientes: cli.rows[0].n,
        total_sem_estoque: sem.rows[0].n,
        limite_por_parte: LIMITE_MAX,
      });
    }

    if (parte === 'produtos') {
      // disp = qtest − reservada no armazém (igual à busca da Nova Venda); preço por tipo
      const r = await client.query(
        `WITH d AS (
           SELECT arp_codprod AS codprod,
                  SUM(COALESCE(arp_qtest,0) - COALESCE(arp_qtest_reservada,0)) AS disp
             FROM cad_armazem_produto
            WHERE arp_arm_id = $1 AND COALESCE(arp_bloqueado,'N') <> 'S'
              AND arp_codprod > $3
            GROUP BY arp_codprod
           HAVING SUM(COALESCE(arp_qtest,0) - COALESCE(arp_qtest_reservada,0)) >= $2
            ORDER BY arp_codprod
            LIMIT $4)
         SELECT p.codprod, p.ref, p.aplic_extendida AS descr, m.descr AS marca, p.codgpe,
                d.disp, p.dolar, p.curva,
                (SELECT json_object_agg(fp."TIPOPRECO"::text, fp."PRECOVENDA")
                   FROM dbformacaoprvenda fp
                  WHERE fp."CODPROD" = p.codprod AND fp."PRECOVENDA" > 0
                    AND fp."TIPOPRECO"::text = ANY($5::text[])) AS precos
           FROM d
           JOIN dbprod p ON p.codprod = d.codprod
           JOIN dbmarcas m ON m.codmarca = p.codmarca
          WHERE COALESCE(p.inf,'') <> 'D' AND COALESCE(p.excluido,0) <> 1
          ORDER BY d.codprod`,
        [arm, min, apos, limite, tipos],
      );
      // o "apos" da próxima parte é o último codprod lido em cad_armazem_produto
      // (mesmo que o produto tenha sido filtrado por excluído/sem marca)
      const ultimo = await client.query(
        `SELECT MAX(codprod) AS ult FROM (
           SELECT arp_codprod AS codprod FROM cad_armazem_produto
            WHERE arp_arm_id = $1 AND COALESCE(arp_bloqueado,'N') <> 'S' AND arp_codprod > $3
            GROUP BY arp_codprod
           HAVING SUM(COALESCE(arp_qtest,0) - COALESCE(arp_qtest_reservada,0)) >= $2
            ORDER BY arp_codprod LIMIT $4) x`,
        [arm, min, apos, limite],
      );
      const prox = ultimo.rows[0]?.ult || null;
      // formato compacto: [codprod, ref, descr, marca, codgpe, disp, dolar, curva, precos]
      const itens = r.rows.map((p) => [
        p.codprod,
        p.ref,
        p.descr,
        p.marca,
        p.codgpe,
        Number(p.disp),
        p.dolar,
        p.curva,
        p.precos || {},
      ]);
      return res.status(200).json({
        colunas: ['codprod', 'ref', 'descr', 'marca', 'codgpe', 'disp', 'dolar', 'curva', 'precos'],
        itens,
        proximo: prox,
        fim: !prox,
      });
    }

    if (parte === 'semestoque') {
      // Índice leve dos produtos SEM estoque cujo grupo de equivalência (dbprod.codgpe) tem
      // algum produto COM estoque: sem internet o vendedor acha a referência pedida e o app
      // oferece os equivalentes que estão no pacote. Sem preço (não dá para vender o zerado).
      const r = await client.query(
        `${SQL_SEM_ESTOQUE_BASE}
         SELECT p.codprod, p.ref, COALESCE(NULLIF(btrim(p.aplic_extendida),''), p.descr) AS descr,
                m.descr AS marca, p.codgpe
           FROM base p JOIN dbmarcas m ON m.codmarca = p.codmarca
          WHERE p.codprod > $3
          ORDER BY p.codprod
          LIMIT $4`,
        [arm, min, apos, limite],
      );
      const itens = r.rows.map((p) => [p.codprod, p.ref, p.descr, p.marca, p.codgpe]);
      const prox = r.rows.length === limite ? r.rows[r.rows.length - 1].codprod : null;
      return res.status(200).json({ colunas: ['codprod', 'ref', 'descr', 'marca', 'codgpe'], itens, proximo: prox, fim: !prox });
    }

    if (parte === 'clientes') {
      // TODOS os clientes da filial (a busca online também acha qualquer cliente);
      // "carteira" marca os do vendedor, que aparecem primeiro na busca do aparelho.
      const r = await client.query(
        `WITH c AS (
           SELECT * FROM dbclien WHERE codcli > $2 ORDER BY codcli LIMIT $3)
         SELECT c.codcli, c.nome, c.nomefant, c.cpfcgc, c.tipo, c.ender, c.numero, c.bairro,
                c.cidade, c.uf, c.cep, c.complemento, c.contato, c.email, c.iest,
                COALESCE(NULLIF(btrim(c.prvenda::text), ''), '0') AS prvenda,
                c.claspgto, c.status, c.atraso, c.limite, c.debito, c.bloquear_preco, c.tipocliente,
                COALESCE(ct.credito_tmp, 0) AS credito_tmp,
                COALESCE(t.qtd_vencidos, 0) AS qtd_vencidos,
                COALESCE(t.valor_vencido, 0) AS valor_vencido,
                COALESCE(t.maior_atraso, 0) AS maior_atraso,
                c.codvend,
                (btrim(COALESCE(c.codvend,'')) = btrim($1)) AS carteira
           FROM c
           -- dbreceb tem ~2 mi de linhas e não tem índice por codcli: agrupa UMA vez para a
           -- página inteira (LATERAL por cliente varria a tabela 2.000 vezes)
           LEFT JOIN (
             SELECT codcli, SUM(GREATEST(COALESCE(limite,0) - COALESCE(limite_usado,0), 0)) AS credito_tmp
               FROM dbclien_creditotmp
              WHERE codcli IN (SELECT codcli FROM c)
                AND COALESCE(status,'') <> 'F' AND datavencimento >= NOW()
              GROUP BY codcli
           ) ct ON ct.codcli = c.codcli
           LEFT JOIN (
             SELECT codcli, COUNT(*)::int AS qtd_vencidos, SUM(COALESCE(valor_pgto,0)) AS valor_vencido,
                    MAX(EXTRACT(DAY FROM NOW() - dt_venc))::int AS maior_atraso
               FROM dbreceb
              WHERE codcli IN (SELECT codcli FROM c) AND dt_venc < NOW()
                AND COALESCE(rec,'N') <> 'S' AND COALESCE(cancel,'N') <> 'S'
              GROUP BY codcli
           ) t ON t.codcli = c.codcli
          ORDER BY c.codcli`,
        [vend.codvend, apos, limite],
      );
      // formato compacto (colunas + linhas): ~metade do tamanho de uma lista de objetos
      const numericas = new Set(['limite', 'debito', 'credito_tmp', 'valor_vencido']);
      const itens = r.rows.map((x) =>
        COLUNAS_CLIENTE.map((k) => {
          const v = x[k];
          if (numericas.has(k)) return Number(v || 0);
          if (typeof v === 'string') return v.trim() || null;
          return v ?? null;
        }),
      );
      const prox = r.rows.length === limite ? r.rows[r.rows.length - 1].codcli : null;
      return res.status(200).json({ colunas: COLUNAS_CLIENTE, itens, proximo: prox, fim: !prox });
    }

    if (parte === 'aux') {
      const [formas, prazos, transp, promo] = await Promise.all([
        client.query(`SELECT id, descricao FROM dbtipo_documento WHERE descricao <> '' ORDER BY descricao`),
        client.query(`SELECT * FROM tb_tabela_prazos WHERE ativo ORDER BY categoria, valor_min`),
        client.query(`SELECT codtptransp, descr FROM dbtptransp ORDER BY descr`),
        client.query(
          `SELECT dpi.id_promocao_item, dpi.codprod, dpi.codgpp, dpi.valor_desconto_item, dpi.tipo_desconto_item,
                  dpi.qtde_minima_item, dpi.qtde_maxima_item, dpi.qtd_total_item, dpi.qtdvendido,
                  dp.id_promocao, dp.nome_promocao, dp.tipo_promocao, dp.valor_desconto, dp.tipo_desconto,
                  dp.data_inicio, dp.data_fim, COALESCE(dp.permite_balcao,false) AS permite_balcao
             FROM dbpromocao_item dpi JOIN dbpromocao dp ON dpi.id_promocao = dp.id_promocao
            WHERE dp.ativa = TRUE AND NOW() BETWEEN dp.data_inicio AND dp.data_fim`,
        ),
      ]);
      return res.status(200).json({
        formas_pagamento: formas.rows,
        tabela_prazos: prazos.rows,
        transportes: transp.rows,
        promocoes: promo.rows,
      });
    }

    return res.status(400).json({ erro: 'Parte inválida. Use meta, produtos, semestoque, clientes ou aux.' });
  } catch (e: any) {
    console.error('Erro no pacote offline:', e);
    return res.status(500).json({ erro: 'Erro ao montar o pacote offline', detalhes: e.message });
  } finally {
    client.release();
  }
}
