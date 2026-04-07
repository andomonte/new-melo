import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

// Interface para query params da API de entradas
interface EntradasQueryParams {
  page?: string | number;
  perPage?: string | number;
  search?: string;
  status?: string;
  filtros?: string; // JSON string dos filtros
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial || 'manaus';

  let client;

  if (req.method === 'GET') {
    const { page = 1, perPage = 10, search = '', status = '', filtros = '' } = req.query as EntradasQueryParams;

    try {
      const pool = getPgPool(filial);
      client = await pool.connect();

      const offset = (Number(page) - 1) * Number(perPage);
      const limit = Number(perPage);

      let whereConditions = [];
      const params: any[] = [];

      if (search) {
        whereConditions.push(`(
          e.numero_entrada ILIKE $${params.length + 1} OR
          e.nfe_id::text ILIKE $${params.length + 2} OR
          n.numero_nf ILIKE $${params.length + 3} OR
          f.nome ILIKE $${params.length + 4}
        )`);
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (status) {
        whereConditions.push(`e.status = $${params.length + 1}`);
        params.push(status);
      }

      // Processar filtros dinamicos por coluna
      if (filtros) {
        try {
          const filtrosParsed = JSON.parse(filtros as string) as { campo: string; tipo: string; valor: string }[];

          // Mapeamento de campos do frontend para colunas do banco
          const campoParaColuna: Record<string, string> = {
            numeroEntrada: 'e.numero_entrada',
            numeroNF: 'nfe.nnf',
            status: 'e.status',
            temRomaneio: 'temRomaneio', // tratamento especial abaixo
            precoConfirmado: 'precoConfirmado', // tratamento especial abaixo
            valorProdutos: '(SELECT COALESCE(SUM(valor_total), 0) FROM db_manaus.entrada_itens WHERE entrada_id = e.id)',
            valorTotal: 'e.valor_total',
            fornecedorNome: 'emit.xnome',
            dataEmissao: 'nfe.demi',
            dataEntrada: 'e.data_entrada',
            serie: 'nfe.serie',
            tipoEntrada: 'e.tipo_operacao',
            observacoes: 'e.observacoes',
            totalItens: '(SELECT COUNT(*) FROM db_manaus.entrada_itens WHERE entrada_id = e.id)',
          };

          // Campos booleanos que precisam de tratamento especial
          const camposBooleanos = ['temRomaneio', 'precoConfirmado'];

          // Mapeamento de valores de texto para booleano
          const valorParaBooleano = (valor: string): boolean | null => {
            const valorLower = valor.toLowerCase().trim();
            if (['confirmado', 'sim', 'true', 'gerado', '1', 'yes'].includes(valorLower)) return true;
            if (['pendente', 'nao', 'não', 'false', 'não gerado', '0', 'no'].includes(valorLower)) return false;
            return null;
          };

          for (const filtro of filtrosParsed) {
            if (!filtro.campo || !filtro.valor) continue;

            const coluna = campoParaColuna[filtro.campo];
            if (!coluna) continue;

            // Tratamento especial para campos booleanos
            if (camposBooleanos.includes(filtro.campo)) {
              const valorBool = valorParaBooleano(filtro.valor);
              if (valorBool !== null) {
                if (filtro.campo === 'precoConfirmado') {
                  if (valorBool) {
                    whereConditions.push('e.data_confirmacao_preco IS NOT NULL');
                  } else {
                    whereConditions.push('e.data_confirmacao_preco IS NULL');
                  }
                } else if (filtro.campo === 'temRomaneio') {
                  if (valorBool) {
                    whereConditions.push('(SELECT COUNT(*) FROM db_manaus.dbitent_armazem WHERE codent = e.numero_entrada) > 0');
                  } else {
                    whereConditions.push('(SELECT COUNT(*) FROM db_manaus.dbitent_armazem WHERE codent = e.numero_entrada) = 0');
                  }
                }
              }
              continue; // Pular processamento normal
            }

            // Aplicar filtro baseado no tipo
            switch (filtro.tipo) {
              case 'começa':
                whereConditions.push(`${coluna}::text ILIKE $${params.length + 1}`);
                params.push(`${filtro.valor}%`);
                break;
              case 'termina':
                whereConditions.push(`${coluna}::text ILIKE $${params.length + 1}`);
                params.push(`%${filtro.valor}`);
                break;
              case 'igual':
                whereConditions.push(`${coluna}::text = $${params.length + 1}`);
                params.push(filtro.valor);
                break;
              case 'diferente':
                whereConditions.push(`${coluna}::text != $${params.length + 1}`);
                params.push(filtro.valor);
                break;
              case 'maior':
                whereConditions.push(`${coluna}::numeric > $${params.length + 1}`);
                params.push(filtro.valor);
                break;
              case 'menor':
                whereConditions.push(`${coluna}::numeric < $${params.length + 1}`);
                params.push(filtro.valor);
                break;
              case 'maior_igual':
                whereConditions.push(`${coluna}::numeric >= $${params.length + 1}`);
                params.push(filtro.valor);
                break;
              case 'menor_igual':
                whereConditions.push(`${coluna}::numeric <= $${params.length + 1}`);
                params.push(filtro.valor);
                break;
              case 'nulo':
                whereConditions.push(`${coluna} IS NULL`);
                break;
              case 'nao_nulo':
                whereConditions.push(`${coluna} IS NOT NULL`);
                break;
              case 'contém':
              default:
                whereConditions.push(`${coluna}::text ILIKE $${params.length + 1}`);
                params.push(`%${filtro.valor}%`);
                break;
            }
          }
        } catch (parseError) {
          console.error('Erro ao parsear filtros:', parseError);
        }
      }

      const whereSQL = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Buscar entradas de estoque com dados da NFe
      const whereSQL_simple = whereConditions.length > 0 ?
        `WHERE ${whereConditions.join(' AND ').replace(/n\./g, 'e.').replace(/f\./g, 'e.')}` : '';

      const entradasQuery = `
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
          nfe.demi as nfe_emissao,
          -- Dados do emitente (fornecedor)
          emit.cpf_cnpj as fornecedor_cnpj,
          emit.xnome as fornecedor_nome,
          -- Contar itens da entrada
          (SELECT COUNT(*) FROM db_manaus.entrada_itens WHERE entrada_id = e.id) as total_itens,
          -- Valor dos produtos (soma dos itens)
          (SELECT COALESCE(SUM(valor_total), 0) FROM db_manaus.entrada_itens WHERE entrada_id = e.id) as valor_produtos,
          -- Verificar se tem romaneio
          (SELECT COUNT(*) > 0 FROM db_manaus.dbitent_armazem WHERE codent = e.numero_entrada) as tem_romaneio,
          -- Verificar se preco foi confirmado
          e.data_confirmacao_preco IS NOT NULL as preco_confirmado
        FROM db_manaus.entradas_estoque e
        LEFT JOIN db_manaus.dbnfe_ent nfe ON e.nfe_id::varchar = nfe.codnfe_ent::varchar
        LEFT JOIN db_manaus.dbnfe_ent_emit emit ON nfe.codnfe_ent = emit.codnfe_ent
        ${whereSQL_simple}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countQuery = `
        SELECT COUNT(DISTINCT e.id) as total
        FROM db_manaus.entradas_estoque e
        ${whereSQL_simple}
      `;

      const [entradasResult, countResult] = await Promise.all([
        client.query(entradasQuery, [...params, limit, offset]),
        client.query(countQuery, params)
      ]);

      const entradas = entradasResult.rows;
      const count = Number(countResult.rows[0]?.total) || 0;

      // Transformar dados para o formato esperado pelo frontend
      const entradasFormatted = entradas.map((entrada: any) => ({
        id: entrada.id.toString(),
        numeroNF: entrada.nfe_numero || entrada.numero_entrada,
        numeroEntrada: entrada.numero_entrada,
        serie: entrada.nfe_serie || '001',
        fornecedor: entrada.fornecedor_cnpj || '',
        fornecedorNome: entrada.fornecedor_nome || 'SISTEMA',
        fornecedorCnpj: entrada.fornecedor_cnpj || '',
        dataEmissao: entrada.nfe_emissao ? new Date(entrada.nfe_emissao).toISOString() : new Date(entrada.created_at).toISOString(),
        dataEntrada: entrada.data_entrada ? new Date(entrada.data_entrada).toISOString() : new Date(entrada.created_at).toISOString(),
        valorTotal: entrada.valor_total ? Number(entrada.valor_total) : 0,
        valorProdutos: entrada.valor_produtos ? Number(entrada.valor_produtos) : undefined,
        status: entrada.status || 'CRIADA',
        tipoEntrada: entrada.tipo_operacao || 'ENTRADA_NFE',
        comprador: 'SISTEMA',
        observacoes: entrada.observacoes || '',
        totalItens: Number(entrada.total_itens) || 0,
        nfeId: entrada.nfe_id,
        temRomaneio: entrada.tem_romaneio === true || entrada.est_alocado === 1,
        precoConfirmado: entrada.preco_confirmado === true
      }));

      res.status(200).json({
        data: entradasFormatted,
        meta: {
          total: count,
          totalPages: count > 0 ? Math.ceil(count / Number(perPage)) : 1,
          lastPage: count > 0 ? Math.ceil(count / Number(perPage)) : 1,
          page: Number(page),
          perPage: Number(perPage),
        },
      });
    } catch (error) {
      console.error('Erro ao carregar entradas:', error);
      res.status(500).json({ error: (error as Error).message });
    } finally {
      if (client) {
        client.release();
      }
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}