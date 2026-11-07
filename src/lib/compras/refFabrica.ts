import type { PoolClient } from 'pg';
import { limparDocumentoAlfa } from '@/utils/cnpjAlfanumerico';

/**
 * Próximo cod_id de dbref_fabrica. Olha também dbprod_ref_fabrica: os vínculos vieram do
 * Oracle com ids que não existem em dbref_fabrica, e reaproveitar um deles faria a
 * referência nova herdar o produto de outra.
 */
export const SQL_PROXIMO_COD_REF = `
  SELECT GREATEST(
    (SELECT COALESCE(MAX(cod_id), 0) FROM dbref_fabrica),
    (SELECT COALESCE(MAX(cod_id), 0) FROM dbprod_ref_fabrica)
  ) + 1 AS next_id
`;

const DOC_CREDOR = `regexp_replace(upper(coalesce(cpf_cgc, '')), '[^0-9A-Z]', '', 'g')`;

export interface CredoresDaNota {
  /** Cadastros com o documento exato do emitente. */
  proprios: string[];
  /** Outras filiais: mesma raiz de CNPJ, documento diferente. */
  mesmaEmpresa: string[];
}

export interface ProdutoDaReferencia {
  codprod: string;
  referencia: string;
  descricao: string;
  marca: string;
  estoque: string | number;
  tipo: string;
  confianca: 'alta' | 'media';
}

/** Localiza os cadastros do emitente. Aceita CNPJ/CPF ou código de 5 dígitos. */
export async function credoresDaNota(
  client: PoolClient,
  fornecedor?: string | null,
): Promise<CredoresDaNota> {
  let doc = limparDocumentoAlfa(fornecedor ?? '');
  if (!doc) return { proprios: [], mesmaEmpresa: [] };

  if (doc.length <= 5) {
    const cadastro = await client.query(
      'SELECT cpf_cgc FROM dbcredor WHERE cod_credor = $1',
      [fornecedor],
    );
    if (cadastro.rows.length === 0) return { proprios: [], mesmaEmpresa: [] };
    doc = limparDocumentoAlfa(cadastro.rows[0].cpf_cgc);
    if (!doc) return { proprios: [String(fornecedor)], mesmaEmpresa: [] };
  }

  const raiz = doc.length === 14 ? doc.slice(0, 8) : null;
  const { rows } = await client.query(
    `SELECT cod_credor, ${DOC_CREDOR} AS doc
       FROM dbcredor
      WHERE ${DOC_CREDOR} = $1
         OR (length(${DOC_CREDOR}) = 14 AND left(${DOC_CREDOR}, 8) = $2)
      ORDER BY cod_credor`,
    [doc, raiz],
  );
  return {
    proprios: rows.filter((r) => r.doc === doc).map((r) => r.cod_credor),
    mesmaEmpresa: rows.filter((r) => r.doc !== doc).map((r) => r.cod_credor),
  };
}

/** Cadastro em que uma referência nova deve ser gravada. */
export function credorParaAprender(credores: CredoresDaNota): string | null {
  return credores.proprios[0] ?? credores.mesmaEmpresa[0] ?? null;
}

/**
 * Produtos ligados à referência da nota. Procura como o Delphi (referência + fornecedor
 * da nota) e, sem resultado, nas outras filiais: o vínculo costuma estar em uma só delas.
 */
export async function produtosDaReferencia(
  client: PoolClient,
  referencia: string,
  credores: CredoresDaNota,
  codMarca?: string,
): Promise<ProdutoDaReferencia[]> {
  const tentativas: Array<{ lista: string[]; marca: string | null; confianca: 'alta' | 'media' }> = [
    { lista: codMarca ? credores.proprios : [], marca: codMarca ?? null, confianca: 'alta' },
    { lista: credores.proprios, marca: null, confianca: 'media' },
    { lista: credores.mesmaEmpresa, marca: null, confianca: 'media' },
  ];

  for (const { lista, marca, confianca } of tentativas) {
    if (lista.length === 0) continue;
    const { rows } = await client.query(
      `SELECT DISTINCT
              p.codprod,
              p.ref AS referencia,
              p.descr AS descricao,
              COALESCE(m.descr, 'SEM MARCA') AS marca,
              COALESCE(p.qtest, 0) - COALESCE(p.qtdreservada, 0) AS estoque,
              p.tipo
         FROM dbref_fabrica rf
         INNER JOIN dbprod_ref_fabrica prf ON rf.cod_id = prf.cod_id
         INNER JOIN dbprod p ON prf.codprod = p.codprod
         LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
        WHERE rf.referencia = $1
          AND rf.codcredor = ANY($2)
          AND ($3::text IS NULL OR rf.codmarca = $3)
          AND p.inf NOT IN ('D')
          AND p.excluido <> 1
        ORDER BY p.codprod`,
      [referencia, lista, marca],
    );
    if (rows.length > 0) return rows.map((r) => ({ ...r, confianca }));
  }
  return [];
}
