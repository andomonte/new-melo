import { z } from 'zod';

import { CfopForm } from './CfopForm';
import {
  CrudApi,
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import {
  Cfop,
  getCfops,
  getCfop,
  createCfop,
  updateCfop,
  deleteCfop,
} from '@/data/cfop/cfop';

// --- PASSO 1: Objeto da API ---
const cfopApi: CrudApi<Cfop> = {
  list: getCfops,
  getById: getCfop,
  create: createCfop,
  update: (id, data) => updateCfop(data),
  remove: deleteCfop,
};

// --- PASSO 2: Colunas da Tabela ---
const cfopColumns: CrudColumn<Cfop>[] = [
  {
    header: 'CFOP',
    cell: (item) => item.cfop,
  },
  {
    header: 'Descrição',
    cell: (item) => item.descr,
  },
  {
    header: 'CFOP Inverso',
    cell: (item) => item.cfopinverso || '-',
  },
  {
    header: 'Exceção',
    cell: (item) => (item.excecao === 'S' ? 'Sim' : 'Não'),
  },
];

// --- PASSO 4: Schema de Validação e Estado Vazio ---
const cfopSchema = z.object({
  cfop: z
    .string()
    .length(4, 'O CFOP deve ter exatamente 4 caracteres.')
    .regex(/^\d+$/, 'O CFOP deve conter apenas números.'),
  descr: z.string().min(3, 'A descrição é obrigatória.'),
  cfopinverso: z
    .string()
    .length(4, 'O CFOP inverso deve ter 4 caracteres.')
    .regex(/^\d+$/, 'O CFOP inverso deve conter apenas números.')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  excecao: z
    .enum(['S', 'N'], { message: "O campo exceção deve ser 'S' ou 'N'." })
    .optional()
    .or(z.literal('')),
});

const cfopEmptyState: Cfop = {
  cfop: '',
  descr: '',
  cfopinverso: null,
  excecao: 'N',
};

// --- PASSO 5: Componente da Página Final ---
const CfopPage = () => {
  // A lógica de permissões pode vir de um hook de autenticação
  const userPermissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  return (
    <GenericCrudPage
      title="Cadastro de CFOP"
      entityName="CFOP"
      idKey="cfop"
      api={cfopApi}
      columns={cfopColumns}
      permissions={userPermissions}
      FormComponent={CfopForm}
      validationSchema={cfopSchema}
      emptyState={cfopEmptyState}
    />
  );
};

export default CfopPage;
