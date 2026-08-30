import { criarHandlerLista } from '@/lib/financeiro/arquivosCrud';
import { CONTAS_BANCARIAS } from '@/lib/financeiro/arquivosConfig';

export default criarHandlerLista(CONTAS_BANCARIAS);
