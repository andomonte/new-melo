import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';

export interface Comprador {
  codcomprador: number;
  nome: string;
}

export interface Compradores {
  data: Comprador[];
  meta: Meta;
}

export async function getCompradores({
  page,
  perPage,
  search,
}: GetParams): Promise<Compradores> {
  let compradores: Compradores = {} as Compradores;

  await api
    .get(
      `/api/compradores/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      compradores = response.data;
    });

  return compradores;
}
