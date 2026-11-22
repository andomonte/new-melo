/**
 * Recebimento de Entradas — tela solta, no mesmo modelo das estações de
 * Separação/Conferência:
 *  - /entrada/recebimento/<codigo_filial> (1 = MANAUS): filial fixa pelo link, entra direto;
 *  - /entrada/recebimento (sem número): escolhe a filial e informa o código do setor;
 *  - depois, o recebedor entra com matrícula + código pessoal (primeiro acesso cria o código).
 * A filial vai em todas as chamadas (header x-filial-recebimento).
 */

import React, { useState } from 'react';
import FilialGate from '@/components/common/FilialGate';
import LoginRecebimento from './LoginRecebimento';
import PainelRecebimento from './PainelRecebimento';
import { Recebedor, definirFilialRecebimento } from '@/data/recebimento-entrada/recebimentoEntradaService';

const RecebimentoEntradaPage: React.FC<{ codigoFilial?: number }> = ({ codigoFilial }) => {
  const fixo = codigoFilial !== undefined && Number.isFinite(codigoFilial);
  const [filial, setFilial] = useState<string | null>(null);
  const [recebedor, setRecebedor] = useState<Recebedor | null>(null);

  if (!filial) {
    return (
      <FilialGate
        filiaisUrl="/api/conferencia/estacao/filiais"
        titulo="Recebimento de Entradas"
        codigoFilialFixo={fixo ? codigoFilial : undefined}
        onUnlock={(f) => {
          definirFilialRecebimento(f);
          setFilial(f);
        }}
      />
    );
  }

  if (!recebedor) {
    return (
      <LoginRecebimento
        filial={filial}
        onLoginSuccess={setRecebedor}
        onTrocarFilial={fixo ? undefined : () => setFilial(null)}
      />
    );
  }

  return <PainelRecebimento recebedor={recebedor} onLogout={() => setRecebedor(null)} />;
};

export default RecebimentoEntradaPage;
