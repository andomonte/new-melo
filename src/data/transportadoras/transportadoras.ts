import api from '@/components/services/api';
import { Meta } from '../common/meta';
import { GetParams } from '../common/getParams';
import { getBairroByDescricao } from '@/data/bairros/bairros';

export interface Transportadora {
  codtransp: string;
  nome: string;
  nomefant?: string;
  cpfcgc?: string;
  tipo?: string;
  data_cad?: Date;
  ender?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  iest?: string;
  isuframa?: string;
  imun?: string;
  tipoemp?: string;
  contatos?: string;
  cc?: string;
  n_agencia?: string;
  banco?: string;
  cod_ident?: string;
  cep?: string;
  codbairro?: string;
  codmunicipio?: string;
  numero?: string;
  referencia?: string;
  codpais?: number;
  complemento?: string;
  codunico?: string;
}

export interface Transportadoras {
  data: Transportadora[];
  meta: Meta;
}

export async function getTransportadoras({
  page,
  perPage,
  search,
}: GetParams): Promise<any> {
  let transportadoras: Transportadoras = {} as Transportadoras;

  await api
    .get(
      `/api/transportadoras/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      transportadoras = response.data;
    });

  return transportadoras;
}

export async function insertTransportadora(
  transportadora: Transportadora,
): Promise<Transportadora> {
  let response = {} as Transportadora;

  // Preencher codbairro, codmunicipio, codpais se bairro foi informado
  if (transportadora.bairro && transportadora.bairro.trim() !== '') {
    try {
      const bairro = await getBairroByDescricao(transportadora.bairro);
      if (bairro && bairro.codbairro) {
        transportadora.codbairro = bairro.codbairro;
        transportadora.codpais = bairro.codpais;
        transportadora.codmunicipio = bairro.codmunicipio;
      }
    } catch (error) {
      console.warn('Erro ao buscar bairro, continuando sem os códigos:', error);
      // Continua sem os códigos se não conseguir buscar o bairro
    }
  }

  // Definir data de cadastro se ainda não estiver definida
  if (!transportadora.data_cad) {
    transportadora.data_cad = new Date();
  }

  // Enviar para a API
  await api.post('/api/transportadoras/add', transportadora).then((res) => {
    response = res.data;
  });

  return response;
}

export async function getTransportadora(id: string): Promise<Transportadora> {
  let transportadora: Transportadora = {} as Transportadora;

  try {
    await api.get(`/api/transportadoras/get/${id}`).then((response) => {
      transportadora = response.data;
    });
  } catch (error) {
    console.error('Erro ao buscar transportadora:', error);
    throw error;
  }

  return transportadora;
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

export async function buscaTransportadoras({
  page = 1,
  perPage = 10,
  filtros = [],
}: GetParams2): Promise<any> {
  try {
    const filtrosCorrigidos = filtros.map((filtro) => ({
      ...filtro,
      valor: String(filtro.valor),
    }));

    const response = await fetch('/api/transportadoras/buscaTransportadoras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page,
        perPage,
        filtros: filtrosCorrigidos,
      }),
    });
    if (!response.ok) {
      throw new Error('Erro ao buscar transportadoras');
    }
    const resultado = await response.json();
    return resultado;
  } catch (error) {
    console.error('Erro em buscaTransportadoras:', error);
    throw error;
  }
}

export async function updateTransportadora(
  transportadora: Transportadora,
): Promise<void> {
  await api.put(
    `/api/transportadoras/update/${transportadora.codtransp}`,
    transportadora,
  );
}

export async function deleteTransportadora(id: string): Promise<void> {
  await api.delete(`/api/transportadoras/delete/${id}`);
}
