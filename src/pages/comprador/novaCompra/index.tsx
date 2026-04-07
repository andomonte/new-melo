import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

const Page = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirecionar para a rota padrão do sistema
    router.replace('/compras/novaCompra');
  }, [router]);

  return null;
};

export default Page;
