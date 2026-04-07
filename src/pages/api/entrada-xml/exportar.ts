import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import ExcelJS from 'exceljs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo nao permitido' });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    const { colunas: colunasRaw = [], filtros = [], search = '' } = req.body;

    // Filtrar colunas invalidas
    const colunasInvalidas = ['selecionar', 'SELECIONAR', 'AÇÕES', 'ações', 'acoes'];
    const colunas = colunasRaw.filter((c: string) => !colunasInvalidas.includes(c));

    // Query para buscar NFes
    let query = `
      SELECT
        n.codnfe_ent as id,
        n.nnf as numero_nfe,
        n.serie as serie,
        n.chave as chave_nfe,
        n.demi as data_emissao,
        n.dtimport as data_upload,
        e.xnome as emitente,
        e.cpf_cnpj as cnpj_fornecedor,
        n.natop as natureza_operacao,
        n.vnf as valor_total,
        n.vprod as total_produtos,
        n.vicms as total_icms,
        n.vipi as total_ipi,
        n.versao,
        n.nprot as protocolo,
        n.exec as status_exec,
        CASE
          WHEN n.exec = 'S' THEN 'Entrada Gerada'
          WHEN n.exec = 'A' THEN 'Em Andamento'
          WHEN n.exec = 'C' THEN 'Associada'
          WHEN n.exec = 'R' THEN 'Recebida'
          ELSE 'Recebida'
        END as status
      FROM dbnfe_ent n
      LEFT JOIN dbnfe_ent_emit e ON n.codnfe_ent = e.codnfe_ent
      WHERE n.codnfe_ent ~ '^[0-9]+$'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Busca global
    if (search?.trim()) {
      query += ` AND (
        LOWER(n.chave) LIKE LOWER($${paramIndex}) OR
        LOWER(n.nnf::text) LIKE LOWER($${paramIndex}) OR
        LOWER(e.xnome) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Filtros especificos
    if (Array.isArray(filtros)) {
      filtros.forEach((filtro: any) => {
        if (filtro.campo && filtro.valor) {
          const campo = mapearCampoParaDB(filtro.campo);
          if (campo) {
            switch (filtro.tipo) {
              case 'igual':
                query += ` AND ${campo} = $${paramIndex}`;
                params.push(filtro.valor);
                break;
              case 'contém':
                query += ` AND LOWER(${campo}::text) LIKE LOWER($${paramIndex})`;
                params.push(`%${filtro.valor}%`);
                break;
              case 'começa':
                query += ` AND LOWER(${campo}::text) LIKE LOWER($${paramIndex})`;
                params.push(`${filtro.valor}%`);
                break;
              case 'termina':
                query += ` AND LOWER(${campo}::text) LIKE LOWER($${paramIndex})`;
                params.push(`%${filtro.valor}`);
                break;
            }
            paramIndex++;
          }
        }
      });
    }

    query += ` ORDER BY n.dtimport DESC LIMIT 5000`;

    console.log('Exportando NFes - Query:', query.substring(0, 200));

    const result = await client.query(query, params);
    const dados = result.rows;

    console.log('Total de registros para exportar:', dados.length);

    // Criar workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('NFes');

    // Mapeamento de colunas
    const colunasFriendly: Record<string, string> = {
      numeroNF: 'Numero NFe',
      serie: 'Serie',
      chaveNFe: 'Chave NFe',
      emitente: 'Emitente',
      dataEmissao: 'Data Emissao',
      dataUpload: 'Data Upload',
      valorTotal: 'Valor Total',
      status: 'Status',
      fornecedorCnpj: 'CNPJ Fornecedor',
      natOperacao: 'Natureza Operacao',
      totalProdutos: 'Total Produtos',
      totalIcms: 'Total ICMS',
      totalIpi: 'Total IPI',
      versao: 'Versao',
      protocolo: 'Protocolo'
    };

    // Mapeamento de campos do frontend para banco
    const colunaParaCampo: Record<string, string> = {
      numeroNF: 'numero_nfe',
      chaveNFe: 'chave_nfe',
      dataEmissao: 'data_emissao',
      dataUpload: 'data_upload',
      valorTotal: 'valor_total',
      fornecedorCnpj: 'cnpj_fornecedor',
      natOperacao: 'natureza_operacao',
      totalProdutos: 'total_produtos',
      totalIcms: 'total_icms',
      totalIpi: 'total_ipi'
    };

    // Definir colunas para exportacao
    const colunasDefault = ['numeroNF', 'serie', 'emitente', 'dataEmissao', 'valorTotal', 'status'];
    const colunasExport = colunas.length > 0 ? colunas : colunasDefault;

    // Criar header
    const headerRow = colunasExport.map((col: string) => colunasFriendly[col] || col);
    worksheet.addRow(headerRow);

    // Estilizar header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }
    };

    // Adicionar dados
    dados.forEach((item: Record<string, any>) => {
      const rowData = colunasExport.map((coluna: string) => {
        const campoReal = colunaParaCampo[coluna] || coluna;
        let value = item[campoReal];

        // Formatacao especial
        if ((coluna === 'dataEmissao' || coluna === 'dataUpload') && value) {
          value = new Date(value).toLocaleDateString('pt-BR');
        } else if ((coluna === 'valorTotal' || coluna === 'totalProdutos' || coluna === 'totalIcms' || coluna === 'totalIpi') && value) {
          value = parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else if (coluna === 'chaveNFe' && value) {
          value = String(value);
        }

        return value ?? '';
      });

      worksheet.addRow(rowData);
    });

    // Ajustar largura das colunas
    colunasExport.forEach((col: string, index: number) => {
      const column = worksheet.getColumn(index + 1);
      if (col === 'chaveNFe') {
        column.width = 50;
      } else if (col === 'emitente' || col === 'natOperacao') {
        column.width = 35;
      } else if (col === 'valorTotal' || col === 'totalProdutos') {
        column.width = 18;
      } else {
        column.width = 15;
      }
    });

    // Gerar buffer e enviar
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=nfes.xlsx');
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(buffer);

  } catch (error) {
    console.error('Erro ao exportar NFes:', error);
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Mapear campos da interface para campos do banco
function mapearCampoParaDB(campo: string): string | null {
  const mapeamento: Record<string, string> = {
    'numeroNF': 'n.nnf',
    'serie': 'n.serie',
    'chaveNFe': 'n.chave',
    'emitente': 'e.xnome',
    'fornecedorCnpj': 'e.cpf_cnpj',
    'status': 'n.exec',
    'dataEmissao': 'n.demi',
    'dataUpload': 'n.dtimport',
    'valorTotal': 'n.vnf'
  };

  return mapeamento[campo] || null;
}
