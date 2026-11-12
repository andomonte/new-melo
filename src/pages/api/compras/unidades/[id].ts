// Compras > Unidades Melo — obter/editar. Sem exclusão (FK de requisição/ordem):
// para tirar das listas, inative a unidade.
import { criarHandlerItem } from '@/lib/financeiro/arquivosCrud';
import { UNIDADES_MELO } from '@/lib/compras/unidadesConfig';

export default criarHandlerItem(UNIDADES_MELO);
