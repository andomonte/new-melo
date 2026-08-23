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

// Listagem de entradas — fonte: modelo Delphi dbent/dbitent (substitui entradas_estoque).
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

      const whereConditions: string[] = [];
      const params: any[] = [];

      if (search) {
        whereConditions.push(`(
          e.codent ILIKE $${params.length + 1} OR
          nfe.codnfe_ent::text ILIKE $${params.length + 2} OR
          nfe.nnf::text ILIKE $${params.length + 3} OR
          emit.xnome ILIKE $${params.length + 4}
        )`);
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (status) {
        whereConditions.push(`COALESCE(rec.status, e.status) = $${params.length + 1}`);
        params.push(status);
      }

      // Processar filtros dinamicos por coluna
      if (filtros) {
        try {
          const filtrosParsed = JSON.parse(filtros as string) as { campo: string; tipo: string; valor: string }[];

          // Mapeamento de campos do frontend para colunas de dbent/dbitent
          const campoParaColuna: Record<string, string> = {
            numeroEntrada: 'e.codent',
            numeroNF: 'nfe.nnf',
            status: 'COALESCE(rec.status, e.status)',
            temRomaneio: 'temRomaneio', // tratamento especial abaixo
            precoConfirmado: 'precoConfirmado', // tratamento especial abaixo
            valorProdutos: '(SELECT COALESCE(SUM(quant*prunit), 0) FROM dbitent WHERE codent = e.codent)',
            valorTotal: 'e.totalnf',
            fornecedorNome: 'emit.xnome',
            dataEmissao: 'nfe.demi',
            dataEntrada: 'e.dtent',
            serie: 'nfe.serie',
            tipoEntrada: 'e.operacao',
            observacoes: 'e.obs',
            totalItens: '(SELECT COUNT(*) FROM dbitent WHERE codent = e.codent)',
          };

          const camposBooleanos = ['temRomaneio', 'precoConfirmado'];

          const valorParaBooleano = (valor: string): boolean | null => {
            const valorLower = valor.toLowerCase().trim();
            if (['confirmado', 'sim', 'true', 'gerado', '1', 'yes', 'finalizada'].includes(valorLower)) return true;
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
                  // Preço confirmado = passou pelo confirmar-preço (companheira) ou entrada fechada
                  whereConditions.push(valorBool
                    ? `((rec.status IS NOT NULL AND rec.data_confirmacao_preco IS NOT NULL) OR (rec.status IS NULL AND e.status = 'F'))`
                    : `((rec.status IS NOT NULL AND rec.data_confirmacao_preco IS NULL) OR (rec.status IS NULL AND e.status <> 'F'))`);
                } else if (filtro.campo === 'temRomaneio') {
                  const cond = `(COALESCE(e.est_alocado,0) = 1 OR (SELECT COUNT(*) FROM dbitent_armazem WHERE codent = e.codent) > 0)`;
                  whereConditions.push(valorBool ? cond : `NOT ${cond}`);
                }
              }
              continue;
            }

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

      const fromJoin = `
        FROM dbent e
        LEFT JOIN dbent_recebimento rec ON rec.codent = e.codent
        LEFT JOIN dbnfe_ent nfe ON nfe.chave = e.chave
        LEFT JOIN dbnfe_ent_emit emit ON emit.codnfe_ent = nfe.codnfe_ent
      `;

      const entradasQuery = `
        SELECT
          e.codent,
          e.chave,
          e.operacao,
          e.dtent,
          e.totalnf,
          e.status,
          e.est_alocado,
          e.obs,
          rec.status as rec_status,
          rec.data_confirmacao_preco,
          nfe.codnfe_ent as nfe_id,
          nfe.nnf as nfe_numero,
          nfe.serie as nfe_serie,
          nfe.demi as nfe_emissao,
          emit.cpf_cnpj as fornecedor_cnpj,
          emit.xnome as fornecedor_nome,
          (SELECT COUNT(*) FROM dbitent WHERE codent = e.codent) as total_itens,
          (SELECT COALESCE(SUM(quant*prunit), 0) FROM dbitent WHERE codent = e.codent) as valor_produtos,
          (COALESCE(e.est_alocado,0) = 1 OR (SELECT COUNT(*) FROM dbitent_armazem WHERE codent = e.codent) > 0) as tem_romaneio
        ${fromJoin}
        ${whereSQL}
        ORDER BY e.dtent DESC, e.codent DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        ${fromJoin}
        ${whereSQL}
      `;

      const [entradasResult, countResult] = await Promise.all([
        client.query(entradasQuery, [...params, limit, offset]),
        client.query(countQuery, params)
      ]);

      const entradas = entradasResult.rows;
      const count = Number(countResult.rows[0]?.total) || 0;

      // Transformar dados para o formato esperado pelo frontend (mesmo contrato de antes)
      const entradasFormatted = entradas.map((entrada: any) => ({
        id: entrada.codent,
        numeroNF: entrada.nfe_numero || entrada.codent,
        numeroEntrada: entrada.codent,
        serie: entrada.nfe_serie || '001',
        fornecedor: entrada.fornecedor_cnpj || '',
        fornecedorNome: entrada.fornecedor_nome || 'SISTEMA',
        fornecedorCnpj: entrada.fornecedor_cnpj || '',
        dataEmissao: entrada.nfe_emissao ? new Date(entrada.nfe_emissao).toISOString() : (entrada.dtent ? new Date(entrada.dtent).toISOString() : null),
        dataEntrada: entrada.dtent ? new Date(entrada.dtent).toISOString() : null,
        valorTotal: entrada.totalnf ? Number(entrada.totalnf) : 0,
        valorProdutos: entrada.valor_produtos ? Number(entrada.valor_produtos) : undefined,
        // status do workflow físico (companheira) com fallback p/ dbent.status (entradas migradas)
        status: entrada.rec_status || entrada.status || 'A',
        tipoEntrada: 'ENTRADA_NFE',
        comprador: 'SISTEMA',
        observacoes: entrada.obs || '',
        totalItens: Number(entrada.total_itens) || 0,
        nfeId: entrada.nfe_id,
        temRomaneio: entrada.tem_romaneio === true,
        // Com companheira: usa o estado dela; sem companheira (migradas): fallback dbent.status='F'
        precoConfirmado: entrada.rec_status != null ? (entrada.data_confirmacao_preco != null) : (entrada.status === 'F'),
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
