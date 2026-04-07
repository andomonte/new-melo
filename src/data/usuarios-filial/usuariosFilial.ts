import api from '@/components/services/api';
import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';

export interface UsuarioFilial {
  login_user_login: string;
  codigo_filial: string;
  nome_filial: string;
}

export interface UsuariosFilial {
  data: UsuarioFilial[];
  meta: Meta;
}

export async function getUsuariosFilial({
  page,
  perPage,
  search,
}: GetParams): Promise<UsuariosFilial> {
  let usuariosFilial: UsuariosFilial = {} as UsuariosFilial;

  await api
    .get(
      `/api/usuarios-filial/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      usuariosFilial = response.data;
    });

  return usuariosFilial;
}

export async function insertUsuarioFilial(
  usuarioFilial: UsuarioFilial,
): Promise<any> {
  await api.post(`/api/usuarios-filial/add`, usuarioFilial).then((response) => {
    usuarioFilial = response.data;
  });

  return usuarioFilial;
}

export async function deleteUsuarioFilial(
  login_user_login: string,
  codigo_filial: string,
): Promise<void> {
  await api
    .delete(
      `/api/usuarios-filial/delete?login_user_login=${login_user_login}&codigo_filial=${codigo_filial}`,
    )
    .then((response) => {
      return response.data;
    });
}
