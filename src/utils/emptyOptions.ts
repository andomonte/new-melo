import { Meta } from '@/data/common/meta';
import { Bancos } from '@/data/bancos/bancos';
import { Paises } from '@/data/paises/paises';
import { cClientes } from '@/data/cClientes/cClientes';

const emptyMeta: Meta = {
  currentPage: 1,
  lastPage: 1,
  perPage: 10,
  total: 0,
};

export const emptyBancos: Bancos = {
  data: [],
  meta: emptyMeta,
};

export const emptyPaises: Paises = {
  data: [],
  meta: emptyMeta,
};

export const emptyCClientes: cClientes = {
  data: [],
  meta: emptyMeta,
};
