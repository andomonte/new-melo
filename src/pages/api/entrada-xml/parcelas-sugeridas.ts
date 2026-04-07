import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface ParcelaSugerida {
  numero_parcela: number;
  numero_duplicata: string;
  valor_parcela: number;
  data_vencimento: string;
  tipo_documento: string;
  origem: 'XML' | 'ANTECIPADO';
}

interface ParcelasSugeridasResponse {
  success: boolean;
  data?: ParcelaSugerida[];
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ParcelasSugeridasResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId, ordemId } = req.query;

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

    const parcelasSugeridas: ParcelaSugerida[] = [];

    // 1. Buscar pagamento antecipado da ordem (orc_valor_entrada)
    if (ordemId && typeof ordemId === 'string') {
      console.log(`🔍 Buscando pagamento antecipado para ordem ${ordemId}`);

      const ordemResult = await client.query(`
        SELECT
          orc_valor_entrada,
          orc_valor_total
        FROM cmp_ordem_compra
        WHERE orc_id = $1
      `, [ordemId]);

      if (ordemResult.rows.length > 0) {
        const valorEntrada = parseFloat(ordemResult.rows[0].orc_valor_entrada || 0);
        const valorTotalOrdem = parseFloat(ordemResult.rows[0].orc_valor_total || 0);

        if (valorEntrada > 0) {
          console.log(`💰 Ordem tem pagamento antecipado: R$ ${valorEntrada.toFixed(2)}`);

          parcelasSugeridas.push({
            numero_parcela: 0,
            numero_duplicata: 'ANTECIPADO',
            valor_parcela: valorEntrada,
            data_vencimento: new Date().toISOString().split('T')[0], // Hoje
            tipo_documento: 'ANTECIPADO',
            origem: 'ANTECIPADO'
          });
        }

        // 2. Buscar parcelas do XML e calcular proporcionalmente
        console.log(`🔍 Buscando parcelas do XML para NFe ${nfeId}`);

        const parcelasXmlResult = await client.query(`
          SELECT
            ndup as numero_duplicata,
            dvencdup as data_vencimento,
            vdup as valor_centavos
          FROM dbnfe_ent_cobr
          WHERE codnfe_ent = $1
          ORDER BY dvencdup
        `, [nfeId]);

        if (parcelasXmlResult.rows.length > 0) {
          console.log(`📄 Encontradas ${parcelasXmlResult.rows.length} parcelas no XML`);

          // Buscar valor total da NFe
          const nfeResult = await client.query(`
            SELECT vnf FROM dbnfe_ent WHERE codnfe_ent = $1
          `, [nfeId]);

          const valorTotalNFe = nfeResult.rows.length > 0 ? parseFloat(nfeResult.rows[0].vnf || 0) : 0;

          if (valorTotalNFe > 0) {
            // Calcular proporção: valor_ordem / valor_nfe
            const proporcao = valorTotalOrdem / valorTotalNFe;
            console.log(`📊 Proporção da ordem: ${(proporcao * 100).toFixed(2)}% (R$ ${valorTotalOrdem.toFixed(2)} / R$ ${valorTotalNFe.toFixed(2)})`);

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
            });
          } else {
            console.log(`⚠️ Valor total da NFe não encontrado, usando valores absolutos do XML`);

            // Fallback: usar valores absolutos se não conseguir calcular proporção
            parcelasXmlResult.rows.forEach((row: any, index: number) => {
              const valorReais = parseFloat(row.valor_centavos) / 100;

              parcelasSugeridas.push({
                numero_parcela: index + 1,
                numero_duplicata: row.numero_duplicata || `PARC-${index + 1}`,
                valor_parcela: valorReais,
                data_vencimento: row.data_vencimento,
                tipo_documento: 'BOLETO',
                origem: 'XML'
              });
            });
          }
        } else {
          console.log(`ℹ️  Nenhuma parcela encontrada no XML`);
        }
      }
    }

    // Renumerar parcelas
    parcelasSugeridas.forEach((parcela, index) => {
      parcela.numero_parcela = index;
    });

    console.log(`✅ Total de ${parcelasSugeridas.length} parcela(s) sugerida(s)`);

    return res.status(200).json({
      success: true,
      data: parcelasSugeridas
    });

  } catch (err) {
    console.error('❌ Erro ao buscar parcelas sugeridas:', err);

    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar parcelas sugeridas'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
