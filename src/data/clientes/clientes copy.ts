import api from '@/components/services/api';
import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import { getBairroByDescricao } from '@/data/bairros/bairros';
import { parseCookies } from 'nookies'; // 🆕 IMPORT NOVO para pegar cookies!
export interface Cliente {
  bloquear_preco?: string;
  codcli: string;
  nome?: string;
  nomefant?: string;
  cpfcgc?: string;
  tipo?: string;
  codcc?: string;
  codvend?: string;
  datacad?: Date;
  ender?: string;
  bairro: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  iest?: string;
  isuframa?: string;
  imun?: string;
  status?: string;
  obs?: string;
  tipoemp?: string;
  debito: number;
  limite: number;
  contato?: string;
  socios?: string;
  icms?: string;
  endercobr?: string;
  cidadecobr?: string;
  bairrocobr?: string;
  ufcobr?: string;
  cepcobr?: string;
  claspgto: string;
  email?: string;
  atraso?: number;
  ipi?: string;
  prvenda?: string;
  codbairro?: string;
  codbairrocobr?: string;
  banco?: string;
  tipocliente?: string;
  codtmk?: string;
  kickback?: number;
  sit_tributaria?: number;
  numero?: string;
  referencia?: string;
  codpais?: number;
  numerocobr?: string;
  codpaiscobr?: number;
  referenciacobr?: string;
  codmunicipio?: string;
  codmunicipiocobr?: string;
  complemento?: string;
  complementocobr?: string;
  acrescimo?: number;
  desconto?: number;
  habilitasuframa?: string;
  emailnfe?: string;
  faixafin?: string;
  codunico?: string;
  codigo_filial: number;
}

export interface Clientes {
  data: Cliente[];
  meta: Meta;
}

export async function getClientes({
  page,
  perPage,
  search,
}: GetParams): Promise<any> {
  let clientes: Clientes = {} as Clientes;

  await api
    .get(`/api/clientes/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      clientes = response.data;
    });

  return clientes;
}

export async function insertCliente(cliente: Cliente): Promise<Cliente> {
  let response = {} as Cliente;

  // 🟦 Preencher codbairro, codmunicipio, codpais
  const bairro = await getBairroByDescricao(cliente.bairro);
  cliente.codbairro = bairro.codbairro;
  cliente.codpais = bairro.codpais;
  cliente.codmunicipio = bairro.codmunicipio;

  // 🟦 Preencher campos de cobrança
  if (cliente.bairro === cliente.bairrocobr) {
    cliente.codbairrocobr = bairro.codbairro;
    cliente.codpaiscobr = bairro.codpais;
    cliente.codmunicipiocobr = bairro.codmunicipio;
  } else if (cliente.bairrocobr) {
    const bairroCobr = await getBairroByDescricao(cliente.bairrocobr);
    cliente.codbairrocobr = bairroCobr.codbairro;
    cliente.codpaiscobr = bairroCobr.codpais;
    cliente.codmunicipiocobr = bairroCobr.codmunicipio;
  }

  // 🟦 Corrigir municípios estrangeiros
  if (cliente.ufcobr === 'EX') {
    cliente.codmunicipiocobr = '9999999'; // corrigido!
  }

  // 🟦 Definir data de cadastro se ainda não estiver definida
  if (!cliente.datacad) {
    cliente.datacad = new Date();
  }

  // 🟦 Preencher código da filial a partir do cookie
  const cookies = parseCookies();
  const filial = cookies.filial_melo;
  if (filial) {
    cliente.codigo_filial = Number(filial);
  }

  // Enviar para a API
  await api.post('/api/clientes/add', cliente).then((res) => {
    response = res.data;
  });

  return response;
}

export async function getCliente(id: string): Promise<Cliente> {
  let cliente: Cliente = {} as Cliente;

  await api.get(`/api/clientes/get/${id}`).then((response) => {
    cliente = response.data;
  });

  return cliente;
}

export type Filtro = {
  campo: string;
  tipo: string;
  valor: string;
};

export type Filtros = Filtro[];

export type GetParams2 = {
  page?: number;
  perPage?: number;
  filtros?: Filtro[];
};

export async function buscaClientes({
  page = 1,
  perPage = 10,
  filtros = [],
}: GetParams2): Promise<any> {
  try {
    const response = await fetch('/api/clientes/buscaClientes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page,
        perPage,
        filtros,
      }),
    });
    if (!response.ok) {
      throw new Error('Erro ao buscar clientes');
    }
    const resultado = await response.json();
    return resultado;
  } catch (error) {
    console.error('Erro em buscaClientes:', error);
    throw error;
  }
}

export async function updateCliente(cliente: Cliente): Promise<void> {
  await api.put(`/api/clientes/update`, cliente);
}

export async function insertClienteComLimite(
  cliente: Cliente,
  observacao: string,
  codusr: string,
): Promise<any> {
  let response = {} as any;

  const cookies = parseCookies();
  const filial = cookies.filial_melo;
  if (filial) {
    cliente.codigo_filial = Number(filial);
  }

  const body = {
    cliente,
    observacao,
    codusr,
  };

  await api.post('/api/clientes/addComLimite', body).then((res) => {
    response = res.data;
  });

  return response;
}
