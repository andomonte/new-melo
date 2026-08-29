import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/faturamento/fechar-vendas  { codvendas: string[], usuario }
 *
 * Fecha (status='F') vendas NÃO FATURADAS — espelha VENDAS_OPERACOES.Fechar_Venda
 * do Delphi (dbVenda.Status='F' + registro/log). Fechamento administrativo: NÃO
 * emite NF-e nem gera fatura, só tira a venda da lista de pendentes.
 * Só fecha vendas que estão de fato não faturadas e não canceladas.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }
  const { codvendas, usuario, tipoFechamento, dataFechamento } = req.body || {};
  const lista: string[] = Array.isArray(codvendas)
    ? codvendas.map((x) => String(x)).filter(Boolean)
    : [];
  if (lista.length === 0) {
    return res.status(400).json({ erro: 'Informe ao menos uma venda.' });
  }
  const usuarioTxt = String(usuario ?? '').trim() || 'DESCONHECIDO';
  // Tipo de Fechamento (dbfecharvendas.status). FIEL AO FRONT DO DELPHI (UnitFecharVenda.pas:
  // vStatus := IntToStr(cbFecharVenda.ItemIndex + 2)): '2'=Não Estocado, '3'=Uso na Loja,
  // '4'=entra no Total do Faturamento. É OBRIGATÓRIO (o Delphi bloqueia ItemIndex=-1).
  const tipoVal = String(tipoFechamento ?? '');
  if (!['2', '3', '4'].includes(tipoVal)) {
    return res.status(400).json({ erro: 'Informe o Tipo de Fechamento.' });
  }
  // Data do Fechamento (dbfecharvendas.data). Recebe 'YYYY-MM-DD'. O Delphi bloqueia data
  // FUTURA (dtFecharVenda.date > date). Grava como literal ao meio-dia (evita shift de tz).
  const dataStr =
    typeof dataFechamento === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataFechamento)
      ? `${dataFechamento} 12:00:00`
      : null;
  if (dataStr) {
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    if (new Date(`${dataFechamento}T12:00:00`) > hoje) {
      return res.status(400).json({ erro: 'Data inválida (não pode ser futura).' });
    }
  }

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    try {
      // Elegíveis: não faturadas e não canceladas. Captura o status ANTERIOR (p/ registrar
      // em dbfecharvendas e permitir auditoria/reversão) antes de mudar para 'F'.
      const elig = await client.query(
        `SELECT codvenda, status
           FROM dbvenda
          WHERE codvenda = ANY($1)
            AND status IN ('0','N','I','S','1','D','2','L')
            AND (cancel IS NULL OR cancel <> 'S')
          FOR UPDATE`,
        [lista],
      );
      const fechadas: string[] = elig.rows.map((r) => r.codvenda);

      if (fechadas.length > 0) {
        // Espelha VENDAS_OPERACOES.Fechar_Venda do Delphi:
        //  1) dbvenda.status = 'F' (faturada);
        //  2) registro em dbfecharvendas (codfat NULL = fechamento admin, reversível);
        //  3) log da ação 'FECHAR VENDA'.
        await client.query(
          `UPDATE dbvenda SET status = 'F' WHERE codvenda = ANY($1)`,
          [fechadas],
        );
        for (const row of elig.rows) {
          // dbfecharvendas.status = TIPO DE FECHAMENTO (não o status anterior da venda).
          await client.query(
            `INSERT INTO dbfecharvendas (codvenda, codfat, data, status)
             VALUES ($1, NULL, COALESCE($2::timestamp, now()), $3)`,
            [row.codvenda, dataStr, tipoVal],
          );
          await client.query(
            `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
             VALUES ($1, 'FECHAR VENDA', 'DBFECHARVENDAS', $2, now())`,
            [usuarioTxt.substring(0, 60), `COD:${row.codvenda}`.substring(0, 255)],
          );
        }
      }

      await client.query('COMMIT');
      return res.status(200).json({
        sucesso: true,
        fechadas: fechadas.length,
        ignoradas: lista.length - fechadas.length,
        vendas: fechadas,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao fechar vendas:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao fechar vendas.', detalhes: error?.message });
  } finally {
    client.release();
  }
}
