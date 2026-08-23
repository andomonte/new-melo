import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/faturamento/fechar-fatura  { codfat, usuario }
 *
 * "Fechar Fatura" — espelha o Fatura.Fechar_Venda do Delphi:
 *   UpDate dbVenda Set Status='F' Where CodVenda = vCodVenda;   (F = faturada/fechada)
 * Aplica o status 'F' à(s) venda(s) ligada(s) à fatura (via dbprodfat) e registra
 * a ação no histórico dbacao (inc_acao_usr). Não pede motivo.
 * Trava: não fecha fatura cancelada.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  const { codfat, usuario } = req.body || {};
  if (!codfat) {
    return res.status(400).json({ erro: 'Código da fatura é obrigatório.' });
  }
  const usuarioTxt = String(usuario ?? '').trim() || 'DESCONHECIDO';

  const client = await getPgPool().connect();
  try {
    // Fatura existe e não está cancelada?
    const fat = await client.query(
      `SELECT cancel FROM dbfatura WHERE codfat = $1`,
      [String(codfat)],
    );
    if (fat.rows.length === 0) {
      return res.status(404).json({ erro: 'Fatura não encontrada.' });
    }
    if (fat.rows[0].cancel === 'S') {
      return res.status(400).json({ erro: 'Fatura cancelada não pode ser fechada.' });
    }

    // Venda(s) ligada(s) à fatura (dbprodfat.codvenda).
    const vendas = await client.query(
      `SELECT DISTINCT codvenda FROM dbprodfat
        WHERE codfat = $1 AND codvenda IS NOT NULL`,
      [String(codfat)],
    );
    const codVendas = vendas.rows.map((r) => r.codvenda);
    if (codVendas.length === 0) {
      return res
        .status(404)
        .json({ erro: 'Nenhuma venda vinculada a esta fatura para fechar.' });
    }

    await client.query('BEGIN');
    try {
      // Espelha Fechar_Venda: status da venda vai para 'F' (faturada/fechada).
      const upd = await client.query(
        `UPDATE dbvenda SET status = 'F' WHERE codvenda = ANY($1)`,
        [codVendas],
      );

      // Histórico — espelha USUARIO.Inc_Acao_Usr do Delphi
      // (o Fechar_Venda loga 'ant.FECHAR VENDA' em DBFECHARVENDAS).
      await client.query(
        `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
         VALUES ($1, 'FECHAR.FATURA', 'DBFATURA', $2, now())`,
        [
          usuarioTxt.substring(0, 60),
          `COD:${codfat} | VENDAS:${codVendas.join(',')}`.substring(0, 255),
        ],
      );

      await client.query('COMMIT');

      return res.status(200).json({
        sucesso: true,
        codfat,
        vendasFechadas: upd.rowCount ?? codVendas.length,
        vendas: codVendas,
        mensagem: 'Fatura fechada com sucesso.',
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao fechar fatura:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao fechar a fatura.', detalhes: error?.message });
  } finally {
    client.release();
  }
}
