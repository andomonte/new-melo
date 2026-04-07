import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';
//import { GruposFuncao } from '../gruposFuncao/gruposFuncao';

export interface ClassificacaoFiscal {
  ncm: string;
  codcla?: number;
  ipi?: number;
  pis?: number;
  cofins?: number;
  descricao: string;
  agregado?: number;
  ncm_auto?: string;
}

export interface ClassificacoesFiscais {
  data: ClassificacaoFiscal[];
  meta: Meta;
}

export async function getClassificacoesFiscais({
  page,
  perPage,
  search,
}: GetParams): Promise<ClassificacoesFiscais> {
  let classificacoesFiscais: ClassificacoesFiscais =
    {} as ClassificacoesFiscais;

  await api
    .get(
      `/api/classificacoesFiscais/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      classificacoesFiscais = response.data;
    });

  return classificacoesFiscais;
}
