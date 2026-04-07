import React, { useState } from 'react';
import LoginRecebimento from './LoginRecebimento';
import PainelRecebimento from './PainelRecebimento';

interface Operador {
  matricula: string;
  nome: string;
}

const RecebimentoPage = () => {
  const [operador, setOperador] = useState<Operador | null>(null);

  const handleLoginSuccess = (operadorLogado: Operador) => {
    setOperador(operadorLogado);
  };

  const handleLogout = () => {
    setOperador(null);
  };

  return (
    <div className="w-full h-full">
      {!operador ? (
        <LoginRecebimento onLoginSuccess={handleLoginSuccess} />
      ) : (
        <PainelRecebimento operador={operador} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default RecebimentoPage;
