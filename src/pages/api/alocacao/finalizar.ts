/**
 * Finalizar alocação — modelo dbent/dbent_recebimento.
 * PUT /api/alocacao/finalizar
 * Body: entradaId (codent), matricula, observacao?
 * Marca ALOCADO + DISPONIVEL_VENDA, libera a reserva do que chegou bom e, se houver divergência,
 * inicia a devolução (armazém 1004 + fat_devolucao + pré-pedido; ver lib/compras/devolucaoEntrada.ts).
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { poolEstacaoEntrada } from '@/lib/recebimentoEntrada/filial';
import { PoolClient } from 'pg';
import { creditarSemReserva, liberarReserva, posicionarReserva } from '@/lib/compras/estoqueEntrada';
import { precoConfirmadoDaEntrada, MSG_PRECO_PENDENTE_ALOCACAO } from '@/lib/recebimentoEntrada/status';
import { iniciarDevolucaoEntrada, itensParaDevolver, ResultadoDevolucao } from '@/lib/compras/devolucaoEntrada';

interface FinalizarRequest {
  entradaId: string; // codent
  matricula: string;
  observacao?: string;
}

interface FinalizarResponse {
  success: boolean;
  message: string;
  devolucao?: ResultadoDevolucao | null;
}

const GET_ALOCACOES_QUERY = `
  SELECT da.codprod as cod_produto, da.arm_id, da.qtd, da.localizacao, arm.arm_descricao
  FROM dbitent_armazem da
  LEFT JOIN cad_armazem arm ON arm.arm_id = da.arm_id
  WHERE da.codent = $1
  ORDER BY da.codprod, da.arm_id
`;
const GET_ALOCACOES_FALLBACK_QUERY = `
  SELECT da.codprod as cod_produto, da.arm_id, da.qtd, NULL as localizacao, arm.arm_descricao
  FROM dbitent_armazem da
  LEFT JOIN cad_armazem arm ON arm.arm_id = da.arm_id
  WHERE da.codent = $1
  ORDER BY da.codprod, da.arm_id
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FinalizarResponse | { error: string }>,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { entradaId, matricula, observacao } = (req.body || {}) as FinalizarRequest;
  if (!entradaId || !matricula) {
    return res.status(400).json({ error: 'entradaId e matricula sao obrigatorios' });
  }

  const cookies = parseCookies({ req });
  // filial do link da tela (header x-filial-estacao); ver lib/recebimentoEntrada/filial.ts
  const { filial, pool, schema } = poolEstacaoEntrada(req);
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const checkResult = await client.query(
      `SELECT id FROM entrada_operacoes
        WHERE codent = $1 AND alocador_matricula = $2 AND status = 'EM_ALOCACAO'`,
      [entradaId, matricula]);
    if (checkResult.rows.length === 0) {
      return res.status(403).json({ error: 'Voce nao esta autorizado a finalizar esta alocacao' });
    }
    // Finalizar libera a reserva (produto disponível para venda): exige o preço confirmado.
    if (!(await precoConfirmadoDaEntrada(client, entradaId))) {
      return res.status(400).json({ error: MSG_PRECO_PENDENTE_ALOCACAO(entradaId) });
    }

    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schema}, public`);

    // Quantidade de cada produto: a recebida, limitada à da nota. O excesso não entra no
    // estoque (como no Delphi, vale a nota); o que veio a menos/danificado/errado vai para o
    // armazém de devolução no passo 5, ainda reservado.
    const itensResult = await client.query(
      `SELECT ie.codprod,
              SUM(ie.quant) AS qtd_nota,
              SUM(COALESCE(eir.qtd_recebida, ie.quant)) AS qtd_recebida,
              COALESCE((SELECT SUM(da.qtd) FROM dbitent_armazem da
                         WHERE da.codent = ie.codent AND da.codprod = ie.codprod), 0) AS qtd_alocada
         FROM dbitent ie
         LEFT JOIN entrada_itens_recebimento eir
           ON eir.codent = ie.codent AND eir.produto_cod = ie.codprod
          AND COALESCE(eir.codreq,'') = COALESCE(ie.codreq,'')
        WHERE ie.codent = $1
        GROUP BY ie.codent, ie.codprod`,
      [entradaId]);

    const naoConfirmado = itensResult.rows.find(
      (i: any) => Number(i.qtd_recebida) > 0 && Number(i.qtd_alocada) !== Number(i.qtd_recebida));
    if (naoConfirmado) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Confirme a alocacao do produto ${naoConfirmado.codprod}: recebido ${Number(naoConfirmado.qtd_recebida)}, alocado ${Number(naoConfirmado.qtd_alocada)}`,
      });
    }

    const saldoProduto = new Map<string, number>(
      itensResult.rows.map((i: any) => [
        i.codprod,
        Math.min(Number(i.qtd_nota), Number(i.qtd_recebida)),
      ]));

    const finalizarResult = await client.query(
      `UPDATE entrada_operacoes
          SET status = 'ALOCADO', fim_alocacao = NOW(),
              observacao = COALESCE($2, observacao), updated_at = NOW()
        WHERE codent = $1 AND status = 'EM_ALOCACAO' RETURNING id`,
      [entradaId, observacao || null]);
    if (finalizarResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nao foi possivel finalizar a alocacao' });
    }

    // Entrada disponível para venda
    await client.query(`UPDATE dbent SET est_alocado = 1 WHERE codent = $1`, [entradaId]);
    await client.query(
      `UPDATE dbent_recebimento SET status = 'DISPONIVEL_VENDA', updated_at = now() WHERE codent = $1`,
      [entradaId]);

    // Confirma o romaneio nos armazéns (dbitent_armazem). O estoque já entrou na geração.
    let alocacoesResult;
    try {
      alocacoesResult = await client.query(GET_ALOCACOES_QUERY, [entradaId]);
    } catch (err: any) {
      if (err.code === '42703') {
        alocacoesResult = await client.query(GET_ALOCACOES_FALLBACK_QUERY, [entradaId]);
      } else {
        throw err;
      }
    }

    for (const aloc of alocacoesResult.rows) {
      const { cod_produto, qtd, localizacao } = aloc;
      const arm_id = Number(aloc.arm_id);
      const saldo = saldoProduto.get(cod_produto) ?? 0;
      const quantidade = Math.min(parseFloat(qtd), saldo);
      saldoProduto.set(cod_produto, saldo - quantidade);

      if (quantidade > 0) {
        // 1. Libera reserva no produto geral
        const produtoResult = await client.query(
          `SELECT COALESCE(qtdreservada, 0) AS reservada FROM dbprod WHERE codprod = $1 FOR UPDATE`,
          [cod_produto]);
        const reservadaProduto = parseFloat(produtoResult.rows[0]?.reservada ?? 0);
        await client.query(
          `UPDATE dbprod SET qtdreservada = GREATEST(COALESCE(qtdreservada, 0) - $1, 0) WHERE codprod = $2`,
          [quantidade, cod_produto]);

        // 2. Leva a reserva ao armazém escolhido e libera (o total não muda)
        const semReserva = await posicionarReserva(client, cod_produto, arm_id, quantidade);
        await liberarReserva(client, cod_produto, arm_id, quantidade - semReserva);

        // 3. Reservada só no produto: entrada gerada antes deste modelo, com qtest somado
        //    e nada no armazém. Sem reserva também no produto, não há o que acertar.
        const faltaNoArmazem = Math.min(semReserva, reservadaProduto);
        if (faltaNoArmazem > 0) {
          await creditarSemReserva(client, cod_produto, arm_id, faltaNoArmazem);
        }
      }

      // 4. Localização física: o produto pode ter várias no armazém (como no Delphi).
      //    A digitada entra como mais uma; as que já existem ficam como estão.
      const locTrimmed = String(localizacao ?? '').trim().toUpperCase().slice(0, 15);
      if (locTrimmed !== '') {
        await client.query(
          `INSERT INTO cad_armazem_produto_locacao (apl_arm_id, apl_codprod, apl_id, apl_descricao)
           SELECT $1::numeric, $2::varchar, COALESCE(MAX(apl_id), 0) + 1, $3::varchar
             FROM cad_armazem_produto_locacao
            WHERE apl_arm_id = $1::numeric AND apl_codprod = $2::varchar
           HAVING NOT bool_or(upper(trim(apl_descricao)) = $3::varchar) OR count(*) = 0`,
          [arm_id, cod_produto, locTrimmed]);
      }
    }

    // 5. Divergência (falta, danificado, errado): como no Delphi, a entrada fica com toda a
    //    quantidade da nota — o que não chegou bom vai, reservado, para o armazém virtual e
    //    nasce a devolução aberta com o pré-pedido para o fornecedor. Mesma transação: a
    //    falta nunca fica disponível para venda.
    let devolucao: ResultadoDevolucao | null = null;
    const itensDev = await itensParaDevolver(client, entradaId);
    if (itensDev.length) {
      const receb = await client.query(
        `SELECT id FROM devolucoes WHERE numero_entrada = $1 AND status = 'PENDENTE' ORDER BY id DESC LIMIT 1`,
        [entradaId]);
      devolucao = await iniciarDevolucaoEntrada(client, entradaId, itensDev, {
        matricula,
        devolucaoRecebId: receb.rows[0]?.id ?? null,
      });
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      message: devolucao
        ? `Alocacao finalizada. Devolucao ${devolucao.devId} iniciada para ${devolucao.itens.length} item(ns) com divergencia`
        : 'Alocacao finalizada com sucesso',
      devolucao,
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Erro ao finalizar alocacao:', error);
    return res.status(500).json({ error: 'Erro ao finalizar alocacao' });
  } finally {
    if (client) client.release();
  }
}
