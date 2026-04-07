/**
 * Pagina principal do modulo de Recebimento de Entradas
 *
 * Orquestra o fluxo de login e painel
 */

import React, { useState } from 'react';
import LoginRecebimento from './LoginRecebimento';
import PainelRecebimento from './PainelRecebimento';
import { Recebedor } from '@/data/recebimento-entrada/recebimentoEntradaService';

const RecebimentoEntradaPage: React.FC = () => {
  const [recebedor, setRecebedor] = useState<Recebedor | null>(null);

  if (!recebedor) {
    return <LoginRecebimento onLoginSuccess={setRecebedor} />;
  }

  return (
    <PainelRecebimento
      recebedor={recebedor}
      onLogout={() => setRecebedor(null)}
    />
  );
};

export default RecebimentoEntradaPage;
