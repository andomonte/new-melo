import { getPgPool } from '@/lib/pg';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { cod_pgto } = req.query;

  if (!cod_pgto || typeof cod_pgto !== 'string') {
    return res.status(400).json({ erro: 'Código do pagamento é obrigatório' });
  }

  const pool = getPgPool();

  try {
    console.log(`🔍 [API Notas] Consultando notas do título ${cod_pgto}...`);

    // 1. Verificar se o título existe
    const tituloResult = await pool.query(`
      SELECT
        cod_pgto,
        tipo,
        cod_transp,
        valor_pgto,
        obs,
        titulo_importado,
        dt_emissao,
        dt_venc,
        paga,
        cancel
      FROM dbpgto
      WHERE cod_pgto = $1
    `, [cod_pgto]);

    if (tituloResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Título não encontrado' });
    }

    const titulo = tituloResult.rows[0];

    // 2. Buscar notas de conhecimento associadas
    const notasResult = await pool.query(`
      SELECT
        c.codpgto,
        c.codtransp,
        c.nrocon,
        nc.totaltransp,
        nc.pago as cte_pago,
        nc.dtemissao as cte_emissao,
        nc.chave as chave_cte,
        nc.serie,
        nc.cfop,
        nc.icms,
        nc.baseicms,
        t.nome as nome_transportadora,
        nf.chavenfe as chave_nota_fiscal
      FROM dbconhecimento c
      JOIN dbconhecimentoent nc ON c.codtransp = nc.codtransp AND c.nrocon = nc.nrocon
      JOIN dbtransp t ON c.codtransp = t.codtransp
      LEFT JOIN dbconhecimentoentnf nf ON nc.codtransp = nf.codtransp AND nc.nrocon = nf.nrocon
      WHERE c.codpgto = $1
      ORDER BY nc.nrocon, nf.sequencia
    `, [cod_pgto]);

    // 3. Calcular totais
    const valorTotalNotas = notasResult.rows.reduce((total, nota) => {
      return total + parseFloat(nota.totaltransp || 0);
    }, 0);

    const diferenca = Math.abs(parseFloat(titulo.valor_pgto) - valorTotalNotas);

    console.log(`📋 [API Notas] Encontradas ${notasResult.rows.length} notas para o título ${cod_pgto}`);

    return res.status(200).json({
      titulo: {
        cod_pgto: titulo.cod_pgto,
        tipo: titulo.tipo,
        cod_transp: titulo.cod_transp,
        valor_pgto: titulo.valor_pgto,
        titulo_importado: titulo.titulo_importado,
        dt_emissao: titulo.dt_emissao,
        dt_venc: titulo.dt_venc,
        paga: titulo.paga,
        cancel: titulo.cancel,
        obs: titulo.obs
      },
      notas: notasResult.rows.map(nota => ({
        codtransp: nota.codtransp,
        nrocon: nota.nrocon,
        serie: nota.serie,
        cfop: nota.cfop,
        totaltransp: nota.totaltransp,
        pago: nota.cte_pago,
        dtemissao: nota.cte_emissao,
        chave: nota.chave_cte,
        icms: nota.icms,
        baseicms: nota.baseicms,
        nome_transportadora: nota.nome_transportadora,
        chave_nota_fiscal: nota.chave_nota_fiscal
      })),
      resumo: {
        quantidade_notas: notasResult.rows.length,
        valor_total_notas: valorTotalNotas.toFixed(2),
        valor_titulo: titulo.valor_pgto,
        valores_conferem: diferenca < 0.01,
        diferenca: diferenca.toFixed(2)
      }
    });

  } catch (error) {
    console.error('❌ [API Notas] Erro:', error);
    return res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}