import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

// Mapeamento das colunas
const filtroParaColunaSQL: Record<string, string> = {
  codcli: 'c.codcli',
  nome: 'c.nome',
  nomefant: 'c.nomefant',
  cpfcgc: 'c.cpfcgc',
  tipo: 'c.tipo',
  cidade: 'c.cidade',
  email: 'c.email',
  nome_vendedor: 'v.nome',
  nome_pais: 'p.descricao',
  nome_municipio: 'm.descricao',
  nome_banco: 'bc.nome',
  nome_bairro: 'b.descr',
  nome_bairro_cobr: 'bcobr.descr',
  nome_pais_cobr: 'pcobr.descricao',
  nome_municipio_cobr: 'mcobr.descricao',
  nome_classe: 'cla.descr',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não definida no cookie.' });
  }

  const pool = getPgPool(filial);
  let client: PoolClient | undefined;
  const { page = 1, perPage = 10, filtros = [] } = req.body;
  const offset = (Number(page) - 1) * Number(perPage);
  const limit = Number(perPage);

  const params: any[] = [];
  const whereGroups: string[] = [];

  // Agrupa filtros pelo campo
  const filtrosAgrupados: Record<string, { tipo: string; valor: string }[]> =
    {};

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
    if (!coluna) return;

    const filtrosCampoSQL: string[] = [];

    filtrosDoCampo.forEach((filtro) => {
      let operador = 'ILIKE';
      let valor = '';

      switch (filtro.tipo) {
        case 'igual':
          operador = '=';
          valor = String(filtro.valor);
          break;
        case 'diferente':
          operador = '<>';
          valor = String(filtro.valor);
          break;
        case 'maior':
          operador = '>';
          valor = String(filtro.valor);
          break;
        case 'maior_igual':
          operador = '>=';
          valor = String(filtro.valor);
          break;
        case 'menor':
          operador = '<';
          valor = String(filtro.valor);
          break;
        case 'menor_igual':
          operador = '<=';
          valor = String(filtro.valor);
          break;
        case 'contém':
          operador = 'ILIKE';
          valor = `%${String(filtro.valor)}%`;
          break;
        case 'começa':
          operador = 'ILIKE';
          valor = `${String(filtro.valor)}%`;
          break;
        case 'termina':
          operador = 'ILIKE';
          valor = `%${String(filtro.valor)}`;
          break;
        case 'nulo':
          filtrosCampoSQL.push(`${coluna} IS NULL`);
          return;
        case 'nao_nulo':
          filtrosCampoSQL.push(`${coluna} IS NOT NULL`);
          return;
        default:
          return;
      }

      filtrosCampoSQL.push(`${coluna} ${operador} $${params.length + 1}`);
      params.push(valor);
    });

    // Junta todos os filtros do mesmo campo com OR
    if (filtrosCampoSQL.length > 0) {
      whereGroups.push(`(${filtrosCampoSQL.join(' OR ')})`);
    }
  });

  const whereString =
    whereGroups.length > 0 ? `WHERE ${whereGroups.join(' AND ')}` : '';

  try {
    client = await pool.connect();

    const data = await client.query(
      `SELECT 
        c.codcli, c.nome, c.nomefant, c.cpfcgc, c.tipo, c.datacad, c.ender, c.bairro, c.cidade,
        c.uf, c.cep, c.iest, c.isuframa, c.imun, c.status, c.obs, c.tipoemp, c.debito, c.limite,
        c.contato, c.socios, c.icms, c.endercobr, c.cidadecobr, c.bairrocobr, c.ufcobr, c.cepcobr,
        c.claspgto, c.email, c.atraso, c.ipi, c.prvenda, c.tipocliente, c.codtmk, c.kickback,
        c.sit_tributaria, c.numero, c.referencia, c.numerocobr, c.referenciacobr, c.complemento,
        c.complementocobr, c.acrescimo, c.desconto, c.habilitasuframa, c.emailnfe, c.faixafin,
        c.codunico, c.bloquear_preco, c.local_entrega, c."REF", c."LOCAL", c.codvend, c.codpais, c.codpaiscobr,
        c.est, c.reforiginal, c.dtprcompra, c.dtprvenda, c.dtprfabr, c.dtprimp, c.dtprconcor,
        c.dtcompra, c.dtvenda, c.dtinventario, c.dtprcustoatual,
    
        p.descricao AS nome_pais,
        pcobr.descricao AS nome_pais_cobr,
        m.descricao AS nome_municipio,
        mcobr.descricao AS nome_municipio_cobr,
        v.nome AS nome_vendedor,
        bc.nome AS nome_banco,
        b.descr AS nome_bairro,
        bcobr.descr AS nome_bairro_cobr,
        cla.descr AS nome_classe
      FROM dbclien c
      LEFT JOIN dbpais p ON c.codpais = p.codpais
      LEFT JOIN dbpais pcobr ON c.codpaiscobr = pcobr.codpais
      LEFT JOIN dbmunicipio m ON c.codmunicipio = m.codmunicipio
      LEFT JOIN dbmunicipio mcobr ON c.codmunicipiocobr = mcobr.codmunicipio
      LEFT JOIN dbvend v ON c.codvend = v.codvend
      LEFT JOIN dbbanco_cobranca bc ON c.banco = bc.banco
      LEFT JOIN dbbairro b ON c.codbairro = b.codbairro
      LEFT JOIN dbbairro bcobr ON c.codbairrocobr = bcobr.codbairro
      LEFT JOIN dbcclien cla ON c.codcc = cla.codcc
     

      ${whereString}
      ORDER BY c.codcli
      LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const totalResult = await client.query(
      `SELECT COUNT(*) FROM dbclien c
      LEFT JOIN dbpais p ON c.codpais = p.codpais
      LEFT JOIN dbpais pcobr ON c.codpaiscobr = pcobr.codpais
      LEFT JOIN dbmunicipio m ON c.codmunicipio = m.codmunicipio
      LEFT JOIN dbmunicipio mcobr ON c.codmunicipiocobr = mcobr.codmunicipio
      LEFT JOIN dbvend v ON c.codvend = v.codvend
      LEFT JOIN dbbanco_cobranca bc ON c.banco = bc.banco
      LEFT JOIN dbbairro b ON c.codbairro = b.codbairro
      LEFT JOIN dbbairro bcobr ON c.codbairrocobr = bcobr.codbairro
      LEFT JOIN dbcclien cla ON c.codcc = cla.codcc
      ${whereString}`,
      params,
    );

    const total = parseInt(totalResult.rows[0].count || '0', 10);

    res.status(200).json({
      data: serializeBigInt(data.rows),
      meta: {
        total,
        lastPage: total > 0 ? Math.ceil(total / Number(perPage)) : 1,
        currentPage: total > 0 ? Number(page) : 1,
        perPage: Number(perPage),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
