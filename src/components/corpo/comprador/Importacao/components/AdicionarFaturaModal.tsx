/**
 * Modal para adicionar uma nova fatura à DI
 * Campos: Fornecedor (obrigatório), Cliente, Comprador
 * Mesmo padrão visual do BuscarProdutoModal
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/components/services/api';

interface FaturaDados {
  cod_credor: string;
  fornecedor_nome: string;
  cod_cliente?: string;
  cliente_nome?: string;
  cod_comprador?: string;
  comprador_nome?: string;
}

interface AdicionarFaturaModalProps {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (dados: FaturaDados) => void;
}

// --- Campo de busca genérico ---
interface CampoBuscaProps {
  label: string;
  placeholder: string;
  obrigatorio?: boolean;
  valor: string;
  valorLabel: string;
  onBuscar: (termo: string) => Promise<{ value: string; label: string }[]>;
  onSelecionar: (value: string, label: string) => void;
  onLimpar: () => void;
}

const CampoBusca: React.FC<CampoBuscaProps> = ({
  label,
  placeholder,
  obrigatorio,
  valor,
  valorLabel,
  onBuscar,
  onSelecionar,
  onLimpar,
}) => {
  const [termo, setTermo] = useState('');
  const [opcoes, setOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTermo(val);
    setAberto(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (val.length >= 1) {
        setCarregando(true);
        const resultado = await onBuscar(val);
        setOpcoes(resultado);
        setCarregando(false);
      } else {
        setOpcoes([]);
      }
    }, 350);
  };

  const handleSelect = (opt: { value: string; label: string }) => {
    onSelecionar(opt.value, opt.label);
    setTermo('');
    setAberto(false);
    setOpcoes([]);
  };

  if (valor) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label} {obrigatorio && <span className="text-red-500">*</span>}
        </label>
        <div className="flex items-center gap-2 px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg bg-green-50 dark:bg-green-900/20 text-sm">
          <Check size={14} className="text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-gray-900 dark:text-gray-100 truncate flex-1">{valorLabel}</span>
          <button
            onClick={onLimpar}
            className="text-gray-400 hover:text-red-500 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {obrigatorio && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={termo}
          onChange={handleChange}
          onFocus={() => { if (opcoes.length > 0) setAberto(true); }}
          placeholder={placeholder}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#347AB6]/40 focus:border-[#347AB6]"
        />
        {carregando && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>

      {aberto && opcoes.length > 0 && (
        <div className="absolute z-[70] w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-auto">
          {opcoes.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelect(opt)}
              className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {aberto && !carregando && termo.length >= 1 && opcoes.length === 0 && (
        <div className="absolute z-[70] w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg shadow-lg p-3 text-center text-xs text-gray-500 dark:text-gray-400">
          Nenhum resultado encontrado
        </div>
      )}
    </div>
  );
};

// --- Modal principal ---
export const AdicionarFaturaModal: React.FC<AdicionarFaturaModalProps> = ({
  aberto,
  onFechar,
  onConfirmar,
}) => {
  const [codCredor, setCodCredor] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [codCliente, setCodCliente] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [codComprador, setCodComprador] = useState('');
  const [compradorNome, setCompradorNome] = useState('');

  // Reset ao abrir
  useEffect(() => {
    if (aberto) {
      setCodCredor('');
      setFornecedorNome('');
      setCodCliente('');
      setClienteNome('');
      setCodComprador('');
      setCompradorNome('');
    }
  }, [aberto]);

  const buscarFornecedores = useCallback(async (termo: string) => {
    try {
      const res = await api.get(`/api/compras/fornecedores?search=${encodeURIComponent(termo)}&perPage=15`);
      return (res.data.fornecedores || []).map((f: any) => ({
        value: f.cod_credor,
        label: `${f.cod_credor} - ${f.nome}${f.nome_fant ? ` (${f.nome_fant})` : ''}`,
      }));
    } catch { return []; }
  }, []);

  const buscarClientes = useCallback(async (termo: string) => {
    try {
      const res = await api.get(`/api/contas-receber/clientes?search=${encodeURIComponent(termo)}`);
      return (res.data.clientes || []).map((c: any) => ({
        value: String(c.value),
        label: c.label,
      }));
    } catch { return []; }
  }, []);

  const buscarCompradores = useCallback(async (termo: string) => {
    try {
      const res = await api.get(`/api/contas-pagar/compradores?search=${encodeURIComponent(termo)}`);
      return (res.data.compradores || []).map((c: any) => ({
        value: c.value,
        label: c.label,
      }));
    } catch { return []; }
  }, []);

  const handleConfirmar = () => {
    if (!codCredor) return;

    onConfirmar({
      cod_credor: codCredor,
      fornecedor_nome: fornecedorNome,
      cod_cliente: codCliente || undefined,
      cliente_nome: clienteNome || undefined,
      cod_comprador: codComprador || undefined,
      comprador_nome: compradorNome || undefined,
    });
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h3 className="text-lg font-bold text-[#347AB6]">Adicionar Fatura</h3>
          <button onClick={onFechar} className="text-gray-500 dark:text-gray-400 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {/* Campos */}
        <div className="px-5 py-5 space-y-4">
          <CampoBusca
            label="Fornecedor"
            placeholder="Buscar por codigo ou nome..."
            obrigatorio
            valor={codCredor}
            valorLabel={`${codCredor} - ${fornecedorNome}`}
            onBuscar={buscarFornecedores}
            onSelecionar={(val, lbl) => {
              setCodCredor(val);
              setFornecedorNome(lbl.replace(`${val} - `, ''));
            }}
            onLimpar={() => { setCodCredor(''); setFornecedorNome(''); }}
          />

          <CampoBusca
            label="Cliente"
            placeholder="Buscar por codigo ou nome..."
            valor={codCliente}
            valorLabel={clienteNome || codCliente}
            onBuscar={buscarClientes}
            onSelecionar={(val, lbl) => {
              setCodCliente(val);
              setClienteNome(lbl);
            }}
            onLimpar={() => { setCodCliente(''); setClienteNome(''); }}
          />

          <CampoBusca
            label="Comprador"
            placeholder="Buscar por codigo ou nome..."
            valor={codComprador}
            valorLabel={compradorNome || codComprador}
            onBuscar={buscarCompradores}
            onSelecionar={(val, lbl) => {
              setCodComprador(val);
              setCompradorNome(lbl);
            }}
            onLimpar={() => { setCodComprador(''); setCompradorNome(''); }}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-zinc-700">
          <Button variant="outline" size="sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!codCredor}
            onClick={handleConfirmar}
            className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
};
