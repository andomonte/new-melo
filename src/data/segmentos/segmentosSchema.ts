import { z } from 'zod';

export const crudMarcaSchema = z.object({
  CODIGO_MARCA: z.string({ required_error: 'Código da marca é obrigatório' }).nonempty({ message: 'Código da marca é obrigatório' }),
  DESCRICAO_FILIAL: z.string({ required_error: 'Descrição da marca é obrigatório' }).nonempty({ message: 'Descrição da marca é obrigatório' }),
});