// Compras > Unidades Melo — lista (POST com page/perPage) e inclusão (POST).
import { criarHandlerLista } from '@/lib/financeiro/arquivosCrud';
import { UNIDADES_MELO } from '@/lib/compras/unidadesConfig';

export default criarHandlerLista(UNIDADES_MELO);
