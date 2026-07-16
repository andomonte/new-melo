import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

interface Filtro {
  campo: string;
  tipo: string;
  valor: string;
}

interface RequestBody {
  page: number;
  perPage: number;
  productSearch: string;
  tipoPreco?: string;
  filtros: Filtro[];
}

/**
 * Colunas que podem ir para a SQL. O Postgres não parametriza NOME de coluna
 * (só valores), então `campo` é interpolado — sem esta checagem ele executa SQL
 * arbitrário. Verificado: `campo` = "codprod IS NOT NULL AND p.codmarca =
 * '00080' --" com tipo "nao_nulo" derrubava o total de 385.575 para 14.693.
 *
 * A lista vem do próprio banco (não é hardcode que envelhece) e é cacheada por
 * processo. Bônus: a grade oferece colunas calculadas no SELECT (ex.:
 * qtd_armazens) que não existem em dbprod — filtrar por elas dava erro 500.
 */
let colunasValidas: Map<string, string> | null = null;

/** Nome da coluna -> data_type. O tipo importa: ILIKE em coluna numérica é erro
 *  no Postgres ("operator does not exist: integer ~~* unknown"), e 63 das 103
 *  colunas de dbprod não são texto. */
async function carregarColunasValidas(
  client: PoolClient,
): Promise<Map<string, string>> {
  if (colunasValidas) return colunasValidas;
  const r = await client.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'db_manaus' AND table_name = 'dbprod'`,
  );
  colunasValidas = new Map(
    r.rows.map((x: any) => [
      String(x.column_name).trim().toLowerCase(),
      String(x.data_type).trim().toLowerCase(),
    ]),
  );
  return colunasValidas;
}

const TIPOS_NUM = new Set([
  'numeric',
  'integer',
  'bigint',
  'smallint',
  'double precision',
  'real',
]);
const TIPOS_DATA = new Set([
  'date',
  'timestamp without time zone',
  'timestamp with time zone',
]);

/** O valor digitado serve para comparar com uma coluna deste tipo? */
const valorCompativel = (valor: string, tipo: string): boolean => {
  const v = String(valor ?? '').trim();
  if (!v) return false;
  if (TIPOS_NUM.has(tipo)) return Number.isFinite(Number(v.replace(',', '.')));
  if (TIPOS_DATA.has(tipo)) return !Number.isNaN(Date.parse(v));
  return true;
};

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const {
    page = 1,
    perPage = 10,
    productSearch = '',
    filtros = [],
    status = 'ativo',
  }: RequestBody & { status?: string } = req.body;
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const currentPage = Number(page);
    const itemsPerPage = Number(perPage);
    const offset = (currentPage - 1) * itemsPerPage;

    // Construir a cláusula WHERE (com alias p. para uso na query principal)
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Status do produto (ver memória produto-status-ativo-inativo):
    //   ativo (padrão) => inf <> 'D' | inativo => inf='D' | todos => sem filtro
    if (status === 'inativo') {
      whereConditions.push(`p.inf = 'D'`);
    } else if (status !== 'todos') {
      whereConditions.push(`p.inf IS DISTINCT FROM 'D'`);
    }

    // Busca geral
    if (productSearch && productSearch.trim()) {
      whereConditions.push(
        `(p.codprod ILIKE $${paramIndex} OR p.descr ILIKE $${paramIndex} OR p.ref ILIKE $${paramIndex})`,
      );
      queryParams.push(`%${productSearch.trim()}%`);
      paramIndex++;
    }

    // Colunas exibidas como "codigo - nome": o usuário digita o NOME (BOSCH),
    // mas a coluna guarda só o código (00080) — filtrar na coluna crua não
    // acha nada. Aqui a comparação passa a ser feita sobre "codigo - nome",
    // que é exatamente o que está na tela.
    const EXIBE_COD_NOME: Record<string, string> = {
      codmarca: `(p.codmarca || ' - ' || COALESCE((SELECT m.descr FROM dbmarcas m WHERE m.codmarca = p.codmarca LIMIT 1), ''))`,
      codgpf: `(p.codgpf || ' - ' || COALESCE((SELECT gf.descr FROM dbgpfunc gf WHERE gf.codgpf = p.codgpf LIMIT 1), ''))`,
      codgpp: `(p.codgpp || ' - ' || COALESCE((SELECT gp.descr FROM dbgpprod gp WHERE gp.codgpp = p.codgpp LIMIT 1), ''))`,
    };

    const permitidas = await carregarColunasValidas(client);

    // Filtros específicos por coluna
    for (const filtro of filtros) {
      if (!filtro.campo || !filtro.tipo) continue;

      const campo = String(filtro.campo).trim().toLowerCase();

      // Só colunas reais de dbprod entram na SQL. Ignora em vez de derrubar a
      // requisição: a grade lista colunas calculadas que não existem na tabela.
      if (!permitidas.has(campo)) {
        console.warn(`Filtro ignorado — coluna não permitida: ${filtro.campo}`);
        continue;
      }

      const campoAlias = EXIBE_COD_NOME[campo] ?? `p.${campo}`;
      const tipo = filtro.tipo;
      const valor = filtro.valor;

      // Tipo real da coluna. As colunas "código - nome" viram texto na
      // expressão acima, então valem como texto.
      const tipoCol = EXIBE_COD_NOME[campo]
        ? 'character varying'
        : permitidas.get(campo) || 'character varying';
      const ehNum = TIPOS_NUM.has(tipoCol);
      const ehData = TIPOS_DATA.has(tipoCol);

      // Comparar como TEXTO (ILIKE) exige cast: ILIKE direto em integer/numeric
      // é erro no Postgres, e era isso que derrubava o filtro de Estoque/Preço.
      const comoTexto = ehNum || ehData ? `${campoAlias}::text` : campoAlias;

      // Comparações de ordem/igualdade convertem o PARÂMETRO para o tipo da
      // coluna (o valor chega sempre como string do formulário).
      const castParam = ehNum ? '::numeric' : ehData ? '::date' : '';

      // Valor incompatível (ex.: "abc" em coluna numérica) faria a query
      // estourar — ignora o filtro em vez de derrubar a listagem.
      const precisaValor = [
        'igual', 'diferente', 'contém', 'começa', 'termina',
        'maior', 'maior_igual', 'menor', 'menor_igual',
      ].includes(tipo);
      const comparaNativo = ['igual', 'diferente', 'maior', 'maior_igual', 'menor', 'menor_igual'].includes(tipo);
      if (precisaValor && !String(valor ?? '').trim()) continue;
      if (comparaNativo && !valorCompativel(valor, tipoCol)) {
        console.warn(`Filtro ignorado — valor "${valor}" incompatível com ${campo} (${tipoCol})`);
        continue;
      }
      // number aceita vírgula decimal do usuário
      const valorNum = ehNum ? String(valor).trim().replace(',', '.') : valor;

      switch (tipo) {
        case 'igual':
          whereConditions.push(`${campoAlias} = $${paramIndex}${castParam}`);
          queryParams.push(valorNum);
          paramIndex++;
          break;
        case 'diferente':
          whereConditions.push(`${campoAlias} != $${paramIndex}${castParam}`);
          queryParams.push(valorNum);
          paramIndex++;
          break;
        case 'contém':
          whereConditions.push(`${comoTexto} ILIKE $${paramIndex}`);
          queryParams.push(`%${valor}%`);
          paramIndex++;
          break;
        case 'começa':
          whereConditions.push(`${comoTexto} ILIKE $${paramIndex}`);
          queryParams.push(`${valor}%`);
          paramIndex++;
          break;
        case 'termina':
          whereConditions.push(`${comoTexto} ILIKE $${paramIndex}`);
          queryParams.push(`%${valor}`);
          paramIndex++;
          break;
        case 'maior':
          whereConditions.push(`${campoAlias} > $${paramIndex}${castParam}`);
          queryParams.push(valorNum);
          paramIndex++;
          break;
        case 'maior_igual':
          whereConditions.push(`${campoAlias} >= $${paramIndex}${castParam}`);
          queryParams.push(valorNum);
          paramIndex++;
          break;
        case 'menor':
          whereConditions.push(`${campoAlias} < $${paramIndex}${castParam}`);
          queryParams.push(valorNum);
          paramIndex++;
          break;
        case 'menor_igual':
          whereConditions.push(`${campoAlias} <= $${paramIndex}${castParam}`);
          queryParams.push(valorNum);
          paramIndex++;
          break;
        case 'nulo':
          whereConditions.push(`${campoAlias} IS NULL`);
          break;
        case 'nao_nulo':
          whereConditions.push(`${campoAlias} IS NOT NULL`);
          break;
        default:
          console.warn(`Tipo de filtro não reconhecido: ${tipo}`);
      }
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // Buscar os produtos com subqueries para nomes (evita conflito de colunas)
    const produtosQuery = `
      SELECT p.*,
        COALESCE((SELECT m.descr FROM dbmarcas m WHERE m.codmarca = p.codmarca LIMIT 1), '') as marca_nome,
        COALESCE((SELECT gf.descr FROM dbgpfunc gf WHERE gf.codgpf = p.codgpf LIMIT 1), '') as grupo_funcao_nome,
        COALESCE((SELECT gp.descr FROM dbgpprod gp WHERE gp.codgpp = p.codgpp LIMIT 1), '') as grupo_produto_nome,
        COALESCE((
          SELECT COUNT(DISTINCT cap.arp_arm_id)
          FROM cad_armazem_produto cap
          WHERE cap.arp_codprod = p.codprod AND COALESCE(cap.arp_qtest, 0) > 0
        ), 0) as qtd_armazens
      FROM db_manaus.dbprod p
      ${whereClause}
      ORDER BY p.descr
      OFFSET $${paramIndex} LIMIT $${paramIndex + 1}
    `;

    queryParams.push(offset, itemsPerPage);
    const produtosResult = await client.query(produtosQuery, queryParams);

    // Conta o total com o MESMO WHERE da listagem (mesmo alias "p"). Antes eram
    // dois WHERE construídos em paralelo, que podiam divergir — e as subqueries
    // correlacionadas (marca/grupo) quebram sem o alias: "m.codmarca = codmarca"
    // resolveria o lado direito para a própria tabela interna.
    const countQuery = `
      SELECT COUNT(*) as total FROM db_manaus.dbprod p
      ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2); // Remove offset e limit
    const countResult = await client.query(countQuery, countParams);

    // Enriquecer dados: "código - nome" como Delphi
    const produtos = produtosResult.rows.map((p: any) => {
      if (p.marca_nome) p.codmarca = `${p.codmarca} - ${p.marca_nome}`;
      if (p.grupo_funcao_nome) p.codgpf = `${p.codgpf} - ${p.grupo_funcao_nome}`;
      if (p.grupo_produto_nome) p.codgpp = `${p.codgpp} - ${p.grupo_produto_nome}`;
      delete p.marca_nome;
      delete p.grupo_funcao_nome;
      delete p.grupo_produto_nome;
      return p;
    });
    const count = parseInt(countResult.rows[0].total, 10);

    // DEBUG: Log dos campos retornados
    if (produtos.length > 0) {
      console.log('🔍 API buscaComFiltro - Campos retornados:', Object.keys(produtos[0]));
      console.log('🔍 API buscaComFiltro - Primeiro produto:', produtos[0].codprod);
      console.log('🔍 API buscaComFiltro - Marca do primeiro produto:', produtos[0].codmarca);
    }

    res.status(200).json({
      data: produtos.map((produto) => serializeBigInt(produto)),
      meta: {
        total: count,
        lastPage: Math.max(1, Math.ceil(count / itemsPerPage)),
        currentPage: Math.max(1, currentPage),
        perPage: itemsPerPage,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar produtos com filtro:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos com filtro' });
  } finally {
    if (client) {
      client.release();
    }
  }
}