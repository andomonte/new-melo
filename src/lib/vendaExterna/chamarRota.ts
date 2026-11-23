/**
 * Chama uma rota de API do próprio sistema por dentro (sem HTTP), com a filial no cookie.
 * Usado pelo envio da Venda Externa para reaproveitar EXATAMENTE as rotas da Nova Venda
 * (validarCredito, finalizarVenda) sem duplicar nem reescrever a lógica delas.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown | Promise<unknown>;

export async function chamarRota(
  handler: Handler,
  opts: { method?: string; body?: any; filial: string; query?: Record<string, string> },
): Promise<{ status: number; data: any }> {
  let status = 200;
  let data: any = undefined;
  let resolver: () => void = () => {};
  const terminou = new Promise<void>((r) => (resolver = r));

  const req = {
    method: opts.method || 'POST',
    body: opts.body ?? {},
    query: opts.query ?? {},
    headers: { cookie: `filial_melo=${encodeURIComponent(opts.filial)}`, 'content-type': 'application/json' },
    cookies: { filial_melo: opts.filial },
  } as unknown as NextApiRequest;

  const res: any = {
    status(c: number) {
      status = c;
      return res;
    },
    json(d: any) {
      data = d;
      resolver();
      return res;
    },
    send(d: any) {
      data = d;
      resolver();
      return res;
    },
    end(d?: any) {
      if (d !== undefined) data = d;
      resolver();
      return res;
    },
    setHeader() {
      return res;
    },
    getHeader() {
      return undefined;
    },
  };

  await Promise.resolve(handler(req, res as NextApiResponse));
  await Promise.race([terminou, new Promise((r) => setTimeout(r, 0))]);
  return { status, data };
}
