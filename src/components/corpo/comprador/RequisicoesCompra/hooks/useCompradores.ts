import { useEffect, useState } from 'react';
import type { Comprador } from '@/data/compradores/compradores';

export function useCompradores() {
  const [compradores, setCompradores] = useState<Comprador[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/compradores/get?page=1&perPage=100')
      .then((r) => r.json())
      .then((j) => setCompradores(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return { compradores, loading };
}
