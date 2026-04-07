import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { registrarHistoricoNfe } from '@/lib/nfe/historicoNfeHelper';

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
  xPed?: string;
  nItemPed?: string;
}

interface DadosCompra {
  xNEmp?: string;
  xPed?: string;
  xCont?: string;
  infCpl?: string;
}

interface ProcessarNFeResponse {
  success: boolean;
  message?: string;
  bloqueado?: boolean;
  processandoPor?: string;
  jaAssumida?: boolean;
  data?: {
    itens: NFeItemXML[];
    compra?: DadosCompra;
  };
}

/**
 * ENDPOINT COMBINADO: Assumir NFe + Extrair Dados XML
 *
 * Otimizacao: Une duas chamadas em uma unica, reduzindo:
 * - 2 round-trips de rede -> 1 round-trip
 * - 2 conexoes de pool -> 1 conexao
 * - Queries em paralelo onde possivel
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProcessarNFeResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { nfeId, userId, userName } = req.body;

  if (!nfeId) {
    return res.status(400).json({
      success: false,
      message: 'nfeId e obrigatorio'
    });
  }

  // Mock data para NFes de teste
  if (typeof nfeId === 'string' && (nfeId.startsWith('MOCK') || nfeId.startsWith('99'))) {
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
      }
    ];
    return res.status(200).json({
      success: true,
      jaAssumida: true,
      data: { itens: mockItens }
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // FASE 1: Verificar se NFe esta bloqueada (query rapida)
    const nfeStatusResult = await client.query(
      `SELECT processando_por, processando_nome, exec
       FROM dbnfe_ent WHERE codnfe_ent = $1`,
      [nfeId]
    );

    if (nfeStatusResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'NFe nao encontrada'
      });
    }

    const nfe = nfeStatusResult.rows[0];

    // Verificar bloqueio por outro usuario
    if (nfe.processando_por && nfe.processando_por !== userId) {
      return res.status(409).json({
        success: false,
        message: 'NFe ja esta sendo processada por outro usuario',
        processandoPor: nfe.processando_nome || nfe.processando_por,
        bloqueado: true
      });
    }

    const jaAssumida = nfe.processando_por === userId;

    // FASE 2: Assumir NFe (se necessario) + Buscar dados em PARALELO
    const promises: Promise<any>[] = [];

    // Flag para saber se adicionamos a promise de assumir
    const vaiAssumir = !jaAssumida && userId && userName;

    // Promise 1: Assumir NFe (se ainda nao assumida E tem userId/userName)
    if (vaiAssumir) {
      promises.push(
        Promise.all([
          client.query(
            `UPDATE dbnfe_ent
             SET processando_por = $1,
                 processando_nome = $2,
                 processando_desde = NOW()
             WHERE codnfe_ent = $3`,
            [userId, userName, nfeId]
          ),
          registrarHistoricoNfe(client, {
            codNfeEnt: parseInt(nfeId),
            tipoAcao: 'ASSUMIU_PROCESSAMENTO',
            previousStatus: nfe.exec,
            newStatus: nfe.exec,
            userId,
            userName,
            comments: { acao: 'Usuario assumiu o processamento da NFe' }
          })
        ])
      );
    }

    // Promise 2: Buscar dados da NFe (header)
    promises.push(
      client.query(`
        SELECT
          codnfe_ent,
          xnemp,
          xpedemp,
          xcontemp,
          infcpl
        FROM dbnfe_ent
        WHERE codnfe_ent = $1
      `, [nfeId])
    );

    // Promise 3: Buscar itens da NFe
    promises.push(
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
      `, [nfeId])
    );

    // Executar todas as queries em paralelo
    const results = await Promise.all(promises);

    // Extrair resultados (indices dependem se adicionou promise de assumir)
    // Se vaiAssumir: [assumir, nfeData, itens] -> indices 1 e 2
    // Se nao vaiAssumir: [nfeData, itens] -> indices 0 e 1
    const nfeDataResult = vaiAssumir ? results[1] : results[0];
    const itensResult = vaiAssumir ? results[2] : results[1];

    // Montar dados de compra
    let dadosCompra: DadosCompra | undefined;
    if (nfeDataResult.rows.length > 0) {
      const nfeData = nfeDataResult.rows[0];
      dadosCompra = {};
      if (nfeData.xnemp) dadosCompra.xNEmp = nfeData.xnemp;
      if (nfeData.xpedemp) dadosCompra.xPed = nfeData.xpedemp;
      if (nfeData.xcontemp) dadosCompra.xCont = nfeData.xcontemp;
      if (nfeData.infcpl) dadosCompra.infCpl = nfeData.infcpl;
      if (Object.keys(dadosCompra).length === 0) dadosCompra = undefined;
    }

    // Verificar se encontrou itens
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
      descricao: row.descricao || 'PRODUTO SEM DESCRICAO',
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

    console.log(`Processado NFe ${nfeId}: ${itens.length} itens, assumida=${vaiAssumir ? 'agora' : (jaAssumida ? 'antes' : 'nao')}`);

    return res.status(200).json({
      success: true,
      jaAssumida,
      data: {
        itens,
        compra: dadosCompra
      }
    });

  } catch (err) {
    console.error('Erro ao processar NFe:', err);
    return res.status(500).json({
      success: false,
      message: 'Falha ao processar NFe'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
