import React, { useMemo, useState } from 'react';

// Página simples para montar o payload e chamar POST /api/impostos
// Usa Tailwind se existir no projeto (opcional). Se não tiver, ainda funciona com HTML padrão.

// enums/consts básicas
const MOVS = ['ENTRADA_COMPRAS', 'ENTRADA', 'SAIDA'] as const;
const FATURAS = ['NOTA_FISCAL', 'FAG'] as const;

const OPS_POR_MOV: Record<(typeof MOVS)[number], string[]> = {
  ENTRADA_COMPRAS: [
    'COMPRA',
    'TRANSFERENCIA',
    'DEVOLUCAO_VENDA',
    'DEVOLUCAO_TRANSFERENCIA',
    'ENTRADA_BONIFICACAO',
    'RETORNO_EXPOSICAO',
    'ENTRADA_DEMOSTRACAO',
    'ENTRADA_ARMAZEM',
    'RETORNO_GARANTIA_FABRICA',
    'RETORNO_GARANTIA_CLIENTE',
    'RETORNO_CONSERTO',
  ],
  ENTRADA: [
    'DEVOLUCAO_VENDA',
    'DEVOLUCAO_TRANSFERENCIA',
    'RETORNO_GARANTIA_CLIENTE',
    'RETORNO_CONSERTO',
  ],
  SAIDA: [
    'VENDA',
    'TRANSFERENCIA',
    'DEVOLUCAO_COMPRA',
    'DEVOLUCAO_TRANSFERENCIA',
    'REMESSA_BONIFICACAO',
    'REMESSA_EXPOSICAO',
    'REMESSA_DEMOSTRACAO',
    'REMESSA_ARMAZEM',
    'REMESSA_GARANTIA_FABRICA',
    'REMESSA_CONSERTO',
    'SIMPLES_REMESSA',
    'REMESSA_GARANTIA_CLIENTE',
    'EXTRAVIO_AVARIA_FABRICA',
    'EXTRAVIO_AVARIA_CLIENTE',
    'RETORNO_REMESSA_GARANTIA',
    'RETORNO_REMESSA_CONSERTO',
  ],
};

// Tipos de formulário (iguais aos esperados pelo endpoint)
type Payload = {
  tipoMovimentacao: (typeof MOVS)[number];
  tipoOperacao: string;
  tipoFatura: (typeof FATURAS)[number];
  codProduto: string;
  codigo: string; // cliente ou credor
  totalProduto: number;
  baseProduto: number;
  mvaAntecipado?: number;
  zerarSubstituicao?: boolean;
  aliquotaIPI?: number | null;
  aliquotaICMS?: number | null;
  codigoTerceiro?: string | null;
};

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium mb-1">{children}</label>;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-4 md:p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export default function ImpostosPage() {
  const [mov, setMov] = useState<(typeof MOVS)[number]>('SAIDA');
  const [op, setOp] = useState('VENDA');
  const [tipoFatura, setTipoFatura] =
    useState<(typeof FATURAS)[number]>('NOTA_FISCAL');

  // básicos
  const [codProduto, setCodProduto] = useState('');
  const [codigo, setCodigo] = useState(''); // cliente/credor
  const [codigoTerceiro, setCodigoTerceiro] = useState('');

  // valores
  const [totalProduto, setTotalProduto] = useState<number>(0);
  const [baseProduto, setBaseProduto] = useState<number>(0);
  const [mvaAntecipado, setMvaAntecipado] = useState<number>(0);
  const [zerarST, setZerarST] = useState<boolean>(false);

  // opcionais
  const [aliqIPI, setAliqIPI] = useState<string>('');
  const [aliqICMS, setAliqICMS] = useState<string>('');

  // cookie da filial (caso queira setar por aqui)
  const [filialCookie, setFilialCookie] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any | null>(null);

  const opsDisponiveis = useMemo(() => OPS_POR_MOV[mov] ?? [], [mov]);

  function setCookieFilial() {
    if (!filialCookie) return;
    const dias = 30;
    const expires = new Date(
      Date.now() + dias * 24 * 60 * 60 * 1000,
    ).toUTCString();
    document.cookie = `filial_melo=${filialCookie}; path=/; expires=${expires}`;
    alert('Cookie filial_melo definido!');
  }

  async function enviar() {
    setLoading(true);
    setError(null);
    setResultado(null);

    // validações mínimas
    if (!codProduto || !codigo) {
      setLoading(false);
      setError('Informe ao menos CodProduto e Código (cliente/credor).');
      return;
    }

    const payload: Payload = {
      tipoMovimentacao: mov,
      tipoOperacao: op,
      tipoFatura,
      codProduto,
      codigo,
      totalProduto: Number(totalProduto) || 0,
      baseProduto: Number(baseProduto) || 0,
      mvaAntecipado: Number(mvaAntecipado) || 0,
      zerarSubstituicao: !!zerarST,
      aliquotaIPI: aliqIPI === '' ? null : Number(aliqIPI),
      aliquotaICMS: aliqICMS === '' ? null : Number(aliqICMS),
      codigoTerceiro: codigoTerceiro || null,
    };

    try {
      const resp = await fetch('/api/impostos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'Falha no cálculo');
      }
      setResultado(data);
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cálculo de Impostos</h1>
        <div className="flex items-center gap-2">
          <input
            placeholder="filial_melo"
            className="input input-bordered border rounded px-3 py-2"
            value={filialCookie}
            onChange={(e) => setFilialCookie(e.target.value)}
          />
          <button
            onClick={setCookieFilial}
            className="btn rounded px-3 py-2 border"
          >
            Definir cookie
          </button>
        </div>
      </header>

      <Section title="Contexto da Operação">
        <div>
          <Label>Tipo Movimentação</Label>
          <select
            className="select border rounded px-3 py-2 w-full"
            value={mov}
            onChange={(e) => {
              const novo = e.target.value as (typeof MOVS)[number];
              setMov(novo);
              const ops = OPS_POR_MOV[novo];
              if (!ops.includes(op)) setOp(ops[0]);
            }}
          >
            {MOVS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Tipo Operação</Label>
          <select
            className="select border rounded px-3 py-2 w-full"
            value={op}
            onChange={(e) => setOp(e.target.value)}
          >
            {opsDisponiveis.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Tipo Fatura</Label>
          <select
            className="select border rounded px-3 py-2 w-full"
            value={tipoFatura}
            onChange={(e) =>
              setTipoFatura(e.target.value as (typeof FATURAS)[number])
            }
          >
            {FATURAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Cod. Produto</Label>
          <input
            className="border rounded px-3 py-2 w-full"
            value={codProduto}
            onChange={(e) => setCodProduto(e.target.value)}
            placeholder="ex.: 397302"
          />
        </div>

        <div>
          <Label>Código (Cliente/Credor)</Label>
          <input
            className="border rounded px-3 py-2 w-full"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="ex.: 000123"
          />
        </div>

        <div>
          <Label>Código Terceiro (opcional)</Label>
          <input
            className="border rounded px-3 py-2 w-full"
            value={codigoTerceiro}
            onChange={(e) => setCodigoTerceiro(e.target.value)}
            placeholder="ex.: 000456"
          />
        </div>
      </Section>

      <Section title="Valores e Ajustes">
        <div>
          <Label>Total Produto</Label>
          <input
            type="number"
            className="border rounded px-3 py-2 w-full"
            value={totalProduto}
            onChange={(e) => setTotalProduto(parseFloat(e.target.value))}
            step="0.01"
            min={0}
          />
        </div>
        <div>
          <Label>Base Produto</Label>
          <input
            type="number"
            className="border rounded px-3 py-2 w-full"
            value={baseProduto}
            onChange={(e) => setBaseProduto(parseFloat(e.target.value))}
            step="0.01"
            min={0}
          />
        </div>
        <div>
          <Label>MVA Antecipado (%)</Label>
          <input
            type="number"
            className="border rounded px-3 py-2 w-full"
            value={mvaAntecipado}
            onChange={(e) => setMvaAntecipado(parseFloat(e.target.value))}
            step="0.0001"
            min={0}
          />
        </div>
        <div className="flex items-center gap-2 mt-6">
          <input
            id="zerarst"
            type="checkbox"
            className="h-4 w-4"
            checked={zerarST}
            onChange={(e) => setZerarST(e.target.checked)}
          />
          <label htmlFor="zerarst">Zerar Substituição Tributária</label>
        </div>

        <div>
          <Label>Alíquota IPI (%) — opcional</Label>
          <input
            type="number"
            className="border rounded px-3 py-2 w-full"
            value={aliqIPI}
            onChange={(e) => setAliqIPI(e.target.value)}
            step="0.01"
            min={0}
          />
        </div>
        <div>
          <Label>Alíquota ICMS (%) — opcional</Label>
          <input
            type="number"
            className="border rounded px-3 py-2 w-full"
            value={aliqICMS}
            onChange={(e) => setAliqICMS(e.target.value)}
            step="0.01"
            min={0}
          />
        </div>
      </Section>

      <div className="flex gap-3">
        <button
          onClick={enviar}
          disabled={loading}
          className="rounded px-4 py-2 bg-black text-white disabled:opacity-50"
        >
          {loading ? 'Calculando...' : 'Calcular'}
        </button>
        <button
          onClick={() => setResultado(null)}
          className="rounded px-4 py-2 border"
        >
          Limpar resultado
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 p-3">
          {error}
        </div>
      )}

      {resultado && (
        <div className="rounded-2xl border p-4 md:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Resultado</h2>

          {/* Se o endpoint retornar um objeto com chaves/valores, exibimos em tabela simples */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Campo</th>
                  <th className="py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(resultado).map(([k, v]) => (
                  <tr key={k} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium whitespace-nowrap">
                      {k}
                    </td>
                    <td className="py-2">
                      {typeof v === 'object' ? (
                        <pre className="bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(v, null, 2)}
                        </pre>
                      ) : (
                        String(v)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <details className="opacity-80">
        <summary className="cursor-pointer">
          Ver payload que será enviado
        </summary>
        <pre className="bg-gray-50 p-3 rounded mt-2 text-sm overflow-x-auto">
          {JSON.stringify(
            {
              tipoMovimentacao: mov,
              tipoOperacao: op,
              tipoFatura,
              codProduto,
              codigo,
              totalProduto,
              baseProduto,
              mvaAntecipado,
              zerarSubstituicao: zerarST,
              aliquotaIPI: aliqIPI === '' ? null : Number(aliqIPI),
              aliquotaICMS: aliqICMS === '' ? null : Number(aliqICMS),
              codigoTerceiro: codigoTerceiro || null,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}
