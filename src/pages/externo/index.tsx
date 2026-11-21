import Head from 'next/head';
import dynamic from 'next/dynamic';

// Só no navegador (usa localStorage/navigator). Arquitetura: docs/VENDAS-EXTERNAS-OFFLINE.md
const VendaExterna = dynamic(() => import('@/components/vendaExterna/VendaExterna'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100dvh] flex items-center justify-center text-sm text-gray-500">Carregando…</div>
  ),
});

export default function PaginaExterno() {
  return (
    <>
      <Head>
        <title>Venda Externa — Melo</title>
        <link rel="manifest" href="/externo.webmanifest" />
        <meta name="theme-color" content="#1e3a5f" />
        {/* iPhone/iPad: "Adicionar à Tela de Início" abre em tela cheia */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Venda Melo" />
        <link rel="apple-touch-icon" href="/images/externo-icon-180.png" />
      </Head>
      <VendaExterna />
    </>
  );
}
