import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface DetalhePagamentoAntecipado {
  ordemId: string;
  valor: number;
  dataVencimento: string;
  paga: boolean;
  dataPagamento: string | null;
}

interface ParcelaSugerida {
  numero_parcela: number;
  numero_duplicata: string;
  valor_parcela: number;
  data_vencimento: string;
  tipo_documento: string;
  origem: 'XML' | 'ANTECIPADO';
  detalhes?: DetalhePagamentoAntecipado[];
}

interface ParcelasSugeridasResponse {
  success: boolean;
  data?: ParcelaSugerida[];
  message?: string;
  pagamentoConfigurado?: boolean;
  debug?: {
    totalEntrada: number;
    valorTotalNFe: number;
    valorTotalOrdens: number;
    proporcao: number;
    ordensAssociadas: number;
    pagamentosAntecipados: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ParcelasSugeridasResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId } = req.query;

  if (!nfeId || typeof nfeId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'NFE ID é obrigatório'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    console.log(`\n📋 ===== BUSCANDO PARCELAS SUGERIDAS PARA NFe ${nfeId} =====`);

    // 1. Buscar TODAS as ordens associadas a esta NFe
    const ordensAssociadas = await client.query(`
      SELECT DISTINCT req_id
      FROM nfe_item_pedido_associacao
      WHERE nfe_id = $1
    `, [nfeId]);

    console.log(`🔍 Encontradas ${ordensAssociadas.rows.length} ordem(ns) associada(s) à NFe`);

    // 2. Buscar pagamentos antecipados de TODAS as ordens
    let totalEntrada = 0;
    const detalhesPagamentosAntecipados: DetalhePagamentoAntecipado[] = [];

    for (const ordem of ordensAssociadas.rows) {
      const pgtoAntecipado = await client.query(`
        SELECT
          opc.valor_parcela,
          opc.data_vencimento,
          p.paga,
          p.dt_pgto
        FROM ordem_pagamento_conta opc
        INNER JOIN dbpgto p ON opc.cod_pgto = p.cod_pgto
        WHERE opc.orc_id = $1 AND opc.numero_parcela = 0
      `, [ordem.req_id]);

      if (pgtoAntecipado.rows.length > 0) {
        const valorAntecipado = parseFloat(pgtoAntecipado.rows[0].valor_parcela || 0);
        totalEntrada += valorAntecipado;

        console.log(`💰 Ordem ${ordem.req_id}: Antecipado R$ ${valorAntecipado.toFixed(2)}`);

        detalhesPagamentosAntecipados.push({
          ordemId: ordem.req_id,
          valor: valorAntecipado,
          dataVencimento: pgtoAntecipado.rows[0].data_vencimento,
          paga: pgtoAntecipado.rows[0].paga === 'S',
          dataPagamento: pgtoAntecipado.rows[0].dt_pgto || null
        });
      } else {
        console.log(`ℹ️  Ordem ${ordem.req_id}: Sem pagamento antecipado`);
      }
    }

    console.log(`\n💵 TOTAL ENTRADA (soma dos antecipados): R$ ${totalEntrada.toFixed(2)}\n`);

    // 3. Buscar valor total da NFe e status do pagamento
    const nfeResult = await client.query(`
      SELECT vnf, COALESCE(pagamento_configurado, false) as pagamento_configurado
      FROM dbnfe_ent WHERE codnfe_ent = $1
    `, [nfeId]);

    if (nfeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'NFe não encontrada no sistema'
      });
    }

    const valorTotalNFe = parseFloat(nfeResult.rows[0].vnf || 0);
    const pagamentoConfigurado = nfeResult.rows[0].pagamento_configurado === true;
    console.log(`📄 Valor Total da NFe: R$ ${valorTotalNFe.toFixed(2)}`);
    console.log(`📄 Pagamento já configurado: ${pagamentoConfigurado ? 'SIM' : 'NÃO'}`);

    // 4. Somar valor de todas as ordens associadas
    const valorTotalOrdensResult = await client.query(`
      SELECT COALESCE(SUM(o.orc_valor_total), 0) as total
      FROM cmp_ordem_compra o
      INNER JOIN nfe_item_pedido_associacao nipa ON o.orc_id = nipa.req_id
      WHERE nipa.nfe_id = $1
    `, [nfeId]);

    const valorTotalOrdens = parseFloat(valorTotalOrdensResult.rows[0].total || 0);
    console.log(`🛒 Valor Total das Ordens Associadas: R$ ${valorTotalOrdens.toFixed(2)}`);

    // 5. Buscar parcelas do XML
    const parcelasXmlResult = await client.query(`
      SELECT
        ndup as numero_duplicata,
        dvencdup as data_vencimento,
        vdup as valor_centavos
      FROM dbnfe_ent_cobr
      WHERE codnfe_ent = $1
      ORDER BY dvencdup
    `, [nfeId]);

    console.log(`📋 Encontradas ${parcelasXmlResult.rows.length} parcela(s) no XML\n`);

    // 6. Montar array de parcelas sugeridas
    const parcelasSugeridas: ParcelaSugerida[] = [];

    // PARCELA 0: ENTRADA (soma dos antecipados)
    if (totalEntrada > 0) {
      parcelasSugeridas.push({
        numero_parcela: 0,
        numero_duplicata: 'ANTECIPADO',
        valor_parcela: parseFloat(totalEntrada.toFixed(2)),
        data_vencimento: new Date().toISOString().split('T')[0], // Hoje
        tipo_documento: 'ANTECIPADO',
        origem: 'ANTECIPADO',
        detalhes: detalhesPagamentosAntecipados
      });

      console.log(`✅ Parcela 0 (ENTRADA): R$ ${totalEntrada.toFixed(2)}`);
      console.log(`   Detalhes:`);
      detalhesPagamentosAntecipados.forEach(det => {
        console.log(`   - Ordem ${det.ordemId}: R$ ${det.valor.toFixed(2)} (${det.paga ? 'PAGA' : 'PENDENTE'})`);
      });
      console.log('');
    }

    // PARCELAS DO XML (proporcionais)
    if (parcelasXmlResult.rows.length > 0) {
      // Calcular proporção APENAS se valor da NFe > 0
      let proporcao = 1;

      if (valorTotalNFe > 0 && valorTotalOrdens > 0) {
        proporcao = valorTotalOrdens / valorTotalNFe;
        console.log(`📊 Proporção calculada: ${(proporcao * 100).toFixed(2)}% (${valorTotalOrdens.toFixed(2)} / ${valorTotalNFe.toFixed(2)})\n`);
      } else {
        console.log(`⚠️  Valor total da NFe ou ordens é zero, usando proporção 100%\n`);
      }

      parcelasXmlResult.rows.forEach((row: any, index: number) => {
        // Converter de centavos para reais
        const valorReais = parseFloat(row.valor_centavos) / 100;

        // Aplicar proporção
        const valorProporcional = valorReais * proporcao;

        parcelasSugeridas.push({
          numero_parcela: index + 1,
          numero_duplicata: row.numero_duplicata || `PARC-${index + 1}`,
          valor_parcela: parseFloat(valorProporcional.toFixed(2)),
          data_vencimento: row.data_vencimento,
          tipo_documento: 'BOLETO',
          origem: 'XML'
        });

        console.log(`✅ Parcela ${index + 1}: R$ ${valorProporcional.toFixed(2)} (venc: ${row.data_vencimento})`);
      });
    } else {
      console.log(`ℹ️  Nenhuma parcela encontrada no XML da NFe\n`);
    }

    console.log(`\n📊 RESUMO:`);
    console.log(`   Total de parcelas sugeridas: ${parcelasSugeridas.length}`);
    console.log(`   Total ENTRADA: R$ ${totalEntrada.toFixed(2)}`);
    console.log(`   Total PARCELAS XML: R$ ${parcelasSugeridas.filter(p => p.origem === 'XML').reduce((sum, p) => sum + p.valor_parcela, 0).toFixed(2)}`);
    console.log(`===================================================\n`);

    return res.status(200).json({
      success: true,
      data: parcelasSugeridas,
      pagamentoConfigurado,
      debug: {
        totalEntrada,
        valorTotalNFe,
        valorTotalOrdens,
        proporcao: valorTotalNFe > 0 ? valorTotalOrdens / valorTotalNFe : 1,
        ordensAssociadas: ordensAssociadas.rows.length,
        pagamentosAntecipados: detalhesPagamentosAntecipados.length
      }
    });

  } catch (err) {
    console.error('❌ Erro ao buscar parcelas sugeridas v2:', err);

    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar parcelas sugeridas',
      debug: process.env.NODE_ENV === 'development' ? {
        error: err instanceof Error ? err.message : String(err)
      } as any : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
