export interface GetParams {
  page?: number;
  perPage?: number;
  search?: string;
  filtros?: { campo: string; tipo: string; valor: string }[];
}
