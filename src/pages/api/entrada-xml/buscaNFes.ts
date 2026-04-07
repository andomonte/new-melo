import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

// Mapeamento das colunas para filtros de NFe
// Usa os mesmos nomes de campo do colunasDbNFe.ts
const filtroParaColunaSQL: Record<string, string> = {
  // Campos principais
  numeroNF: 'n.nnf',
  serie: 'n.serie',
  chaveNFe: 'n.chave',
  emitente: 'e.xnome',
  fornecedorCnpj: 'e.cpf_cnpj',
  dataEmissao: 'n.demi',
  dataUpload: 'n.dtimport',
  valorTotal: 'n.vnf',
  status: 'n.exec',

  // Campos secundarios
  natOperacao: 'n.natop',
  modelo: 'n.mod',
  versao: 'n.versao',
  protocolo: 'n.nprot',
  totalProdutos: 'n.vprod',
  totalIcms: 'n.vicms',
  totalIpi: 'n.vipi',
  pesoLiquido: 'n.pesol',
  pesoBruto: 'n.pesob',
  tipoFrete: 'n.modfrete',
};

// Mapeamento de status legivel para codigo do banco
const statusParaCodigo: Record<string, string> = {
  'recebida': 'R',
  'processada': 'S',
  'em_andamento': 'A',
  'em andamento': 'A',
  'associacao_concluida': 'C',
  'erro': 'N',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { page = 1, perPage = 10, filtros = [], search = '' } = req.body;
  const offset = (Number(page) - 1) * Number(perPage);
  const limit = Number(perPage);

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'manaus';

  const params: any[] = [];
  const whereGroups: string[] = [];

  // Busca geral (search)
  if (search && typeof search === 'string' && search.trim()) {
    params.push(`%${search.trim()}%`);
    whereGroups.push(`(
      n.nnf::text ILIKE $${params.length} OR
      n.serie::text ILIKE $${params.length} OR
      n.chave ILIKE $${params.length} OR
      e.xnome ILIKE $${params.length}
    )`);
  }

  // Agrupa filtros pelo campo
  const filtrosAgrupados: Record<string, { tipo: string; valor: string }[]> = {};

  filtros.forEach((filtro: { campo: string; tipo: string; valor: string }) => {
    if (!filtrosAgrupados[filtro.campo]) {
      filtrosAgrupados[filtro.campo] = [];
    }
    filtrosAgrupados[filtro.campo].push({
      tipo: filtro.tipo,
      valor: filtro.valor,
    });
  });

  // Para cada campo agrupado
  Object.entries(filtrosAgrupados).forEach(([campo, filtrosDoCampo]) => {
    const coluna = filtroParaColunaSQL[campo];
    if (!coluna) {
      console.log(`Campo ${campo} nao mapeado para SQL, ignorando`);
      return;
    }

    // Identificar tipos de campo
    const camposData = ['dataEmissao', 'dataUpload'];
    const camposNumerico = ['numeroNF', 'serie', 'valorTotal', 'totalProdutos', 'totalIcms', 'totalIpi', 'pesoLiquido', 'pesoBruto'];
    const operadoresTextuais = ['contém', 'começa', 'termina'];

    const isCampoData = camposData.includes(campo);
    const isCampoNumerico = camposNumerico.includes(campo);
    const isCampoStatus = campo === 'status';

    const filtrosCampoSQL: string[] = [];

    filtrosDoCampo.forEach((filtro) => {
      let operador = 'ILIKE';
      let valor: any = filtro.valor;

      // Tratamento especial para status
      if (isCampoStatus) {
        const valorLower = String(valor).toLowerCase().trim();
        const codigoStatus = statusParaCodigo[valorLower];
        if (codigoStatus) {
          valor = codigoStatus;
        }
      }

      // Converter DD/MM/YYYY para YYYY-MM-DD para campos de data (apenas operadores nao-textuais)
      if (isCampoData && filtro.valor && !operadoresTextuais.includes(filtro.tipo)) {
        const dateValue = String(filtro.valor).trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          valor = `${year}-${month}-${day}`;
        } else if (/^\d{2}\/\d{2}$/.test(dateValue)) {
          const currentYear = new Date().getFullYear();
          const [day, month] = dateValue.split('/');
          valor = `${currentYear}-${month}-${day}`;
        }
      }

      switch (filtro.tipo) {
        case 'igual':
          if (isCampoData && !operadoresTextuais.includes('igual')) {
            operador = '=';
            valor = String(valor);
          } else {
            operador = '=';
            valor = String(valor);
          }
          break;
        case 'diferente':
          operador = '<>';
          valor = String(valor);
          break;
        case 'maior':
          operador = '>';
          valor = String(valor);
          break;
        case 'maior_igual':
          operador = '>=';
          valor = String(valor);
          break;
        case 'menor':
          operador = '<';
          valor = String(valor);
          break;
        case 'menor_igual':
          operador = '<=';
          valor = String(valor);
          break;
        case 'contém':
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY\') ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else {
            operador = 'ILIKE';
            valor = `%${String(filtro.valor)}%`;
          }
          break;
        case 'começa':
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY\') ILIKE';
            valor = `${String(filtro.valor)}%`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
            valor = `${String(filtro.valor)}%`;
          } else {
            operador = 'ILIKE';
            valor = `${String(filtro.valor)}%`;
          }
          break;
        case 'termina':
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY\') ILIKE';
            valor = `%${String(filtro.valor)}`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
            valor = `%${String(filtro.valor)}`;
          } else {
            operador = 'ILIKE';
            valor = `%${String(filtro.valor)}`;
          }
          break;
        case 'nulo':
          filtrosCampoSQL.push(`${coluna} IS NULL`);
          return;
        case 'nao_nulo':
          filtrosCampoSQL.push(`${coluna} IS NOT NULL`);
          return;
        default:
          // Default: contem
          if (isCampoData) {
            operador = 'TO_CHAR(COLUMN, \'DD/MM/YYYY\') ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else if (isCampoNumerico) {
            operador = 'CAST(COLUMN AS TEXT) ILIKE';
            valor = `%${String(filtro.valor)}%`;
          } else {
            operador = 'ILIKE';
            valor = `%${String(filtro.valor)}%`;
          }
          break;
      }

      // Tratar operadores especiais que precisam substituir COLUMN
      if (operador.includes('COLUMN')) {
        const queryFinal = operador.replace(/COLUMN/g, coluna);
        filtrosCampoSQL.push(`${queryFinal} $${params.length + 1}`);
      } else {
        filtrosCampoSQL.push(`${coluna} ${operador} $${params.length + 1}`);
      }
      params.push(valor);
    });

    // Junta todos os filtros do mesmo campo com OR
    if (filtrosCampoSQL.length > 0) {
      whereGroups.push(`(${filtrosCampoSQL.join(' OR ')})`);
    }
  });

  const whereString = whereGroups.length > 0 ? `WHERE ${whereGroups.join(' AND ')}` : '';

  const pool = getPgPool(filial);
  let client;

  try {
    client = await pool.connect();

    // Query principal com JOINs para dados relacionados
    const query = `
      SELECT
        n.codnfe_ent, n.chave, n.versao, n.cuf, n.serie, n.nnf, n.demi,
        n.dtimport, n.vnf, n.vprod, n.vfrete, n.vseg, n.vdesc, n.vipi,
        n.vpis, n.vcofins, n.voutro, n.pesol, n.pesob, n.exec, n.nprot,
        n.natop, n.finnfe, n.qvol, n.vicms, n.vbc, n.vst, n.vbcst, n.vii,
        n.processando_por, n.processando_nome, n.processando_desde,
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
      ${whereString}
      ORDER BY n.dtimport DESC, n.demi DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    console.log('DEBUG - Query NFes com filtros:', query);
    console.log('DEBUG - Parametros NFes:', params);

    const result = await client.query(query, params);

    // Query para contar total (sem limit/offset)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbnfe_ent n
      LEFT JOIN dbnfe_ent_emit e ON n.codnfe_ent = e.codnfe_ent
      ${whereString}
    `;

    const countResult = await client.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total) || 0;

    // Mapear dados para o formato esperado pelo frontend
    const nfesFormatted = result.rows.map((nfe: any) => {
      let status = 'RECEBIDA';
      if (nfe.exec === 'S') {
        status = 'PROCESSADA';
      } else if (nfe.exec === 'A') {
        status = 'EM_ANDAMENTO';
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
        processandoPor: nfe.processando_por || null,
        processandoNome: nfe.processando_nome || null,
        processandoDesde: nfe.processando_desde
          ? new Date(nfe.processando_desde).toISOString()
          : null,
      };
    });

    const meta = {
      total,
      currentPage: Number(page),
      page: Number(page),
      lastPage: Math.ceil(total / Number(perPage)) || 1,
      perPage: Number(perPage),
    };

    console.log('DEBUG - Resultado filtros NFes:', {
      totalItems: nfesFormatted.length,
      totalGeral: total,
      meta
    });

    return res.status(200).json({
      success: true,
      data: nfesFormatted,
      meta,
    });

  } catch (error) {
    console.error('Erro ao buscar NFes com filtros:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
