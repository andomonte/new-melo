import * as React from 'react';
import { IoTrashOutline } from 'react-icons/io5';
import { GoPencil } from 'react-icons/go';
import { FaPrint } from 'react-icons/fa6';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

const dados = [
  {
    nf: 1,
    cliente: 'João Silva',
    uf: 'SP',
    formulario: 'A123',
    documento: '123456',
    tipoFatura: 'Mensal',
    data: '2025-02-26',
  },
  {
    nf: 2,
    cliente: 'Maria Souza',
    uf: 'RJ',
    formulario: 'B456',
    documento: '654321',
    tipoFatura: 'Única',
    data: '2025-02-25',
  },
  {
    nf: 3,
    cliente: 'Carlos Lima',
    uf: 'MG',
    formulario: 'C789',
    documento: '789012',
    tipoFatura: 'Parcelada',
    data: '2025-02-24',
  },
];

export default function TabelaFaturamento() {
  const [notaStatus, setNotaStatus] = React.useState('');

  return (
    <div className="w-full">
      <div className="px-8 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto text-black">
              Filtrar Notas <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              checked={notaStatus === 'todos'}
              onCheckedChange={() =>
                setNotaStatus(notaStatus === 'todos' ? '' : 'todos')
              }
            >
              Todos
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={notaStatus === 'faturada'}
              onCheckedChange={() =>
                setNotaStatus(notaStatus === 'faturada' ? '' : 'faturada')
              }
            >
              Notas Faturadas
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={notaStatus === 'cobrada'}
              onCheckedChange={() =>
                setNotaStatus(notaStatus === 'cobrada' ? '' : 'cobrada')
              }
            >
              Notas Cobradas
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex justify-center overflow-hidden">
        <table className="w-[100%] bg-white  dark:bg-gray-800 dark:border-gray-700 shadow-md text-black dark:text-white  border-collapse">
          <thead>
            <tr className=" bg-gray-200 dark:bg-gray-700">
              <th className="px-4 py-3 pl-10 text-left">NF</th>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">UF</th>
              <th className="px-4 py-2 text-left">Formulário</th>
              <th className="px-4 py-2 text-left">Documento</th>
              <th className="px-4 py-2 text-left">Tipo Fatura</th>
              <th className="px-4 py-2 text-left">Data</th>
              <th className="px-4 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {dados.map((item) => (
              <tr key={item.nf} className="border-t  dark:border-gray-600">
                <td className="px-4 pl-10 py-2">{item.nf}</td>
                <td className="px-4 py-2">{item.cliente}</td>
                <td className="px-4 py-2">{item.uf}</td>
                <td className="px-4 py-2">{item.formulario}</td>
                <td className="px-4 py-2">{item.documento}</td>
                <td className="px-4 py-2">{item.tipoFatura}</td>
                <td className="px-4 py-2">{item.data}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-center items-center ">
                    <div className="flex justify-center items-center h-10 w-10 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                      <FaPrint className="text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="flex justify-center items-center h-10 w-10 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                      <IoTrashOutline className="text-red-800 dark:text-red-300" />
                    </div>
                    <div className="flex justify-center items-center h-10 w-10 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                      <GoPencil className="text-blue-500 dark:text-blue-400" />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
