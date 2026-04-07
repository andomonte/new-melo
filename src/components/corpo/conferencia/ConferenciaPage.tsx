import React, { useState } from 'react';
import { Conferente } from '@/data/conferencia/conferenciaService';
import LoginConferencia from './LoginConferencia';
import PainelConferencia from './PainelConferencia';

const ConferenciaPage = () => {
  const [conferente, setConferente] = useState<Conferente | null>(null);

  const handleLoginSuccess = (conferenteLogado: Conferente) => {
    setConferente(conferenteLogado);
  };

  const handleLogout = () => {
    setConferente(null);
  };

  return (
    <div className="w-full h-full">
      {!conferente ? (
        <LoginConferencia onLoginSuccess={handleLoginSuccess} />
      ) : (
        <PainelConferencia conferente={conferente} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default ConferenciaPage;
