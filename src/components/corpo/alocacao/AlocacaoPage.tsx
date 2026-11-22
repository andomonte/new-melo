/**
 * Alocação — tela solta, no mesmo modelo do Recebimento e das estações:
 *  - /alocacao/<codigo_filial> (1 = MANAUS): filial fixa pelo link, entra direto;
 *  - /alocacao (sem número): escolhe a filial e informa o código do setor;
 *  - depois, o alocador entra com matrícula + código pessoal (primeiro acesso cria o código).
 * A filial vai em todas as chamadas (header x-filial-estacao).
 */
import React, { useState } from 'react';
import FilialGate from '@/components/common/FilialGate';
import LoginAlocacao from './LoginAlocacao';
import PainelAlocacao from './PainelAlocacao';
import { Alocador, definirFilialAlocacao } from '@/data/alocacao/alocacaoService';

const AlocacaoPage: React.FC<{ codigoFilial?: number }> = ({ codigoFilial }) => {
  const fixo = codigoFilial !== undefined && Number.isFinite(codigoFilial);
  const [filial, setFilial] = useState<string | null>(null);
  const [alocador, setAlocador] = useState<Alocador | null>(null);

  if (!filial) {
    return (
      <FilialGate
        filiaisUrl="/api/conferencia/estacao/filiais"
        titulo="Alocação"
        codigoFilialFixo={fixo ? codigoFilial : undefined}
        onUnlock={(f) => {
          definirFilialAlocacao(f);
          setFilial(f);
        }}
      />
    );
  }

  return (
    <div className="w-full h-full">
      {!alocador ? (
        <LoginAlocacao
          filial={filial}
          onLoginSuccess={setAlocador}
          onTrocarFilial={fixo ? undefined : () => setFilial(null)}
        />
      ) : (
        <PainelAlocacao alocador={alocador} onLogout={() => setAlocador(null)} />
      )}
    </div>
  );
};

export default AlocacaoPage;
