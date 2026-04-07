import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';

export interface GrupoProduto {
  codgpp: string;
  codvend?: string;
  descbalcao?: number;
  dscrev30?: number;
  dscrev45?: number;
  dscrev60?: number;
  dscrv30?: number;
  dscrv45?: number;
  dscrv60?: number;
  dscbv30?: number;
  dscbv45?: number;
  dscbv60?: number;
  dscpv30?: number;
  dscpv45?: number;
  dscpv60?: number;
  descr: string;
  comgpp?: number;
  comgpptmk?: number;
  codseg?: string;
  diasreposicao?: number;
  codcomprador?: string;
  ramonegocio?: string;
  gpp_id?: number;
  p_comercial?: number;
  v_marketing?: number;
  codgpc?: string;
  margem_min_venda?: number;
  margem_med_venda?: number;
  margem_ide_venda?: number;
  bloquear_preco?: string;
  codgrupai?: number;
  codgrupoprod?: number;
  comgppextmk?: number;
  DSCBALCAO?: number;
}

export interface GruposProduto {
  data: GrupoProduto[];
  meta: Meta;
}

export async function getGruposProduto({
  page,
  perPage,
  search,
}: GetParams): Promise<GruposProduto> {
  let gruposProduto: GruposProduto = {} as GruposProduto;

  try {
    const response = await api.get(
      `/api/gruposProduto/get?page=${page}&perPage=${perPage}&search=${search}`,
    );
    gruposProduto = response.data;
  } catch (error) {
    console.error('Erro ao buscar grupos de produto:', error);
    // Retorna estrutura vazia mas válida em caso de erro
    gruposProduto = {
      data: [],
      meta: {
        total: 0,
        lastPage: 1,
        currentPage: 1,
        perPage: perPage || 10,
      },
    } as GruposProduto;
  }

  return gruposProduto;
}

export async function createGrupoProduto(
  grupoProduto: GrupoProduto,
): Promise<void> {
  await api.post('/api/gruposProduto/add', grupoProduto);
}

export async function updateGrupoProduto(
  grupoProduto: GrupoProduto,
): Promise<void> {
  await api.put(`/api/gruposProduto/update`, grupoProduto);
}
