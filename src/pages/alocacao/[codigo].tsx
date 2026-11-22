// Link fixo por filial: /alocacao/<codigo_filial> (1 = MANAUS, 2 = RORAIMA, 3 = RONDONIA).
// A filial vem da URL e não aparece para escolha; o alocador entra com matrícula + código.
import React from 'react';
import { useRouter } from 'next/router';
import AlocacaoPage from '@/components/corpo/alocacao';

export default function AlocacaoPorFilial() {
  const router = useRouter();
  if (!router.isReady) return null;
  return <AlocacaoPage codigoFilial={Number(router.query.codigo)} />;
}
