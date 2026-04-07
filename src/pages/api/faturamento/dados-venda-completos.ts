// pages/api/faturamento/dados-venda-completos.ts
// API para buscar dados completos por codvenda (para preview antes de faturar)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codvenda, nrovenda } = req.query;

  if (
    (!codvenda && !nrovenda) ||
    (codvenda && typeof codvenda !== 'string') ||
    (nrovenda && typeof nrovenda !== 'string')
  ) {
    return res
      .status(400)
      .json({
        error:
          'Código da venda (codvenda) ou número da venda (nrovenda) é obrigatório.',
      });
  }

  try {
    const client = await getPgPool().connect();

    // Determinar o campo e valor de busca
    const campoConsulta = codvenda ? 'codvenda' : 'nrovenda';
    const valorConsulta = codvenda || nrovenda;

    // Query corrigida com campos reais do schema dbvenda
    const query = `
      SELECT 
        json_build_object(
          'codvenda', v.codvenda,
          'nrovenda', v.nrovenda,
          'data', v.data,
          'codvend', v.codvend,
          'codcli', v.codcli,
          'total', v.total,
          'obs', v.obs,
          'tipo', v.tipo,
          'status', v.status
        ) as dbvenda,
        
        json_build_object(
          'nomefant', c.nomefant,
          'nome', c.nome,
          'cpfcgc', c.cpfcgc,
          'ender', c.ender,
          'bairro', c.bairro,
          'cidade', c.cidade,
          'uf', c.uf,
          'cep', c.cep,
          'email', c.email
        ) as dbclien,
        
        json_agg(
          json_build_object(
            'ref', i.ref,
            'codprod', i.codprod,
            'codvenda', i.codvenda,
            'qtd', i.qtd,
            'prunit', i.prunit,
            'descr', COALESCE(p.descr, i.descr),
            'total_item', COALESCE(i.totalproduto, i.qtd * i.prunit),
            'unimed', p.unimed,
            'ncm', i.ncm,
            'cst', COALESCE(i.csticms, '0102'),
            'csticms', i.csticms,
            'cfop', i.cfop,
            'icms', i.icms,
            'baseicms', i.baseicms,
            'totalicms', i.totalicms,
            'dbprod', json_build_object(
              'codprod', p.codprod,
              'descr', p.descr,
              'unimed', p.unimed,
              'ref', p.ref,
              'prvenda', p.prvenda,
              'prcompra', p.prcompra,
              'prmedio', p.prmedio
            )
          )
        ) as dbitvenda
        
      FROM dbvenda v
      JOIN dbitvenda i ON i.codvenda = v.codvenda
      LEFT JOIN dbprod p ON p.codprod = i.codprod
      LEFT JOIN dbclien c ON c.codcli = v.codcli
      WHERE v.${campoConsulta} = $1
      GROUP BY v.codvenda, v.nrovenda, v.data, v.codvend, v.codcli, v.total, v.obs, v.tipo, v.status,
               c.nomefant, c.nome, c.cpfcgc, c.ender, c.bairro, c.cidade, c.uf, c.cep, c.email;
    `;

    console.log(
      `🔍 Buscando dados completos por ${campoConsulta}:`,
      valorConsulta,
    );
    const result = await client.query(query, [valorConsulta]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Venda não encontrada',
        [campoConsulta]: valorConsulta,
      });
    }

    const row = result.rows[0];

    const dadosCompletos = {
      dbfatura: {
        // Simular dados de fatura para o preview
        codfat: 'PREVIEW',
        data: row.dbvenda.data,
        codvend: row.dbvenda.codvend,
        codcli: row.dbvenda.codcli,
        totalnf: row.dbvenda.total,
        totalfat: row.dbvenda.total,
      },
      dbclien: row.dbclien,
      dbvenda: row.dbvenda,
      dbitvenda: row.dbitvenda || [],
    };

    console.log('✅ Dados completos da venda encontrados:', {
      venda: dadosCompletos.dbvenda?.codvenda,
      cliente: dadosCompletos.dbclien?.nomefant || dadosCompletos.dbclien?.nome,
      produtos: dadosCompletos.dbitvenda?.length || 0,
      primeiro_produto: dadosCompletos.dbitvenda?.[0]
        ? {
            codprod: dadosCompletos.dbitvenda[0].codprod,
            descr: dadosCompletos.dbitvenda[0].descr,
            descr_dbprod: dadosCompletos.dbitvenda[0].dbprod?.descr,
          }
        : 'NENHUM',
    });

    return res.status(200).json(dadosCompletos);
  } catch (error) {
    console.error('❌ Erro ao buscar dados da venda:', error);
    return res.status(500).json({
      error: 'Erro ao buscar dados da venda',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
