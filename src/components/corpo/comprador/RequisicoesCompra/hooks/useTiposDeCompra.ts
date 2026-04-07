import { useEffect, useState } from 'react';
import type { TipoDeCompraDTO } from '@/data/tipoDeCompra/types';

export function useTiposDeCompra() {
  const [tipos, setTipos] = useState<TipoDeCompraDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/tipoDeCompra/get')
      .then((r) => r.json())
      .then((j) => setTipos(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return { tipos, loading };
}
