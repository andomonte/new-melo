import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

// Reserva (soft lock) de vendas para o Novo Faturamento. Também serve de HEARTBEAT:
// chamar de novo com as mesmas vendas RENOVA a validade (expira_em) das que já são suas.
//
// Claim atômico via INSERT ... ON CONFLICT: só toma a venda se ela estiver LIVRE
// (sem reserva ou com reserva expirada) ou se já for do próprio usuário. Se outra
// pessoa detém a reserva ativa, a venda entra em `emUso` com o nome de quem está usando.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { codvendas, usuario, usuario_nome, ttlMin } = req.body || {};
  const lista: string[] = Array.isArray(codvendas)
    ? codvendas.filter(Boolean).map(String)
    : [];

  if (!usuario || lista.length === 0) {
    return res.status(400).json({ error: 'usuario e codvendas são obrigatórios.' });
  }

  const ttl = Number(ttlMin) > 0 ? Number(ttlMin) : 3; // minutos

  const client = await getPgPool().connect();
  try {
    await client.query(`SET search_path TO ${process.env.DB_SCHEMA || 'db_manaus'}, public`);

    const reservadas: string[] = [];
    const falhou: string[] = [];

    for (const cv of lista) {
      const r = await client.query(
        `INSERT INTO fat_reserva_venda (codvenda, usuario, usuario_nome, reservado_em, expira_em)
         VALUES ($1, $2, $3, now(), now() + ($4 || ' minutes')::interval)
         ON CONFLICT (codvenda) DO UPDATE
           SET usuario      = EXCLUDED.usuario,
               usuario_nome = EXCLUDED.usuario_nome,
               reservado_em = now(),
               expira_em    = EXCLUDED.expira_em
           WHERE fat_reserva_venda.expira_em < now()          -- reserva vencida: pode tomar
              OR fat_reserva_venda.usuario   = EXCLUDED.usuario -- já é minha: renova
         RETURNING codvenda`,
        [cv, usuario, usuario_nome || usuario, String(ttl)],
      );
      if (r.rowCount && r.rowCount > 0) reservadas.push(cv);
      else falhou.push(cv);
    }

    // Para as que falharam, descobre quem detém a reserva ativa (para avisar na tela).
    let emUso: Array<{ codvenda: string; usuario_nome: string }> = [];
    if (falhou.length > 0) {
      const q = await client.query(
        `SELECT codvenda, usuario_nome
           FROM fat_reserva_venda
          WHERE codvenda = ANY($1) AND expira_em > now()`,
        [falhou],
      );
      emUso = q.rows.map((x: any) => ({
        codvenda: x.codvenda,
        usuario_nome: x.usuario_nome || 'outro usuário',
      }));
    }

    return res.status(200).json({ reservadas, emUso });
  } catch (error) {
    console.error('Erro ao reservar venda:', error);
    return res.status(500).json({
      error: `Erro ao reservar venda: ${(error as Error)?.message || 'erro desconhecido'}`,
    });
  } finally {
    client.release();
  }
}
