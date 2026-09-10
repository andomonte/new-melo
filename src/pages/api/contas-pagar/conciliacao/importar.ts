import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { parseExtratoCsv } from '@/lib/conciliacao/parseCsv';
import { parseExtratoOfx, ehOfx, bancoDoOfx } from '@/lib/conciliacao/parseOfx';
import { classificarPagamento } from '@/lib/conciliacao/classificarPagamento';
import { decodificarExtrato } from '@/lib/conciliacao/db';

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };

/**
 * POST /api/contas-pagar/conciliacao/importar
 * body: { arquivoBase64, nome?, usuario? }
 *
 * Conciliação de Contas a Pagar (stateless): lê o extrato (OFX/CSV), separa as SAÍDAS
 * (débitos) que são pagamento a fornecedor e, para cada uma, busca em dbpgto os títulos
 * a pagar EM ABERTO cujo saldo bate com o valor pago. NÃO dá baixa — a baixa é confirmada
 * depois (via /api/contas-pagar/[id]/pagar). Reaproveita os parsers do Contas a Receber.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  const { arquivoBase64 } = req.body || {};
  if (!arquivoBase64) return res.status(400).json({ erro: 'Envie o arquivo (arquivoBase64).' });

  let texto: string;
  try {
    texto = decodificarExtrato(Buffer.from(String(arquivoBase64), 'base64'));
  } catch {
    return res.status(400).json({ erro: 'Não foi possível decodificar o arquivo.' });
  }

  const formatoOfx = ehOfx(texto);
  const ext = formatoOfx ? parseExtratoOfx(texto) : parseExtratoCsv(texto);
  const banco = formatoOfx ? bancoDoOfx(texto) || 'BANCO' : 'SANTANDER';
  if (ext.linhas.length === 0) return res.status(400).json({ erro: 'Nenhuma linha de extrato reconhecida (CSV ou OFX).' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    // Busca títulos a pagar EM ABERTO com saldo = valor da saída (em centavos).
    const buscarContas = async (absCent: number, dataIso: string) => {
      const r = await client.query(
        `SELECT
           p.cod_pgto,
           p.tipo,
           COALESCE(cr.nome, tr.nome) AS credor,
           p.cod_credor, p.cod_transp,
           p.nro_dup, p.nro_nf,
           to_char(p.dt_venc,'YYYY-MM-DD')    AS dt_venc,
           to_char(p.dt_emissao,'YYYY-MM-DD') AS dt_emissao,
           COALESCE(p.valor_pgto,0)  AS valor_pgto,
           COALESCE(p.valor_pago,0)  AS valor_pago,
           (COALESCE(p.valor_pgto,0) - COALESCE(p.valor_pago,0)) AS saldo,
           cf.cof_descricao AS conta_financeira
         FROM dbpgto p
         LEFT JOIN dbcredor cr ON p.cod_credor = cr.cod_credor
         LEFT JOIN dbtransp tr ON p.cod_transp = tr.codtransp
         LEFT JOIN cad_conta_financeira cf ON p.pag_cof_id = cf.cof_id
         WHERE COALESCE(p.cancel,'N') <> 'S'
           AND COALESCE(p.paga,'N')   <> 'S'
           AND ROUND((COALESCE(p.valor_pgto,0) - COALESCE(p.valor_pago,0)) * 100) = $1
         ORDER BY ABS(p.dt_venc::date - $2::date) NULLS LAST, p.dt_venc
         LIMIT 25`,
        [absCent, dataIso],
      );
      return r.rows.map((x) => ({
        cod_pgto: x.cod_pgto,
        tipo: x.tipo,
        credor: x.credor || '',
        cod_credor: x.cod_credor,
        cod_transp: x.cod_transp,
        nro_dup: x.nro_dup || '',
        nro_nf: x.nro_nf || '',
        dt_venc: x.dt_venc,
        dt_emissao: x.dt_emissao,
        valor_pgto: Number(x.valor_pgto),
        valor_pago: Number(x.valor_pago),
        saldo: Number(x.saldo),
        conta_financeira: x.conta_financeira || '',
      }));
    };

    const pagamentos: any[] = [];
    for (const l of ext.linhas) {
      const cls = classificarPagamento(l.historico, l.valorCentavos);
      if (cls.categoria !== 'pagamento') continue;
      const absCent = Math.abs(l.valorCentavos);
      const contas = await buscarContas(absCent, l.data);
      pagamentos.push({
        idx: l.idx,
        data: l.data,
        historico: l.historico,
        documento: l.documento || '',
        valorCentavos: absCent,
        tipo: cls.tipo,
        motivo: cls.motivo,
        contas,
      });
    }

    const comMatch = pagamentos.filter((p) => p.contas.length > 0).length;
    return res.status(200).json({
      banco,
      agencia: ext.agencia,
      conta: ext.conta,
      totalLinhas: ext.linhas.length,
      totalPagamentos: pagamentos.length,
      comMatch,
      semMatch: pagamentos.length - comMatch,
      pagamentos,
    });
  } catch (error: any) {
    console.error('Erro ao importar extrato (contas a pagar):', error);
    return res.status(500).json({ erro: 'Erro ao importar extrato', detalhes: error.message });
  } finally {
    client.release();
  }
}
