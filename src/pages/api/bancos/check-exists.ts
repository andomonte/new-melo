import type { NextApiRequest, NextApiResponse } from 'next';
import { Banco } from '@/data/bancos/bancos';

// Mock database
const existingBancos: Banco[] = [
  { banco: '237', nome: 'Banco Bradesco S.A.' },
  { banco: '001', nome: 'Banco do Brasil S.A.' },
  { banco: '341', nome: 'Itaú Unibanco S.A.' },
  { banco: '11', nome: 'Banco Fictício 11' },
  { banco: '002', nome: 'Banco Fictício 2' },
  { banco: '14', nome: 'Banco Fictício 14' },
];

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ data: Banco } | { error: string }>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { codigo } = req.query;

  if (typeof codigo !== 'string' || isNaN(Number(codigo))) {
    return res.status(400).json({ error: 'Código (ID) inválido.' });
  }

  const foundBanco = existingBancos.find(
    (b) => Number(b.banco) === Number(codigo),
  );

  if (foundBanco) {
    return res.status(200).json({ data: foundBanco });
  } else {
    return res.status(404).json({ error: 'Banco não encontrado.' });
  }
}
