import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';

export interface Segmento {
  codseg: number;
  descricao: string;
  margem_min_venda: number;
  margem_med_venda: number;
  margem_ide_venda: number;
}

export interface Segmentos {
  data: Segmento[];
  meta: Meta;
}

export async function getSegmentos({
  page,
  perPage,
  search,
}: GetParams): Promise<Segmentos> {
  let segmentos: Segmentos = {} as Segmentos;

  await api
    .get(`/api/segmentos/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      segmentos = response.data;
    });

  return segmentos;
}
