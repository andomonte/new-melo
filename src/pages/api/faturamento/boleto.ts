import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { renderHtmlToPdf } from '@/lib/danfe/renderHtmlToPdf';
import { gerarBoletoHtml, type BoletoData } from '@/lib/titulo/gerarBoletoHtml';
import { digitoNossoNumero } from '@/lib/boleto/nossoNumero';
import { gerarBoletoFebraban, CONFIG_BOLETO } from '@/lib/boleto/febraban';

/**
 * Gera o BOLETO bancário (PDF) da MELO — Bradesco (banco '0') / Santander ('5').
 * GET ?cod_fat=<codfat>  → boletos (forma_fat='2') da fatura
 *     ?cod_receb=<cod>   → um boleto específico
 *
 * Nosso Número = dbreceb.nro_banco (gerado no faturamento por dbbanco_numero) + DV.
 * Linha digitável / código de barras: FEBRABAN (lib/boleto/febraban), validado vs modelos.
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
              r.banco, r.nro_banco, r.codcli,
              c.nome, c.nomefant, c.cpfcgc, c.ender, c.bairro, c.cidade, c.uf, c.cep
         FROM dbreceb r
         LEFT JOIN dbclien c ON c.codcli = r.codcli
        WHERE ${filtro}
          AND COALESCE(r.forma_fat, '') = '2'
          AND COALESCE(r.cancel, 'N') = 'N'
        ORDER BY r.cod_receb`,
      [param],
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Nenhum boleto encontrado para o filtro informado.' });
    }

    // Bancos sem config de boleto no filtro → erro claro (não gera barcode inválido).
    const semConfig = rows.find((r: any) => !CONFIG_BOLETO[String(r.banco)]);
    if (semConfig) {
      return res.status(422).json({
        erro: `Banco '${semConfig.banco}' ainda não suportado para boleto (só Bradesco/Santander).`,
      });
    }
    const semNumero = rows.find((r: any) => !r.nro_banco);
    if (semNumero) {
      return res.status(409).json({
        erro:
          'Título sem Nosso Número (nro_banco). Boletos antigos gerados antes do padrão dbbanco_numero — reemita a fatura.',
      });
    }

    const boletos: BoletoData[] = rows.map((r: any) => {
      const banco = String(r.banco);
      const cfg = CONFIG_BOLETO[banco];
      const nroBanco = String(r.nro_banco);
      const dv = digitoNossoNumero(banco, nroBanco);
      const valor = Number(r.valor_pgto) || 0;
      const dtVenc = new Date(r.dt_venc);
      const feb = gerarBoletoFebraban(banco, nroBanco, dv, valor, dtVenc);

      // Nosso Número (display) por banco: Bradesco "09 / 00000773464-9"; Santander "0306667 3".
      const nossoNumeroDisplay =
        banco === '0' ? `09 / ${nroBanco}-${dv}` : `${nroBanco} ${dv}`;

      const partes = [r.ender, r.bairro, r.cidade, r.uf].filter(Boolean).join(' - ');
      const endereco = [partes, r.cep ? `CEP:${r.cep}` : ''].filter(Boolean).join(' - ');

      return {
        bancoNome: cfg.bancoNome,
        bancoCodigoDisplay: cfg.bancoCodigoDisplay,
        linhaDigitavel: feb.linhaDigitavel,
        codigoBarras: feb.codigoBarras,
        nossoNumero: nossoNumeroDisplay,
        agenciaCedente: cfg.agenciaCedenteDisplay,
        carteira: cfg.carteiraDisplay,
        localPagamento: cfg.localPagamento,
        numeroDocto: String(r.nro_doc || ''),
        especieDocto: 'DM',
        aceite: 'N',
        vencimento: r.dt_venc,
        valorDocumento: valor,
        dataEmissao: r.dt_emissao,
        dataProcessamento: r.dt_emissao,
        moraDia: Math.round((valor * 8) / 3000 * 100) / 100,
        sacadoCodigo: String(r.codcli || ''),
        sacadoNome: String(r.nome || r.nomefant || ''),
        sacadoCnpj: r.cpfcgc ? String(r.cpfcgc) : undefined,
        sacadoEndereco: endereco || undefined,
      };
    });

    const html = gerarBoletoHtml(boletos);
    const pdf = await renderHtmlToPdf(html, { landscape: false });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${req.query.download ? 'attachment' : 'inline'}; filename="boleto-${codReceb || codFat}.pdf"`,
    );
    return res.status(200).send(pdf);
  } catch (error: any) {
    console.error('Erro ao gerar boleto:', error);
    return res.status(500).json({ erro: 'Erro ao gerar o boleto.', detalhes: error?.message });
  } finally {
    client.release();
  }
}
