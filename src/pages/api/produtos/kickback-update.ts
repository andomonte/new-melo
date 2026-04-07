import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';
import formidable from 'formidable';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';

// Tipagem para dados do Excel
interface ExcelRow {
  item_sku: string;
  preco_sem_taxa: number;
  descricao?: string;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // 1. Validação do método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // 2. Multi-tenant: Obter filial do cookie
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não identificada' });
  }

  // 3. Obter conexão do pool
  const pool = getPgPool(filial);
  const client = await pool.connect();

  try {
    // 4. Processar upload com formidable
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);

    // Compatibilidade com ambos os nomes de campo
    const percentual = parseFloat(
      fields.percentual?.[0] || fields.vendorPercent?.[0] || '0',
    );
    const file = Array.isArray(files.arquivo)
      ? files.arquivo[0]
      : files.arquivo;

    if (!file || !percentual) {
      return res
        .status(400)
        .json({ error: 'Arquivo e percentual são obrigatórios' });
    }

    // 5. Processar arquivo Excel
    const excelData = await processExcelFile(file.filepath);

    if (excelData.length === 0) {
      return res
        .status(400)
        .json({ error: 'Arquivo Excel vazio ou sem dados válidos' });
    }

    // 6. Processar cada produto com transações individuais
    let processados = 0;
    const erros: string[] = [];

    // 7. Processar cada produto
    for (const item of excelData) {
      try {
        // 7.1. Iniciar transação individual para cada produto
        await client.query('BEGIN');

        // 7.2. Buscar produto na dbprod (apenas marca Bosch)
        const productQuery = `
          SELECT p."codprod" 
          FROM dbprod p
          INNER JOIN dbmarcas m ON p."codmarca" = m."codmarca"
          WHERE p."ref" = $1 
          AND UPPER(m."descr") = 'BOSCH'
          LIMIT 1
        `;

        const productResult = await client.query(productQuery, [item.item_sku]);

        if (productResult.rows.length === 0) {
          await client.query('ROLLBACK');
          erros.push(`SKU ${item.item_sku} não encontrado ou não é Bosch`);
          continue;
        }

        const codprod = productResult.rows[0].codprod;

        // 7.3. Calcular preço com desconto (kickback)
        const valor_kickback = item.preco_sem_taxa * (1 - percentual / 100);

        // 7.4. Upsert na dbprecokb (sem ON CONFLICT - fazer manualmente)
        // Primeiro verificar se já existe
        const existsQuery = `
          SELECT codprod FROM dbprecokb WHERE codprod = $1
        `;
        const existsResult = await client.query(existsQuery, [codprod]);

        let upsertQuery: string;
        if (existsResult.rows.length > 0) {
          // UPDATE se já existe
          upsertQuery = `
            UPDATE dbprecokb 
            SET dscbalcao45 = $2
            WHERE codprod = $1
          `;
        } else {
          // INSERT se não existe
          upsertQuery = `
            INSERT INTO dbprecokb (codprod, dscbalcao45)
            VALUES ($1, $2)
          `;
        }

        await client.query(upsertQuery, [codprod, valor_kickback.toFixed(2)]);

        // 7.5. Confirmar transação individual
        await client.query('COMMIT');
        processados++;
      } catch (itemError) {
        // Reverter transação individual em caso de erro
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Erro no rollback:', rollbackError);
        }
        console.error(`Erro ao processar SKU ${item.item_sku}:`, itemError);
        erros.push(
          `SKU ${item.item_sku}: ${
            itemError instanceof Error ? itemError.message : String(itemError)
          }`,
        );
      }
    }

    // 8. Retornar resultado
    return res.status(200).json({
      success: true,
      message: `Processamento concluído: ${processados} produtos atualizados`,
      processados,
      erros: erros.length > 0 ? erros : undefined,
    });
  } catch (error) {
    // Em caso de erro global, tentar rollback de segurança
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Erro no rollback de segurança:', rollbackError);
    }
    console.error('Erro no processamento do kickback:', error);
    return res.status(500).json({
      error: 'Erro ao processar arquivo',
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // SEMPRE liberar a conexão
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

    // Ler arquivo Excel
    const fileBuffer = await fs.readFile(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Pegar a primeira planilha
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Converter para JSON com opções para manter dados como string
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false, // Converter tudo para string primeiro
      dateNF: 'yyyy-mm-dd', // Formato de data padrão
    });

    console.log(`📄 Planilha "${sheetName}" com ${jsonData.length} linhas`);

    // Processar dados (assumindo que a primeira linha são os cabeçalhos)
    const results: ExcelRow[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      // Pular cabeçalho (linha 0)
      const row = jsonData[i] as any[];

      if (row && row.length >= 2) {
        // Tratamento especial para SKU - forçar como string e limpar
        const item_sku = String(row[0] || '').trim();

        // Se parece com data (formato dd/mm/yyyy hh:mm:ss), pular esta linha
        if (item_sku.match(/^\d{2}\/\d{2}\/\d{4}/)) {
          console.log(
            `⚠️ Ignorando linha ${i + 1}: SKU parece ser data (${item_sku})`,
          );
          continue;
        }

        // Se está vazio, pular
        if (!item_sku || item_sku === 'undefined') {
          continue;
        }

        const preco_sem_taxa =
          parseFloat(String(row[1]).replace(',', '.')) || 0;
        const descricao = String(row[2] || '').trim();

        // Validar se tem dados mínimos necessários
        if (item_sku && preco_sem_taxa > 0) {
          results.push({
            item_sku,
            preco_sem_taxa,
            descricao: descricao || undefined,
          });
        }
      }
    }

    console.log(`✅ ${results.length} linhas válidas extraídas do Excel`);
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
