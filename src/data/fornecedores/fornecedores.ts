import { GetParams } from '../common/getParams';
import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { getBairroByDescricao } from '@/data/bairros/bairros';

export interface ClasseFornecedor {
  codcf: string;
  descr: string;
}

export interface ClassesFornecedor {
  data: ClasseFornecedor[];
  meta: Meta;
}

// para corresponder exatamente à resposta da sua API.
export interface Fornecedor {
  cod_credor?: string;
  nome?: string;
  nome_fant?: string;
  cpf_cgc?: string | null; // Permitindo null como no JSON
  tipo?: string;
  data_cad?: Date;
  endereco?: string;
  bairro: string;
  cidade?: string;
  uf?: string;
  isuframa?: string;
  iest?: string;
  imun?: string;
  cc?: string | null;
  n_agencia?: string | null;
  banco?: string | null;
  cod_ident?: string | null;
  contatos?: string;
  tipoemp?: string;
  cep?: string;
  codcf?: string | null;
  fabricante?: string;
  regime_tributacao?: string;
  codbairro?: string | null;
  codmunicipio?: string;
  numero?: string;
  referencia?: string | null;
  codpais?: number;
  complemento?: string | null;
  tipofornecedor?: string | null;
  codunico?: string | null;
  codccontabil?: string | null;

  // Campos de Regra de Faturamento agora no nível principal
  crf_id?: string | null;
  desc_icms_sufra?: number | null;
  desc_icms_sufra_piscofins?: number | null;
  piscofins_365?: number | null;
  piscofins_925?: number | null;
  piscofins_1150?: number | null;
  piscofins_1310?: number | null;
  desc_icms_sufra_st?: number | null;
  desc_piscofins_st?: number | null;
  acres_piscofins_st?: number | null;
  desc_icms_sufra_importado?: number | null;
  cobrar_ipi_importado?: number | null;
  frete?: number | null;
  basereduzida_st?: number | null;
  basereduzida_icms?: number | null;
  desc_icms_sufra_base?: number | null;
  desc_icms_sufra_importado_base?: number | null;
}

export interface Fornecedores {
  data: Fornecedor[];
  meta: Meta;
}

export async function getFornecedores({
  page,
  perPage,
  search,
}: GetParams): Promise<Fornecedores> {
  let fornecedores: Fornecedores = {} as Fornecedores;

  await api
    .get(
      `/api/fornecedores/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      fornecedores = response.data;
    });

  return fornecedores;
}

export async function insertFornecedor(
  fornecedor: Fornecedor,
): Promise<Fornecedor> {
  let fornecedorInserted: Fornecedor = {} as Fornecedor;

  const bairro = await getBairroByDescricao(fornecedor.bairro);

  fornecedor.codbairro = bairro.codbairro;
  fornecedor.codpais = bairro.codpais;
  fornecedor.codmunicipio = bairro.codmunicipio;

  try {
    const response = await api.post('/api/fornecedores/add', fornecedor);
    fornecedorInserted = response.data;
  } catch (error: any) {
    console.error('Erro ao inserir fornecedor:', error);

    // Propagar o erro com uma mensagem mais clara
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else if (error.response?.status === 409) {
      throw new Error('CNPJ/CPF já cadastrado no sistema.');
    } else if (error.response?.status === 400) {
      throw new Error('Dados inválidos. Verifique os campos obrigatórios.');
    } else {
      throw new Error('Erro interno do servidor. Tente novamente.');
    }
  }

  return fornecedorInserted;
}

export async function getFornecedor(id: string): Promise<Fornecedor> {
  let fornecedor: Fornecedor = {} as Fornecedor;

  await api.get(`/api/fornecedores/get/${id}`).then((response) => {
    fornecedor = response.data;
  });
  console.log(fornecedor);
  return fornecedor;
}

export async function updateFornecedor(
  fornecedor: Fornecedor,
): Promise<Fornecedor> {
  let fornecedorUpdated: Fornecedor = {} as Fornecedor;

  try {
    const response = await api.put(`/api/fornecedores/update`, fornecedor);
    fornecedorUpdated = response.data;
    console.log(
      '✅ Fornecedor atualizado com sucesso via API:',
      fornecedorUpdated,
    );
  } catch (error: any) {
    console.error('❌ Erro ao atualizar fornecedor via API:', error);

    // ✅ CORREÇÃO: Propagar o erro com uma mensagem mais clara
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else if (error.response?.status === 409) {
      throw new Error('CNPJ/CPF já cadastrado para outro fornecedor.');
    } else if (error.response?.status === 400) {
      throw new Error('Dados inválidos. Verifique os campos obrigatórios.');
    } else if (error.response?.status === 404) {
      throw new Error('Fornecedor não encontrado para atualização.');
    } else {
      throw new Error('Erro interno do servidor. Tente novamente.');
    }
  }

  return fornecedorUpdated;
}

export async function getClassesFornecedor({
  page,
  perPage,
  search,
}: GetParams): Promise<ClassesFornecedor> {
  let classesFornecedor: ClassesFornecedor = {} as ClassesFornecedor;

  await api
    .get(
      `/api/fornecedores/classes/get?page=${page}&perPage=${perPage}&search=${search}`,
    )
    .then((response) => {
      classesFornecedor = response.data;
    });

  return classesFornecedor;
}

export async function buscaFornecedores({
  page,
  perPage,
  filtros,
  busca = '',
}: {
  page: number;
  perPage: number;
  filtros: { campo: string; tipo: string; valor: string }[];
  busca?: string;
}): Promise<Fornecedores> {
  let fornecedores: Fornecedores = {} as Fornecedores;

  await api
    .post('/api/fornecedores/busca', {
      page,
      perPage,
      filtros: JSON.stringify(filtros),
      busca,
    })
    .then((response) => {
      fornecedores = response.data;
    });

  return fornecedores;
}
