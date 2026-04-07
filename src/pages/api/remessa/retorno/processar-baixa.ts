import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

/**
 * API para processar baixa automática dos títulos do retorno CNAB 400
 * 
 * Busca títulos classificados para baixa automática (Ocorrência 06)
 * Localiza o título correspondente em dbpgto pelo nro_dup
 * Registra o pagamento em db_manaus.dbfpgto
 * Atualiza o status da conta em dbpgto
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  try {
    const { codretorno } = req.body;

    if (!codretorno) {
      return res.status(400).json({ erro: 'Código do arquivo de retorno é obrigatório (codretorno)' });
    }

    // 1. Buscar todos os títulos com baixa automática (ocorrência 06)
    const queryTitulosAutomaticos = `
      SELECT 
        rd.coddetalhe,
        rd.nosso_numero,
        rd.nro_doc,
        rd.valor_pago,
        rd.dt_ocor,
        rd.desconto,
        rd.juros_multa,
        rd.nome_sacado,
        rd.codcli
      FROM db_manaus.dbretorno_detalhe rd
      INNER JOIN db_manaus.dbretorno_situacao rs ON rd.coddetalhe = rs.coddetalhe
      WHERE rd.codretorno = $1
        AND rs.baixa_auto = 'S'
        AND rd.cod_ocor = '06'
      ORDER BY rd.coddetalhe
    `;

    const resultTitulos = await pool.query(queryTitulosAutomaticos, [codretorno]);

    if (resultTitulos.rows.length === 0) {
      return res.status(404).json({ 
        erro: 'Nenhum título para baixa automática encontrado neste arquivo de retorno',
        totalProcessados: 0
      });
    }

    const titulosRetorno = resultTitulos.rows;
    const resultados = {
      totalTitulos: titulosRetorno.length,
      sucesso: [] as any[],
      erros: [] as any[],
      naoEncontrados: [] as any[]
    };

    // 2. Processar cada título
    for (const titulo of titulosRetorno) {
      try {
        // 2.1. Buscar o título em dbpgto pelo nro_dup (número do documento)
        // Tenta primeiro match exato, depois LIKE para capturar parcelados (ex: "123/01")
        const queryBuscarTitulo = `
          SELECT 
            cod_pgto,
            valor_pgto,
            dt_venc,
            paga,
            cancel,
            nro_dup
          FROM dbpgto
          WHERE (nro_dup = $1 OR nro_dup LIKE $2)
            AND (cancel IS NULL OR cancel != 'S')
          ORDER BY 
            CASE WHEN nro_dup = $1 THEN 1 ELSE 2 END,
            dt_venc ASC
          LIMIT 1
        `;

        const resultBuscar = await pool.query(queryBuscarTitulo, [
          titulo.nro_doc,
          `${titulo.nro_doc}%` // Para capturar parcelados
        ]);

        if (resultBuscar.rows.length === 0) {
          resultados.naoEncontrados.push({
            nossoNumero: titulo.nosso_numero,
            numeroDocumento: titulo.nro_doc,
            valorPago: titulo.valor_pago / 100, // Converter de centavos para reais
            motivo: 'Título não encontrado em contas a pagar'
          });
          continue;
        }

        const contaPagar = resultBuscar.rows[0];

        // 2.2. Verificar se já está totalmente pago
        const queryHistorico = `
          SELECT COALESCE(SUM(valor_pgto), 0) as total_pago
          FROM db_manaus.dbfpgto
          WHERE cod_pgto = $1
            AND (cancel IS NULL OR cancel != 'S')
        `;
        const resultHistorico = await pool.query(queryHistorico, [contaPagar.cod_pgto]);
        const totalJaPago = parseFloat(resultHistorico.rows[0].total_pago || '0');
        const valorOriginal = parseFloat(contaPagar.valor_pgto);

        if (totalJaPago >= valorOriginal) {
          resultados.erros.push({
            codPgto: contaPagar.cod_pgto,
            nroDup: contaPagar.nro_dup,
            nossoNumero: titulo.nosso_numero,
            motivo: `Título já totalmente pago (R$ ${totalJaPago.toFixed(2)})`,
            valorRetorno: titulo.valor_pago / 100
          });
          continue;
        }

        // 2.3. Calcular valores
        const valorPagoReais = titulo.valor_pago / 100; // Converter centavos para reais
        const descontoReais = (titulo.desconto || 0) / 100;
        const jurosMultaReais = (titulo.juros_multa || 0) / 100;
        const novoTotalPago = totalJaPago + valorPagoReais;
        const estaCompletamentePago = novoTotalPago >= valorOriginal - 0.01;

        // 2.4. Gerar próximo fpg_cof_id
        const maxFpgResult = await pool.query(
          'SELECT COALESCE(MAX(fpg_cof_id), 0) + 1 as next_id FROM db_manaus.dbfpgto'
        );
        const nextFpgCofId = maxFpgResult.rows[0].next_id;

        // 2.5. Registrar pagamento no histórico (dbfpgto)
        const insertHistoricoQuery = `
          INSERT INTO db_manaus.dbfpgto (
            cod_pgto,
            cod_fpgto,
            fpg_cof_id,
            dt_pgto,
            valor_pgto,
            tp_pgto,
            cancel,
            desconto,
            juros,
            dt_venc,
            dt_emissao,
            sf,
            import
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING fpg_cof_id, valor_pgto
        `;

        const resultHistoricoInsert = await pool.query(insertHistoricoQuery, [
          contaPagar.cod_pgto,           // cod_pgto
          1,                              // cod_fpgto = 1 (Transferência bancária)
          nextFpgCofId,                   // fpg_cof_id
          titulo.dt_ocor,                 // dt_pgto (data da ocorrência no retorno)
          valorPagoReais,                 // valor_pgto
          'T',                            // tp_pgto = T (Transferência)
          null,                           // cancel
          descontoReais,                  // desconto
          jurosMultaReais,                // juros
          contaPagar.dt_venc,             // dt_venc
          new Date().toISOString().split('T')[0], // dt_emissao = hoje
          'N',                            // sf = N
          'N'                             // import = N
        ]);

        // 2.6. Atualizar registro principal em dbpgto
        const updatePrincipalQuery = `
          UPDATE dbpgto
          SET 
            paga = $2,
            dt_pgto = $3,
            valor_pago = $4,
            obs = COALESCE(obs, '') || $5
          WHERE cod_pgto = $1
          RETURNING cod_pgto, nro_dup, valor_pgto, paga
        `;

        const obsAdicional = `\n[Baixa Automática CNAB - ${new Date().toLocaleDateString('pt-BR')}] Nosso Número: ${titulo.nosso_numero}`;

        const resultUpdate = await pool.query(updatePrincipalQuery, [
          contaPagar.cod_pgto,
          estaCompletamentePago ? 'S' : 'N',
          titulo.dt_ocor,
          novoTotalPago,
          obsAdicional
        ]);

        // 2.7. Registrar sucesso
        resultados.sucesso.push({
          codPgto: contaPagar.cod_pgto,
          nroDup: contaPagar.nro_dup,
          nossoNumero: titulo.nosso_numero,
          numeroDocumento: titulo.nro_doc,
          valorOriginal: valorOriginal,
          valorPago: valorPagoReais,
          totalPago: novoTotalPago,
          desconto: descontoReais,
          jurosMulta: jurosMultaReais,
          statusFinal: estaCompletamentePago ? 'Pago' : 'Parcialmente Pago',
          dataPagamento: titulo.dt_ocor,
          fpgCofId: nextFpgCofId
        });

      } catch (error: any) {
        console.error('Erro ao processar título:', error);
        resultados.erros.push({
          nossoNumero: titulo.nosso_numero,
          numeroDocumento: titulo.nro_doc,
          motivo: error.message || 'Erro desconhecido',
          stack: error.stack
        });
      }
    }

    // 3. Retornar resultado completo
    return res.status(200).json({
      mensagem: 'Processamento de baixa automática concluído',
      resumo: {
        totalTitulos: resultados.totalTitulos,
        processadosComSucesso: resultados.sucesso.length,
        erros: resultados.erros.length,
        naoEncontrados: resultados.naoEncontrados.length
      },
      detalhes: resultados
    });

  } catch (error: any) {
    console.error('Erro ao processar baixa automática:', error);
    return res.status(500).json({ 
      erro: 'Erro ao processar baixa automática',
      detalhes: error.message,
      stack: error.stack
    });
  }
}
