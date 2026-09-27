// GET /api/comissao/extrato?ano=YYYY&mes=M[&codvend=00147]
// Extrato de comissão do vendedor (razão fin_comissao_mov).
// - Roda a reconciliação do mês (novos faturamentos) + débitos de cancelamento (todos).
// - Sem codvend: resumo por vendedor no mês.
// - Com codvend: extrato do vendedor por dia, com saldo corrente.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { reconciliarComissao } from '@/lib/comissao/reconciliarComissao';

const pool = getPgPool();

function periodo(ano: number, mes: number) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const proxAno = mes === 12 ? ano + 1 : ano;
  const fim = `${proxAno}-${String(proxMes).padStart(2, '0')}-01`;
  return { inicio, fim };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  const ano = parseInt(String(req.query.ano || ''), 10);
  const mes = parseInt(String(req.query.mes || ''), 10);
  const codvend = req.query.codvend ? String(req.query.codvend).trim() : '';
  if (!ano || !mes || mes < 1 || mes > 12) {
    return res.status(400).json({ erro: 'Informe ano e mês válidos.' });
  }
  const { inicio, fim } = periodo(ano, mes);

  try {
    // Mantém o razão fresco: cria créditos do mês e débitos de cancelamento detectados.
    const recon = await reconciliarComissao(pool, inicio, fim);

    // Resumo por vendedor no mês (+ status de fechamento)
    const resumo = await pool.query(
      `SELECT m.codvend,
              COALESCE(ve.nome, m.codvend) AS nome,
              SUM(CASE WHEN m.valor_comissao > 0 THEN m.valor_comissao ELSE 0 END) AS creditos,
              SUM(CASE WHEN m.valor_comissao < 0 THEN m.valor_comissao ELSE 0 END) AS debitos,
              SUM(m.valor_comissao) AS total,
              SUM(CASE WHEN m.status = 'A' THEN m.valor_comissao ELSE 0 END) AS total_aberto,
              COUNT(*) AS movimentos,
              (fc.id IS NOT NULL) AS fechado,
              fc.fechado_em, fc.fechado_por
         FROM db_manaus.fin_comissao_mov m
         LEFT JOIN db_manaus.dbvend ve ON ve.codvend = m.codvend
         LEFT JOIN db_manaus.fin_comissao_fechamento fc
                ON fc.codvend = m.codvend AND fc.ano = $3 AND fc.mes = $4
        WHERE m.data_mov >= $1 AND m.data_mov < $2
          ${codvend ? 'AND m.codvend = $5' : ''}
        GROUP BY m.codvend, ve.nome, fc.id, fc.fechado_em, fc.fechado_por
        ORDER BY total DESC`,
      codvend ? [inicio, fim, ano, mes, codvend] : [inicio, fim, ano, mes],
    );

    let extrato: any[] = [];
    if (codvend) {
      // Extrato do vendedor: movimentos por dia + saldo corrente do mês
      const r = await pool.query(
        `SELECT m.id, m.data_mov, m.tipo, m.codfat, m.codvenda, m.codprod,
                m.valor_base, m.perc, m.valor_comissao, m.status, m.obs,
                SUM(m.valor_comissao) OVER (ORDER BY m.data_mov, m.id) AS saldo,
                COALESCE(cl.nome, '') AS cliente
           FROM db_manaus.fin_comissao_mov m
           LEFT JOIN db_manaus.dbvenda v ON v.codvenda = m.codvenda
           LEFT JOIN db_manaus.dbclien cl ON cl.codcli = v.codcli
          WHERE m.codvend = $3 AND m.data_mov >= $1 AND m.data_mov < $2
          ORDER BY m.data_mov, m.id`,
        [inicio, fim, codvend],
      );
      extrato = r.rows.map((x: any) => ({
        id: x.id,
        data_mov: x.data_mov instanceof Date ? x.data_mov.toISOString().slice(0, 10) : x.data_mov,
        tipo: x.tipo, // FAT | CAN | DEV
        codfat: x.codfat,
        codvenda: x.codvenda,
        codprod: x.codprod,
        cliente: x.cliente,
        valor_base: Number(x.valor_base) || 0,
        perc: Number(x.perc) || 0,
        valor_comissao: Number(x.valor_comissao) || 0,
        saldo: Number(x.saldo) || 0,
        status: x.status,
        obs: x.obs,
      }));
    }

    // Totais gerais do período (todos os vendedores) — para o cabeçalho, independente de paginação
    const tot = await pool.query(
      `SELECT
         SUM(CASE WHEN valor_comissao > 0 THEN valor_comissao ELSE 0 END) AS creditos,
         SUM(CASE WHEN valor_comissao < 0 THEN valor_comissao ELSE 0 END) AS debitos,
         SUM(valor_comissao) AS total,
         SUM(CASE WHEN status = 'A' THEN valor_comissao ELSE 0 END) AS a_pagar,
         SUM(CASE WHEN status = 'P' THEN valor_comissao ELSE 0 END) AS pagos
       FROM db_manaus.fin_comissao_mov
      WHERE data_mov >= $1 AND data_mov < $2
        ${codvend ? 'AND codvend = $3' : ''}`,
      codvend ? [inicio, fim, codvend] : [inicio, fim],
    );
    const totais = {
      creditos: Number(tot.rows[0]?.creditos) || 0,
      debitos: Number(tot.rows[0]?.debitos) || 0,
      total: Number(tot.rows[0]?.total) || 0,
      a_pagar: Number(tot.rows[0]?.a_pagar) || 0,
      pagos: Number(tot.rows[0]?.pagos) || 0,
    };

    const totalMes = totais.total;

    return res.status(200).json({
      ano,
      mes,
      reconciliacao: recon, // {creditos, debitosCancelamento}
      resumo: resumo.rows.map((r: any) => ({
        codvend: r.codvend,
        nome: r.nome,
        creditos: Number(r.creditos) || 0,
        debitos: Number(r.debitos) || 0,
        total: Number(r.total) || 0,
        total_aberto: Number(r.total_aberto) || 0,
        movimentos: Number(r.movimentos) || 0,
        fechado: !!r.fechado,
        fechado_em: r.fechado_em,
        fechado_por: r.fechado_por,
      })),
      // mês considerado "fechado" quando todos os vendedores com movimento estão fechados
      mesFechado: resumo.rows.length > 0 && resumo.rows.every((r: any) => r.fechado),
      totais,
      totalMes,
      extrato,
    });
  } catch (error: any) {
    console.error('Erro no extrato de comissão:', error);
    return res.status(500).json({ erro: 'Erro ao gerar extrato', detalhes: error.message });
  }
}
