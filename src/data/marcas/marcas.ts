import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';

export interface Marca {
  codmarca: string;
  descr: string;
  mar_id?: number;
  bloquear_preco?: string;
}

export interface Marcas {
  data: Marca[];
  meta: Meta;
}

export async function getMarcas({
  page,
  perPage,
  search,
}: GetParams): Promise<Marcas> {
  let marcas: Marcas = {} as Marcas;

  await api
    .get(`/api/marcas/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      marcas = response.data;
    });

  return marcas;
}

export async function createMarca(marca: Marca): Promise<void> {
  await api.post('/api/marcas/add', marca);
}

export async function updateMarca(marca: Marca): Promise<void> {
  await api.put(`/api/marcas/update`, marca);
}

export async function getMarca(codmarca: string): Promise<Marca> {
  const res = await api.get(`/api/marcas/${codmarca}`);
  return res.data;
}

export async function deleteMarca(codmarca: string): Promise<void> {
  await api.delete('/api/marcas/delete', { data: { codmarca } });
}
