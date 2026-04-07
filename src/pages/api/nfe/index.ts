import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient'; // Mudar para o cliente pg

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'manaus'; // Usar um filial padrão

  const {
    page = 1,
    perPage = 10,
    search = '',
    status = '',
    fornecedor = '',
    numeroNfe = '',
    serieNfe = '',
    chaveNfe = '',
    dataInicio = '',
    dataFim = '',
    valorMinimo = '',
    valorMaximo = '',
    temAssociacao = ''
  } = req.query;

  const pool = getPgPool(filial);
  let client;

  try {
    client = await pool.connect();

    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Busca geral (search)
    if (search) {
      conditions.push(`(
        n.nnf::text ILIKE $${paramIndex} OR
        n.serie::text ILIKE $${paramIndex} OR
        n.chave ILIKE $${paramIndex} OR
        e.xnome ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Filtro por fornecedor (nome ou CNPJ)
    if (fornecedor) {
      conditions.push(`(e.xnome ILIKE $${paramIndex} OR e.cpf_cnpj ILIKE $${paramIndex})`);
      params.push(`%${fornecedor}%`);
      paramIndex++;
    }

    // Filtro por número da NFe
    if (numeroNfe) {
      conditions.push(`n.nnf::text = $${paramIndex}`);
      params.push(numeroNfe);
      paramIndex++;
    }

    // Filtro por série
    if (serieNfe) {
      conditions.push(`n.serie::text = $${paramIndex}`);
      params.push(serieNfe);
      paramIndex++;
    }

    // Filtro por chave de acesso
    if (chaveNfe) {
      conditions.push(`n.chave ILIKE $${paramIndex}`);
      params.push(`%${chaveNfe}%`);
      paramIndex++;
    }

    // Filtro por data de emissão - início
    if (dataInicio) {
      conditions.push(`n.demi >= $${paramIndex}::date`);
      params.push(dataInicio);
      paramIndex++;
    }

    // Filtro por data de emissão - fim
    if (dataFim) {
      conditions.push(`n.demi <= $${paramIndex}::date`);
      params.push(dataFim);
      paramIndex++;
    }

    // Filtro por valor mínimo
    if (valorMinimo) {
      conditions.push(`n.vnf >= $${paramIndex}::numeric`);
      params.push(valorMinimo);
      paramIndex++;
    }

    // Filtro por valor máximo
    if (valorMaximo) {
      conditions.push(`n.vnf <= $${paramIndex}::numeric`);
      params.push(valorMaximo);
      paramIndex++;
    }

    // Filtro por status (pode ser array separado por vírgula)
    if (status) {
      const statusArray = String(status).split(',').filter(s => s.trim());
      if (statusArray.length > 0) {
        const statusConditions: string[] = [];

        for (const s of statusArray) {
          if (s === 'RECEBIDA') statusConditions.push("n.exec = 'R'");
          else if (s === 'PROCESSADA') statusConditions.push("n.exec = 'S'");
          else if (s === 'EM_ANDAMENTO') statusConditions.push("n.exec = 'A'");
          else if (s === 'ASSOCIACAO_CONCLUIDA') statusConditions.push("n.exec = 'C'");
          else if (s === 'ERRO') statusConditions.push("(n.exec = 'N' AND n.nprot IS NULL)");
        }

        if (statusConditions.length > 0) {
          conditions.push(`(${statusConditions.join(' OR ')})`);
        }
      }
    }

    // Filtro por associação
    if (temAssociacao === 'true') {
      conditions.push(`EXISTS (
        SELECT 1 FROM dbnfe_ent_item i
        WHERE i.codnfe_ent = n.codnfe_ent AND i.cod_cadastro IS NOT NULL
      )`);
    } else if (temAssociacao === 'false') {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM dbnfe_ent_item i
        WHERE i.codnfe_ent = n.codnfe_ent AND i.cod_cadastro IS NOT NULL
      )`);
    }

    const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const nfesQuery = `
      SELECT
        n.codnfe_ent, n.chave, n.versao, n.cuf, n.serie, n.nnf, n.demi,
        n.dtimport, n.vnf, n.vprod, n.vfrete, n.vseg, n.vdesc, n.vipi,
        n.vpis, n.vcofins, n.voutro, n.pesol, n.pesob, n.exec, n.nprot,
        n.natop, n.finnfe, n.qvol, n.vicms, n.vbc, n.vst, n.vbcst, n.vii,
        n.processando_por, n.processando_nome, n.processando_desde,
        COALESCE(n.pagamento_configurado, false) as pagamento_configurado,
        e.xnome as emitente_nome, e.cpf_cnpj as emitente_cnpj, e.ie as emitente_ie,
        e.xlgr as emitente_logradouro, e.xbairro as emitente_bairro,
        e.xmun as emitente_municipio, e.uf as emitente_uf, e.cep as emitente_cep,
        e.nro as emitente_numero,
        t.xnome as transportadora_nome, t.cpf_cnpj as transportadora_cnpj,
        t.ie as transportadora_ie, t.xender as transportadora_endereco,
        t.xmun as transportadora_municipio, t.uf as transportadora_uf,
        t.placa as transportadora_placa
      FROM dbnfe_ent n
      LEFT JOIN dbnfe_ent_emit e ON n.codnfe_ent = e.codnfe_ent
      LEFT JOIN dbnfe_ent_tran t ON n.codnfe_ent = t.codnfe_ent
      ${whereSQL}
      ORDER BY n.dtimport DESC, n.demi DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbnfe_ent n
      LEFT JOIN dbnfe_ent_emit e ON n.codnfe_ent = e.codnfe_ent
      ${whereSQL}
    `;

    const nfesResult = await client.query(nfesQuery, [...params, limit, offset]);
    const countResult = await client.query(countQuery, params);
    
    const nfes = nfesResult.rows;
    const count = Number(countResult.rows[0]?.total) || 0;

    const nfesFormatted = nfes.map((nfe: any) => {
      // Mapear status seguindo o mesmo padrão de nfes-processadas.ts
      let status = 'RECEBIDA';
      if (nfe.exec === 'S') {
        status = 'PROCESSADA';
      } else if (nfe.exec === 'A') {
        status = 'EM_ANDAMENTO'; // FIXED: Era EM_PROCESSAMENTO
      } else if (nfe.exec === 'C') {
        status = 'ASSOCIACAO_CONCLUIDA';
      } else if (nfe.exec === 'R') {
        status = 'RECEBIDA';
      } else if (!nfe.nprot) {
        status = 'ERRO';
      }

      return {
        id: nfe.codnfe_ent,
        numeroNF: nfe.nnf ? nfe.nnf.toString() : '',
        serie: nfe.serie ? nfe.serie.toString() : '',
        chaveNFe: nfe.chave || '',
        versao: nfe.versao || '4.00',
        cuf: nfe.cuf || 0,
        protocolo: nfe.nprot || '',
        naturezaOperacao: nfe.natop || '',
        finalidadeNFe: nfe.finnfe || 1,
        emitente: nfe.emitente_nome || 'N/A',
        cnpjEmitente: nfe.emitente_cnpj || '',
        emitenteIE: nfe.emitente_ie || '',
        emitenteLogradouro: nfe.emitente_logradouro || '',
        emitenteNumero: nfe.emitente_numero || '',
        emitenteBairro: nfe.emitente_bairro || '',
        emitenteMunicipio: nfe.emitente_municipio || '',
        emitenteUf: nfe.emitente_uf || '',
        emitenteCep: nfe.emitente_cep || '',
        transportadora: nfe.transportadora_nome || '',
        cnpjTransportadora: nfe.transportadora_cnpj || '',
        transportadoraIE: nfe.transportadora_ie || '',
        transportadoraEndereco: nfe.transportadora_endereco || '',
        transportadoraMunicipio: nfe.transportadora_municipio || '',
        transportadoraUf: nfe.transportadora_uf || '',
        transportadoraPlaca: nfe.transportadora_placa || '',
        modalidadeFrete: 0,
        dataEmissao: nfe.demi ? new Date(nfe.demi).toISOString() : '',
        dataUpload: nfe.dtimport ? new Date(nfe.dtimport).toISOString() : '',
        valorTotal: nfe.vnf ? Number(nfe.vnf.toString()) : 0,
        valorProdutos: nfe.vprod ? Number(nfe.vprod.toString()) : 0,
        valorFrete: nfe.vfrete ? Number(nfe.vfrete.toString()) : 0,
        valorSeguro: nfe.vseg ? Number(nfe.vseg.toString()) : 0,
        valorDesconto: nfe.vdesc ? Number(nfe.vdesc.toString()) : 0,
        valorIPI: nfe.vipi ? Number(nfe.vipi.toString()) : 0,
        valorPIS: nfe.vpis ? Number(nfe.vpis.toString()) : 0,
        valorCOFINS: nfe.vcofins ? Number(nfe.vcofins.toString()) : 0,
        valorOutros: nfe.voutro ? Number(nfe.voutro.toString()) : 0,
        valorICMS: nfe.vicms ? Number(nfe.vicms.toString()) : 0,
        valorBaseICMS: nfe.vbc ? Number(nfe.vbc.toString()) : 0,
        valorICMSST: nfe.vst ? Number(nfe.vst.toString()) : 0,
        valorBaseICMSST: nfe.vbcst ? Number(nfe.vbcst.toString()) : 0,
        valorII: nfe.vii ? Number(nfe.vii.toString()) : 0,
        pesoLiquido: nfe.pesol ? Number(nfe.pesol.toString()) : 0,
        pesoBruto: nfe.pesob ? Number(nfe.pesob.toString()) : 0,
        quantidadeVolumes: nfe.qvol ? Number(nfe.qvol.toString()) : 0,
        status,
        itens: [],
        // Campos de controle de processamento por usuario
        processandoPor: nfe.processando_por || null,
        processandoNome: nfe.processando_nome || null,
        processandoDesde: nfe.processando_desde
          ? new Date(nfe.processando_desde).toISOString()
          : null,
        // Pagamento configurado
        pagamentoConfigurado: nfe.pagamento_configurado === true,
      };
    });

    res.status(200).json({
      success: true,
      data: nfesFormatted,
      meta: {
        total: count,
        lastPage: count > 0 ? Math.ceil(count / Number(perPage)) : 1,
        page: Number(page),
        perPage: Number(perPage),
      },
    });
  } catch (error) {
    console.error('Erro ao carregar NFes:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  } finally {
    if (client) {
      client.release();
    }
  }
}