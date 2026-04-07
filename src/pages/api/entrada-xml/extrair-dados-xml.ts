import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface ExtrairDadosXMLRequest {
  nfe_id: string;
}

interface NFeItemXML {
  id: string;
  codigo_produto: string;
  descricao: string;
  codigo_barras?: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  produto_sugerido?: any;
  // Campos para associação com ordem de compra
  xPed?: string;     // Número do pedido (campo <xPed> do XML)
  nItemPed?: string; // Item do pedido (campo <nItemPed> do XML)
}

interface DadosCompra {
  xNEmp?: string;   // Nota de Empenho
  xPed?: string;    // Pedido
  xCont?: string;   // Contrato
  infCpl?: string;  // Informações complementares (pode conter O.C., N.PEDIDO, etc)
}

interface ExtrairDadosXMLResponse {
  success: boolean;
  data?: {
    itens: NFeItemXML[];
    compra?: DadosCompra;
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExtrairDadosXMLResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfe_id }: ExtrairDadosXMLRequest = req.body;

  if (!nfe_id) {
    return res.status(400).json({
      success: false,
      message: 'NFE ID é obrigatório'
    });
  }

  // Fallback para dados mock apenas para NFes de teste
  if (typeof nfe_id === 'string' && (nfe_id.startsWith('MOCK') || nfe_id.startsWith('99'))) {
    console.log('Usando dados mock para NFe de teste:', nfe_id);
    const mockItens: NFeItemXML[] = [
      {
        id: '1',
        codigo_produto: '',
        descricao: 'ALTO-FALANTE P4X 69 TOYOTA',
        codigo_barras: '85182100',
        ncm: '85182100',
        cfop: '6949',
        unidade: 'P',
        quantidade: 2,
        valor_unitario: 84.90,
        valor_total: 169.80
      },
      {
        id: '2',
        codigo_produto: '',
        descricao: 'PRODUTO TESTE 2',
        codigo_barras: '12345678',
        ncm: '84159000',
        cfop: '6949',
        unidade: 'P',
        quantidade: 5,
        valor_unitario: 45.00,
        valor_total: 225.00
      }
    ];
    return res.status(200).json({ success: true, data: { itens: mockItens } });
  }

  let client;

  try {
    console.log('Extraindo dados do XML para NFe:', nfe_id);

    const pgPool = getPgPool('manaus');
    client = await pgPool.connect();
    await client.query('SET search_path TO db_manaus');

    // OTIMIZADO: Buscar NFe header e itens em PARALELO
    const [nfeResult, itensResult] = await Promise.all([
      // Query 1: Dados da NFe (header)
      client.query(`
        SELECT
          codnfe_ent,
          chave,
          nnf,
          serie,
          xnemp,
          xpedemp,
          xcontemp,
          infcpl
        FROM dbnfe_ent
        WHERE codnfe_ent = $1
      `, [nfe_id]),

      // Query 2: Itens da NFe com código de barras (se disponível)
      client.query(`
        SELECT
          d.nitem,
          d.cprod as codigo_produto,
          d.xprod as descricao,
          d.ncm,
          d.cfop,
          d.ucom as unidade,
          d.qcom::numeric as quantidade,
          d.vuncom::numeric as valor_unitario,
          d.vprod::numeric as valor_total,
          COALESCE(p.codbar, '') as codigo_barras,
          d.xped,
          d.nitemped
        FROM dbnfe_ent_det d
        LEFT JOIN dbprod p ON d.cprod = p.codprod
        WHERE d.codnfe_ent = $1
        ORDER BY d.nitem
      `, [nfe_id])
    ]);

    // Montar dados de compra se existirem
    let dadosCompra: DadosCompra | undefined;
    if (nfeResult.rows.length > 0) {
      const nfeData = nfeResult.rows[0];
      dadosCompra = {};
      if (nfeData.xnemp) dadosCompra.xNEmp = nfeData.xnemp;
      if (nfeData.xpedemp) dadosCompra.xPed = nfeData.xpedemp;
      if (nfeData.xcontemp) dadosCompra.xCont = nfeData.xcontemp;
      if (nfeData.infcpl) dadosCompra.infCpl = nfeData.infcpl;

      // Limpar objeto vazio
      if (Object.keys(dadosCompra).length === 0) dadosCompra = undefined;
    }

    // Se não encontrou itens, retornar erro
    if (itensResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum item encontrado para esta NFe'
      });
    }

    // Mapear itens
    const itens: NFeItemXML[] = itensResult.rows.map((row: any) => ({
      id: row.nitem?.toString() || '1',
      codigo_produto: row.codigo_produto || '',
      descricao: row.descricao || 'PRODUTO SEM DESCRIÇÃO',
      codigo_barras: row.codigo_barras || '',
      ncm: row.ncm || '',
      cfop: row.cfop?.toString() || '',
      unidade: row.unidade || 'UN',
      quantidade: parseFloat(row.quantidade) || 1,
      valor_unitario: parseFloat(row.valor_unitario) || 0,
      valor_total: parseFloat(row.valor_total) || 0,
      xPed: row.xped || undefined,
      nItemPed: row.nitemped || undefined
    }));

    console.log(`Extraídos ${itens.length} itens da NFe ${nfe_id}`);

    return res.status(200).json({
      success: true,
      data: {
        itens,
        compra: dadosCompra
      }
    });

  } catch (err) {
    console.error('Erro ao extrair dados do XML:', err);

    return res.status(500).json({
      success: false,
      message: 'Falha ao extrair dados do XML'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}