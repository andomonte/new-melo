import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Simular chamada para o endpoint real
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/ordens/confirmar-pagamento`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
      body: JSON.stringify({
        ordem_id: 2423,
        valor_pagamento: 367.00,
        data_pagamento: new Date().toISOString().split('T')[0],
        observacoes: 'Teste de pagamento antecipado automático',
        status_pagamento: 'CONFIRMADO'
      })
    });

    const result = await response.json();

    return res.status(response.status).json(result);
  } catch (error) {
    console.error('Erro no teste:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}