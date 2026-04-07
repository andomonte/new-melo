import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';

export interface GrupoContabil {
  codgpc: string;
  descr: string;
}

export interface GruposContabeis {
  data: GrupoContabil[];
  meta: Meta;
}

export async function getGruposContabil({
  page,
  perPage,
  search,
}: GetParams): Promise<GruposContabeis> {
  let gruposContabil: GruposContabeis = {} as GruposContabeis;

  await api
    .get(
      `/api/gruposContabil/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      gruposContabil = response.data;
    });

  return gruposContabil;
}
