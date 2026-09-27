// POST /api/entradas/:id/enfileirar-impressao
// Enfileira a impressão da Entrada e/ou Romaneio na fila da matricial (dbservimp),
// espelhando o Inc_ServImp do Delphi. O robô de separação (TIPODOC E/R) imprime.
// Body: { entrada?: boolean, romaneio?: boolean, motivo?: string, username?: string }
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

// Fila de impressão de compras (NROIMP) = estação onde o robô de separação está
// escutando. No Delphi vinha de dmConsulta.FilaImpCompra (escolhida na tela principal).
// Aqui é configurável por env; default '01' (fila do robô atual). Precisa bater com a
// "Fila (NROIMP)" selecionada no robô, senão os documentos não são impressos.
const FILA_COMPRAS = process.env.FILA_IMPRESSAO_COMPRAS || '01';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }
  const codent = String(req.query.id || '').trim();
  if (!codent) return res.status(400).json({ error: 'Código da entrada é obrigatório.' });

  const wantEntrada = req.body?.entrada !== false;
  const wantRomaneio = req.body?.romaneio !== false || wantEntrada; // imprimir entrada já força romaneio (Delphi)
  const motivo = (req.body?.motivo || '').toString().slice(0, 200) || null;
  const username = (req.body?.username || 'WEB').toString().slice(0, 10);

  if (!wantEntrada && !wantRomaneio) {
    return res.status(400).json({ error: 'Selecione Entrada e/ou Romaneio.' });
  }

  const client = await pool.connect();
  try {
    const entRes = await client.query(
      `SELECT e.codent, e.cod_credor, e.totalprod,
              COALESCE(cr.nome,'') AS nmcredor,
              (SELECT MAX(a.arm_id) FROM dbitent_armazem a WHERE a.codent = e.codent) AS armazem
       FROM dbent e
       LEFT JOIN dbcredor cr ON cr.cod_credor = e.cod_credor
       WHERE e.codent = $1`,
      [codent],
    );
    if (entRes.rows.length === 0) {
      return res.status(404).json({ error: 'Entrada não encontrada.' });
    }
    const e = entRes.rows[0];
    const armazem: number | null = e.armazem != null ? Number(e.armazem) : null;

    const inserir = async (tipodoc: 'E' | 'R') => {
      await client.query(
        `INSERT INTO db_manaus.dbservimp
           ("CODIGO","NRODOC","TIPODOC","CODCF","NOMECF","NOMEUSR","VALOR","DATA","HORA","NROIMP","IMPRESSO","ARMAZEM","motivo")
         VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,to_char(now(),'HH24:MI:SS'),$8,'N',$9,$10)`,
        [
          codent,
          codent,
          tipodoc,
          e.cod_credor || '',
          (e.nmcredor || '').slice(0, 40),
          username,
          Number(e.totalprod) || 0,
          FILA_COMPRAS,
          armazem,
          motivo,
        ],
      );
    };

    await client.query('BEGIN');
    const enfileirados: string[] = [];
    if (wantEntrada) {
      await inserir('E');
      enfileirados.push('Entrada');
    }
    if (wantRomaneio) {
      await inserir('R');
      enfileirados.push('Romaneio');
    }
    await client.query('COMMIT');

    return res.status(200).json({
      sucesso: true,
      enfileirados,
      fila: FILA_COMPRAS,
      mensagem: `Enviado à fila de impressão (${enfileirados.join(' + ')}). O robô imprimirá na matricial.`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao enfileirar impressão da entrada:', error);
    return res.status(500).json({ error: 'Erro ao enfileirar impressão', message: error.message });
  } finally {
    client.release();
  }
}
