import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import ExcelJS from 'exceljs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo nao permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const { colunas: colunasRaw = [], filtros = [], busca = '' } = req.body;

    // Filtrar colunas invalidas
    const colunasInvalidas = ['selecionar', 'SELECIONAR', 'AÇÕES', 'ações', 'acoes'];
    const colunas = colunasRaw.filter((c: string) => !colunasInvalidas.includes(c));

    // Query para buscar entradas
    let query = `
      SELECT
        e.id,
        e.numero_entrada,
        e.nfe_id,
        e.tipo_operacao,
        e.data_entrada,
        e.valor_total,
        e.status,
        e.est_alocado,
        e.created_at,
        e.updated_at,
        e.observacoes,
        -- Dados da NFe
        nfe.nnf as nfe_numero,
        nfe.serie as nfe_serie,
        nfe.chave as chave_nfe,
        nfe.demi as nfe_emissao,
        -- Dados do emitente (fornecedor)
        emit.cpf_cnpj as fornecedor_cnpj,
        emit.xnome as fornecedor_nome,
        -- Contar itens da entrada
        (SELECT COUNT(*) FROM db_manaus.entrada_itens WHERE entrada_id = e.id) as total_itens,
        -- Valor dos produtos (soma dos itens)
        (SELECT COALESCE(SUM(valor_total), 0) FROM db_manaus.entrada_itens WHERE entrada_id = e.id) as valor_produtos,
        -- Verificar se tem romaneio
        (SELECT COUNT(*) > 0 FROM db_manaus.dbitent_armazem WHERE codent = e.numero_entrada) as tem_romaneio
      FROM db_manaus.entradas_estoque e
      LEFT JOIN db_manaus.dbnfe_ent nfe ON e.nfe_id::varchar = nfe.codnfe_ent::varchar
      LEFT JOIN db_manaus.dbnfe_ent_emit emit ON nfe.codnfe_ent = emit.codnfe_ent
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Busca global
    if (busca?.trim()) {
      query += ` AND (
        LOWER(e.numero_entrada) LIKE LOWER($${paramIndex}) OR
        LOWER(nfe.nnf::text) LIKE LOWER($${paramIndex}) OR
        LOWER(emit.xnome) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${busca.trim()}%`);
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
              case 'contem':
              case 'contém':
                query += ` AND LOWER(${campo}::text) LIKE LOWER($${paramIndex})`;
                params.push(`%${filtro.valor}%`);
                break;
              case 'comeca':
              case 'começa':
                query += ` AND LOWER(${campo}::text) LIKE LOWER($${paramIndex})`;
                params.push(`${filtro.valor}%`);
                break;
              case 'termina':
                query += ` AND LOWER(${campo}::text) LIKE LOWER($${paramIndex})`;
                params.push(`%${filtro.valor}`);
                break;
              default:
                // Filtro padrao "contem"
                query += ` AND LOWER(${campo}::text) LIKE LOWER($${paramIndex})`;
                params.push(`%${filtro.valor}%`);
            }
            paramIndex++;
          }
        }
      });
    }

    query += ` ORDER BY e.created_at DESC, e.id DESC LIMIT 5000`;

    console.log('Exportando Entradas - Query:', query.substring(0, 200));

    const result = await client.query(query, params);
    const dados = result.rows;

    console.log('Total de registros para exportar:', dados.length);

    // Criar workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Entradas');

    // Mapeamento de colunas para labels amigaveis
    const colunasFriendly: Record<string, string> = {
      numeroEntrada: 'Numero Entrada',
      numeroNF: 'Numero NF',
      serie: 'Serie',
      chaveNFe: 'Chave NFe',
      fornecedorNome: 'Fornecedor',
      fornecedorCnpj: 'CNPJ Fornecedor',
      dataEmissao: 'Data Emissao',
      dataEntrada: 'Data Entrada',
      valorTotal: 'Valor Total',
      valorProdutos: 'Valor Produtos',
      status: 'Status',
      tipoEntrada: 'Tipo Entrada',
      comprador: 'Comprador',
      totalItens: 'Qtd Itens',
      temRomaneio: 'Romaneio',
      observacoes: 'Observacoes',
    };

    // Mapeamento de campos do frontend para banco
    const colunaParaCampo: Record<string, string> = {
      numeroEntrada: 'numero_entrada',
      numeroNF: 'nfe_numero',
      chaveNFe: 'chave_nfe',
      fornecedorNome: 'fornecedor_nome',
      fornecedorCnpj: 'fornecedor_cnpj',
      dataEmissao: 'nfe_emissao',
      dataEntrada: 'data_entrada',
      valorTotal: 'valor_total',
      valorProdutos: 'valor_produtos',
      tipoEntrada: 'tipo_operacao',
      totalItens: 'total_itens',
      temRomaneio: 'tem_romaneio',
      serie: 'nfe_serie',
    };

    // Status labels
    const statusLabels: Record<string, string> = {
      P: 'Pendente',
      A: 'Disponivel',
      C: 'Cancelada',
      F: 'Finalizada',
      R: 'Recebida',
      CRIADA: 'Criada',
    };

    // Colunas default
    const colunasDefault = [
      'numeroEntrada',
      'numeroNF',
      'serie',
      'fornecedorNome',
      'dataEmissao',
      'dataEntrada',
      'valorTotal',
      'status',
    ];
    const colunasExport = colunas.length > 0 ? colunas : colunasDefault;

    // Criar header
    const headerRow = colunasExport.map((col: string) => colunasFriendly[col] || col);
    worksheet.addRow(headerRow);

    // Estilizar header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    // Adicionar dados
    dados.forEach((item: Record<string, any>) => {
      const rowData = colunasExport.map((coluna: string) => {
        const campoReal = colunaParaCampo[coluna] || coluna;
        let value = item[campoReal];

        // Formatacao especial
        if ((coluna === 'dataEmissao' || coluna === 'dataEntrada') && value) {
          value = new Date(value).toLocaleDateString('pt-BR');
        } else if ((coluna === 'valorTotal' || coluna === 'valorProdutos') && value) {
          value = parseFloat(value).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          });
        } else if (coluna === 'chaveNFe' && value) {
          value = String(value);
        } else if (coluna === 'status' && value) {
          value = statusLabels[value] || value;
        } else if (coluna === 'temRomaneio') {
          value = value === true || value === 't' ? 'Sim' : 'Nao';
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
      } else if (col === 'fornecedorNome' || col === 'observacoes') {
        column.width = 35;
      } else if (col === 'valorTotal' || col === 'valorProdutos') {
        column.width = 18;
      } else if (col === 'numeroEntrada' || col === 'numeroNF') {
        column.width = 15;
      } else {
        column.width = 15;
      }
    });

    // Gerar buffer e enviar
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=entradas.xlsx');
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(buffer);
  } catch (error) {
    console.error('Erro ao exportar entradas:', error);
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
    numeroEntrada: 'e.numero_entrada',
    numeroNF: 'nfe.nnf',
    serie: 'nfe.serie',
    chaveNFe: 'nfe.chave',
    fornecedorNome: 'emit.xnome',
    fornecedorCnpj: 'emit.cpf_cnpj',
    status: 'e.status',
    tipoEntrada: 'e.tipo_operacao',
    dataEmissao: 'nfe.demi',
    dataEntrada: 'e.data_entrada',
    valorTotal: 'e.valor_total',
  };

  return mapeamento[campo] || null;
}
