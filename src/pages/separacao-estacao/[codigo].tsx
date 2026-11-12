// Link fixo por filial: /separacao-estacao/<codigo_filial> (1 = MANAUS, 2 = RORAIMA, 3 = RONDONIA).
// A filial vem da URL e não aparece para escolha; o gate só pede o código de
// acesso do setor (e entra direto se a filial não tiver código).
import React from 'react';
import { useRouter } from 'next/router';
import Tela from '../separacao-estacao';

export default function SeparacaoEstacaoPorFilial() {
  const router = useRouter();
  if (!router.isReady) return null;
  const codigo = Number(router.query.codigo);
  return <Tela codigoFilial={codigo} />;
}
