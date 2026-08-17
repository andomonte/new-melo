import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

// Dados para o Termo de Compromisso de Baterias: cliente + produtos da fatura.
// O usuário marca na tela quais itens são baterias; o termo é gerado só com esses.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  const codfat = String(req.query.codfat || '').trim();
  if (!codfat) return res.status(400).json({ error: 'codfat é obrigatório.' });

  const client = await getPgPool().connect();
  try {
    const r = await client.query(
      `SELECT f.nroform, f.serie,
              c.nome, c.cpfcgc, c.ender, c.numero, c.bairro, c.cidade, c.uf, c.cep,
              i.codprod, i.ref, p.descr, m.descr AS marca, i.qtd::numeric AS qtd
         FROM dbfatura f
         JOIN dbclien c ON c.codcli = f.codcli
         JOIN fatura_venda fv ON fv.codfat = f.codfat
         JOIN dbvenda v ON v.codvenda = fv.codvenda
         JOIN dbitvenda i ON i.codvenda = v.codvenda
         LEFT JOIN dbprod p ON p.codprod = i.codprod
         LEFT JOIN dbmarcas m ON m.codmarca = p.codmarca
        WHERE f.codfat = $1
        ORDER BY i.ref, p.descr`,
      [codfat],
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Fatura sem produtos.' });
    }

    const c0 = r.rows[0];
    const doc = String(c0.cpfcgc || '').replace(/\D/g, '');
    const cliente = {
      nome: c0.nome || '',
      documento: doc,
      tipoDoc: doc.length === 14 ? 'CNPJ' : 'CPF',
      endereco: [
        c0.ender && `${c0.ender}${c0.numero ? ', ' + c0.numero : ''}`,
        c0.bairro,
        c0.cidade && c0.uf ? `${c0.cidade}/${c0.uf}` : c0.cidade,
        c0.cep,
      ]
        .filter(Boolean)
        .join(' - '),
    };

    // Dedup por ref+codprod, somando quantidades iguais só uma vez (mesma lógica da grade).
    const vistos = new Set<string>();
    const produtos = r.rows
      .filter((row) => {
        const k = `${row.ref}|${row.codprod}`;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .map((row) => ({
        codprod: String(row.codprod),
        ref: row.ref || '',
        descr: row.descr || '',
        marca: row.marca || '',
        qtde: Number(row.qtd || 0),
      }));

    return res.status(200).json({
      fatura: { nroform: c0.nroform, serie: c0.serie, codfat },
      cliente,
      produtos,
    });
  } catch (e: any) {
    console.error('Erro no termo de baterias:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
}
