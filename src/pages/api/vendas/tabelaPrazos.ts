import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) return res.status(400).json({ error: 'Filial não informada' });

  const { valor, categoria } = req.body ?? {};
  const totalVenda = Number(valor) || 0;
  const cat = String(categoria || 'CARRO/MOTO/LUBRIFICANTES');

  let client;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const result = await client.query(`
      SELECT id, valor_min, valor_max, dias_medio, opcoes_prazo, categoria
      FROM db_manaus.tb_tabela_prazos
      WHERE ativo = TRUE
        AND categoria = $1
        AND valor_min <= $2
        AND (valor_max IS NULL OR valor_max >= $2)
      ORDER BY valor_min ASC
      LIMIT 1
    `, [cat, totalVenda]);

    if (result.rows.length === 0) {
      return res.status(200).json({ faixa: null, opcoes: [] });
    }

    const faixa = result.rows[0];
    const opcoes = (faixa.opcoes_prazo || []).map((op: string) => {
      const dias = op.split('/').map(Number);
      const qtdParcelas = dias.length;
      return { prazo: op, dias, qtdParcelas };
    });

    // Adicionar opção de dia médio (pagamento único)
    const opcoesFinal = [
      { prazo: String(faixa.dias_medio), dias: [faixa.dias_medio], qtdParcelas: 1 },
      ...opcoes,
    ];

    return res.status(200).json({
      faixa: {
        id: faixa.id,
        valor_min: faixa.valor_min,
        valor_max: faixa.valor_max,
        dias_medio: faixa.dias_medio,
        categoria: faixa.categoria,
      },
      opcoes: opcoesFinal,
    });
  } catch (error) {
    console.error('Erro ao buscar tabela de prazos:', error);
    return res.status(500).json({ error: 'Erro ao buscar prazos' });
  } finally {
    if (client) client.release();
  }
}
