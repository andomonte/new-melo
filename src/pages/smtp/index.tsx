// pages/smtp/index.tsx - Tela de configuração SMTP

import React, { useState } from 'react';
import withAuth from '@/utils/withAuth';
import SMTPPageContent from '@/components/corpo/admin/smtp';

const SMTPPage = () => {
  const [showModal, setShowModal] = useState(true);

  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', '/admin/cadastros/smtp');
  }

  const handleClose = () => {
    setShowModal(false);
    // Redirecionar ou fechar conforme necessário
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  return (
    <>
      {showModal && <SMTPPageContent onClose={handleClose} />}
    </>
  );
};

export default withAuth(SMTPPage, ['ADMINISTRAÇÃO']);
