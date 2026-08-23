import React, { useContext } from 'react';
import { useRouter } from 'next/router';
import { AuthContext } from '@/contexts/authContexts';
import PainelRecebimento from './PainelRecebimento';

/**
 * Tela de Recebimento (fila de impressão / separação). Antes tinha um login
 * próprio por operador (dbfunc_estoque). Agora usa o LOGIN NORMAL DO SISTEMA:
 * o operador é o usuário logado (AuthContext) — sem login extra.
 */
const RecebimentoPage = () => {
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const operador = {
    matricula: String(user?.codusr || user?.usuario || ''),
    nome: String(user?.usuario || 'Operador'),
  };

  if (!user?.usuario) {
    return <div className="w-full h-full p-6 text-sm text-gray-500">Carregando…</div>;
  }

  return (
    <div className="w-full h-full">
      <PainelRecebimento operador={operador} onLogout={() => router.push('/')} />
    </div>
  );
};

export default RecebimentoPage;
