import { useEffect, useState } from 'react';
import type { Fornecedor } from '@/data/fornecedores/fornecedores';
import { getFornecedores } from '@/data/fornecedores/fornecedores';

export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Você pode ajustar o perPage se quiser trazer mais fornecedores
    getFornecedores({ page: 1, perPage: 100, search: '' })
      .then((res) => setFornecedores(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return { fornecedores, loading };
}
