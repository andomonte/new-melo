import { useTheme } from 'next-themes';
import React from 'react';

interface TextoEspera {
  texto?: string;
}

export default function Carregamento({ texto }: TextoEspera) {
  const { theme } = useTheme();
  const [urlLogo2, setUrlLogo2] = React.useState('');

  React.useEffect(() => {
    const urlLogoT =
      theme === 'dark' ? '/images/logo2Branco.webp' : '/images/logo2.webp';
    setUrlLogo2(urlLogoT);
  }, [theme]);

  return (
    <div className="h-full   flex flex-col justify-center items-center">
      <div className="relative flex justify-center items-center">
        <div className=" absolute animate-spin rounded-full h-28 w-28 border-t-4 border-b-4 border-blue-900 dark:border-blue-100"></div>
        <div className="flex justify-center flex-col items-center">
          <img src={urlLogo2} alt="Melo" className="rounded-full h-16 w-16" />
        </div>
      </div>
      <div className="text-[16px] mt-10 dark:text-gray-100 text-[#2B558D] font-bold">
        {texto}
      </div>
    </div>
  );
}
