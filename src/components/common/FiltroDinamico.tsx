import React, { useState, useRef } from 'react';
import Select from 'react-select';

interface FiltroDinamicoProps {
  colunas: string[];
  onChange: (filtros: { campo: string; tipo: string; valor: string }[]) => void;
}
const customStyles = {
  control: (provided: any) => ({
    ...provided,
    backgroundColor: document.documentElement.classList.contains('dark')
      ? '#1f2937' // bg-zinc-900 aproximado
      : '#ffffff',
    borderColor: document.documentElement.classList.contains('dark')
      ? '#4b5563' // border-zinc-600
      : '#d1d5db',
    color: document.documentElement.classList.contains('dark')
      ? '#f9fafb'
      : '#111827',
    fontSize: '0.875rem', // text-sm
    minHeight: '38px',
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: document.documentElement.classList.contains('dark')
      ? '#1f2937'
      : '#ffffff',
    color: document.documentElement.classList.contains('dark')
      ? '#f9fafb'
      : '#111827',
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: document.documentElement.classList.contains('dark')
      ? '#f9fafb'
      : '#111827',
  }),
  input: (provided: any) => ({
    ...provided,
    color: document.documentElement.classList.contains('dark')
      ? '#f9fafb'
      : '#111827',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: document.documentElement.classList.contains('dark')
      ? '#9ca3af' // text-gray-400
      : '#6b7280', // text-gray-500
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isFocused
      ? document.documentElement.classList.contains('dark')
        ? '#374151' // bg-zinc-700 se focado
        : '#e5e7eb' // bg-gray-200 se focado
      : 'transparent',
    color: document.documentElement.classList.contains('dark')
      ? '#f9fafb'
      : '#111827',
    cursor: 'pointer',
  }),
};

const tiposDeFiltro = [
  { label: 'Contém', value: 'contém' },
  { label: 'Igual', value: 'igual' },
  { label: 'Diferente', value: 'diferente' },
  { label: 'Começa com', value: 'começa' },
  { label: 'Termina com', value: 'termina' },
  { label: 'Maior que', value: 'maior' },
  { label: 'Maior ou igual', value: 'maior_igual' },
  { label: 'Menor que', value: 'menor' },
  { label: 'Menor ou igual', value: 'menor_igual' },
  { label: 'É nulo', value: 'nulo' },
  { label: 'Não é nulo', value: 'nao_nulo' },
];

const FiltroDinamicoDeClientes: React.FC<FiltroDinamicoProps> = ({
  colunas,
  onChange,
}) => {
  const [filtros, setFiltros] = useState<
    { campo: string; tipo: string; valor: string }[]
  >([]);
  const [campoSelecionado, setCampoSelecionado] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [valorInput, setValorInput] = useState('');

  const campoSelectRef = useRef<any>(null);
  const tipoSelectRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const botaoAdicionarRef = useRef<HTMLButtonElement>(null);

  const adicionarFiltro = () => {
    if (campoSelecionado && tipoSelecionado) {
      setFiltros((prev) => [
        ...prev,
        {
          campo: campoSelecionado.value,
          tipo: tipoSelecionado.value,
          valor: valorInput,
        },
      ]);

      setValorInput('');
    }
  };

  const aplicarFiltros = () => {
    const filtrosFormatados = filtros.map((filtro) => ({
      campo: filtro.campo,
      tipo: filtro.tipo,
      valor: filtro.valor,
    }));
    onChange(filtrosFormatados);
  };

  const removerFiltro = (index: number) => {
    setFiltros((prev) => prev.filter((_, i) => i !== index));
  };

  const limparTudo = () => {
    setFiltros([]);
    onChange([]);
  };

  return (
    <div className="w-full h-[70vh] flex flex-col bg-white dark:bg-zinc-900 dark:text-white rounded-md shadow-md overflow-hidden">
      {/* Botões fixos no topo */}
      <div className="flex justify-between items-center p-4 border-b border-zinc-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800">
        <div className="flex gap-2">
          <button
            onClick={limparTudo}
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
          >
            Limpar Tudo
          </button>
        </div>
        <button
          onClick={aplicarFiltros}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
        >
          Aplicar Filtros
        </button>
      </div>

      {/* Seção de seleção de novo filtro */}
      <div className="flex gap-2 p-4 items-center border-b border-zinc-300 dark:border-zinc-700">
        <div className="flex-1">
          <Select
            ref={campoSelectRef}
            placeholder="Selecionar campo"
            value={campoSelecionado}
            onChange={(selected) => {
              setCampoSelecionado(selected);
              setTimeout(() => {
                tipoSelectRef.current?.focus();
              }, 100);
            }}
            options={colunas.sort().map((coluna) => ({
              label: coluna.toUpperCase(),
              value: coluna,
            }))}
            className="text-sm"
            styles={customStyles}
          />
        </div>

        <div className="flex-1">
          <Select
            ref={tipoSelectRef}
            placeholder="Tipo de filtro"
            value={tipoSelecionado}
            onChange={(selected) => {
              setTipoSelecionado(selected);
              setTimeout(() => {
                inputRef.current?.focus();
              }, 100);
            }}
            options={tiposDeFiltro}
            className="text-sm"
            styles={customStyles}
          />
        </div>

        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            placeholder="Valor"
            value={valorInput}
            onChange={(e) => setValorInput(e.target.value)}
            disabled={
              tipoSelecionado?.value === 'nulo' ||
              tipoSelecionado?.value === 'nao_nulo'
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                botaoAdicionarRef.current?.click();
              }
            }}
            className="w-full p-2 border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-sm"
          />
        </div>

        <button
          ref={botaoAdicionarRef}
          onClick={adicionarFiltro}
          className="bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 text-sm"
        >
          Adicionar
        </button>
      </div>

      {/* Lista dos filtros adicionados */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          {filtros.map((filtro, index) => (
            <div
              key={index}
              className="flex justify-between items-center p-2 border border-gray-300 dark:border-zinc-700 rounded"
            >
              <span className="text-sm">
                <strong>{filtro.campo.toUpperCase()}</strong> — {filtro.tipo} —{' '}
                {filtro.valor || 'NULO'}
              </span>
              <button
                onClick={() => removerFiltro(index)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FiltroDinamicoDeClientes;
