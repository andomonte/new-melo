import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { page = '1', perPage = '10', search = '', status = 'ativo', sortBy = 'descr', sortDir = 'asc' } =
    req.query;
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const currentPage = Number(page);
    const itemsPerPage = Number(perPage);
    const offset = (currentPage - 1) * itemsPerPage;

    // Status do produto (ver memória produto-status-ativo-inativo):
    //   ativo (padrão) => inf <> 'D'  | inativo => inf = 'D' | todos => sem filtro
    // Obs.: dirigido por inf='D' e excluido=1.
    const filtroStatus =
      status === 'inativo'
        ? `inf = 'D'`
        : status === 'todos'
          ? ''
          : `inf IS DISTINCT FROM 'D'`;

    // Construir a cláusula WHERE (com alias p. para uso na query principal)
    const whereConditions: string[] = [];
    const whereConditionsCount: string[] = [];
    if (filtroStatus) {
      whereConditions.push(`p.${filtroStatus}`);
      whereConditionsCount.push(filtroStatus);
    }
    // Sempre filtrar excluídos
    whereConditions.push(`COALESCE(p.excluido, 0) != 1`);
    whereConditionsCount.push(`COALESCE(excluido, 0) != 1`);
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Busca geral com regras:
    // Uma palavra = prefixo em aplic_extendida e ref
    // Múltiplas palavras = primeira prefixo + demais contém em aplic_extendida
    // % na frente = contém | ; ou , = OR | | = marca (não aplicável aqui) | "aspas" = frase exata
    // Número puro = codprod e ref | Letras+números = ref e codprod
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      const isNumerico = /^\d+$/.test(searchTerm);
      const isRefMista = /^[A-Za-z]+\d+/.test(searchTerm) || /^\d+[A-Za-z]+/.test(searchTerm);

      // Extrair frases entre aspas
      const frases: string[] = [];
      const semAspas = searchTerm.replace(/"([^"]+)"/g, (_m: string, f: string) => {
        frases.push(f.trim());
        return '';
      }).trim();

      const grupos = semAspas
        .split(/[;,]/)
        .map((g: string) => g.trim().split(/[\s%]+/).filter(Boolean))
        .filter((g: string[]) => g.length > 0);

      frases.forEach((f: string) => { if (f) grupos.push([f]); });

      if (grupos.length > 0) {
        const colsGeral = ['p.aplic_extendida', 'p.ref'];

        const orConds = grupos.map((termos: string[]) => {
          if (termos.length === 1) {
            const t = termos[0];
            const contemMode = t.startsWith('%');
            const termoLimpo = t.replace(/^%+|%+$/g, '').trim();
            if (!termoLimpo) return '';
            const like = contemMode ? `%${termoLimpo}%` : `${termoLimpo}%`;
            const colConds = colsGeral.map((col: string) => `${col} ILIKE $${paramIndex}`);
            queryParams.push(like);
            paramIndex++;
            return `(${colConds.join(' OR ')})`;
          } else {
            const colTexto = ['p.aplic_extendida'];
            const andConds = termos.map((t: string, i: number) => {
              const temPercent = t.startsWith('%');
              const termoLimpo = t.replace(/^%+|%+$/g, '').trim();
              if (!termoLimpo) return '';
              const like = temPercent ? `%${termoLimpo}%` : (i === 0 ? `${termoLimpo}%` : `%${termoLimpo}%`);
              const colConds = colTexto.map((col: string) => `${col} ILIKE $${paramIndex}`);
              queryParams.push(like);
              paramIndex++;
              return `(${colConds.join(' OR ')})`;
            }).filter(Boolean);
            return andConds.length > 1 ? `(${andConds.join(' AND ')})` : andConds[0] || '';
          }
        }).filter(Boolean);

        const cond = orConds.length > 1 ? `(${orConds.join(' OR ')})` : orConds[0];
        if (cond) {
          whereConditions.push(cond);
          whereConditionsCount.push(cond);
        }
      }
    }

    const whereClause = whereConditions.length
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';
    const whereClauseCount = whereConditionsCount.length
      ? `WHERE ${whereConditionsCount.join(' AND ')}`
      : '';

    // Buscar os produtos com subqueries para nomes (evita conflito de colunas com JOINs)
    const produtosQuery = `
      SELECT p.*,
        COALESCE((SELECT m.descr FROM dbmarcas m WHERE m.codmarca = p.codmarca LIMIT 1), '') as marca_nome,
        COALESCE((SELECT gf.descr FROM dbgpfunc gf WHERE gf.codgpf = p.codgpf LIMIT 1), '') as grupo_funcao_nome,
        COALESCE((SELECT gp.descr FROM dbgpprod gp WHERE gp.codgpp = p.codgpp LIMIT 1), '') as grupo_produto_nome,
        COALESCE((
          SELECT COUNT(DISTINCT cap.arp_arm_id)
          FROM cad_armazem_produto cap
          WHERE cap.arp_codprod = p.codprod AND COALESCE(cap.arp_qtest, 0) > 0
        ), 0) as qtd_armazens,
        COALESCE((
          SELECT SUM(cap.arp_qtest)
          FROM cad_armazem_produto cap
          WHERE cap.arp_codprod = p.codprod
            AND COALESCE(cap.arp_bloqueado, 'N') <> 'S'
        ), 0) as estoque_disponivel
      FROM db_manaus.dbprod p
      ${whereClause}
      ORDER BY ${(() => {
        const allowedCols: Record<string, string> = {
          codprod: 'p.codprod',
          ref: 'p.ref',
          descr: 'p.descr',
          codmarca: 'p.codmarca',
          estoque_disponivel: 'estoque_disponivel',
          prvenda: 'p.prvenda',
        };
        const col = allowedCols[String(sortBy)] || 'p.descr';
        const dir = String(sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        return `${col} ${dir}`;
      })()}
      OFFSET $${paramIndex} LIMIT $${paramIndex + 1}
    `;

    queryParams.push(offset, itemsPerPage);
    const produtosResult = await client.query(produtosQuery, queryParams);

    // Contar o total
    const countQuery = `
      SELECT COUNT(*) as total FROM db_manaus.dbprod p
      ${whereClauseCount}
    `;

    const countParams = queryParams.slice(0, -2); // Remove offset e limit
    const countResult = await client.query(countQuery, countParams);

    const count = parseInt(countResult.rows[0].total, 10);

    // Enriquecer dados: mostrar "código - nome" como Delphi faz
    const produtos = produtosResult.rows.map((p: any) => {
      if (p.marca_nome) p.codmarca = `${p.codmarca} - ${p.marca_nome}`;
      if (p.grupo_funcao_nome) p.codgpf = `${p.codgpf} - ${p.grupo_funcao_nome}`;
      if (p.grupo_produto_nome) p.codgpp = `${p.codgpp} - ${p.grupo_produto_nome}`;
      // Remover colunas auxiliares
      delete p.marca_nome;
      delete p.grupo_funcao_nome;
      delete p.grupo_produto_nome;
      return p;
    });

    res.status(200).json({
      data: produtos.map((produto: any) => serializeBigInt(produto)),
      meta: {
        total: count,
        lastPage: Math.max(1, Math.ceil(count / itemsPerPage)),
        currentPage: Math.max(1, currentPage),
        perPage: itemsPerPage,
      },
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar produtos:', error);
    res.status(500).json({
      error: 'Erro ao buscar produtos',
      message: error.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
