import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { registrarHistoricoOrdem } from '@/lib/compras/ordemHistoricoHelper';
import { gerarEntradaDbent } from '@/lib/compras/gerarEntradaDbent';

/**
 * POST /api/entradas/gerar-por-chave
 *
 * Gera a entrada a partir da chave de acesso da NFe (44 dígitos).
 * A NFe precisa estar processada (exec='S') e não pode ter entrada já gerada.
 *
 * Modelo Delphi: cria dbent (status 'A') + dbitent + dbent_recebimento ('PENDENTE')
 * via gerarEntradaDbent (o custo é calculado depois, no Confirmar Preço). Também atualiza
 * o estoque (dbprod), as quantidades atendidas dos pedidos e auto-finaliza ordens.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let { chaveNFe } = req.body;
  const { nfeId: nfeIdBody } = req.body;
  if (!chaveNFe && !nfeIdBody) {
    return res.status(400).json({ error: 'Chave de acesso da NFe (ou nfeId) é obrigatória.' });
  }

  let client: any;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('BEGIN');

    // Resolve a chave a partir do nfeId quando não veio explícita (o hub usa nfeId).
    if (!chaveNFe && nfeIdBody) {
      const r = await client.query(
        `SELECT chave FROM db_manaus.dbnfe_ent WHERE codnfe_ent = $1`, [nfeIdBody]);
      if (r.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NFe não encontrada para o nfeId informado.' });
      }
      chaveNFe = r.rows[0].chave;
    }

    const isImportacao = String(chaveNFe).startsWith('IMP');
    const chaveLimpa = isImportacao ? chaveNFe : String(chaveNFe).replace(/\D/g, '');
    if (!isImportacao && chaveLimpa.length !== 44) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chave de acesso da NFe inválida. Deve conter 44 dígitos.' });
    }

    // 1. NFe pela chave
    const nfeResult = await client.query(`
      SELECT codnfe_ent, exec as status, nnf as numero_nf, chave, natop, infcpl
      FROM db_manaus.dbnfe_ent
      WHERE chave = $1
      FOR UPDATE NOWAIT
    `, [chaveLimpa]);
    if (nfeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NFe não encontrada com esta chave de acesso.' });
    }
    const nfe = nfeResult.rows[0];
    const nfeId = nfe.codnfe_ent;

    // 2. NFe processada?
    if (nfe.status !== 'S') {
      await client.query('ROLLBACK');
      const statusLabel = nfe.status === 'A' ? 'em andamento' : nfe.status === 'N' || nfe.status === 'R' ? 'não processada' : nfe.status;
      return res.status(400).json({ error: `Esta NFe está ${statusLabel}. Processe a NFe primeiro na tela de Entrada XML.` });
    }

    // 3. Já existe entrada (dbent) para esta chave?
    const entradaExistente = await client.query(
      `SELECT codent FROM db_manaus.dbent WHERE chave = $1 LIMIT 1`, [chaveLimpa]);
    if (entradaExistente.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Já existe entrada gerada para esta NFe: ${entradaExistente.rows[0].codent}` });
    }

    // 4. Associações salvas
    const associacoesQuery = await client.query(`
      SELECT
        nia.produto_cod, nia.quantidade_associada,
        ARRAY_AGG(json_build_object('pedidoId', nipa.req_id, 'quantidade', nipa.quantidade)) as associacoes
      FROM db_manaus.nfe_item_associacao nia
      LEFT JOIN db_manaus.nfe_item_pedido_associacao nipa ON nia.id = nipa.nfe_associacao_id
      WHERE nia.nfe_id = $1 AND nia.status != 'ASSOCIADO_TESTE'
      GROUP BY nia.id, nia.produto_cod, nia.quantidade_associada
    `, [nfeId]);
    if (associacoesQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nenhuma associação encontrada para esta NFe.' });
    }
    const associacoesSalvas = associacoesQuery.rows;
    console.log(`📦 Gerando entrada para NFe ${nfe.numero_nf} (chave: ${chaveLimpa.slice(-8)}...) - ${associacoesSalvas.length} associações`);

    // 5. Pedidos a validar + estoque a atualizar
    const associacoesParaValidar: { pedidoId: string; produtoCod: string; quantidade: number }[] = [];
    const estoquesParaAtualizar: Map<string, number> = new Map();
    for (const itemSalvo of associacoesSalvas) {
      const quantidadeFloat = parseFloat(itemSalvo.quantidade_associada.toString());
      if (itemSalvo.associacoes && itemSalvo.associacoes[0] !== null) {
        for (const associacao of itemSalvo.associacoes) {
          const isTestOrder = associacao.pedidoId?.toString().startsWith('99') ||
            associacao.pedidoId?.toString().startsWith('FB') ||
            associacao.pedidoId?.toString().includes('ERRO');
          if (!isTestOrder && associacao.pedidoId) {
            associacoesParaValidar.push({
              pedidoId: associacao.pedidoId,
              produtoCod: itemSalvo.produto_cod,
              quantidade: parseFloat(associacao.quantidade),
            });
          }
        }
      }
      estoquesParaAtualizar.set(itemSalvo.produto_cod, (estoquesParaAtualizar.get(itemSalvo.produto_cod) || 0) + quantidadeFloat);
    }

    // 6. Validar quantidades nos pedidos
    if (associacoesParaValidar.length > 0) {
      const paresUnicos = [...new Set(associacoesParaValidar.map(a => `${a.pedidoId}|${a.produtoCod}`))];
      const placeholders = paresUnicos.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
      const params = paresUnicos.flatMap(par => par.split('|'));
      const batchCheckResult = await client.query(`
        SELECT o.orc_id as pedido_id, ri.itr_codprod as produto_cod,
               ri.itr_quantidade, COALESCE(ri.itr_quantidade_atendida, 0) as itr_quantidade_atendida
        FROM db_manaus.cmp_it_requisicao ri
        INNER JOIN db_manaus.cmp_ordem_compra o ON (o.orc_req_id = ri.itr_req_id AND o.orc_req_versao = ri.itr_req_versao)
        WHERE (o.orc_id, ri.itr_codprod) IN (${placeholders})
      `, params);

      const qtdMap = new Map<string, { total: number; atendida: number }>();
      for (const row of batchCheckResult.rows) {
        qtdMap.set(`${row.pedido_id}|${row.produto_cod}`, {
          total: parseFloat(row.itr_quantidade),
          atendida: parseFloat(row.itr_quantidade_atendida),
        });
      }
      const qtdSolicitadaMap = new Map<string, number>();
      for (const assoc of associacoesParaValidar) {
        const key = `${assoc.pedidoId}|${assoc.produtoCod}`;
        qtdSolicitadaMap.set(key, (qtdSolicitadaMap.get(key) || 0) + assoc.quantidade);
      }
      for (const [key, qtdSolicitada] of qtdSolicitadaMap) {
        const [pedidoId, produtoCod] = key.split('|');
        const qtdInfo = qtdMap.get(key);
        if (!qtdInfo) throw new Error(`Pedido ${pedidoId} não encontrado ou produto ${produtoCod} não está neste pedido`);
        if (qtdInfo.total - qtdInfo.atendida < qtdSolicitada) {
          throw new Error(`Quantidade insuficiente no pedido ${pedidoId} para produto ${produtoCod}. Disponível: ${qtdInfo.total - qtdInfo.atendida}, Solicitado: ${qtdSolicitada}`);
        }
      }
    }

    // 7. Empresa/zona + credor/header (da confirmação da nota)
    const empRow = await client.query(`SELECT uf FROM db_manaus.dadosempresa LIMIT 1`);
    const uf = empRow.rows[0]?.uf || 'AM';
    const zonaRow = await client.query(`SELECT "ZONA_ISENTIVADA" AS zona FROM db_manaus.dbuf_n WHERE "UF" = $1`, [uf]);
    const empresa = { uf, zona_isentivada: zonaRow.rows[0]?.zona || 'S' };

    const auxRow = await client.query(
      `SELECT codcredor, codtransp, codcomprador, operacao, cfop, custofin, desconto, acrescimo,
              verba_tmk, temcusto, zerar_ipi, zerar_st, selo, dtselo, temcon, nrocon
         FROM db_manaus.dbnfe_ent_aux WHERE codnfe_ent = $1`, [nfeId]);
    const aux = auxRow.rows[0] || {};

    let codCredor: string | null = aux.codcredor || null;
    if (!codCredor) {
      const emitRow = await client.query(
        `SELECT regexp_replace(COALESCE(cpf_cnpj,''),'[^0-9]','','g') AS cnpj FROM db_manaus.dbnfe_ent_emit WHERE codnfe_ent = $1`, [nfeId]);
      const cnpjEmit = emitRow.rows[0]?.cnpj;
      if (cnpjEmit) {
        // Determinístico: com vários cadastros no mesmo CNPJ e sem escolha fixada em
        // dbnfe_ent_aux, pega o de MENOR cod_credor (evita seleção aleatória).
        const credorRow = await client.query(
          `SELECT cod_credor FROM db_manaus.dbcredor WHERE regexp_replace(COALESCE(cpf_cgc,''),'[^0-9]','','g') = $1 ORDER BY cod_credor LIMIT 1`, [cnpjEmit]);
        codCredor = credorRow.rows[0]?.cod_credor || null;
      }
    }

    // 8. Gerar a entrada (dbent + dbitent + dbent_recebimento)
    const rDbent = await gerarEntradaDbent(client, {
      nfeId,
      chave: chaveLimpa,
      empresa,
      codCredor,
      codTransp: aux.codtransp || null,
      codComprador: aux.codcomprador || null,
      header: {
        custofin: Number(aux.custofin || 0),
        desconto: Number(aux.desconto || 0),
        acrescimo: Number(aux.acrescimo || 0),
        verba_tmk: Number(aux.verba_tmk || 0),
        operacao: aux.operacao != null ? String(aux.operacao) : '0',
        cfop: aux.cfop != null ? String(aux.cfop) : null,
        temcusto: aux.temcusto || 'S',
        zerar_ipi: aux.zerar_ipi || 'N',
        zerar_st: aux.zerar_st || 'N',
        // Selo e conhecimento (Delphi: ENTRADA_INCLUIR grava selo/dtselo/temcon/nrocon no dbent)
        temcon: aux.temcon || 'N',
        nrocon: aux.nrocon || null,
        selo: aux.selo || null,
        dtselo: aux.dtselo || null,
      },
    });
    const codent = rDbent.codent;
    const itensProcessados = rDbent.itens.length;

    // 9. Atualizar quantidade atendida nos pedidos + auto-finalizar ordens
    const isImp = nfe.natop === 'ENTRADA_IMPORTACAO';
    if (associacoesParaValidar.length > 0 && !isImp) {
      const updatesAgrupados = new Map<string, number>();
      for (const assoc of associacoesParaValidar) {
        const key = `${assoc.pedidoId}|${assoc.produtoCod}`;
        updatesAgrupados.set(key, (updatesAgrupados.get(key) || 0) + assoc.quantidade);
      }
      await Promise.all(Array.from(updatesAgrupados.entries()).map(([key, quantidade]) => {
        const [pedidoId, produtoCod] = key.split('|');
        return client.query(`
          UPDATE db_manaus.cmp_it_requisicao ri
          SET itr_quantidade_atendida = COALESCE(itr_quantidade_atendida, 0) + $1
          FROM db_manaus.cmp_ordem_compra o
          WHERE o.orc_id = $2 AND ri.itr_req_id = o.orc_req_id
            AND ri.itr_req_versao = o.orc_req_versao AND ri.itr_codprod = $3
        `, [quantidade, pedidoId, produtoCod]);
      }));

      const pedidosDistintos = new Set<string>();
      for (const assoc of associacoesParaValidar) if (assoc.pedidoId) pedidosDistintos.add(assoc.pedidoId);
      for (const pedidoId of pedidosDistintos) {
        const ordemResult = await client.query(
          `SELECT orc_id, orc_req_id, orc_req_versao, orc_status FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1`, [pedidoId]);
        if (ordemResult.rows.length === 0 || ordemResult.rows[0].orc_status !== 'A') continue;
        const ordem = ordemResult.rows[0];
        const pendentesResult = await client.query(
          `SELECT COUNT(*) as count FROM db_manaus.cmp_it_requisicao
            WHERE itr_req_id = $1 AND itr_req_versao = $2
              AND (itr_quantidade - COALESCE(itr_quantidade_atendida, 0) - COALESCE(itr_quantidade_fechada, 0)) > 0`,
          [ordem.orc_req_id, ordem.orc_req_versao]);
        if (Number(pendentesResult.rows[0].count) === 0) {
          await client.query(`UPDATE db_manaus.cmp_ordem_compra SET orc_status = 'F' WHERE orc_id = $1`, [pedidoId]);
          await registrarHistoricoOrdem(client, {
            orcId: Number(pedidoId), previousStatus: 'A', newStatus: 'F',
            userId: 'SISTEMA', userName: 'Sistema (Entrada NFe)',
            reason: `Ordem fechada automaticamente - todos os itens atendidos via entrada ${codent}`,
            comments: { tipo: 'FINALIZACAO', motivo: 'auto_entrada_nfe', entrada_id: codent, nfe_id: nfeId },
          });
          console.log(`✅ Ordem ${pedidoId} fechada automaticamente`);
        }
      }
    }

    // 10. Atualizar estoque (reserva a quantidade que entrou)
    await Promise.all(Array.from(estoquesParaAtualizar.entries()).map(([codprod, quantidade]) =>
      client.query(`
        UPDATE db_manaus.dbprod
        SET qtest = COALESCE(qtest, 0) + $1, qtdreservada = COALESCE(qtdreservada, 0) + $1
        WHERE codprod = $2
      `, [quantidade, codprod])));

    // 11. Importação: atualizar codent na fatura da DI
    if (nfe.natop === 'ENTRADA_IMPORTACAO' && nfe.infcpl) {
      const parts = nfe.infcpl.split(':'); // IMPORTACAO:id_importacao:id_fatura
      if (parts.length === 3 && parts[0] === 'IMPORTACAO') {
        const importacaoId = parseInt(parts[1]);
        const faturaId = parseInt(parts[2]);
        if (faturaId && importacaoId) {
          await client.query(
            `UPDATE db_manaus.dbent_importacao_entrada SET codent = $1 WHERE id = $2 AND id_importacao = $3`,
            [codent, faturaId, importacaoId]);
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Entrada ${codent} gerada com sucesso! ${itensProcessados} itens`);

    return res.status(200).json({
      success: true,
      message: `Entrada ${codent} gerada com sucesso!`,
      numeroEntrada: codent,
      entradaId: codent,
      itensProcessados,
      numeroNF: nfe.numero_nf,
    });
  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    if (error.code === '55P03') {
      return res.status(409).json({ error: 'Esta NFe está sendo processada por outro usuário. Aguarde.' });
    }
    console.error('Erro ao gerar entrada por chave:', error);
    return res.status(500).json({ error: error.message || 'Erro ao gerar entrada' });
  } finally {
    if (client) client.release();
  }
}
