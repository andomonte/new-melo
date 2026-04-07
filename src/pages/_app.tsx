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
            <meta
              name="viewport"
              content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover"
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
