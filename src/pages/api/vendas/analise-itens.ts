import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para gerenciar itens de uma venda na análise de liberação.
 * Registra todas as alterações em dbanalise_liberacao + dbanalise_liberacao_itens.
 *
 * POST   /api/vendas/analise-itens  { codvenda, codprod, qtd, prunit, prcompra, ref, descr, usuario }
 * DELETE /api/vendas/analise-itens  { codvenda, codprod, usuario }
 */

// Busca ou cria o registro de análise para a venda
async function getOrCreateAnalise(client: any, codvenda: string, usuario: string): Promise<number> {
  // Buscar análise EM_ANALISE existente
  const existing = await client.query(
    `SELECT id FROM db_manaus.dbanalise_liberacao WHERE codvenda = $1 AND resultado = 'EM_ANALISE' ORDER BY id DESC LIMIT 1`,
    [codvenda]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  // Criar nova análise + snapshot dos itens originais
  const insert = await client.query(
    `INSERT INTO db_manaus.dbanalise_liberacao (codvenda, resultado, usuario) VALUES ($1, 'EM_ANALISE', $2) RETURNING id`,
    [codvenda, usuario]
  );
  const idAnalise = insert.rows[0].id;

  // Snapshot: gravar todos os itens originais
  const itens = await client.query(
    `SELECT codprod, qtd, prunit, prcompra FROM dbitvenda WHERE codvenda = $1`,
    [codvenda]
  );
  for (const item of itens.rows) {
    await client.query(
      `INSERT INTO db_manaus.dbanalise_liberacao_itens (id_analise, codprod, acao, valor_anterior)
       VALUES ($1, $2, 'ORIGINAL', $3)`,
      [idAnalise, item.codprod, `qtd:${item.qtd} pr:${Number(item.prunit).toFixed(2)} custo:${Number(item.prcompra || 0).toFixed(2)}`]
    );
  }

  return idAnalise;
}

// Retorna o status atual da venda (dbvenda.status). 'F' = FATURADA.
async function getStatusVenda(client: any, codvenda: string): Promise<string | null> {
  const r = await client.query('SELECT status FROM dbvenda WHERE codvenda = $1', [codvenda]);
  return r.rows[0]?.status ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    if (req.method === 'POST') {
      const { codvenda, codprod, qtd, prunit, prcompra, ref, descr, usuario } = req.body;
      if (!codvenda || !codprod) {
        return res.status(400).json({ error: 'codvenda e codprod são obrigatórios' });
      }

      // GUARD: venda faturada não pode ter itens recalculados/editados — isso
      // desincronizaria o snapshot fiscal já copiado para dbprodfat.
      const statusPost = await getStatusVenda(client, codvenda);
      if (statusPost === 'F') {
        return res.status(409).json({
          error: 'Venda já faturada (status F) — itens não podem ser recalculados/editados.',
        });
      }

      const quantidade = Number(qtd) || 1;
      const valorUnitario = Number(prunit) || 0;
      const custoCompra = Number(prcompra) || 0;
      const user = usuario || 'SISTEMA';

      // Buscar ou criar análise
      const idAnalise = await getOrCreateAnalise(client, codvenda, user);

      // Buscar codcli da venda
      const vendaResult = await client.query('SELECT codcli FROM dbvenda WHERE codvenda = $1', [codvenda]);
      const codcli = vendaResult.rows[0]?.codcli;

      // Buscar NCM e CODGPE do produto
      const prodResult = await client.query('SELECT codprod, clasfiscal as ncm, COALESCE(TRIM(codgpe), \'\') as codgpe, dolar as origem FROM dbprod WHERE codprod = $1', [codprod]);
      const ncm = (prodResult.rows[0]?.ncm || '').replace(/\D/g, '').substring(0, 8);
      const codgpe = prodResult.rows[0]?.codgpe || '';
      const origem = prodResult.rows[0]?.origem || 'N';

      // Calcular impostos via função PostgreSQL db_manaus.calcular_imposto_item
      // (tradução fiel de CALCULO_IMPOSTO do Oracle). Sem aritmética fiscal em JS;
      // mesmos parâmetros do /api/impostos e do finalizarVenda → display = persistência.
      let campos: Record<string, any> = {};
      try {
        const { rows } = await client.query(
          `SELECT * FROM db_manaus.calcular_imposto_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            String(codprod).trim().padStart(6, '0'),
            String(codcli ?? '').trim(),
            quantidade,
            valorUnitario,
            'SAIDA',
            'VENDA',
            'NOTA_FISCAL',
            '04',
            'N',
            0,
          ],
        );
        const r = rows[0];
        if (!r) throw new Error(`produto ${codprod} / cliente ${codcli} não encontrado`);
        const num = (v: any) => Number(v ?? 0);

        campos = {
          aliquota_icms: num(r.icms),
          baseicms: num(r.baseicms),
          totalicms: num(r.totalicms),
          icmsinterno_dest: num(r.icmsinterno_dest),
          icmsexterno_orig: num(r.icmsexterno_orig),
          mva: num(r.mva),
          basesubst_trib: num(r.basesubst_trib),
          totalsubst_trib: num(r.totalsubst_trib),
          aliquota_ipi: num(r.ipi),
          baseipi: num(r.baseipi),
          totalipi: num(r.totalipi),
          ipi: num(r.totalipi),
          pis: num(r.pis),
          basepis: num(r.basepis),
          valorpis: num(r.valorpis),
          cofins: num(r.cofins),
          basecofins: num(r.basecofins),
          valorcofins: num(r.valorcofins),
          fcp: 0,
          base_fcp: 0,
          valor_fcp: 0,
          fcp_subst: 0,
          basefcp_subst: 0,
          valorfcp_subst: 0,
          totalproduto: num(r.totalproduto),
          icms: num(r.totalicms),
          aliquota_ibs: num(r.ibs_e) + num(r.ibs_m),
          aliquota_cbs: num(r.cbs_aliquota),
          valor_ibs: num(r.valor_ibs),
          valor_cbs: num(r.valor_cbs),
          ibs_e: num(r.ibs_e),
          ibs_m: num(r.ibs_m),
        };
        if (r.cstipi) campos.cstipi = String(r.cstipi).substring(0, 5);
        if (r.cstpis) campos.cstpis = String(r.cstpis).substring(0, 5);
        if (r.cstcofins) campos.cstcofins = String(r.cstcofins).substring(0, 5);
        if (r.cfop) campos.cfop = String(r.cfop).substring(0, 4);
        if (r.ncm) campos.ncm = String(r.ncm).substring(0, 10);
      } catch (taxError: any) {
        console.error('Erro ao calcular impostos (PG):', taxError.message);
        return res.status(500).json({ error: `Falha no cálculo fiscal: ${taxError.message}` });
      }

      // Verificar se já existe na venda
      const existe = await client.query(
        'SELECT qtd, prunit FROM dbitvenda WHERE codvenda = $1 AND codprod = $2',
        [codvenda, codprod]
      );

      if (existe.rows.length > 0) {
        const qtdAnterior = Number(existe.rows[0].qtd);
        const prunitAnterior = Number(existe.rows[0].prunit);

        // Atualizar
        const setClauses = ['qtd = $3', 'prunit = $4', 'prcompra = $5'];
        const params: any[] = [codvenda, codprod, quantidade, valorUnitario, custoCompra];
        let paramIdx = 6;
        Object.entries(campos).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            setClauses.push(`${key} = $${paramIdx}`);
            params.push(val);
            paramIdx++;
          }
        });
        await client.query(`UPDATE dbitvenda SET ${setClauses.join(', ')} WHERE codvenda = $1 AND codprod = $2`, params);

        // Registrar alterações
        if (qtdAnterior !== quantidade) {
          await client.query(
            `INSERT INTO db_manaus.dbanalise_liberacao_itens (id_analise, codprod, acao, campo, valor_anterior, valor_novo)
             VALUES ($1, $2, 'ALTERAR', 'qtd', $3, $4)`,
            [idAnalise, codprod, String(qtdAnterior), String(quantidade)]
          );
        }
        if (Math.abs(prunitAnterior - valorUnitario) > 0.001) {
          await client.query(
            `INSERT INTO db_manaus.dbanalise_liberacao_itens (id_analise, codprod, acao, campo, valor_anterior, valor_novo)
             VALUES ($1, $2, 'ALTERAR', 'prunit', $3, $4)`,
            [idAnalise, codprod, prunitAnterior.toFixed(2), valorUnitario.toFixed(2)]
          );
        }
      } else {
        // Novo item
        const maxItem = await client.query(
          `SELECT COALESCE(MAX(CAST(nritem AS INTEGER)), 0) + 1 as next_item FROM dbitvenda WHERE codvenda = $1`,
          [codvenda]
        );
        const nritem = maxItem.rows[0]?.next_item || 1;

        const armResult = await client.query(
          `SELECT arp_arm_id FROM cad_armazem_produto WHERE arp_codprod = $1 AND COALESCE(arp_bloqueado, 'N') <> 'S' ORDER BY arp_qtest DESC LIMIT 1`,
          [codprod]
        );
        const armId = armResult.rows[0]?.arp_arm_id || '1';

        const baseCols = ['codvenda', 'codprod', 'qtd', 'prunit', 'prcompra', 'ref', 'descr', 'nritem', 'demanda', 'arm_id'];
        const baseVals: any[] = [codvenda, codprod, quantidade, valorUnitario, custoCompra, (ref || '').substring(0, 20), (descr || '').substring(0, 60), nritem, 'S', armId];
        let pIdx = baseCols.length + 1;

        const taxCols: string[] = [];
        const taxPlaceholders: string[] = [];
        const taxVals: any[] = [];
        Object.entries(campos).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            taxCols.push(key);
            taxPlaceholders.push(`$${pIdx}`);
            taxVals.push(val);
            pIdx++;
          }
        });

        const allCols = [...baseCols, ...taxCols];
        const allPlaceholders = baseCols.map((_, i) => `$${i + 1}`).concat(taxPlaceholders);
        await client.query(
          `INSERT INTO dbitvenda (${allCols.join(', ')}) VALUES (${allPlaceholders.join(', ')})`,
          [...baseVals, ...taxVals]
        );

        // Registrar adição
        await client.query(
          `INSERT INTO db_manaus.dbanalise_liberacao_itens (id_analise, codprod, acao, valor_novo)
           VALUES ($1, $2, 'ADICIONAR', $3)`,
          [idAnalise, codprod, `qtd:${quantidade} pr:${valorUnitario.toFixed(2)} ref:${(ref || '').substring(0, 20)}`]
        );
      }

      // Recalcular total da venda
      const totalResult = await client.query(
        `SELECT COALESCE(SUM(qtd * prunit), 0) as total FROM dbitvenda WHERE codvenda = $1`,
        [codvenda]
      );
      await client.query('UPDATE dbvenda SET total = $2 WHERE codvenda = $1', [codvenda, totalResult.rows[0].total]);

      return res.status(200).json({ ok: true, impostos: campos, codgpe, origem });
    }

    if (req.method === 'DELETE') {
      const { codvenda, codprod, usuario } = req.body;
      if (!codvenda || !codprod) {
        return res.status(400).json({ error: 'codvenda e codprod são obrigatórios' });
      }

      // GUARD: venda faturada não pode ter itens removidos (ver POST acima).
      const statusDel = await getStatusVenda(client, codvenda);
      if (statusDel === 'F') {
        return res.status(409).json({
          error: 'Venda já faturada (status F) — itens não podem ser removidos.',
        });
      }

      const user = usuario || 'SISTEMA';
      const idAnalise = await getOrCreateAnalise(client, codvenda, user);

      // Buscar dados antes de deletar
      const itemRef = await client.query(
        'SELECT ref, qtd, prunit FROM dbitvenda WHERE codvenda = $1 AND codprod = $2',
        [codvenda, codprod]
      );
      const refDel = itemRef.rows[0]?.ref || '';
      const qtdDel = itemRef.rows[0]?.qtd || 0;
      const prDel = Number(itemRef.rows[0]?.prunit || 0);

      await client.query('DELETE FROM dbitvenda WHERE codvenda = $1 AND codprod = $2', [codvenda, codprod]);

      // Registrar remoção
      await client.query(
        `INSERT INTO db_manaus.dbanalise_liberacao_itens (id_analise, codprod, acao, valor_anterior)
         VALUES ($1, $2, 'REMOVER', $3)`,
        [idAnalise, codprod, `qtd:${qtdDel} pr:${prDel.toFixed(2)} ref:${refDel}`]
      );

      // Recalcular total
      const totalResult = await client.query(
        `SELECT COALESCE(SUM(qtd * prunit), 0) as total FROM dbitvenda WHERE codvenda = $1`,
        [codvenda]
      );
      await client.query('UPDATE dbvenda SET total = $2 WHERE codvenda = $1', [codvenda, totalResult.rows[0].total]);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error: any) {
    console.error('Erro em analise-itens:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}
