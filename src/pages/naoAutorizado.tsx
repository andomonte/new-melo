import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useTheme } from 'next-themes';

export default function ForbiddenPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [urlLogo, setUrlLogo] = React.useState('/images/logo1.webp');
  React.useEffect(() => {
    const urlLogoT =
      theme === 'dark' ? '/images/logo1Branco.webp' : '/images/logo1.webp';
    setUrlLogo(urlLogoT);
  }, [theme]);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* LOGO */}
      <Image
        priority
        src={urlLogo} // Substitua pelo caminho correto do logo
        alt="Logo"
        width={150} // placeholder
        height={150}
        className="mb-6"
      />

      {/* MENSAGEM */}
      <h1 className="text-3xl mb-2 font-bold text-red-600 dark:text-red-400">
        Acesso Negado
      </h1>
      <p className="text-gray-700 mb-5 dark:text-gray-300 mt-2">
        Você não tem permissão para acessar esta página.
      </p>

      {/* BOTÃO VOLTAR PARA LOGIN */}
      <button
        onClick={() => router.push('/logout')}
        className="mt-10 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all"
      >
        VOLTAR
      </button>
    </div>
  );
}
