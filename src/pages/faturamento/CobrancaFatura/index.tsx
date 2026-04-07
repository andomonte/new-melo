import React from 'react';
import Faturamento from '@/components/menus/faturamento';
import withAuth from '@/utils/withAuth';

const Page = () => {
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', '/faturamento/CobrancaFatura');
  }

  return <Faturamento tela={'CobrancaFatura'} />;
};

export default withAuth(Page, ['FATURAMENTO', 'ADMINISTRAÇÃO']);