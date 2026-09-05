// Busca de produto para a inclusão de itens da garantia.
//
// No Delphi (UniGarantiaProd.pas, MeRefKeyPress) a busca é SEMPRE por
// referência, com prefixo:
//
//   ParamByName('vFILTRO').value := ' P.REF LIKE ''' + MeRef.Text + '%' + '''';
//   spNavega_Produto -> PRODUTO.NAVEGA_PRODUTO
//
// e o combo de armazém do item vem de ARMAZEM.NAV_PRODUTO_ARMAZEM, cujo corpo
// no Oracle é:
//
//   SELECT ARM.ARM_ID, ARM.ARM_DESCRICAO, P.CODPROD, P.REF, P.DESCR,
//          M.DESCR AS MARCA, ARP.ARP_QTEST, ARP.ARP_QTEST_RESERVADA,
//          (ARP.ARP_QTEST-ARP.ARP_QTEST_RESERVADA) AS QTEST_DISPONIVEL ...
//   WHERE ARP.ARP_BLOQUEADO='N' AND ARM.ARM_STATUS='A' AND
//         ARP.ARP_CODPROD=pCODPROD AND P.INF<>'D' AND P.EXCLUIDO=0
//
// Aqui os dois viram uma chamada só: o produto já volta com os armazéns e a
// quantidade disponível, que é o que a tela precisa para montar o item.
//
// Usa o mesmo pool (@/lib/pg) das demais rotas da garantia — a inclusão baixa
// estoque nessas tabelas, então a leitura tem que sair do mesmo schema.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';

const LIMITE = 30;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const search = String(req.query.search ?? '').trim();
  if (search.length < 2) return res.status(200).json({ data: [] });

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    // 1ª tentativa: referência começando pelo texto — o filtro do Delphi.
    let produtos = await buscar(client, `p.ref ILIKE $1`, [`${search}%`]);

    // Só se não achar nada é que alargamos (referência no meio, código ou
    // descrição). O Delphi não faz isso, mas aqui não custa nada e evita o
    // usuário achar que o produto não existe.
    if (produtos.length === 0) {
      produtos = await buscar(
        client,
        `(p.ref ILIKE $1 OR p.codprod ILIKE $1 OR p.descr ILIKE $1)`,
        [`%${search}%`],
      );
    }

    // 3ª: a referência costuma vir com espaço no cadastro ("IK 500") e o
    // usuário digita colado ("IK500"). Compara sem os espaços dos dois lados.
    const semEspaco = search.replace(/\s+/g, '');
    if (produtos.length === 0 && semEspaco.length >= 2) {
      produtos = await buscar(
        client,
        `REPLACE(p.ref, ' ', '') ILIKE $1`,
        [`${semEspaco}%`],
      );
    }

    if (produtos.length === 0) return res.status(200).json({ data: [] });

    const codprods = produtos.map((p) => p.codprod);
    const { rows: armazens } = await client.query(
      `SELECT arp.arp_codprod AS codprod,
              a.arm_id,
              a.arm_descricao,
              COALESCE(arp.arp_qtest, 0) AS qtest,
              COALESCE(arp.arp_qtest_reservada, 0) AS reservada,
              COALESCE(arp.arp_qtest, 0) - COALESCE(arp.arp_qtest_reservada, 0)
                AS disponivel
       FROM cad_armazem_produto arp
       INNER JOIN cad_armazem a ON a.arm_id = arp.arp_arm_id
       WHERE arp.arp_codprod = ANY($1::text[])
         AND arp.arp_bloqueado = 'N'
         AND a.arm_status = 'A'
       ORDER BY a.arm_descricao`,
      [codprods],
    );

    const porProduto = new Map<string, any[]>();
    for (const a of armazens) {
      const lista = porProduto.get(a.codprod) ?? [];
      lista.push({
        armId: Number(a.arm_id),
        armDescricao: a.arm_descricao,
        qtest: Number(a.qtest),
        reservada: Number(a.reservada),
        disponivel: Number(a.disponivel),
      });
      porProduto.set(a.codprod, lista);
    }

    return res.status(200).json({
      data: produtos.map((p) => ({
        ...p,
        armazens: porProduto.get(p.codprod) ?? [],
      })),
    });
  } catch (erro: any) {
    console.error('Erro ao buscar produtos da garantia:', erro);
    return res.status(500).json({ error: 'Erro ao buscar produtos' });
  } finally {
    client?.release();
  }
}

async function buscar(client: PoolClient, condicao: string, params: any[]) {
  const { rows } = await client.query(
    `SELECT p.codprod, p.ref, p.descr, COALESCE(m.descr, '') AS marca
     FROM dbprod p
     LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
     WHERE ${condicao}
       AND COALESCE(p.inf, '') <> 'D'
       AND COALESCE(p.excluido, 0) = 0
     ORDER BY p.ref
     LIMIT ${LIMITE}`,
    params,
  );
  return rows as { codprod: string; ref: string; descr: string; marca: string }[];
}
