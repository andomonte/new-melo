import type { ReactElement, ReactNode } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import type { AppProps } from 'next/app';
import { ThemeProvider } from 'next-themes';
import '@/styles/globals.css';
import { AuthProvider } from '@/contexts/authContexts';
import { ToastProvider } from '@/components/ui/toast';
import { Toaster as UIToaster } from '@/components/ui/toaster';
import { Toaster } from 'sonner';

export type NextPageWithLayout<P = unknown, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page) => page);

  return getLayout(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ToastProvider>
          <Head>
            {/* Sem user-scalable=no/minimum-scale: bloquear zoom tira a saída
                de emergência de quem usa escala alta no Windows (e é falha de
                acessibilidade). O usuário precisa poder ampliar/reduzir. */}
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1, viewport-fit=cover"
            />
            <meta httpEquiv="Content-Language" content="pt-BR" />
            <title>Sistema-Melo</title>
            <link rel="icon" href="/images/logo2.webp" />
          </Head>
          <Component {...pageProps} />
          <UIToaster />
          <Toaster richColors position="top-center" expand={true} />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}
