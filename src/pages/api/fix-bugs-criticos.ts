import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

/**
 * ENDPOINT DE CORRECAO - Bugs Criticos do Modulo de Compras
 *
 * Corrige:
 * - BUG-001: Quantidade atendida NULL em cmp_it_requisicao
 * - BUG-002: Status de requisicao NULL em cmp_requisicao
 *
 * Seguranca:
 * - Usa transacao (rollback em caso de erro)
 * - Retorna contagem de registros afetados
 * - Nao forca NOT NULL para nao quebrar insercoes existentes
 */

interface CorrecaoResult {
  bug: string;
  descricao: string;
  registrosAfetados: number;
  status: 'corrigido' | 'erro' | 'nenhum';
  erro?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let client;
  const resultados: CorrecaoResult[] = [];

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // Iniciar transacao
    await client.query('BEGIN');

    // ========================================
    // BUG-001: Quantidade atendida NULL
    // ========================================
    try {
      // Primeiro, verificar quantos registros serao afetados
      const countBug001 = await client.query(`
        SELECT COUNT(*) as total
        FROM cmp_it_requisicao
        WHERE itr_quantidade_atendida IS NULL
      `);

      const totalBug001 = parseInt(countBug001.rows[0].total);

      if (totalBug001 > 0) {
        // Corrigir os dados
        const updateBug001 = await client.query(`
          UPDATE cmp_it_requisicao
          SET itr_quantidade_atendida = 0
          WHERE itr_quantidade_atendida IS NULL
        `);

        resultados.push({
          bug: 'BUG-001',
          descricao: 'Quantidade atendida NULL em cmp_it_requisicao',
          registrosAfetados: updateBug001.rowCount || 0,
          status: 'corrigido'
        });
      } else {
        resultados.push({
          bug: 'BUG-001',
          descricao: 'Quantidade atendida NULL em cmp_it_requisicao',
          registrosAfetados: 0,
          status: 'nenhum'
        });
      }
    } catch (e: any) {
      resultados.push({
        bug: 'BUG-001',
        descricao: 'Quantidade atendida NULL em cmp_it_requisicao',
        registrosAfetados: 0,
        status: 'erro',
        erro: e.message
      });
    }

    // ========================================
    // BUG-002: Status de requisicao NULL
    // ========================================
    try {
      // Verificar quantos registros serao afetados
      const countBug002 = await client.query(`
        SELECT COUNT(*) as total
        FROM cmp_requisicao
        WHERE req_status IS NULL
      `);

      const totalBug002 = parseInt(countBug002.rows[0].total);

      if (totalBug002 > 0) {
        // Corrigir os dados - definir como 'P' (Pendente)
        const updateBug002 = await client.query(`
          UPDATE cmp_requisicao
          SET req_status = 'P'
          WHERE req_status IS NULL
        `);

        resultados.push({
          bug: 'BUG-002',
          descricao: 'Status de requisicao NULL em cmp_requisicao',
          registrosAfetados: updateBug002.rowCount || 0,
          status: 'corrigido'
        });
      } else {
        resultados.push({
          bug: 'BUG-002',
          descricao: 'Status de requisicao NULL em cmp_requisicao',
          registrosAfetados: 0,
          status: 'nenhum'
        });
      }
    } catch (e: any) {
      resultados.push({
        bug: 'BUG-002',
        descricao: 'Status de requisicao NULL em cmp_requisicao',
        registrosAfetados: 0,
        status: 'erro',
        erro: e.message
      });
    }

    // Verificar se houve algum erro critico
    const temErro = resultados.some(r => r.status === 'erro');

    if (temErro) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false,
        message: 'Houve erro em uma ou mais correcoes. Rollback executado.',
        resultados
      });
    }

    // Commit se tudo deu certo
    await client.query('COMMIT');

    // Resumo final
    const totalCorrigidos = resultados.filter(r => r.status === 'corrigido').length;
    const totalRegistros = resultados.reduce((acc, r) => acc + r.registrosAfetados, 0);

    res.status(200).json({
      success: true,
      message: `${totalCorrigidos} bug(s) corrigido(s), ${totalRegistros} registro(s) afetado(s)`,
      resultados
    });

  } catch (error: any) {
    console.error('Erro ao corrigir bugs:', error);

    if (client) {
      await client.query('ROLLBACK');
    }

    res.status(500).json({
      success: false,
      error: error.message,
      resultados
    });
  } finally {
    if (client) client.release();
  }
}
