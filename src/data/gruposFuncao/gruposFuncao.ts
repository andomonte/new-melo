import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';

export interface GrupoFuncao {
  codgpf: number;
  descr: string;
  agregado_substituicao: number;
  gpf_id: number;
}

export interface GruposFuncao {
  data: GrupoFuncao[];
  meta: Meta;
}

export async function getGruposFuncao({
  page,
  perPage,
  search,
}: GetParams): Promise<GruposFuncao> {
  let gruposFuncao: GruposFuncao = {} as GruposFuncao;

  await api
    .get(
      `/api/gruposFuncao/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      gruposFuncao = response.data;
    });

  return gruposFuncao;
}
