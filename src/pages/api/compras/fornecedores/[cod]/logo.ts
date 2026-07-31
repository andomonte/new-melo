import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

// Recebe base64 (data URI ou puro). O redimensionamento/normalização para PNG
// é feito no cliente (canvas); aqui só validamos e gravamos. Sem dependência
// de binário nativo (sharp). Aceitamos payloads de alguns MB.
export const config = {
  api: {
    bodyParser: { sizeLimit: '8mb' },
  },
};

// Lê largura/altura do cabeçalho PNG (IHDR) — fonte da verdade das dimensões.
function dimensoesPng(buf: Buffer): { largura: number | null; altura: number | null } {
  // Assinatura PNG (8 bytes) + IHDR (largura em offset 16, altura em 20).
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
  }
  return { largura: null, altura: null };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const cod = String(req.query.cod || '').trim();
  if (!cod) {
    return res.status(400).json({ success: false, message: 'Fornecedor não informado' });
  }

  const pool = getPgPool('manaus');
  const client = await pool.connect();
  try {
    // ---- SERVIR a imagem (para preview / <img src>) ----
    if (req.method === 'GET') {
      const r = await client.query(
        `SELECT imagem, mime FROM db_manaus.cad_credor_logo WHERE cod_credor = $1`,
        [cod],
      );
      if (!r.rows.length) {
        return res.status(404).json({ success: false, message: 'Sem logo' });
      }
      const { imagem, mime } = r.rows[0];
      res.setHeader('Content-Type', mime || 'image/png');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).send(imagem);
    }

    // ---- SALVAR / SUBSTITUIR ----
    if (req.method === 'POST' || req.method === 'PUT') {
      const { imagemBase64 } = req.body || {};
      if (!imagemBase64 || typeof imagemBase64 !== 'string') {
        return res.status(400).json({ success: false, message: 'imagemBase64 obrigatório' });
      }
      // Remove prefixo data:...;base64, se vier
      const puro = imagemBase64.includes(',')
        ? imagemBase64.substring(imagemBase64.indexOf(',') + 1)
        : imagemBase64;
      const png = Buffer.from(puro, 'base64');
      if (!png.length) {
        return res.status(400).json({ success: false, message: 'Imagem inválida' });
      }
      // O cliente sempre envia PNG (canvas.toDataURL('image/png')).
      const { largura, altura } = dimensoesPng(png);
      if (largura === null || altura === null) {
        return res
          .status(400)
          .json({ success: false, message: 'Imagem inválida (esperado PNG)' });
      }

      await client.query(
        `INSERT INTO db_manaus.cad_credor_logo (cod_credor, imagem, mime, largura, altura, atualizado_em)
         VALUES ($1, $2, 'image/png', $3, $4, now())
         ON CONFLICT (cod_credor)
         DO UPDATE SET imagem = EXCLUDED.imagem, mime = EXCLUDED.mime,
                       largura = EXCLUDED.largura, altura = EXCLUDED.altura,
                       atualizado_em = now()`,
        [cod, png, largura, altura],
      );
      return res.status(200).json({ success: true, largura, altura });
    }

    // ---- REMOVER ----
    if (req.method === 'DELETE') {
      await client.query(`DELETE FROM db_manaus.cad_credor_logo WHERE cod_credor = $1`, [cod]);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  } catch (error) {
    console.error('Erro na API de logo do fornecedor:', error);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  } finally {
    client.release();
  }
}
