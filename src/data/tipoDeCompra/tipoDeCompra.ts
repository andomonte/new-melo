// src/data/tipoDeCompra/tipoDeCompra.ts
import api from '@/components/services/api';
import type { TipoDeCompraDTO } from './types';

export async function getTiposDeCompra(): Promise<TipoDeCompraDTO[]> {
  const res = await api.get<{ data: TipoDeCompraDTO[] }>(
    '/api/tipoDeCompra/get',
  );
  return res.data.data;
}
