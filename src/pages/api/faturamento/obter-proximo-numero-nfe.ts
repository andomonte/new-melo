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
    const { serie, numeroAtual, insc07 } = req.body;
    const insc07Norm = String(insc07 ?? 'N').toUpperCase() === 'S' ? 'S' : 'N';

    const client = await getPgPool().connect();

    try {
      // Número = 1 + MAIOR entre: (a) MAX(nroform) em dbfatura escopado por (serie,insc07)
      // e (b) MAX(nNF) das NF-e já USADAS na SEFAZ naquela SÉRIE (lido da chave). O (b)
      // fecha a fragmentação (notas antigas via override têm dbfatura.serie='2' mas chave
      // série='1') e evita reemitir número já autorizado na SEFAZ.
      const serieChave = String(serie).replace(/\D/g, '').padStart(3, '0');
      const result = await client.query(
        `SELECT GREATEST(
           COALESCE((SELECT MAX(CAST(f.nroform AS INTEGER))
                       FROM db_manaus.dbfatura f
                      WHERE f.serie = $1 AND COALESCE(f.insc07,'N') = $2
                        AND f.nroform ~ '^[0-9]+$'), 0),
           COALESCE((SELECT MAX(CAST(substring(n.chave,26,9) AS INTEGER))
                       FROM db_manaus.dbfat_nfe n
                      WHERE length(n.chave) = 44 AND substring(n.chave,23,3) = $3
                        AND n.status IN ('100','150','301','302','303')), 0)
         ) AS ultimo_numero`,
        [serie, insc07Norm, serieChave],
      );

      let proximoNumero = 1;

      if (result.rows.length > 0 && result.rows[0].ultimo_numero !== null) {
        const ultimoNumero = parseInt(result.rows[0].ultimo_numero, 10);
        proximoNumero = ultimoNumero + 1;
        console.log(
          `📊 Série ${serie}/insc07 ${insc07Norm}: último número = ${ultimoNumero}, próximo = ${proximoNumero}`,
        );
      } else {
        console.log(`📊 Série ${serie}/insc07 ${insc07Norm}: começando do número 1`);
      }

      // SALVAGUARDA anti-539: nunca reofertar um número <= o que acabou de ser
      // rejeitado (numeroAtual). Se colidiu, salta pra frente do rejeitado.
      const numAtualInt = parseInt(String(numeroAtual ?? '').replace(/\D/g, ''), 10);
      if (Number.isFinite(numAtualInt) && numAtualInt >= proximoNumero) {
        proximoNumero = numAtualInt + 1;
        console.log(`⚠️ numeroAtual (${numAtualInt}) rejeitado — saltando para ${proximoNumero}`);
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
