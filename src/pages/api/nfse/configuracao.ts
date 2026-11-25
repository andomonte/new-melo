import type { NextApiRequest, NextApiResponse } from 'next';
import { ambienteSefin } from '@/lib/nfse/sefin/emissao';
import { ambienteAdn } from '@/lib/nfse/adn/distribuicao';

/** Ambiente da emissão/busca e série da DPS — para a tela avisar se é teste ou produção. */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({
    emissao: ambienteSefin(),
    busca: ambienteAdn(),
    serie: String(process.env.NFSE_DPS_SERIE || '1'),
    certificadoTeste: !!process.env.NFSE_TESTE_PFX,
  });
}
