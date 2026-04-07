//import Home from '@/components/home';
import React from 'react';
import Faturamento from '@/components/menus/comprador';
import withAuth from '@/utils/withAuth';

const Page = () => {
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', '/compras/historicoCompra');
  }

  return <Faturamento tela={'historicoCompra'} />;
};

export default withAuth(Page, ['COMPRAS']);
