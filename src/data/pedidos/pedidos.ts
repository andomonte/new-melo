import { Meta } from '../common/meta';
import { Usuario } from '../usuarios/usuarios';
import { GetParams } from '../common/getParams';
import api from '@/components/services/api';
import { Cliente } from '@/data/clientes/clientes';

export interface ItemPedido {
  ref?: string;
  codprod: string;
  codvenda: string;
  qtd: bigint;
  prunit: number;
  demanda?: string;
  descr?: string;
  comissao?: number;
  origemcom?: string;
  codoperador?: string;
  codvend?: string;
  prcompra?: bigint;
  prmedio?: bigint;
  comissaovend?: bigint;
  comissao_operador?: bigint;
  desconto?: bigint;
  codreq?: string;
  codent?: string;
  nrequis?: string;
  nritem?: string;
  arm_id: bigint;
}

export interface PedidoUser {
  pedido: Pedido;
  usuario: Usuario;
}

export interface Pedido {
  operacao?: bigint;
  codvenda: string;
  codusr?: string;
  nrovenda?: string;
  codcli: string;
  data?: Date;
  total?: number;
  nronf?: string;
  pedido?: string;
  status?: string;
  transp?: string;
  prazo?: string;
  obs?: string;
  tipo_desc?: string;
  tipo: string;
  tele?: string;
  cancel?: string;
  statusest?: string;
  impresso?: string;
  vlrfrete?: number;
  codtptransp?: string;
  bloqueada?: string;
  estoque_virtual?: string;
  numeroserie?: string;
  numerocupom?: string;
  obsfat?: string;
  items?: ItemPedido[];
  pedido_user?: PedidoUser;
  cliente: Cliente;
}

export interface Pedidos {
  data: Pedido[];
  meta: Meta;
}

export interface PedidosGetParams extends GetParams {
  login_user_login?: string;
}

export async function getPedidos({
  page,
  perPage,
  search,
}: PedidosGetParams): Promise<Pedidos> {
  let pedidos: Pedidos = {} as Pedidos;

  await api
    .get(`/api/pedidos/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      pedidos = response.data;
    });

  return pedidos;
}

export async function getPedidosByUser({
  page,
  perPage,
  search,
  login_user_login,
}: PedidosGetParams): Promise<Pedidos> {
  let pedidos: Pedidos = {} as Pedidos;

  await api
    .get(
      `/api/pedidos/get?page=${page}&perPage=${perPage}&search=${search}&login_user_login=${login_user_login}`,
    )
    .then((response) => {
      pedidos = response.data;
    });

  return pedidos;
}

export async function insertPedidoUser(
  pedido: Pedido,
  login_user_login: string,
): Promise<void> {
  await api.post(`/api/pedidos/add-pedido-user`, {
    data: pedido,
    login_user_login,
  });
}

export async function confirmarSeparacao(pedido: Pedido): Promise<void> {
  await api.post(`/api/pedidos/confirmar-separacao`, { data: pedido });
}

export async function confirmarConferencia(pedido: Pedido): Promise<void> {
  await api.post(`/api/pedidos/confirmar-conferencia`, { data: pedido });
}
