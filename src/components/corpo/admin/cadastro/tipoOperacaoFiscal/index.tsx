import { z } from 'zod';

import { TipoOperacaoFiscalForm } from './TipoOperacaoFiscalForm';
import {
  CrudApi,
  CrudColumn,
  GenericCrudPage,
} from '@/components/common/genericCrudPage';
import {
  TipoOperacaoFiscal,
  getTiposOperacaoFiscal,
  getTipoOperacaoFiscal,
  createTipoOperacaoFiscal,
  updateTipoOperacaoFiscal,
  deleteTipoOperacaoFiscal,
} from '@/data/tipoOperacaoFiscal/tipoOperacaoFiscal';

const api: CrudApi<TipoOperacaoFiscal> = {
  list: getTiposOperacaoFiscal,
  getById: getTipoOperacaoFiscal,
  create: createTipoOperacaoFiscal,
  update: (id, data) => updateTipoOperacaoFiscal({ ...data, id: Number(id) }),
  remove: deleteTipoOperacaoFiscal,
};

const columns: CrudColumn<TipoOperacaoFiscal>[] = [
  { header: 'Movimentação', cell: (item) => item.tipo_movimentacao },
  { header: 'Código', cell: (item) => item.codigo },
  { header: 'Descrição', cell: (item) => item.descricao },
  { header: 'Ordem', cell: (item) => String(item.ordem ?? 0) },
  { header: 'Ativo', cell: (item) => (item.ativo === false ? 'Não' : 'Sim') },
];

const schema = z.object({
  id: z.coerce.number().optional(),
  codigo: z.string().min(2, 'O código é obrigatório.'),
  descricao: z.string().min(2, 'A descrição é obrigatória.'),
  tipo_movimentacao: z.string().min(2, 'A movimentação é obrigatória.'),
  ordem: z.coerce.number().optional(),
  ativo: z.boolean().optional(),
});

const emptyState: TipoOperacaoFiscal = {
  codigo: '',
  descricao: '',
  tipo_movimentacao: 'SAIDA',
  ordem: 0,
  ativo: true,
};

const TipoOperacaoFiscalPage = () => {
  const userPermissions = { canCreate: true, canEdit: true, canDelete: true };

  return (
    <GenericCrudPage
      title="Tipos de Operação Fiscal"
      entityName="Tipo de Operação Fiscal"
      idKey="id"
      api={api}
      columns={columns}
      permissions={userPermissions}
      FormComponent={TipoOperacaoFiscalForm}
      validationSchema={schema}
      emptyState={emptyState}
    />
  );
};

export default TipoOperacaoFiscalPage;
