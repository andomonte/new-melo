import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';

export interface Cest {
  id?: number;
  cest: string;
  ncm: string;
  segmento: string;
  descricao: string;
}

export interface Cests {
  data: Cest[];
  meta: Meta;
}

export async function getCests({
  page,
  perPage,
  search,
}: GetParams): Promise<Cests> {
  let cests: Cests = {} as Cests;

  await api
    .get(`/api/cests/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      cests = response.data;
    });

  return cests;
}
