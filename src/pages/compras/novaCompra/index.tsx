import React, { useEffect, useContext, useState } from 'react';
import { useRouter } from 'next/router';
import { AuthContext, Permissao } from '@/contexts/authContexts';
import MenuPadrao from '@/components/menus/padrao';
import Carregamento from '@/utils/carregamento';
import { NovaRequisicaoModal } from '@/components/corpo/comprador/RequisicoesCompra/components/NovaRequisicaoModal';

const NovaCompraPage = () => {
  const router = useRouter();
  const { user, isLoading } = useContext(AuthContext);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [permissaoAtual, setPermissaoAtual] = useState<Permissao | null>(null);
  const [permissoesPaths, setPermissoesPaths] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Aguardar o AuthContext terminar de carregar antes de verificar permissões
    if (isLoading) return;
    if (!user?.permissoes) return;

    const telaAtual = '/compras/novaCompra';

    const permissaoEncontrada = user.permissoes.find(
      (p) => p.tb_telas?.PATH_TELA === telaAtual,
    );

    if (!permissaoEncontrada) {
      router.replace('/naoAutorizado');
      return;
    }

    setPermissaoAtual(permissaoEncontrada);

    const pathsPermitidos = user.permissoes
      .map((p) => p.tb_telas?.PATH_TELA)
      .filter((p): p is string => !!p);

    setPermissoesPaths(pathsPermitidos);
    setDadosCarregados(true);

    // Abrir modal automaticamente quando a página carregar
    setIsModalOpen(true);
  }, [user, router, isLoading]);

  if (!dadosCarregados || !permissaoAtual) {
    return (
      <div className="h-screen">
        <Carregamento texto="Aguarde..." />
      </div>
    );
  }

  return (
    <>
      <MenuPadrao
        tela={permissaoAtual.tb_telas?.PATH_TELA}
        permissoes={permissoesPaths}
      />
      
      <NovaRequisicaoModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          // Redirecionar para requisições quando modal for fechado
          router.push('/compras/requisicoes-compra');
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          // Após sucesso, será redirecionado pelo próprio modal
        }}
      />
    </>
  );
};

export default NovaCompraPage;