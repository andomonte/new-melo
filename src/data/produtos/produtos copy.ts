import { Meta } from '../common/meta';
import api from '@/components/services/api';
import { GetParams } from '../common/getParams';

export type Curva = "A"|"B"|"C"|"D";

export type Informativo = "A"|"B"|"C"|"D";

export type UnidadeMedida = "PC"|"UN"|"KT"|"CX"|"CJ"|"JG"|"LT"|"ML"|"MT"|"PT"|"KG"|"CT"|"PR"|"RL";

export type CompraDireta = "SIM"|"NAO";

export type Dolar = "S"|"N";

export type TipoProduto = "ME - MERCADORIA"|"MC - MATERIAL DE CONSUMO";

export type IsentoIPI = "S"|"C"|"P"|"Z"|"I";

export interface Produto {
  codbar?: string;
  ref: string;
  reforiginal?: string;
  descr: string;
  aplic_extendida?: string;
  codmarca: string;
  codgpf: string;
  codgpp: string;
  curva: Curva;
  qtestmin?: number;
  qtestmax: number;
  obs?: string;
  inf: Informativo;
  pesoliq?: number;
  qtembal?: number;
  unimed: UnidadeMedida;
  multiplo: number;
  coddesc: number;
  tabelado: string;
  compradireta: CompraDireta;
  dolar?: Dolar;
  multiplocompra: number;
  tipo: TipoProduto;
  descr_importacao?: string;

  nrodi?: string;
  trib: string;
  clasfiscal: string;
  dtdi?: Date;
  strib: string;
  percsubst: number;
  isentopiscofins: string;
  pis?: number;
  cofins?: number;
  isentoipi: IsentoIPI;
  ipi?: number;
  naotemst?: string;
  prodepe?: string;
  hanan?: string;
  descontopiscofins?: string;
  ii?: number;
  cest: string;

  prfabr?: number;
  prcustoatual?: number;
  preconf?: number;
  precosnf?: number;
  prcompra: number;
  prcomprasemst?: number;
  pratualdesp?: number;
  txdolarcompra?: number;
  // prcusto?: number;
  prvenda?: number;
  primp?: number;
  impfat?: number;
  impfab?: number;
  concor?: number;
  txdolarvenda?: number;

  codprod: string;
  qtdreservada: number;
  qtest_filial: number;
  cmercd: string;
  cmercf: string;
  margem: number;
  margempromo: number;
  cmerczf: string;
  excluido: number;
  qtestmax_sugerido: number;
  prmedio: number;
  qtest: number;
  consumo_interno: boolean;
}

export interface Produtos {
  data: Produto[];
  meta: Meta;
}

export async function getProdutos({ page, perPage, search}: GetParams): Promise<Produtos> {
  let produtos: Produtos = {} as Produtos;

  await api.get(`/api/produtos/get?page=${page}&perPage=${perPage}&search=${search}`)
    .then((response) => {
      produtos = response.data;
    });

  return produtos;
}

export async function insertProduto(produto: Produto): Promise<void> {
  await api.post('/api/produtos/add', produto);
}

export async function getProduto(codprod: string): Promise<Produto> {
  let produto: Produto = {} as Produto;

  await api.get(`/api/produtos/get/${codprod}`)
    .then((response) => {
      produto = response.data;
    });

  return produto;
}

export async function updateProduto(produto: Produto): Promise<void> {
  await api.put(`/api/produtos/update`, produto);
}

export async function getProdutoByCodBar(codbar: string): Promise<Produto> {
  let produto: Produto = {} as Produto;

  await api.get(`/api/produtos/get/by-codbar?codbar=${codbar}`)
    .then((response) => {
      produto = response.data;
    });

  return produto;
}