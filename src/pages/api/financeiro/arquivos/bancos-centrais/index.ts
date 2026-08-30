import { criarHandlerLista } from '@/lib/financeiro/arquivosCrud';
import { BANCOS_CENTRAIS } from '@/lib/financeiro/arquivosConfig';

export default criarHandlerLista(BANCOS_CENTRAIS);
