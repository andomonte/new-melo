import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

export interface Grupo {
  LOGIN_GROUP_NAME: string;
  LOGIN_GROUP_IS_ADMIN: boolean;
}

export interface Grupos {
  data: Grupo[];
  meta: Meta;
}

export async function getGroups({
  page,
  perPage,
  search,
}: GetParams): Promise<Grupos> {
  let groups: Grupos = {} as Grupos;

  await api
    .get(`/api/grupos/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      groups = response.data;
    });

  return groups;
}

export async function insertGrupo(grupo: Grupo): Promise<void> {
  await api.post('/api/grupos/add', grupo);
}

export async function getGrupo(id: string): Promise<Grupo> {
  let grupo: Grupo = {} as Grupo;

  await api.get(`/api/grupos/get/${id}`).then((response) => {
    grupo = response.data;
  });

  return grupo;
}

export async function updateGrupo(grupo: Grupo): Promise<void> {
  await api.put(`/api/grupos/update`, grupo);
}
