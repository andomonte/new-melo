import { useRouter } from 'next/router';
import { useContext, useEffect } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import Carregamento from '@/utils/carregamento';

const withAuth = (WrappedComponent: React.FC, allowedRoles: string[]) => {
  const ComponentWithAuth = (props: any) => {
    const { user } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
      if (user === undefined) return; // 🔹 Aguarda o contexto carregar
      if (!user) {
        router.push('/login'); // 🔹 Redireciona se não estiver autenticado
      } else if (
        user.perfil !== '' &&
        !allowedRoles.includes(user.perfil?.trim())
      ) {
        router.push('/naoAutorizado'); // 🔹 Redireciona se não tiver permissão
      }
    }, [user, router]);

    if (user === undefined || user.perfil === '') {
      return (
        <div className="w-screen h-screen">
          <Carregamento texto={'CARREGANDO DADOS DO USUÁRIO'} />
        </div>
      );
    }

    if (!user || !allowedRoles.includes(user.perfil?.trim())) {
      return (
        <div className="w-screen h-screen">
          <Carregamento texto={'VERIFICANDO PERMISSÕES'} />
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  ComponentWithAuth.displayName = `WithAuth(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return ComponentWithAuth;
};

export default withAuth;
