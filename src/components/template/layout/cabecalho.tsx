import React, { useContext, useEffect, useState, useCallback } from 'react';
import { Menu, X, LockOpen, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PerfilPagina from '@/components/template/perfil';
import { AuthContext } from '@/contexts/authContexts';
import { ComponentType } from 'react';
import { useRouter } from 'next/router';

interface LayoutPaginaProps {
  ampliar?: boolean;
  readonly handleAmpliar: (arg0: boolean) => void;
  Corpo?: ComponentType<any>;
  tela?: string;
}

const LayoutPagina: React.FC<LayoutPaginaProps> = ({
  ampliar,
  handleAmpliar,
  Corpo,
}) => {
  const { user } = useContext(AuthContext);
  const perfilUser = user;
  const router = useRouter();
  const [vendasBloqueadas, setVendasBloqueadas] = useState(0);
  const [promoAlerta, setPromoAlerta] = useState<{ total: number; msg: string }>({ total: 0, msg: '' });

  // Verificar se o usuário tem função DBV (Desbloquear Venda)
  const temDBV = user?.funcoes?.some((f: any) => (typeof f === 'string' ? f : f?.sigla) === 'DBV');
  const isAdmin = user?.perfil === 'ADMINISTRAÇÃO';

  // Buscar contagem de vendas bloqueadas
  const fetchBloqueadas = useCallback(async () => {
    if (!temDBV) return;
    try {
      const url = isAdmin
        ? '/api/vendas/get?page=1&perPage=1&status=bloqueada'
        : `/api/vendas/get?page=1&perPage=1&status=bloqueada&codvend_usuario=${user?.codusr || ''}`;
      const resp = await fetch(url);
      const data = await resp.json();
      setVendasBloqueadas(data?.meta?.total || 0);
    } catch { /* ignora */ }
  }, [temDBV, isAdmin, user?.codusr]);

  // Buscar notificações de promoção (expirando por data ou estoque acabando)
  const fetchPromoAlerta = useCallback(async () => {
    try {
      const resp = await fetch('/api/vendas/notificacoes');
      const data = await resp.json();
      const qtdPromo = (data?.promoExpirando?.qtd || 0) + (data?.promoEstoque?.qtd || 0);
      const msgs: string[] = [];
      if (data?.promoExpirando?.qtd > 0) msgs.push(`${data.promoExpirando.qtd} expirando por data`);
      if (data?.promoEstoque?.qtd > 0) msgs.push(`${data.promoEstoque.qtd} com estoque acabando`);
      setPromoAlerta({ total: qtdPromo, msg: msgs.join(' | ') });
    } catch { /* ignora */ }
  }, []);

  useEffect(() => {
    fetchBloqueadas();
    fetchPromoAlerta();
    const interval = setInterval(() => { fetchBloqueadas(); fetchPromoAlerta(); }, 60000);
    return () => clearInterval(interval);
  }, [fetchBloqueadas, fetchPromoAlerta]);

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
      {/* Header Bar */}
      <div className="flex-none flex h-20 items-center justify-center w-full bg-[#347AB6] dark:bg-[#1f517c] text-white border-b border-gray-300 dark:border-slate-700">
        <div className="w-[6%] sm:w-[8%] md:w-[5%] lg:w-[4%] ml-2 h-full flex items-center justify-start">
          <Button
            className="w-8 h-8 text-black dark:text-white"
            size="icon"
            variant="outline"
            onClick={() => {
              handleAmpliar(!ampliar);
            }}
          >
            {!ampliar ? (
              <Menu className="h-[4] w-full" />
            ) : (
              <X className="h-4 w-4" />
            )}
            <span className="sr-only">Abrir / fechar menu</span>
          </Button>
        </div>
        <div className={`w-[93%] flex items-center justify-end`}>
          <div className="h-auto w-[75%] flex justify-start">
            <div className="h-full w-auto">
              <div className="w-full flex h-[70%] text-[14px] items-start justify-start">
                {perfilUser.filial}
              </div>
            </div>
          </div>
          <div className="w-[25%] flex items-center justify-end gap-3">
            {/* Notificação de promoções expirando / estoque acabando */}
            {promoAlerta.total > 0 ? (
              <button
                onClick={() => {
                  if (window.location.pathname.includes('promocoes')) {
                    window.location.reload();
                  } else {
                    router.push('/vendas/promocoes');
                  }
                }}
                className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
                title={`Promoções: ${promoAlerta.msg}`}
              >
                <Tag size={20} className="text-yellow-300" />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-yellow-500 text-black text-[10px] font-bold rounded-full px-1">
                  {promoAlerta.total > 99 ? '99+' : promoAlerta.total}
                </span>
              </button>
            ) : null}
            {/* Notificação de vendas bloqueadas */}
            {temDBV && vendasBloqueadas > 0 ? (
              <button
                onClick={() => {
                  // Se já está na Central V2, muda o filtro direto
                  if (window.location.pathname.includes('centralVendasV2')) {
                    window.dispatchEvent(new CustomEvent('centralV2:filtro', { detail: 'bloqueada' }));
                  } else {
                    // Navega e seta flag para a Central V2 ler ao montar
                    sessionStorage.setItem('centralV2_filtroInicial', 'bloqueada');
                    router.push('/vendas/centralVendasV2');
                  }
                }}
                className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
                title={`${vendasBloqueadas} venda(s) bloqueada(s) aguardando liberação`}
              >
                <LockOpen size={20} className="text-white" />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                  {vendasBloqueadas > 99 ? '99+' : vendasBloqueadas}
                </span>
              </button>
            ) : null}
            <PerfilPagina perfilUser={perfilUser} />
          </div>
        </div>
      </div>
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 w-full text-black dark:text-gray-50 bg-white dark:bg-black overflow-hidden">
        {Corpo ? <Corpo /> : null}
      </div>
    </div>
  );
};
export default LayoutPagina;
