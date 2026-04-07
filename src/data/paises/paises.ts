import { Bairro } from '@/data/bairros/bairros';
import { Meta } from '@/data/common/meta';
import api from '@/components/services/api';
import { GetParams } from '@/data/common/getParams';

export interface Pais {
  codpais: number;
  descricao: string;
  bairros: Bairro[];
}

export interface Paises {
  data: Pais[];
  meta: Meta;
}

export async function getPaises({
  page,
  perPage,
  search,
}: GetParams): Promise<Paises> {
  let paises: Paises = {} as Paises;

  await api
    .get(`/api/paises/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      paises = response.data;
    });

  return paises;
}
