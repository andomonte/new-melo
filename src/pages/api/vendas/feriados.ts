import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) return res.status(400).json({ error: 'Filial não informada' });

  const { ano, uf } = req.query;
  const anoNum = Number(ano) || new Date().getFullYear();
  const ufStr = uf ? String(uf).toUpperCase() : null;

  let client;
  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Verificar se já tem feriados do ano no cache
    const cached = await client.query(
      `SELECT COUNT(*) FROM db_manaus.tb_feriados WHERE ano = $1 AND tipo = 'NACIONAL'`,
      [anoNum]
    );

    if (Number(cached.rows[0].count) === 0) {
      // Buscar da BrasilAPI e cachear
      try {
        const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${anoNum}`);
        if (response.ok) {
          const feriados = await response.json();
          for (const f of feriados) {
            await client.query(
              `INSERT INTO db_manaus.tb_feriados (data, nome, tipo, ano) VALUES ($1, $2, 'NACIONAL', $3) ON CONFLICT (data, tipo, uf) DO NOTHING`,
              [f.date, f.name, anoNum]
            );
          }
        }
      } catch {
        // Se BrasilAPI falhar, continua com o que tem no cache
      }
    }

    // Buscar todos os feriados do ano (nacionais + estaduais da UF)
    let query = `SELECT data, nome, tipo, uf FROM db_manaus.tb_feriados WHERE ano = $1 AND (tipo = 'NACIONAL' OR tipo = 'MANUAL'`;
    const params: any[] = [anoNum];

    if (ufStr) {
      query += ` OR (tipo = 'ESTADUAL' AND uf = $2)`;
      params.push(ufStr);
    }
    query += `) ORDER BY data ASC`;

    const result = await client.query(query, params);

    return res.status(200).json({
      ano: anoNum,
      feriados: result.rows.map((r: any) => ({
        data: r.data,
        nome: r.nome,
        tipo: r.tipo,
        uf: r.uf,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar feriados:', error);
    return res.status(500).json({ error: 'Erro ao buscar feriados' });
  } finally {
    if (client) client.release();
  }
}
