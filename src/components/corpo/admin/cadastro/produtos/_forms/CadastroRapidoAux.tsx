import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

export type TipoAux = 'marca' | 'grupoFuncao' | 'grupoProduto';

interface CadastroRapidoAuxProps {
  aberto: boolean;
  tipo: TipoAux;
  onClose: () => void;
  /** Chamado quando o registro é criado com sucesso (código + descrição). */
  onCriado: (codigo: string, descr: string) => void;
}

const CONFIG: Record<
  TipoAux,
  {
    titulo: string;
    url: string;
    body: (descr: string) => Record<string, any>;
    extrair: (d: any) => { codigo?: string; descr?: string };
  }
> = {
  marca: {
    titulo: 'Nova Marca',
    url: '/api/marcas/add',
    body: (descr) => ({ descr, bloquear_preco: 'S' }),
    extrair: (d) => ({ codigo: d?.data?.codmarca, descr: d?.data?.descr }),
  },
  grupoFuncao: {
    titulo: 'Novo Grupo de Função',
    url: '/api/gruposFuncao/add',
    body: (descr) => ({ descr }),
    extrair: (d) => ({ codigo: d?.data?.codgpf, descr: d?.data?.descr }),
  },
  grupoProduto: {
    titulo: 'Novo Grupo de Produto',
    url: '/api/gruposProduto/add',
    body: (descr) => ({ descr }),
    extrair: (d) => ({ codigo: d?.data?.codgpp, descr: d?.data?.descr }),
  },
};

/**
 * Modal de cadastro rápido (código gerado automaticamente, só a Descrição) para
 * criar Marca / Grupo de Função / Grupo de Produto na hora, sem sair do
 * cadastro de produto. Ao salvar, devolve o código para já ser selecionado.
 */
const CadastroRapidoAux: React.FC<CadastroRapidoAuxProps> = ({
  aberto,
  tipo,
  onClose,
  onCriado,
}) => {
  const [descr, setDescr] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (aberto) {
      setDescr('');
      setErro('');
      setSalvando(false);
    }
  }, [aberto, tipo]);

  if (!aberto) return null;
  const cfg = CONFIG[tipo];

  const salvar = async () => {
    setErro('');
    const d = descr.trim();
    if (!d) {
      setErro('Informe a descrição.');
      return;
    }
    setSalvando(true);
    try {
      const resp = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg.body(d)),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErro(data?.error || data?.message || 'Falha ao cadastrar.');
        return;
      }
      const { codigo, descr: descrCriada } = cfg.extrair(data);
      if (!codigo) {
        setErro('Cadastrado, mas não foi possível obter o código.');
        return;
      }
      onCriado(String(codigo).trim(), String(descrCriada ?? d).trim());
      onClose();
    } catch (e) {
      setErro('Erro ao cadastrar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-blue-600 dark:text-blue-300">
            {cfg.titulo}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-red-500"
          >
            <X size={18} />
          </button>
        </div>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Descrição *
        </label>
        <input
          type="text"
          autoFocus
          value={descr}
          onChange={(e) => setDescr(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              salvar();
            }
          }}
          className="w-full h-10 px-3 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100"
          placeholder="Digite a descrição"
        />
        {erro && <p className="text-red-500 text-xs mt-1">{erro}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1 px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CadastroRapidoAux;
