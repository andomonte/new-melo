import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { renderHtmlToPdf } from '@/lib/danfe/renderHtmlToPdf';
import {
  gerarTituloCarteiraHtml,
  type TituloCarteiraData,
} from '@/lib/titulo/gerarTituloCarteiraHtml';

/**
 * Gera o "Título em Carteira" (PDF) da MELO — fiel ao modelo impresso.
 * GET ?cod_fat=<codfat>  → todos os títulos de carteira (forma_fat='4') da fatura
 *     ?cod_receb=<cod>   → um título específico
 *     &download=1        → força download (Content-Disposition attachment)
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
      `SELECT r.cod_receb, r.nro_doc, r.dt_venc, r.dt_emissao, r.valor_pgto,
              r.codcli, r.forma_fat,
              c.nome, c.nomefant, c.ender, c.numero, c.bairro, c.cidade, c.uf, c.cep
         FROM dbreceb r
         LEFT JOIN dbclien c ON c.codcli = r.codcli
        WHERE ${filtro}
          AND COALESCE(r.forma_fat, '') = '4'
          AND COALESCE(r.cancel, 'N') = 'N'
        ORDER BY r.cod_receb`,
      [param],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ erro: 'Nenhum título em carteira encontrado para o filtro informado.' });
    }

    const titulos: TituloCarteiraData[] = rows.map((r: any) => {
      const partes = [r.ender, r.bairro, r.cidade, r.uf].filter(Boolean).join(' - ');
      const endereco = [partes, r.cep ? `CEP:${r.cep}` : '']
        .filter(Boolean)
        .join(' - ');
      return {
        nossoNumero: String(r.cod_receb),
        numeroDocto: String(r.nro_doc || ''),
        vencimento: r.dt_venc,
        valorDocumento: Number(r.valor_pgto) || 0,
        dataDocumento: r.dt_emissao,
        dataProcessamento: r.dt_emissao,
        sacadoCodigo: String(r.codcli || ''),
        sacadoNome: String(r.nome || r.nomefant || ''),
        sacadoEndereco: endereco || undefined,
      };
    });

    const html = gerarTituloCarteiraHtml(titulos);
    const pdf = await renderHtmlToPdf(html, { landscape: false });

    const nome = `titulo-carteira-${codReceb || codFat}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${req.query.download ? 'attachment' : 'inline'}; filename="${nome}"`,
    );
    return res.status(200).send(pdf);
  } catch (error: any) {
    console.error('Erro ao gerar título em carteira:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao gerar o título em carteira.', detalhes: error?.message });
  } finally {
    client.release();
  }
}
