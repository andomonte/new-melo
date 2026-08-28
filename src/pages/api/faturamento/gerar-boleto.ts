import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { renderHtmlToPdf } from '@/lib/danfe/renderHtmlToPdf';
import { gerarBoletoHtml, type BoletoData } from '@/lib/titulo/gerarBoletoHtml';
import {
  gerarTituloCarteiraHtml,
  type TituloCarteiraData,
} from '@/lib/titulo/gerarTituloCarteiraHtml';
import { digitoNossoNumero } from '@/lib/boleto/nossoNumero';
import { gerarBoletoFebraban, CONFIG_BOLETO } from '@/lib/boleto/febraban';

/**
 * Gera o PDF da cobrança (base64) para ANEXAR no e-mail (ação "Enviar Cobrança").
 * Usa os MESMOS renderizadores fiéis do "Visualizar Boletos":
 *   - forma_fat='2' + banco real (Bradesco/Santander) → boleto FEBRABAN (gerarBoletoHtml)
 *   - forma_fat='4' (ou fallback) → Título em Carteira (gerarTituloCarteiraHtml)
 * Filtra forma_fat IN ('2','4') e cancel<>'S' — exclui recibos/pagos e títulos legados
 * que colidem no mesmo cod_fat pela migração (ex.: recibo antigo forma_fat='1').
 *
 * POST { codfat }  ou  { codgp } (cobrança agrupada).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codfat, codgp } = req.body;
  const usaGrupo = codgp !== undefined && codgp !== null && String(codgp) !== '';
  if (!usaGrupo && !codfat) {
    return res.status(400).json({
      error: 'Código da fatura (ou codgp) é obrigatório',
    });
  }

  const client = await getPgPool().connect();
  try {
    // Títulos da cobrança (individual por cod_fat; grupo por codgp). Só boleto ('2') ou
    // carteira ('4'), ativos (cancel<>'S') — exclui recibo/promissória e legados.
    const filtro = usaGrupo ? 'r.codgp = $1' : 'r.cod_fat = $1';
    const param = usaGrupo ? codgp : codfat;
    const { rows } = await client.query(
      `SELECT r.cod_receb, r.nro_doc, r.dt_venc, r.dt_emissao, r.valor_pgto,
              r.banco, r.nro_banco, r.forma_fat, r.codcli,
              c.nome, c.nomefant, c.cpfcgc, c.ender, c.numero, c.bairro, c.cidade, c.uf, c.cep
         FROM dbreceb r
         LEFT JOIN dbclien c ON c.codcli = r.codcli
        WHERE ${filtro}
          AND COALESCE(r.cancel, 'N') <> 'S'
          AND COALESCE(r.forma_fat, '') IN ('2', '4')
        ORDER BY r.dt_venc, r.cod_receb`,
      [param],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Nenhum boleto/título em carteira encontrado para esta cobrança',
      });
    }

    const enderecoDe = (r: any) => {
      const partes = [r.ender, r.bairro, r.cidade, r.uf].filter(Boolean).join(' - ');
      return (
        [partes, r.cep ? `CEP:${r.cep}` : ''].filter(Boolean).join(' - ') ||
        undefined
      );
    };

    const boletoRows = rows.filter((r: any) => String(r.forma_fat) === '2');
    const carteiraRows = rows.filter((r: any) => String(r.forma_fat) === '4');
    // Boleto bancário FEBRABAN só quando todos os títulos '2' têm banco suportado + nosso número.
    const usarBoleto =
      boletoRows.length > 0 &&
      boletoRows.every((r: any) => CONFIG_BOLETO[String(r.banco)] && r.nro_banco);

    let html: string;
    if (usarBoleto) {
      const total = boletoRows.length;
      const boletos: BoletoData[] = boletoRows.map((r: any, i: number) => {
        const banco = String(r.banco);
        const cfg = CONFIG_BOLETO[banco];
        const nroBanco = String(r.nro_banco);
        const dv = digitoNossoNumero(banco, nroBanco);
        const valor = Number(r.valor_pgto) || 0;
        const feb = gerarBoletoFebraban(banco, nroBanco, dv, valor, new Date(r.dt_venc));
        const nossoNumeroDisplay =
          banco === '0' ? `09 / ${nroBanco}-${dv}` : `${nroBanco} ${dv}`;
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
          sacadoEndereco: enderecoDe(r),
          parcela: `${i + 1}/${total}`,
        };
      });
      html = gerarBoletoHtml(boletos);
    } else {
      // Carteira MELO (ou fallback quando o boleto bancário não é possível).
      const alvo = carteiraRows.length ? carteiraRows : boletoRows;
      const total = alvo.length;
      const titulos: TituloCarteiraData[] = alvo.map((r: any, i: number) => ({
        nossoNumero: String(r.cod_receb),
        numeroDocto: String(r.nro_doc || ''),
        vencimento: r.dt_venc,
        valorDocumento: Number(r.valor_pgto) || 0,
        dataDocumento: r.dt_emissao,
        dataProcessamento: r.dt_emissao,
        sacadoCodigo: String(r.codcli || ''),
        sacadoNome: String(r.nome || r.nomefant || ''),
        sacadoEndereco: enderecoDe(r),
        parcela: `${i + 1}/${total}`,
      }));
      html = gerarTituloCarteiraHtml(titulos);
    }

    const pdf = await renderHtmlToPdf(html, { landscape: false });
    return res.status(200).json({
      success: true,
      boleto: Buffer.from(pdf).toString('base64'),
      parcelas: rows.length,
    });
  } catch (error) {
    console.error('❌ Erro ao gerar boleto:', error);
    return res.status(500).json({
      error: 'Erro ao gerar boleto',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    client.release();
  }
}
