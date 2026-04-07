import { useEffect, useState } from 'react';
import type { Filial } from '@/data/filiais/filiais';

export function useFiliais() {
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/filiais/get?page=1&perPage=100')
      .then((r) => r.json())
      .then((j) => setFiliais(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return { filiais, loading };
}
