// Link fixo por filial: /entrada/recebimento/<codigo_filial> (1 = MANAUS, 2 = RORAIMA, 3 = RONDONIA).
// A filial vem da URL e não aparece para escolha; o recebedor entra com matrícula + código.
import React from 'react';
import { useRouter } from 'next/router';
import RecebimentoEntradaPage from '@/components/corpo/recebimento-entrada';

export default function RecebimentoEntradaPorFilial() {
  const router = useRouter();
  if (!router.isReady) return null;
  return <RecebimentoEntradaPage codigoFilial={Number(router.query.codigo)} />;
}
