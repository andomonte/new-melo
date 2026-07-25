import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { CalculadoraImpostos } from '@/lib/impostos/calculadoraImpostos';
import type { DadosCalculoImposto } from '@/lib/impostos/types';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    if (req.method === 'POST') {
      const { codvenda, codprod, qtd, prunit, prcompra, ref, descr, usuario } = req.body;
      if (!codvenda || !codprod) {
        return res.status(400).json({ error: 'codvenda e codprod são obrigatórios' });
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

      // Calcular impostos
      let campos: Record<string, any> = {};
      try {
        const dados: DadosCalculoImposto = {
          produto_id: parseInt(codprod),
          ncm,
          valor_produto: valorUnitario,
          quantidade,
          desconto: 0,
          cliente_id: codcli ? parseInt(codcli) : 0,
          tipo_operacao: 'VENDA',
        };
        const calculadora = new CalculadoraImpostos(client);
        const resultado = await calculadora.calcular(dados);

        campos = {
          aliquota_icms: resultado.icms,
          baseicms: resultado.baseicms,
          totalicms: resultado.totalicms,
          icmsinterno_dest: resultado.icmsinterno_dest,
          icmsexterno_orig: resultado.icmsexterno_orig,
          mva: resultado.mva,
          basesubst_trib: resultado.basesubst_trib,
          totalsubst_trib: resultado.totalsubst_trib,
          aliquota_ipi: resultado.ipi,
          baseipi: resultado.baseipi,
          totalipi: resultado.totalipi,
          ipi: resultado.totalipi,
          pis: resultado.pis,
          basepis: resultado.basepis,
          valorpis: resultado.valorpis,
          cofins: resultado.cofins,
          basecofins: resultado.basecofins,
          valorcofins: resultado.valorcofins,
          fcp: resultado.fcp,
          base_fcp: resultado.base_fcp,
          valor_fcp: resultado.valor_fcp,
          fcp_subst: resultado.fcp_subst,
          basefcp_subst: resultado.basefcp_subst,
          valorfcp_subst: resultado.valorfcp_subst,
          totalproduto: resultado.valor_total_item,
          icms: resultado.totalicms,
        };
        if (resultado.csticms) campos.csticms = String(resultado.csticms).substring(0, 5);
        if (resultado.cstipi) campos.cstipi = String(resultado.cstipi).substring(0, 5);
        if (resultado.cstpis) campos.cstpis = String(resultado.cstpis).substring(0, 5);
        if (resultado.cstcofins) campos.cstcofins = String(resultado.cstcofins).substring(0, 5);
        if (resultado.cfop) campos.cfop = String(resultado.cfop).substring(0, 4);
        if (resultado.ncm) campos.ncm = String(resultado.ncm).substring(0, 10);
        if (resultado.tipocfop) campos.tipocfop = String(resultado.tipocfop).substring(0, 1);
      } catch (taxError: any) {
        console.error('Erro ao calcular impostos:', taxError.message);
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
