import { useEffect, useState } from 'react';
import axios from 'axios';

interface Opcao {
  cod: string;
  nome: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (cod: string) => void;
  tipo: 'vendedor' | 'transportadora';
  disabled?: boolean;
}

export default function AutocompletePessoa({
  label,
  value,
  onChange,
  tipo,
  disabled,
}: Props) {
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [inputValue, setInputValue] = useState(''); // controla o texto digitado
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const rota = tipo === 'vendedor' ? '/api/faturamento/vendedorget' : '/api/faturamento/tranpget';
      const res = await axios.get(rota);
  const data = res.data;
  if (!Array.isArray(data)) {
    console.error('Erro: resposta não é uma lista');
    return;
  }
      setOpcoes(
        res.data.map((o: any) => ({
          cod: tipo === 'vendedor' ? o.codvend : o.codtransp,
          nome: o.nome,
        })),
      );
    };
    fetch();
  }, [tipo]);

  // Atualiza inputValue com o label do value só quando não estiver digitando
  useEffect(() => {
    if (!isTyping) {
      const selecionado = opcoes.find((o) => o.cod === value);
      setInputValue(selecionado ? `${selecionado.cod} - ${selecionado.nome}` : '');
    }
  }, [value, opcoes, isTyping]);

  const opcoesFiltradas = inputValue
    ? opcoes.filter((o) =>
        `${o.cod} - ${o.nome}`.toLowerCase().includes(inputValue.toLowerCase()),
      )
    : opcoes;

  return (
    <div className="relative">
      <label className="text-sm">{label}</label>
      <input
        type="text"
        className="w-full px-2 py-1 border rounded bg-white dark:bg-zinc-900 dark:text-white"
        value={inputValue}
        disabled={disabled}
        onChange={(e) => {
          setIsTyping(true);
          setInputValue(e.target.value);
        }}
        onBlur={() => {
          setTimeout(() => setIsTyping(false), 200); // permite clique no dropdown antes de resetar
        }}
        onFocus={() => setIsTyping(true)}
      />
      {isTyping && (
        <ul className="absolute z-10 bg-white dark:bg-zinc-800 border rounded w-full mt-1 max-h-40 overflow-auto shadow text-sm">
          {opcoesFiltradas.map((o) => (
            <li
              key={o.cod}
              className="px-2 py-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
              onMouseDown={() => {
                onChange(o.cod);
                setInputValue(`${o.cod} - ${o.nome}`);
                setIsTyping(false);
              }}
            >
              {o.cod} - {o.nome}
            </li>
          ))}
          {opcoesFiltradas.length === 0 && (
            <li className="px-2 py-1 text-zinc-500">Nenhum resultado</li>
          )}
        </ul>
      )}
    </div>
  );
}
