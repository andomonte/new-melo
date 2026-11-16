// GET /api/remessa/bancaria/arquivo/<nome> — download do arquivo CNAB gerado.
//
// Antes o arquivo era gravado em public/remessas/bancaria e baixado como estático;
// no container essa pasta não é gravável (ver src/lib/arquivosServidor.ts).
// Procura primeiro na pasta nova e, para arquivos antigos, na pasta pública.

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import {
  DIR_ARQUIVOS,
  DIR_REMESSA_BANCARIA_LEGADO,
  SUB_REMESSA_BANCARIA,
  nomeArquivoSeguro,
} from '@/lib/arquivosServidor';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const nome = nomeArquivoSeguro(String(req.query.nome || ''));
  if (!nome) return res.status(400).json({ error: 'Nome de arquivo inválido' });

  const candidatos = [
    path.join(DIR_ARQUIVOS, ...SUB_REMESSA_BANCARIA, nome),
    path.join(DIR_REMESSA_BANCARIA_LEGADO, nome),
  ];
  const caminho = candidatos.find((c) => fs.existsSync(c));
  if (!caminho) return res.status(404).json({ error: 'Arquivo de remessa não encontrado no servidor' });

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(fs.readFileSync(caminho));
}
