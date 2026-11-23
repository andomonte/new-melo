// /externo sem filial: vai para a filial já usada neste aparelho ou mostra as filiais.
// O link certo para o vendedor é /externo/<codigo_filial> (ex.: /externo/1 = MANAUS).
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

type Filial = { nome_filial: string; codigo_filial: number };

export default function PaginaExterno() {
  const router = useRouter();
  const [filiais, setFiliais] = useState<Filial[] | null>(null);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('vendaExterna_sessao_v1') || 'null');
      if (s?.codigoFilial) {
        router.replace(`/externo/${s.codigoFilial}`);
        return;
      }
    } catch {
      /* */
    }
    fetch('/api/conferencia/estacao/filiais')
      .then((r) => r.json())
      .then((d) => setFiliais(d.filiais || []))
      .catch(() => setFiliais([]));
  }, [router]);

  return (
    <>
      <Head>
        <title>Venda Externa — Melo</title>
        <meta name="theme-color" content="#1e3a5f" />
      </Head>
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#1e3a5f] p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl p-6">
          <div className="font-bold text-gray-900 mb-1">Venda Externa</div>
          <div className="text-sm text-gray-500 mb-4">Escolha a filial</div>
          {filiais === null ? (
            <div className="text-sm text-gray-400">Carregando…</div>
          ) : filiais.length === 0 ? (
            <div className="text-sm text-red-600">Sem conexão para listar as filiais.</div>
          ) : (
            <div className="space-y-2">
              {filiais.map((f) => (
                <a
                  key={f.codigo_filial}
                  href={`/externo/${f.codigo_filial}`}
                  className="block rounded-xl border border-gray-200 px-4 py-3 font-semibold text-[#1e3a5f]"
                >
                  {f.nome_filial}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
