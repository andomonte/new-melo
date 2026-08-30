// src/lib/financeiro/arquivosCrud.ts
//
// CRUD compartilhado das telas de "Financeiro > Arquivos" (porte do menu
// Financeiro > Arquivos do Delphi). São 8 cadastros com o mesmo formato de
// listagem (paginação + busca global + filtros por coluna, igual ao /api/cfop)
// mudando só tabela, colunas e validação — por isso a lógica mora aqui e cada
// rota declara apenas a sua configuração.
//
// As telas do Delphi geram o código pelo package Oracle (INC_*, que faz
// SELECT MAX + 1 e devolve o código zero-preenchido). `pkGerada` reproduz isso.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';

/** Coluna do cadastro: `prop` é o nome exposto na API, `coluna` o nome real. */
export interface ColunaArquivo {
  prop: string;
  coluna: string;
}

export interface ConfigArquivo {
  /** Tabela física (ex.: 'dbcompradores'). */
  tabela: string;
  /** Coluna da chave primária. */
  pk: ColunaArquivo;
  /** Se preenchido, a PK é gerada como no Delphi: lpad(MAX+1, tamanho, '0'). */
  pkGerada?: { tamanho: number };
  /** Valida a PK informada pelo usuário (cadastros sem código automático). */
  normalizarPk?: (body: Record<string, any>) => string;
  /** Colunas graváveis (não inclui a PK quando ela é gerada). */
  colunas: ColunaArquivo[];
  /** Colunas varridas pela busca global (SQL já qualificado). */
  colunasBusca: string[];
  /** ORDER BY da listagem (SQL já qualificado). */
  ordem: string;
  /**
   * SELECT/FROM alternativos para trazer descrições de tabelas relacionadas
   * (o Delphi mostra, por ex., o nome da agência ao lado da conta). Quando
   * informados, `aliasTabela` precisa apontar para a tabela principal.
   */
  selectLista?: string;
  fromLista?: string;
  aliasTabela?: string;
  /** Habilita DELETE (só UF e CFOP têm exclusão no Delphi). */
  permiteExcluir?: boolean;
  /**
   * Valida e normaliza o corpo da requisição. Deve devolver um objeto com as
   * `prop`s das colunas. Lança `ErroValidacao` para devolver 400 ao usuário.
   */
  normalizar: (
    body: Record<string, any>,
    modo: 'criar' | 'editar',
  ) => Record<string, any>;
  /**
   * Validações que precisam do banco (existência de FK, duplicidade por nome,
   * "só na matriz" etc.). Lance `ErroValidacao` para devolver 400.
   */
  antesDeSalvar?: (
    client: PoolClient,
    valores: Record<string, any>,
    modo: 'criar' | 'editar',
    id?: string,
  ) => Promise<void>;
}

/** Levanta ErroValidacao se o código não existir na tabela indicada. */
export async function exigirExistencia(
  client: PoolClient,
  tabela: string,
  coluna: string,
  valor: unknown,
  rotulo: string,
): Promise<void> {
  const { rows } = await client.query(
    `SELECT 1 FROM ${tabela} WHERE "${coluna}" = $1 LIMIT 1`,
    [valor],
  );
  if (!rows.length) throw new ErroValidacao(`${rotulo} inválido(a).`);
}

export class ErroValidacao extends Error {}

/** Aplica as regras de campo do Delphi (trim + caixa alta + obrigatoriedade). */
export function texto(
  valor: unknown,
  opts: { campo: string; min?: number; max?: number; upper?: boolean; obrigatorio?: boolean } ,
): string {
  const bruto = valor === null || valor === undefined ? '' : String(valor).trim();
  const v = opts.upper === false ? bruto : bruto.toUpperCase();

  if (!v.length) {
    if (opts.obrigatorio) throw new ErroValidacao(`Informe ${opts.campo}.`);
    return '';
  }
  if (opts.min && v.length < opts.min) {
    throw new ErroValidacao(
      `${opts.campo} deve ter no mínimo ${opts.min} caracteres.`,
    );
  }
  if (opts.max && v.length > opts.max) {
    throw new ErroValidacao(
      `${opts.campo} deve ter no máximo ${opts.max} caracteres.`,
    );
  }
  return v;
}

/** Aceita "12,50" e "12.50" (o Delphi usa MaskEdit 99.99). */
export function decimal(
  valor: unknown,
  opts: { campo: string; min?: number; max?: number; obrigatorio?: boolean },
): number | null {
  const bruto = valor === null || valor === undefined ? '' : String(valor).trim();
  if (!bruto.length) {
    if (opts.obrigatorio) throw new ErroValidacao(`Informe ${opts.campo}.`);
    return null;
  }
  const n = Number(bruto.replace(',', '.'));
  if (!Number.isFinite(n)) {
    throw new ErroValidacao(`${opts.campo} inválido.`);
  }
  if (opts.min !== undefined && n < opts.min) {
    throw new ErroValidacao(`${opts.campo} não pode ser menor que ${opts.min}.`);
  }
  if (opts.max !== undefined && n > opts.max) {
    throw new ErroValidacao(`${opts.campo} não pode ser maior que ${opts.max}.`);
  }
  return n;
}

/** Combos S/N do Delphi (RadioGroup / ComboBox de duas opções). */
export function simNao(valor: unknown, padrao: 'S' | 'N' = 'N'): 'S' | 'N' {
  const v = String(valor ?? '').trim().toUpperCase();
  return v === 'S' ? 'S' : v === 'N' ? 'N' : padrao;
}

/** Zero à esquerda — equivalente ao StrZero() do util.pas do Delphi. */
export function zeroEsquerda(valor: string, tamanho: number): string {
  return String(valor ?? '').trim().padStart(tamanho, '0');
}

const q = (nome: string) => `"${nome}"`;

const OPERADORES: Record<string, string> = {
  igual: '=',
  diferente: '<>',
  maior: '>',
  maior_igual: '>=',
  menor: '<',
  menor_igual: '<=',
};

function montarWhere(
  cfg: ConfigArquivo,
  source: Record<string, any>,
  params: any[],
): string {
  const grupos: string[] = [];
  const filtros = Array.isArray(source.filtros) ? source.filtros : [];
  const alias = cfg.aliasTabela ? `${cfg.aliasTabela}.` : '';

  // Filtros por coluna (mesmo contrato do DataTableFiltro usado no CFOP).
  const porCampo = new Map<string, { tipo: string; valor: string }[]>();
  filtros.forEach((f: { campo: string; tipo: string; valor: string }) => {
    if (!porCampo.has(f.campo)) porCampo.set(f.campo, []);
    porCampo.get(f.campo)!.push({ tipo: f.tipo, valor: f.valor });
  });

  porCampo.forEach((lista, campo) => {
    const col = [cfg.pk, ...cfg.colunas].find((c) => c.prop === campo);
    if (!col) return;
    const sql = `${alias}${q(col.coluna)}`;
    const partes: string[] = [];

    lista.forEach((f) => {
      const op = OPERADORES[f.tipo];
      if (op) {
        partes.push(`${sql} ${op} $${params.length + 1}`);
        params.push(String(f.valor));
      } else {
        partes.push(`${sql}::text ILIKE $${params.length + 1}`);
        params.push(`%${f.valor}%`);
      }
    });

    if (partes.length) grupos.push(`(${partes.join(' OR ')})`);
  });

  // Busca global — só quando não há filtro por coluna, igual ao /api/cfop.
  const search = String(source.search ?? '').trim();
  if (search && grupos.length === 0) {
    const idx = params.length + 1;
    grupos.push(
      `(${cfg.colunasBusca.map((c) => `${c}::text ILIKE $${idx}`).join(' OR ')})`,
    );
    params.push(`%${search}%`);
  }

  return grupos.length ? `WHERE ${grupos.join(' AND ')}` : '';
}

async function proximoCodigo(
  client: PoolClient,
  cfg: ConfigArquivo,
): Promise<string> {
  // O package Oracle faz SELECT MAX+1; aqui um advisory lock por tabela evita
  // que duas inclusões simultâneas cheguem ao mesmo código.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [cfg.tabela]);
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(${q(cfg.pk.coluna)}, '\\D', '', 'g'), '')::bigint), 0) + 1 AS proximo
     FROM ${cfg.tabela}`,
  );
  return zeroEsquerda(String(rows[0].proximo), cfg.pkGerada!.tamanho);
}

/** Handler de /api/financeiro/arquivos/<entidade> (listar + criar). */
export function criarHandlerLista(cfg: ConfigArquivo) {
  return async function handle(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return listar(cfg, req, res);
    if (req.method === 'POST') {
      // O GenericCrudPage lista via POST; a criação vem sem page/filtros.
      const ehListagem =
        'page' in req.body || 'filtros' in req.body || 'search' in req.body;
      return ehListagem ? listar(cfg, req, res) : criar(cfg, req, res);
    }
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  };
}

/** Handler de /api/financeiro/arquivos/<entidade>/[id] (ler + editar + excluir). */
export function criarHandlerItem(cfg: ConfigArquivo) {
  return async function handle(req: NextApiRequest, res: NextApiResponse) {
    const id = String(req.query.id ?? '').trim();
    if (!id) return res.status(400).json({ error: 'Código não informado.' });

    if (req.method === 'GET') return obter(cfg, id, res);
    if (req.method === 'PUT') return editar(cfg, id, req, res);
    if (req.method === 'DELETE') return excluir(cfg, id, res);

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  };
}

function selectDeLista(cfg: ConfigArquivo) {
  if (cfg.selectLista) return cfg.selectLista;
  return [cfg.pk, ...cfg.colunas]
    .map((c) => `${q(c.coluna)} AS ${q(c.prop)}`)
    .join(', ');
}

async function listar(
  cfg: ConfigArquivo,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const source = req.method === 'POST' ? req.body : req.query;
  const page = Math.max(1, Number(source.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(source.perPage) || 10));

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();

    const params: any[] = [];
    const where = montarWhere(cfg, source, params);
    const from = cfg.fromLista ?? cfg.tabela;

    const total = Number(
      (await client.query(`SELECT COUNT(*) AS n FROM ${from} ${where}`, params))
        .rows[0].n,
    );

    const { rows } = await client.query(
      `SELECT ${selectDeLista(cfg)}
       FROM ${from}
       ${where}
       ORDER BY ${cfg.ordem}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, perPage, (page - 1) * perPage],
    );

    return res.status(200).json({
      data: rows,
      meta: {
        total,
        perPage,
        currentPage: total > 0 ? page : 1,
        lastPage: total > 0 ? Math.ceil(total / perPage) : 1,
        firstPage: 1,
      },
    });
  } catch (erro: any) {
    console.error(`Erro ao listar ${cfg.tabela}:`, erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}

async function obter(cfg: ConfigArquivo, id: string, res: NextApiResponse) {
  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();
    const { rows } = await client.query(
      `SELECT ${[cfg.pk, ...cfg.colunas]
        .map((c) => `${q(c.coluna)} AS ${q(c.prop)}`)
        .join(', ')}
       FROM ${cfg.tabela} WHERE ${q(cfg.pk.coluna)} = $1`,
      [id],
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }
    return res.status(200).json(rows[0]);
  } catch (erro: any) {
    console.error(`Erro ao buscar ${cfg.tabela}:`, erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}

async function criar(
  cfg: ConfigArquivo,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let client: PoolClient | undefined;
  try {
    const valores = cfg.normalizar(req.body ?? {}, 'criar');
    client = await getPgPool().connect();
    await client.query('BEGIN');
    await cfg.antesDeSalvar?.(client, valores, 'criar');

    const pk = cfg.pkGerada
      ? await proximoCodigo(client, cfg)
      : cfg.normalizarPk
        ? cfg.normalizarPk(req.body ?? {})
        : texto(req.body?.[cfg.pk.prop], { campo: 'o código', obrigatorio: true });

    const colunas = [cfg.pk, ...cfg.colunas];
    const params = [pk, ...cfg.colunas.map((c) => valores[c.prop] ?? null)];

    const { rows } = await client.query(
      `INSERT INTO ${cfg.tabela} (${colunas.map((c) => q(c.coluna)).join(', ')})
       VALUES (${colunas.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING ${colunas.map((c) => `${q(c.coluna)} AS ${q(c.prop)}`).join(', ')}`,
      params,
    );

    await client.query('COMMIT');
    return res.status(201).json(rows[0]);
  } catch (erro: any) {
    await client?.query('ROLLBACK').catch(() => {});
    if (erro instanceof ErroValidacao) {
      return res.status(400).json({ error: erro.message });
    }
    if (erro?.code === '23505') {
      return res.status(409).json({ error: 'Este registro já está cadastrado.' });
    }
    console.error(`Erro ao criar em ${cfg.tabela}:`, erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}

async function editar(
  cfg: ConfigArquivo,
  id: string,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let client: PoolClient | undefined;
  try {
    const valores = cfg.normalizar(req.body ?? {}, 'editar');
    client = await getPgPool().connect();
    await cfg.antesDeSalvar?.(client, valores, 'editar', id);

    const sets = cfg.colunas
      .map((c, i) => `${q(c.coluna)} = $${i + 1}`)
      .join(', ');

    const { rows } = await client.query(
      `UPDATE ${cfg.tabela} SET ${sets}
       WHERE ${q(cfg.pk.coluna)} = $${cfg.colunas.length + 1}
       RETURNING ${[cfg.pk, ...cfg.colunas]
         .map((c) => `${q(c.coluna)} AS ${q(c.prop)}`)
         .join(', ')}`,
      [...cfg.colunas.map((c) => valores[c.prop] ?? null), id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }
    return res.status(200).json(rows[0]);
  } catch (erro: any) {
    if (erro instanceof ErroValidacao) {
      return res.status(400).json({ error: erro.message });
    }
    if (erro?.code === '23505') {
      return res.status(409).json({ error: 'Já existe outro registro com estes dados.' });
    }
    console.error(`Erro ao editar ${cfg.tabela}:`, erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}

async function excluir(cfg: ConfigArquivo, id: string, res: NextApiResponse) {
  if (!cfg.permiteExcluir) {
    // O Delphi só permite excluir em CFOP e UF; nos demais o registro é
    // referenciado por lançamentos e a tela nem oferece a opção.
    return res
      .status(405)
      .json({ error: 'Este cadastro não permite exclusão.' });
  }

  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();
    const r = await client.query(
      `DELETE FROM ${cfg.tabela} WHERE ${q(cfg.pk.coluna)} = $1`,
      [id],
    );
    if (!r.rowCount) {
      return res.status(404).json({ error: 'Registro não encontrado.' });
    }
    return res.status(204).end();
  } catch (erro: any) {
    if (erro?.code === '23503') {
      return res.status(409).json({
        error: 'Registro em uso por outros lançamentos — não pode ser excluído.',
      });
    }
    console.error(`Erro ao excluir de ${cfg.tabela}:`, erro);
    return res.status(500).json({ error: erro.message });
  } finally {
    client?.release();
  }
}
