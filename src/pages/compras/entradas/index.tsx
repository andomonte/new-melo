import React, { useEffect, useContext, useState } from 'react';
import { useRouter } from 'next/router';
import { AuthContext, Permissao } from '@/contexts/authContexts';
import MenuPadrao from '@/components/menus/padrao';
import Carregamento from '@/utils/carregamento';

const EntradasPage = () => {
  const router = useRouter();
  const { user, isLoading } = useContext(AuthContext);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [permissaoAtual, setPermissaoAtual] = useState<Permissao | null>(null);
  const [permissoesPaths, setPermissoesPaths] = useState<string[]>([]);

  useEffect(() => {
    // Aguardar o AuthContext terminar de carregar antes de verificar permissões
    if (isLoading) return;
    if (!user?.permissoes) return;

    const telaAtual = '/compras/entradas';

    // Por enquanto, não vamos verificar permissão específica
    // já que é uma tela nova
    setPermissaoAtual({
      tb_telas: { PATH_TELA: telaAtual }
    } as Permissao);

    const pathsPermitidos = user.permissoes
      .map((p) => p.tb_telas?.PATH_TELA)
      .filter((p): p is string => !!p);

    setPermissoesPaths(pathsPermitidos);
    setDadosCarregados(true);
  }, [user, router, isLoading]);

  if (!dadosCarregados || !permissaoAtual) {
    return (
      <div className="h-screen">
        <Carregamento texto="Aguarde..." />
      </div>
    );
  }

  return (
    <MenuPadrao
      tela={permissaoAtual.tb_telas?.PATH_TELA}
      permissoes={permissoesPaths}
    />
  );
};

export default EntradasPage;