import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { serie, numeroAtual } = req.body;

    const client = await getPgPool().connect();

    try {
      // IMPORTANTE: Buscar o maior número tanto em dbfatura quanto em dbfat_nfe
      // para evitar duplicidade com notas já autorizadas
      const result = await client.query(
        `SELECT MAX(numero) as ultimo_numero
         FROM (
           -- Números em dbfatura
           SELECT CAST(f.nroform AS INTEGER) as numero
           FROM db_manaus.dbfatura f
           WHERE f.serie = $1
             AND f.nroform IS NOT NULL
             AND f.nroform != ''
             AND f.nroform ~ '^[0-9]+$'
           
           UNION ALL
           
           -- Números em dbfat_nfe (notas já autorizadas)
           SELECT CAST(nfe.nrodoc_fiscal AS INTEGER)
           FROM db_manaus.dbfat_nfe nfe
           INNER JOIN db_manaus.dbfatura f ON f.codfat = nfe.codfat
           WHERE f.serie = $1
             AND nfe.nrodoc_fiscal IS NOT NULL
             AND nfe.nrodoc_fiscal != ''
             AND nfe.nrodoc_fiscal ~ '^[0-9]+$'
             AND nfe.status IN ('100', '150', '301', '302', '303')
         ) AS todos_numeros`,
        [serie],
      );

      let proximoNumero = 2; // Começar do 2 pois número 1 já existe na SEFAZ

      if (result.rows.length > 0 && result.rows[0].ultimo_numero !== null) {
        const ultimoNumero = parseInt(result.rows[0].ultimo_numero, 10);
        proximoNumero = ultimoNumero + 1;
        console.log(
          `📊 Série ${serie}: último número usado = ${ultimoNumero}, próximo = ${proximoNumero}`,
        );
      } else {
        console.log(
          `📊 Série ${serie}: começando do número 2 (número 1 já existe na SEFAZ)`,
        );
      }

      console.log(
        `✅ Próximo número disponível para série ${serie}: ${proximoNumero}`,
      );

      return res.status(200).json({
        sucesso: true,
        proximoNumero: proximoNumero,
        ultimoNumeroUsado:
          result.rows.length > 0 && result.rows[0].ultimo_numero !== null
            ? parseInt(result.rows[0].ultimo_numero, 10)
            : 0,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Erro ao obter próximo número de NFe:', error);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro ao obter próximo número de NFe',
      detalhe: error.message,
    });
  }
}
