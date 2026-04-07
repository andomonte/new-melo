// pages/api/cliente/exportar.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import ExcelJS from 'exceljs';
import { serializeBigInt } from '@/utils/serializeBigInt';

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
  nome_filial: 'f.nome_filial',
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
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const pool = getPgPool(filial);
  let client: PoolClient | undefined;
  const { colunas = [], filtros = {}, busca = '' } = req.body;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (busca) {
    whereClauses.push(`
      (
        c.codcli ILIKE $${params.length + 1}
        OR c.nome ILIKE $${params.length + 2}
        OR c.cpfcgc ILIKE $${params.length + 3}
      )
    `);
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
  } else {
    Object.entries(filtros).forEach(([key, value]) => {
      const coluna = filtroParaColunaSQL[key];
      if (coluna && value) {
        whereClauses.push(`${coluna} ILIKE $${params.length + 1}`);
        params.push(`%${value}%`);
      }
    });
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    client = await pool.connect();

    const dados = await client.query(
      `SELECT 
        c.codcli, c.nome, c.nomefant, c.cpfcgc, c.tipo, c.datacad, c.ender, c.bairro, c.cidade,
        c.uf, c.cep, c.iest, c.isuframa, c.imun, c.status, c.obs, c.tipoemp, c.debito, c.limite,
        c.contato, c.socios, c.icms, c.endercobr, c.cidadecobr, c.bairrocobr, c.ufcobr, c.cepcobr,
        c.claspgto, c.email, c.atraso, c.ipi, c.prvenda, c.tipocliente, c.codtmk, c.kickback,
        c.sit_tributaria, c.numero, c.referencia, c.numerocobr, c.referenciacobr, c.complemento,
        c.complementocobr, c.acrescimo, c.desconto, c.habilitasuframa, c.emailnfe, c.faixafin,
        c.codunico, c.bloquear_preco, c.local_entrega, c."REF", c."LOCAL", 
        c.est, c.reforiginal, c.dtprcompra, c.dtprvenda, c.dtprfabr, c.dtprimp, c.dtprconcor,
        c.dtcompra, c.dtvenda, c.dtinventario, c.dtprcustoatual,
        f.nome_filial AS nome_filial,
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
      LEFT JOIN tb_filial f ON c.codigo_filial::TEXT = f."codigo_filial"::TEXT
      ${whereString}
      ORDER BY c.codcli`,
      params,
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Clientes');

    worksheet.columns = colunas.map((coluna: string) => ({
      header: coluna,
      key: coluna,
      width: 30,
    }));

    const dadosSanitizados = serializeBigInt(dados.rows);

    dadosSanitizados.forEach((item: Record<string, any>) => {
      const rowData: Record<string, any> = {};
      colunas.forEach((coluna: string) => {
        rowData[coluna] = item[coluna] ?? '';
      });
      worksheet.addRow(rowData);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=clientes.xlsx');
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(buffer);
  } catch (error) {
    console.error('Erro ao exportar clientes:', error);
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
