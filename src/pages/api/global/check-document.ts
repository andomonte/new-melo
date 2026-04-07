import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { doc } = req.query;

  if (!doc || typeof doc !== 'string') {
    return res.status(200).json({ found: false, matches: [] });
  }

  // Clean document (remove non-numeric characters)
  const cleanDoc = doc.replace(/\D/g, '');

  if (!cleanDoc && !doc.trim()) {
    return res.status(200).json({ found: false, matches: [] });
  }

  const searchDoc = cleanDoc || doc;

  console.log('🔍 [check-document] Searching for doc:', {
    original: doc,
    cleaned: cleanDoc,
    searchDoc,
  });

  const pool = getPgPool();

  try {
    // Use pg with regexp_replace to strip ALL non-numeric characters for comparison
    const [clientResult, supplierResult, transporterResult] = await Promise.all(
      [
        pool
          .query(
            `SELECT codcli, nome, cpfcgc, tipo 
         FROM dbclien 
         WHERE regexp_replace(cpfcgc, '[^0-9]', '', 'g') = $1 
         LIMIT 1`,
            [searchDoc],
          )
          .catch((e) => {
            console.error('Error querying dbclien:', e);
            return { rows: [] };
          }),

        pool
          .query(
            `SELECT cod_credor, nome, cpf_cgc, tipo 
         FROM dbcredor 
         WHERE regexp_replace(cpf_cgc, '[^0-9]', '', 'g') = $1 
         LIMIT 1`,
            [searchDoc],
          )
          .catch((e) => {
            console.error('Error querying dbcredor:', e);
            return { rows: [] };
          }),

        pool
          .query(
            `SELECT codtransp, nome, cpfcgc, tipo 
         FROM dbtransp 
         WHERE regexp_replace(cpfcgc, '[^0-9]', '', 'g') = $1 
         LIMIT 1`,
            [searchDoc],
          )
          .catch((e) => {
            console.error('Error querying dbtransp:', e);
            return { rows: [] };
          }),
      ],
    );

    console.log('📊 [check-document] Query results:', {
      clientRows: clientResult.rows.length,
      supplierRows: supplierResult.rows.length,
      transporterRows: transporterResult.rows.length,
    });

    const client = clientResult.rows[0] || null;
    const supplier = supplierResult.rows[0] || null;
    const transporter = transporterResult.rows[0] || null;

    const matches = [];

    if (client) {
      console.log('✅ [check-document] Found CLIENT:', client.nome);
      matches.push({
        type: 'CLIENTE',
        id: client.codcli,
        name: client.nome,
        doc: client.cpfcgc,
      });
    }

    if (supplier) {
      console.log('✅ [check-document] Found SUPPLIER:', supplier.nome);
      matches.push({
        type: 'FORNECEDOR',
        id: supplier.cod_credor,
        name: supplier.nome,
        doc: supplier.cpf_cgc,
      });
    }

    if (transporter) {
      console.log('✅ [check-document] Found TRANSPORTER:', transporter.nome);
      matches.push({
        type: 'TRANSPORTADORA',
        id: transporter.codtransp,
        name: transporter.nome,
        doc: transporter.cpfcgc,
      });
    }

    console.log('📋 [check-document] Final result:', {
      found: matches.length > 0,
      matchCount: matches.length,
    });

    return res.status(200).json({
      found: matches.length > 0,
      matches,
    });
  } catch (error) {
    console.error('Error checking document:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
