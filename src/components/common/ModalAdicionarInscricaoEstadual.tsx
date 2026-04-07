// src/components/common/ModalAdicionarInscricaoEstadual.tsx

import React, { useState } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';
import FormInput from '@/components/common/FormInput';
import { InscricaoEstadual } from '@/data/inscricoesEstaduais/inscricoesEstaduais';

interface ModalAdicionarInscricaoEstadualProps {
  cgc: string;
  nomeContribuinte?: string;
  existingInscricoes: InscricaoEstadual[];
  onClose: () => void;
  onAdd: (ie: InscricaoEstadual) => void;
  onEdit: (ie: InscricaoEstadual, index: number) => void;
  onDelete: (index: number) => void;
}

const ModalAdicionarInscricaoEstadual: React.FC<ModalAdicionarInscricaoEstadualProps> = ({
  cgc,
  nomeContribuinte = '',
  existingInscricoes,
  onClose,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const isEditing = editingIndex !== null;

  const handleEditClick = (ie: InscricaoEstadual, index: number) => {
    setInscricaoEstadual(ie.inscricaoestadual);
    setEditingIndex(index);
    setError(null);
  };

  const handleDeleteClick = (index: number) => {
    onDelete(index);
  };

  const handleCancelEdit = () => {
    setInscricaoEstadual('');
    setEditingIndex(null);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inscricaoEstadual.trim()) {
      setError('Inscrição Estadual é obrigatória');
      return;
    }

    // Verifica se a IE já existe localmente (exceto se estiver editando a mesma)
    const ieJaExiste = existingInscricoes.some(
      (ie, index) =>
        ie.inscricaoestadual === inscricaoEstadual.trim() &&
        (!isEditing || index !== editingIndex)
    );

    if (ieJaExiste) {
      setError('Esta Inscrição Estadual já está cadastrada');
      return;
    }

    const ieData: InscricaoEstadual = {
      cgc,
      inscricaoestadual: inscricaoEstadual.trim(),
      nomecontribuinte: nomeContribuinte, // Sempre usa o nome do formulário principal
    };

    if (isEditing && editingIndex !== null) {
      onEdit(ieData, editingIndex);
    } else {
      onAdd(ieData);
    }

    // Limpar form após salvar
    setInscricaoEstadual('');
    setEditingIndex(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center px-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg w-full max-w-md">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
          <h4 className="text-xl font-bold text-[#347AB6] dark:text-gray-100">
            {isEditing ? 'Editar' : 'Adicionar'} Inscrição Estadual
          </h4>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-100 hover:text-red-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <FormInput
            autoComplete="off"
            name="cgc"
            type="text"
            label="CGC"
            value={cgc}
            disabled
            readOnly
          />
          <FormInput
            autoComplete="off"
            name="inscricaoestadual"
            type="text"
            label="Inscrição Estadual"
            value={inscricaoEstadual}
            onChange={(e) => setInscricaoEstadual(e.target.value)}
            required
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
            * Esta inscrição será vinculada ao contribuinte: {nomeContribuinte || '(não informado)'}
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Lista de IEs existentes */}
          {existingInscricoes.length > 0 && (
            <div className="mt-4">
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Inscrições Cadastradas
              </h5>
              <div className="border dark:border-gray-600 rounded-md max-h-[135px] overflow-y-auto">
                {existingInscricoes.map((ie, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 border-b last:border-b-0 dark:border-gray-600 ${
                      editingIndex === index
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {ie.inscricaoestadual}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(ie, index)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(index)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-4">
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancelar Edição
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#347AB6] text-white rounded-md hover:bg-[#2a5a8a]"
            >
              {isEditing ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalAdicionarInscricaoEstadual;
