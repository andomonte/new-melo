import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';
import formidable from 'formidable';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';

// Configuração para aceitar upload de arquivos
export const config = {
  api: {
    bodyParser: false, // Desabilita o parser padrão para usar formidable
  },
};

// Tipagem para os dados da planilha Excel
interface ExcelRow {
  item_sku: string;
  preco_sem_taxa: number;
  descricao?: string; // Campo opcional para descrição
}

// Tipagem para mapeamento de colunas
interface ColumnMapping {
  skuCol: number;
  precoCol: number;
  descricaoCol: number;
  startRow: number;
}

// Tipagem para o resultado final
interface ProcessResult {
  sku: string;
  descricao: string;
  precoOriginal: number;
  precoCalculado: number;
}

/**
 * Endpoint principal para processar arquivo Excel e calcular preços kickback
 * Método: POST
 * Content-Type: multipart/form-data
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // 1. Validação do método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido. Use POST.',
    });
  }

  // 2. Obter filial do cookie (sistema multi-tenant)
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({
      error: 'Filial não identificada. Faça login novamente.',
    });
  }

  // 3. Obter conexão com banco de dados
  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    // 4. Processar upload do arquivo com formidable
    console.log('📁 Iniciando processamento do upload...');

    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // Limite de 10MB
      keepExtensions: true, // Manter extensões dos arquivos
    });

    const [fields, files] = await form.parse(req);

    // 5. Extrair dados do formulário
    const vendorPercent = parseFloat(fields.vendorPercent?.[0] || '0');
    const arquivo = Array.isArray(files.arquivo)
      ? files.arquivo[0]
      : files.arquivo;

    // 6. Validar dados recebidos
    if (!arquivo) {
      return res.status(400).json({
        error: 'Nenhum arquivo foi enviado.',
      });
    }

    if (vendorPercent <= 0 || vendorPercent > 100) {
      return res.status(400).json({
        error: 'Vendor % deve ser um número entre 0.1 e 100.',
      });
    }

    // 7. Ler e processar arquivo Excel
    const excelData = await processExcelFile(arquivo.filepath);

    if (excelData.length === 0) {
      return res.status(400).json({
        error: 'Arquivo Excel vazio ou sem dados válidos.',
      });
    }

    // 8. Processar cada linha do Excel
    const results: ProcessResult[] = [];

    // 8.1. Buscar todos os produtos Bosch de uma vez para otimizar performance

    const todosSkus = excelData.map((row) => row.item_sku);
    const produtosBosch = await buscarProdutosBoschEmLote(client, todosSkus);

    // 8.2. Processar cada linha usando o cache de produtos

    for (const row of excelData) {
      try {
        // Buscar produto no cache
        const produto = produtosBosch.get(row.item_sku);

        if (produto) {
          // Calcular preço kickback
          const precoCalculado = row.preco_sem_taxa * (1 - vendorPercent / 100);

          // Adicionar resultado
          results.push({
            sku: row.item_sku,
            descricao: produto.descricao || row.descricao || 'Sem descrição',
            precoOriginal: row.preco_sem_taxa,
            precoCalculado: parseFloat(precoCalculado.toFixed(2)),
          });
        } else {
          // Log apenas dos primeiros 20 não encontrados
        }
      } catch (itemError) {
        console.error(`🚨 Erro ao processar SKU ${row.item_sku}:`, itemError);
      }
    }

    // 9. Retornar resultados (sem salvar no banco)

    return res.status(200).json({
      success: true,
      message: `Processamento concluído: ${results.length} itens calculados`,
      results: results,
      summary: {
        totalLinhasExcel: excelData.length,
        itensProcessados: results.length,
        vendorPercent: vendorPercent,
      },
    });
  } catch (error) {
    console.error('🚨 Erro no processamento:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    // 10. Sempre liberar conexão do banco
    client.release();
  }
}

/**
 * Função para processar arquivo Excel e extrair dados
 * @param filePath - Caminho do arquivo Excel no servidor
 * @returns Array com dados das linhas válidas
 */
async function processExcelFile(filePath: string): Promise<ExcelRow[]> {
  try {
    console.log('📖 Lendo arquivo Excel...');

    // Ler arquivo Excel com opções para preservar texto
    const fileBuffer = await fs.readFile(filePath);
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: false, // Não converter para Date
      cellNF: false, // Não aplicar formatos de número
      cellText: true, // Preservar como texto quando possível
      raw: true, // Manter valores brutos
    });

    // Pegar a primeira planilha
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Ler dados célula por célula para evitar conversão automática
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const jsonData: any[][] = [];

    // Percorrer cada linha da planilha
    for (let row = range.s.r; row <= range.e.r; row++) {
      const rowData: any[] = [];

      // Percorrer cada coluna da linha
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];

        if (cell && cell.v !== undefined) {
          let cellValue = '';

          // Estratégia universal para todas as células
          // Verificar se é uma data convertida automaticamente
          if (cell.t === 'd' || cell.v instanceof Date) {
            // Se for data, tentar recuperar texto original
            if (cell.w && !cell.w.includes('/') && !cell.w.includes(':')) {
              // Valor formatado que não parece data
              cellValue = String(cell.w).trim();
            } else {
              // Pular esta célula pois é provavelmente data real
              cellValue = '';
            }
          } else {
            // 1. Tentar valor formatado primeiro (preserva formatação original)
            if (cell.w) {
              cellValue = String(cell.w).trim();
            }
            // 2. Se não tem valor formatado, tentar valor bruto
            else if (cell.v !== undefined) {
              cellValue = String(cell.v).trim();
            }
            // 3. Se tem fórmula, tentar usar ela
            else if (cell.f) {
              cellValue = String(cell.f).trim();
            }
          }

          rowData[col] = cellValue;
        } else {
          rowData[col] = '';
        }
      }

      jsonData.push(rowData);
    }

    // Detectar estrutura da planilha automaticamente
    const structure = detectSheetStructure(jsonData);

    // Processar dados usando a estrutura detectada
    const results: ExcelRow[] = [];
    let linhasProcessadas = 0;
    let linhasValidas = 0;

    for (let i = structure.startRow; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      linhasProcessadas++;

      if (row && row.length > Math.max(structure.skuCol, structure.precoCol)) {
        // Usar colunas detectadas
        const item_sku = String(row[structure.skuCol] || '').trim();

        // Se está vazio, pular
        if (
          !item_sku ||
          item_sku === 'undefined' ||
          item_sku === '' ||
          item_sku === 'null'
        ) {
          continue;
        }

        // Se parece com data (formato dd/mm/yyyy), provavelmente é linha inválida
        if (item_sku.match(/^\d{2}\/\d{2}\/\d{4}/)) {
          continue;
        }

        // Se contém apenas texto descritivo, pular
        if (
          item_sku.toLowerCase().includes('lista') ||
          item_sku.toLowerCase().includes('validade') ||
          item_sku.toLowerCase().includes('taxa') ||
          item_sku.toLowerCase().includes('preço') ||
          item_sku.toLowerCase().includes('data')
        ) {
          continue;
        }

        // Extrair preço da célula correta
        let preco_sem_taxa = 0;
        const precoCelula = row[structure.precoCol];

        if (
          precoCelula !== undefined &&
          precoCelula !== null &&
          precoCelula !== ''
        ) {
          // Converter para string e limpar
          const precoStr = String(precoCelula).replace(',', '.').trim();
          preco_sem_taxa = parseFloat(precoStr) || 0;
        }

        const descricao =
          structure.descricaoCol !== -1
            ? String(row[structure.descricaoCol] || '').trim()
            : undefined;

        // Validar se tem dados mínimos necessários
        if (item_sku && preco_sem_taxa > 0) {
          results.push({
            item_sku,
            preco_sem_taxa,
            descricao: descricao || undefined,
          });

          linhasValidas++;
        }
      }
    }

    console.log(
      `📊 Backend: Processamento concluído - ${linhasProcessadas} linhas processadas, ${linhasValidas} válidas`,
    );

    return results;
  } catch (error) {
    console.error('🚨 Erro ao processar Excel:', error);
    throw new Error(
      `Erro ao ler arquivo Excel: ${
        error instanceof Error ? error.message : 'Erro desconhecido'
      }`,
    );
  }
}

/**
 * Função inteligente para detectar estrutura da planilha
 */
function detectSheetStructure(jsonData: any[][]): ColumnMapping {
  let skuCol = -1;
  let precoCol = -1;
  let descricaoCol = -1;
  let startRow = -1;
  let precoComTaxaCol = -1;

  // Procurar por cabeçalhos nas primeiras 15 linhas
  for (let row = 0; row < Math.min(15, jsonData.length); row++) {
    const rowData = jsonData[row];
    if (!rowData || rowData.length === 0) continue;

    // Procurar por padrões de cabeçalho específicos da planilha Bosch
    for (let col = 0; col < rowData.length; col++) {
      const cellValue = String(rowData[col] || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, ''); // Remove caracteres especiais para comparação

      // Detectar coluna SKU/Item (exato para planilha Bosch)
      if (
        skuCol === -1 &&
        (cellValue === 'item' ||
          cellValue === 'codigo' ||
          cellValue === 'sku' ||
          cellValue === 'codigodoitem' ||
          cellValue === 'ref' ||
          cellValue === 'referencia')
      ) {
        skuCol = col;
      }

      // Detectar coluna Preco_Sem_Taxa (prioritária)
      if (
        precoCol === -1 &&
        (cellValue === 'precosemtaxa' ||
          cellValue === 'precosemtaxa' ||
          cellValue === 'preco_sem_taxa' ||
          cellValue === 'precosemtaxa')
      ) {
        precoCol = col;
      }

      // Detectar coluna Preco_Com_Taxa (alternativa)
      if (
        precoComTaxaCol === -1 &&
        (cellValue === 'precocomtaxa' ||
          cellValue === 'precocomtaxa' ||
          cellValue === 'preco_com_taxa' ||
          cellValue === 'precocomtaxa')
      ) {
        precoComTaxaCol = col;
      }

      // Detectar coluna descrição
      if (
        descricaoCol === -1 &&
        (cellValue === 'descricao' ||
          cellValue === 'descricao' ||
          cellValue === 'nome' ||
          cellValue === 'produto' ||
          cellValue === 'description')
      ) {
        descricaoCol = col;
      }
    }

    // Se encontrou pelo menos SKU e algum tipo de preço, definir linha de início
    if (
      skuCol !== -1 &&
      (precoCol !== -1 || precoComTaxaCol !== -1) &&
      startRow === -1
    ) {
      startRow = row + 1; // Dados começam na próxima linha

      // Se não encontrou Preco_Sem_Taxa, usar Preco_Com_Taxa
      if (precoCol === -1 && precoComTaxaCol !== -1) {
        precoCol = precoComTaxaCol;
      }

      break;
    }
  }

  // Fallback: se não encontrou cabeçalhos, assumir estrutura padrão
  if (skuCol === -1 || precoCol === -1) {
    // Procurar primeira linha com dados válidos
    for (let row = 0; row < Math.min(10, jsonData.length); row++) {
      const rowData = jsonData[row];
      if (!rowData || rowData.length < 2) continue;

      const firstCol = String(rowData[0] || '').trim();
      const secondCol = rowData[1];

      // Verificar se primeira coluna parece SKU e segunda parece preço
      if (
        firstCol &&
        !firstCol.includes('/') && // Não é data
        firstCol.length > 2 &&
        !isNaN(parseFloat(String(secondCol)))
      ) {
        skuCol = 0;
        precoCol = 1;
        descricaoCol = rowData.length > 2 ? 2 : -1;
        startRow = row;
        break;
      }
    }
  }

  const result: ColumnMapping = {
    skuCol: skuCol !== -1 ? skuCol : 0,
    precoCol: precoCol !== -1 ? precoCol : 1,
    descricaoCol: descricaoCol !== -1 ? descricaoCol : 2,
    startRow: startRow !== -1 ? startRow : 1,
  };

  return result;
}

/**
 * Função otimizada para buscar múltiplos produtos Bosch de uma vez
 * @param client - Cliente de conexão PostgreSQL
 * @param skus - Array de SKUs dos produtos a buscar
 * @returns Map com SKU como chave e dados do produto como valor
 */
async function buscarProdutosBoschEmLote(
  client: any,
  skus: string[],
): Promise<Map<string, any>> {
  try {
    const produtosMap = new Map<string, any>();

    // Processar em lotes de 1000 SKUs para evitar queries muito grandes
    const tamanheLote = 1000;

    for (let i = 0; i < skus.length; i += tamanheLote) {
      const loteSkus = skus.slice(i, i + tamanheLote);

      // Query para buscar produtos com marca Bosch em lote
      const placeholders = loteSkus
        .map((_, index) => `$${index + 1}`)
        .join(', ');
      const query = `
        SELECT 
          p."codprod",
          p."ref",
          p."descr" as descricao,
          m."descr" as marca
        FROM dbprod p
        INNER JOIN dbmarcas m ON p."codmarca" = m."codmarca"
        WHERE p."ref" IN (${placeholders})
        AND UPPER(m."descr") = 'BOSCH'
      `;

      const result = await client.query(query, loteSkus);

      // Adicionar resultados ao Map
      result.rows.forEach((produto: any) => {
        produtosMap.set(produto.ref, produto);
      });
    }

    return produtosMap;
  } catch (error) {
    console.error('🚨 Erro na consulta em lote dos produtos Bosch:', error);
    return new Map();
  }
}

/**
 * Função para buscar produto Bosch individual (mantida para compatibilidade)
 * @param client - Cliente de conexão PostgreSQL
 * @param item_sku - SKU do produto a buscar
 * @returns Dados do produto se encontrado e for Bosch, null caso contrário
 */
async function _buscarProdutoBosch(client: any, item_sku: string) {
  try {
    // Query para buscar produto com marca Bosch
    const query = `
      SELECT 
        p."codprod",
        p."ref",
        p."descr" as descricao,
        m."descr" as marca
      FROM dbprod p
      INNER JOIN dbmarcas m ON p."codmarca" = m."codmarca"
      WHERE p."ref" = $1 
      AND UPPER(m."descr") = 'BOSCH'
      LIMIT 1
    `;

    const result = await client.query(query, [item_sku]);

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    return null;
  } catch (error) {
    console.error(`🚨 Erro na consulta do SKU ${item_sku}:`, error);
    return null;
  }
}
