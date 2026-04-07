// src/schemas/requisitionSchema.ts
import { z } from 'zod';

export const createRequisitionSchema = z.object({
  tipo: z.string().optional(),
  compradorNome: z.string().optional(),
  condicoesPgto: z.string().optional(),
  observacao: z.string().optional(),
  localEntrega: z.string().optional(),
  destino: z.string().optional(),
  fornecedorCodigo: z.string().optional(),
});

export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;

export const updateRequisitionSchema = createRequisitionSchema.extend({
  id: z.number(),
});

export type UpdateRequisitionInput = z.infer<typeof updateRequisitionSchema>;
