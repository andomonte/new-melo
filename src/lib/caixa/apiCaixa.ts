import type { NextApiResponse } from 'next';
import { CaixaError } from './sessaoCaixa';

/** Responde um erro do caixa mapeando CaixaError → HTTP+code; genérico → 500. */
export function responderErroCaixa(res: NextApiResponse, error: any) {
  if (error instanceof CaixaError) {
    return res.status(error.http).json({ erro: error.message, code: error.code });
  }
  // corrida do índice único parcial que escapou
  if (error?.code === '23505') {
    return res.status(409).json({ erro: 'Já existe caixa aberto nesta conta.', code: 'CAIXA_JA_ABERTO' });
  }
  console.error('Erro no caixa:', error);
  return res.status(500).json({ erro: 'Erro interno no caixa', detalhes: error?.message });
}
