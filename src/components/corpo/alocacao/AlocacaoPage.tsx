import React, { useState } from 'react';
import LoginAlocacao from './LoginAlocacao';
import PainelAlocacao from './PainelAlocacao';
import { Alocador } from '@/data/alocacao/alocacaoService';

const AlocacaoPage = () => {
  const [alocador, setAlocador] = useState<Alocador | null>(null);

  const handleLoginSuccess = (alocadorLogado: Alocador) => {
    setAlocador(alocadorLogado);
  };

  const handleLogout = () => {
    setAlocador(null);
  };

  return (
    <div className="w-full h-full">
      {!alocador ? (
        <LoginAlocacao onLoginSuccess={handleLoginSuccess} />
      ) : (
        <PainelAlocacao alocador={alocador} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default AlocacaoPage;
