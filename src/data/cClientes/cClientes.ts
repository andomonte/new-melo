import api from '@/components/services/api';
import { GetParams } from '../common/getParams';
import { Meta } from '../common/meta';

export interface CCliente {
  codcc: string;
  descr: string;
}

export interface cClientes {
  data: CCliente[];
  meta: Meta;
}

export async function getcClientes({
  page,
  perPage,
  search,
}: GetParams): Promise<cClientes> {
  let cClientes: cClientes = {} as cClientes;

  await api
    .get(`/api/cClientes/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      cClientes = response.data;
    });

  return cClientes;
}

export async function createcClientes(cCliente: CCliente): Promise<void> {
  await api.post('/api/cClientes/add', cCliente);
}

export async function updatecClientes(cCliente: CCliente): Promise<void> {
  await api.put(`/api/cClientes/update`, cCliente);
}
