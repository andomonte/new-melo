import React, { useState, useEffect } from 'react';
import { Separador } from '@/data/separacao/separacaoService';
import { useToast } from '@/hooks/use-toast';
import LoginSeparacao from './LoginSeparacao';
import PainelSeparacao from './PainelSeparacao';

const SeparacaoPage = () => {
  const [separador, setSeparador] = useState<Separador | null>(null);
  const { toast } = useToast();

  // Teste do toast na montagem do componente
  useEffect(() => {
    toast({
      title: 'Toast de teste',
      description: 'Se você vê isso, o toast está funcionando!',
      variant: 'default',
    });
  }, [toast]);

  const handleLoginSuccess = (separadorLogado: Separador) => {
    setSeparador(separadorLogado);
  };

  const handleLogout = () => {
    setSeparador(null);
  };

  return (
    <div className="w-full h-full">
      {!separador ? (
        <LoginSeparacao onLoginSuccess={handleLoginSuccess} />
      ) : (
        <PainelSeparacao separador={separador} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default SeparacaoPage;
