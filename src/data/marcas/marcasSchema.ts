import { z } from 'zod';

export const crudMarcaSchema = z.object({
  codmarca: z
    .string()
    .min(1, 'Código da marca é obrigatório')
    .max(5, 'Código da marca não pode ter mais de 5 caracteres'),
  descr: z
    .string()
    .min(1, 'Descrição da marca é obrigatória')
    .max(200, 'Descrição da marca não pode ter mais de 200 caracteres'),
  bloquear_preco: z.string().max(1).optional(),
});
