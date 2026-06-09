import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';

// Mapeamento UF -> código IBGE (primeiros 2 dígitos do código de município)
const UF_IBGE: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23',
  DF: '53', ES: '32', GO: '52', MA: '21', MT: '51', MS: '50',
  MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22',
  RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17',
};

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { codmunicipio, uf } = req.query;

  if (!codmunicipio || typeof codmunicipio !== 'string' || !codmunicipio.trim()) {
    return res.status(400).json({ error: 'codmunicipio é obrigatório' });
  }

  if (!uf || typeof uf !== 'string' || !uf.trim()) {
    return res.status(400).json({ error: 'uf é obrigatório' });
  }

  const ufUpper = uf.trim().toUpperCase();
  const codMun = codmunicipio.trim();

  // Exterior: sempre válido
  if (ufUpper === 'EX') {
    return res.status(200).json({ valido: true });
  }

  // Verificar pelo mapeamento estático IBGE
  const prefixoEsperado = UF_IBGE[ufUpper];

  if (!prefixoEsperado) {
    return res.status(200).json({
      valido: false,
      message: `UF "${ufUpper}" não reconhecida.`,
    });
  }

  const prefixoMunicipio = codMun.substring(0, 2);

  if (prefixoMunicipio !== prefixoEsperado) {
    return res.status(200).json({
      valido: false,
      message: `O município (código ${codMun}) não pertence à UF ${ufUpper}. Esperado prefixo ${prefixoEsperado}, encontrado ${prefixoMunicipio}.`,
    });
  }

  return res.status(200).json({ valido: true });
}
