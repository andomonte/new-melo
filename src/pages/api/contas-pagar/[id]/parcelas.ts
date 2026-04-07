import { getPgPool } from '@/lib/pg';
import type { NextApiRequest, NextApiResponse } from 'next';

interface Parcela {
  cod_pgto: string;
  nro_dup: string;
  dt_venc: string;
  valor_pgto: number;
  paga: string;
  dt_pgto: string | null;
  valor_pago: number;
  numero_parcela: number;
  status: 'pendente' | 'pago_parcial' | 'pago' | 'cancelado';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ erro: 'ID da conta é obrigatório' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Primeiro, buscar a conta atual para pegar o nro_dup
    const contaAtual = await client.query(
      `SELECT nro_dup, cod_credor, cod_transp, tipo 
       FROM dbpgto 
       WHERE cod_pgto = $1`,
      [id]
    );

    if (contaAtual.rows.length === 0) {
      return res.status(404).json({ erro: 'Conta não encontrada' });
    }

    const { nro_dup, cod_credor, cod_transp, tipo } = contaAtual.rows[0];

    // Se não tem nro_dup ou não tem "/" (não é parcelada), retornar array vazio
    if (!nro_dup || !nro_dup.includes('/')) {
      return res.status(200).json({
        parcelas: [],
        total_parcelas: 0,
        parcelas_pagas: 0,
        valor_total: 0,
        valor_pago_total: 0,
      });
    }

    // Extrair o prefixo do nro_dup (tudo antes da "/")
    const prefixoDup = nro_dup.split('/')[0];

    // Buscar todas as parcelas com o mesmo prefixo e mesmo credor/transportadora
    const queryParcelas = tipo === 'F'
      ? `SELECT 
           p.cod_pgto,
           p.nro_dup,
           p.dt_venc,
           p.valor_pgto,
           p.paga,
           p.dt_pgto,
           p.valor_pago,
           p.cancel
         FROM dbpgto p
         WHERE p.nro_dup LIKE $1
           AND p.cod_credor = $2
           AND p.tipo = 'F'
           AND (p.cancel != 'S' OR p.cancel IS NULL)
         ORDER BY p.nro_dup`
      : `SELECT 
           p.cod_pgto,
           p.nro_dup,
           p.dt_venc,
           p.valor_pgto,
           p.paga,
           p.dt_pgto,
           p.valor_pago,
           p.cancel
         FROM dbpgto p
         WHERE p.nro_dup LIKE $1
           AND p.cod_transp = $2
           AND p.tipo = 'T'
           AND (p.cancel != 'S' OR p.cancel IS NULL)
         ORDER BY p.nro_dup`;

    const resultParcelas = await client.query(
      queryParcelas,
      [`${prefixoDup}/%`, tipo === 'F' ? cod_credor : cod_transp]
    );

    // Para cada parcela, buscar o histórico de pagamentos para calcular o status
    const parcelas: Parcela[] = await Promise.all(
      resultParcelas.rows.map(async (parcela, index) => {
        // Buscar total pago no histórico
        const historico = await client.query(
          `SELECT COALESCE(SUM(valor_pgto), 0) as total_pago
           FROM db_manaus.dbfpgto
           WHERE cod_pgto = $1 
             AND (cancel != 'S' OR cancel IS NULL)`,
          [parcela.cod_pgto]
        );

        const totalPago = parseFloat(historico.rows[0]?.total_pago || '0');
        const valorOriginal = parseFloat(parcela.valor_pgto);
        
        // Determinar status
        let status: 'pendente' | 'pago_parcial' | 'pago' | 'cancelado' = 'pendente';
        
        if (parcela.cancel === 'S') {
          status = 'cancelado';
        } else if (totalPago >= valorOriginal - 0.01) {
          status = 'pago';
        } else if (totalPago > 0) {
          status = 'pago_parcial';
        }

        // Extrair número da parcela do nro_dup (ex: "DUP123/01" -> 1)
        const numeroParcela = parcela.nro_dup.includes('/')
          ? parseInt(parcela.nro_dup.split('/')[1]) || (index + 1)
          : (index + 1);

        return {
          cod_pgto: parcela.cod_pgto,
          nro_dup: parcela.nro_dup,
          dt_venc: parcela.dt_venc,
          valor_pgto: valorOriginal,
          paga: parcela.paga,
          dt_pgto: parcela.dt_pgto,
          valor_pago: totalPago,
          numero_parcela: numeroParcela,
          status,
        };
      })
    );

    // Calcular totais
    const totalParcelas = parcelas.length;
    const parcelasPagas = parcelas.filter(p => p.status === 'pago').length;
    const valorTotal = parcelas.reduce((sum, p) => sum + p.valor_pgto, 0);
    const valorPagoTotal = parcelas.reduce((sum, p) => sum + p.valor_pago, 0);

    return res.status(200).json({
      parcelas,
      total_parcelas: totalParcelas,
      parcelas_pagas: parcelasPagas,
      valor_total: valorTotal,
      valor_pago_total: valorPagoTotal,
      percentual_pago: valorTotal > 0 ? (valorPagoTotal / valorTotal) * 100 : 0,
    });
  } catch (error: any) {
    console.error('Erro ao buscar parcelas:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar parcelas',
      detalhes: error.message,
    });
  } finally {
    client.release();
  }
}
