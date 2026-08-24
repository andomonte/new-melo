import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { renderHtmlToPdf } from '@/lib/danfe/renderHtmlToPdf';
import { gerarReciboHtml, type ReciboData } from '@/lib/titulo/gerarReciboHtml';

/**
 * Gera o RECIBO (PDF) da MELO — fiel ao modelo impresso. É a forma_fat='1'.
 * GET ?cod_fat=<codfat>  → recibos da fatura
 *     ?cod_receb=<cod>   → um recibo específico
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }
  const codFat = String(req.query.cod_fat || '').trim();
  const codReceb = String(req.query.cod_receb || '').trim();
  if (!codFat && !codReceb) {
    return res.status(400).json({ erro: 'Informe cod_fat ou cod_receb.' });
  }

  const client = await getPgPool().connect();
  try {
    const filtro = codReceb ? 'r.cod_receb = $1' : 'r.cod_fat = $1';
    const param = codReceb || codFat;
    const { rows } = await client.query(
      `SELECT r.cod_receb, r.nro_doc, r.dt_emissao, r.valor_pgto, r.codcli,
              c.nome, c.nomefant, c.cpfcgc, c.ender, c.numero, c.bairro, c.cidade, c.uf, c.cep
         FROM dbreceb r
         LEFT JOIN dbclien c ON c.codcli = r.codcli
        WHERE ${filtro}
          AND COALESCE(r.forma_fat, '') = '1'
          AND COALESCE(r.cancel, 'N') = 'N'
        ORDER BY r.cod_receb`,
      [param],
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Nenhum recibo (forma_fat=1) encontrado para o filtro.' });
    }

    const recibos: ReciboData[] = rows.map((r: any) => {
      const partes = [r.ender, r.bairro, r.cidade, r.uf].filter(Boolean).join(' - ');
      const endereco = [partes, r.cep ? `CEP:${r.cep}` : ''].filter(Boolean).join(' - ');
      return {
        numero: String(r.cod_receb),
        numeroDocto: String(r.nro_doc || ''),
        valor: Number(r.valor_pgto) || 0,
        dataEmissao: r.dt_emissao,
        clienteCodigo: String(r.codcli || ''),
        clienteNome: String(r.nome || r.nomefant || ''),
        clienteEndereco: endereco || undefined,
        clienteCpfCnpj: r.cpfcgc ? String(r.cpfcgc) : undefined,
      };
    });

    const html = gerarReciboHtml(recibos);
    const pdf = await renderHtmlToPdf(html, { landscape: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${req.query.download ? 'attachment' : 'inline'}; filename="recibo-${codReceb || codFat}.pdf"`,
    );
    return res.status(200).send(pdf);
  } catch (error: any) {
    console.error('Erro ao gerar recibo:', error);
    return res.status(500).json({ erro: 'Erro ao gerar o recibo.', detalhes: error?.message });
  } finally {
    client.release();
  }
}
