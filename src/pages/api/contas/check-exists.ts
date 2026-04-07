import type { NextApiRequest, NextApiResponse } from 'next';
import { Conta } from '@/data/contas/contas';

// Mock database of accounts
const existingContas: Conta[] = [
  {
    id: 101,
    banco: '237',
    agencia: '1234',
    nroconta: '56789-0',
    tipo: 'NF',
    carteira: '09',
    status: 'ATIVO',
    convenio: '123456',
    variacao: '01',
    melo: '1',
  },
  {
    id: 102,
    banco: '001',
    agencia: '4321',
    nroconta: '98765-4',
    tipo: 'FAG',
    carteira: '17',
    status: 'INATIVO',
    convenio: '654321',
    variacao: '',
    melo: '2',
  },
];

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ data: Conta } | { error: string }>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { bancoId, agencia, nroconta } = req.query;

  if (
    typeof bancoId !== 'string' ||
    typeof agencia !== 'string' ||
    typeof nroconta !== 'string'
  ) {
    return res.status(400).json({ error: 'Parâmetros inválidos.' });
  }

  const foundConta = existingContas.find(
    (c) =>
      c.banco === bancoId &&
      Number(c.agencia) === Number(agencia) &&
      c.nroconta?.replace(/[^0-9]/g, '') === nroconta.replace(/[^0-9]/g, ''),
  );

  if (foundConta) {
    return res.status(200).json({ data: foundConta });
  } else {
    return res.status(404).json({ error: 'Conta não encontrada.' });
  }
}
