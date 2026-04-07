// src/pages/api/armazens/listarArmazens.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies';

// --- Nova Interface para o Modelo DBArmazem ---
// É altamente recomendável mover esta interface para um arquivo de tipos global
// (ex: `src/types/dbarmazem.d.ts` ou `types/index.d.ts`)
// para reutilização em todo o seu projeto.
interface DBArmazem {
  id_armazem: number;
  nome: string | null;
  filial: string | null;
  ativo: boolean | null;
  data_cadastro: Date | null; // Ou string, dependendo de como o driver do PG retorna timestamp
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  inscricaoestadual: string | null; // <-- NOVA COLUNA ADICIONADA AQUI
  // Você pode adicionar propriedades para os relacionamentos aqui, se precisar.
  // Por exemplo: arm_transferencia_arm_transferencia_id_armazem_destinoTodbarmazem?: any[];
  // Mas para um SELECT * simples, eles não serão populados automaticamente.
}
// --- Fim da Nova Interface ---

interface GetParams {
  page?: string;
  perPage?: string;
  search?: string;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = '1', perPage = '9999', search = '' }: GetParams = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const pageNumber = parseInt(page, 10);
    const perPageNumber = parseInt(perPage, 10);
    const offset = (pageNumber - 1) * perPageNumber;
    const searchTerm = `%${search}%`;

    // Consulta para buscar armazéns com paginação e filtro
    // A tipagem <DBArmazem> foi adicionada para o resultado da query
    const result = await client.query<DBArmazem>(
      `
                SELECT *
                FROM dbarmazem
                WHERE filial = $1 AND nome ILIKE $2
                ORDER BY id_armazem
                OFFSET $3
                LIMIT $4
            `,
      [filial, searchTerm, offset, perPageNumber],
    );

    // O array armazens agora terá a tipagem correta de DBArmazem[]
    const armazens: DBArmazem[] = result.rows;

    // Consulta para contar o total de armazéns
    const countResult = await client.query<{ total: string }>( // Tipagem específica para o COUNT
      `
                SELECT COUNT(*) AS total
                FROM dbarmazem
                WHERE filial = $1 AND nome ILIKE $2
            `,
      [filial, searchTerm],
    );

    const total = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      // Mapeamos os armazéns com serializeBigInt, que já é uma boa prática
      data: armazens.map(serializeBigInt),
      meta: {
        total: total,
        lastPage: total > 0 ? Math.ceil(total / perPageNumber) : 1,
        currentPage: total > 0 ? pageNumber : 1,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar armazéns:', error);
    res.status(500).json({ error: 'Erro ao buscar armazéns' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
