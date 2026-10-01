import React from 'react';
import Admin from '@/components/menus/admin';
import withAuth from '@/utils/withAuth';

const Page = () => {
  if (typeof window !== 'undefined') {
    window.history.replaceState(window.history.state, '', '/admin/cadastros/operadoras');
  }

  return <Admin tela={'/admin/cadastros/operadoras'} />;
};

export default withAuth(Page, ['ADMINISTRAÇÃO']);
