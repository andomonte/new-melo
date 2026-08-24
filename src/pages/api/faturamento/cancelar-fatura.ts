import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/faturamento/cancelar-fatura
 * Body: { codfat, motivo, cancelarVendas: boolean, usuario }
 *
 * "Cancelar Faturamento" — espelha o Fatura.Canc_Fatura do Delphi (parte de banco):
 *   1. dbfatura.cancel = 'S'
 *   2. dbreceb.cancel = 'S'  (exceto títulos de grupo, nro_doc 'GP...')
 *   3. Vendas do faturamento (dbprodfat):
 *        - cancelarVendas=true  → dbvenda.cancel='S' + DEVOLVE estoque
 *          (dbprod.qtest e cad_armazem_produto.arp_qtest, revertendo a baixa do
 *          faturamento) + cancela a pré-nota (dbprenota) quando tipo='1'.
 *        - cancelarVendas=false → dbvenda.status='L' (libera p/ refaturar).
 *   4. Log dbacao ('CANCELAR','DBFATURA', COD:<codfat> | MOTIVO:...).
 *
 * OBS: NÃO mexe em dbclien.debito — o faturamento web não movimenta o débito do
 * cliente (o Delphi usa red_debcli, mas o web não), então reduzir aqui corromperia.
 *
 * A NF-e na SEFAZ deve ter sido cancelada ANTES (o fluxo chama cancelar-nfe primeiro).
 * Guarda de segurança: recusa se ainda houver NF-e autorizada não cancelada.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }
  const { codfat, motivo, cancelarVendas, usuario, ignorarNfe } = req.body || {};
  if (!codfat) return res.status(400).json({ erro: 'Código da fatura é obrigatório.' });
  const motivoTxt = String(motivo ?? '').trim();
  const usuarioTxt = String(usuario ?? '').trim() || 'DESCONHECIDO';

  const client = await getPgPool().connect();
  try {
    const fat = await client.query(
      `SELECT cancel FROM dbfatura WHERE codfat = $1`,
      [String(codfat)],
    );
    if (fat.rows.length === 0) {
      return res.status(404).json({ erro: 'Fatura não encontrada.' });
    }

    // Guarda: NF-e autorizada e não cancelada precisa ir à SEFAZ antes.
    // Exceção: ignorarNfe=true — o usuário optou por cancelar SÓ o faturamento
    // internamente (ex.: prazo de cancelamento da NF-e expirado). Nesse caso a NF-e
    // continua VÁLIDA na SEFAZ (divergência a regularizar com devolução) — espelha o
    // Canc_Fatura do Delphi, que cancela a fatura de forma desacoplada da NF-e.
    if (!ignorarNfe) {
      const nfeAtiva = await client.query(
        `SELECT 1 FROM dbfat_nfe
          WHERE codfat = $1 AND status = '100'
            AND dthrcancelamento IS NULL AND numcancelamento IS NULL
          LIMIT 1`,
        [String(codfat)],
      );
      if (nfeAtiva.rows.length > 0) {
        return res.status(409).json({
          erro: 'A NF-e autorizada precisa ser cancelada na SEFAZ antes de cancelar a fatura.',
        });
      }
    }

    // Vendas do faturamento.
    const vendasRes = await client.query(
      `SELECT DISTINCT codvenda FROM dbprodfat
        WHERE codfat = $1 AND codvenda IS NOT NULL`,
      [String(codfat)],
    );
    const codVendas: string[] = vendasRes.rows.map((r) => r.codvenda);

    await client.query('BEGIN');
    try {
      // 1. Cancela a fatura.
      await client.query(
        `UPDATE dbfatura SET cancel = 'S' WHERE codfat = $1`,
        [codfat],
      );

      // 2. Cancela contas a receber (exceto títulos de grupo 'GP...').
      await client.query(
        `UPDATE dbreceb SET cancel = 'S'
          WHERE cod_fat = $1 AND (nro_doc IS NULL OR substr(nro_doc, 1, 2) <> 'GP')`,
        [codfat],
      );

      // 3. Vendas.
      if (cancelarVendas) {
        for (const cv of codVendas) {
          // Devolve o estoque de cada item (reverte a baixa do faturamento).
          const itens = await client.query(
            `SELECT codprod, qtd, arm_id FROM dbitvenda WHERE codvenda = $1`,
            [cv],
          );
          for (const it of itens.rows) {
            const qtd = Number(it.qtd) || 0;
            if (!qtd || !it.codprod) continue;
            await client.query(
              `UPDATE dbprod SET qtest = COALESCE(qtest, 0) + $1 WHERE codprod = $2`,
              [qtd, it.codprod],
            );
            if (it.arm_id != null) {
              await client.query(
                `UPDATE cad_armazem_produto
                    SET arp_qtest = COALESCE(arp_qtest, 0) + $1
                  WHERE arp_codprod = $2 AND arp_arm_id = $3`,
                [qtd, it.codprod, it.arm_id],
              );
            }
          }
          // Cancela a venda.
          await client.query(
            `UPDATE dbvenda SET cancel = 'S' WHERE codvenda = $1`,
            [cv],
          );
          // Pré-nota (só quando a venda é tipo '1').
          await client
            .query(
              `UPDATE dbprenota SET cancel = 'S', dtcancel = now()
                WHERE codvenda = $1
                  AND EXISTS (SELECT 1 FROM dbvenda v WHERE v.codvenda = $1 AND v.tipo = '1')`,
              [cv],
            )
            .catch(() => {});
        }
      } else if (codVendas.length > 0) {
        // Libera as vendas (volta para 'L', disponível p/ refaturar).
        await client.query(
          `UPDATE dbvenda SET status = 'L' WHERE codvenda = ANY($1)`,
          [codVendas],
        );
      }

      // 3b. Desativa o vínculo venda↔fatura. Sem isto, a trava anti-duplicata do
      // salvar.ts continua enxergando a fatura cancelada como 'ativa' e bloqueia a
      // reemissão ("a venda já possui a fatura ...").
      await client.query(
        `UPDATE fatura_venda SET status = 'cancelado' WHERE codfat = $1 AND status = 'ativo'`,
        [codfat],
      );

      // 4. Log da ação (espelha inc_acao_usr 'CANCELAR' / 'DBFATURA').
      await client.query(
        `INSERT INTO dbacao (codusr, acao, tabela, obs, data)
         VALUES ($1, 'CANCELAR', 'DBFATURA', $2, now())`,
        [
          usuarioTxt.substring(0, 60),
          `COD:${codfat}${motivoTxt ? ` | MOTIVO: ${motivoTxt}` : ''}`.substring(0, 255),
        ],
      );

      await client.query('COMMIT');
      return res.status(200).json({
        sucesso: true,
        codfat,
        cancelarVendas: !!cancelarVendas,
        vendasCanceladas: cancelarVendas ? codVendas.length : 0,
        vendasLiberadas: cancelarVendas ? 0 : codVendas.length,
        vendas: codVendas,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    console.error('Erro ao cancelar fatura:', error);
    return res
      .status(500)
      .json({ erro: 'Erro ao cancelar a fatura.', detalhes: error?.message });
  } finally {
    client.release();
  }
}
