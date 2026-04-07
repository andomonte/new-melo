import React, { useEffect, useState } from 'react';
import { Bancos, getBancos, deletarBanco, Banco } from '@/data/bancos/bancos';
import { useDebouncedCallback } from 'use-debounce';
import { PlusIcon, Pencil, Trash2 } from 'lucide-react';
import DataTable from '@/components/common/DataTable';
import { DefaultButton } from '@/components/common/Buttons';
import Carregamento from '@/utils/carregamento';
import BancoDetail from './BancoDetail';

const BancosContasPage = () => {
  const [bancos, setBancos] = useState<Bancos>({} as Bancos);
  const [searchBanco, setSearchBanco] = useState('');
  const [pageBanco, setPageBanco] = useState(1);
  const [perPageBanco, setPerPageBanco] = useState(10);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedBanco, setSelectedBanco] = useState<Banco | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bancoToDelete, setBancoToDelete] = useState<Banco | null>(null);

  const handleBancos = async () => {
    try {
      const data = await getBancos({
        page: pageBanco,
        perPage: perPageBanco,
        search: searchBanco,
      });
      setBancos(data);
    } catch (error) {
      console.error('Erro ao buscar bancos:', error);
    }
  };

  const debouncedSearchBanco = useDebouncedCallback(handleBancos, 300);

  useEffect(() => {
    handleBancos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageBanco, perPageBanco]);

  const handleOpenDetail = (banco: Banco | null) => {
    setSelectedBanco(banco);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedBanco(null);
    handleBancos();
  };

  const handleSaveAndContinue = (newBank: Banco) => {
    setSelectedBanco(newBank);
  };

  const handleRecordFound = (foundBank: Banco | null) => {
    setSelectedBanco(foundBank);
  };

  const handleDeleteClick = (banco: Banco) => {
    setBancoToDelete(banco);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (bancoToDelete?.banco) {
      try {
        await deletarBanco(bancoToDelete.banco);
        handleBancos();
      } catch (error) {
        console.error('Erro ao deletar banco', error);
      } finally {
        setIsDeleteModalOpen(false);
        setBancoToDelete(null);
      }
    }
  };

  const rowsBanco = bancos.data?.map((banco) => ({
    action: (
      <div className="flex gap-2">
        <button
          onClick={() => handleOpenDetail(banco)}
          className="p-1 text-gray-500 hover:text-gray-700"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => handleDeleteClick(banco)}
          className="p-1 text-red-500 hover:text-red-700"
        >
          <Trash2 size={16} />
        </button>
      </div>
    ),
    nome: banco.nome,
    codigo: banco.banco,
  }));

  if (isDetailOpen) {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden bg-slate-900">
        <main className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
          <BancoDetail
            banco={selectedBanco}
            onClose={handleCloseDetail}
            onSaveAndContinue={handleSaveAndContinue}
            onRecordFound={handleRecordFound}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-900 p-6 gap-4">
      <header className="flex-none flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-200">Bancos</h2>
        <DefaultButton
          onClick={() => handleOpenDetail(null)}
          text="Novo Banco"
          icon={<PlusIcon size={18} />}
        />
      </header>
      <div className="flex-1 min-h-0 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <input
            type="text"
            placeholder="Pesquisar banco..."
            value={searchBanco}
            onChange={(e) => {
              setSearchBanco(e.target.value);
              debouncedSearchBanco();
            }}
            className="w-full bg-slate-900/50 border border-slate-600 rounded-md p-2 text-white"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          <DataTable
            headers={['Ações', 'Nome', 'Código']}
            rows={rowsBanco || []}
            meta={bancos.meta}
            onPageChange={setPageBanco}
            onPerPageChange={setPerPageBanco}
            onSearch={() => {}}
          />
        </div>
      </div>
      {isDeleteModalOpen && (
        <ConfirmDeleteBancoModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          bancoId={bancoToDelete?.banco}
        />
      )}
    </div>
  );
};

interface ConfirmDeleteBancoModalProps {
  isOpen: boolean;
  onClose: () => void;
  bancoId?: string | null;
  onConfirm: () => Promise<void>;
}

const ConfirmDeleteBancoModal: React.FC<ConfirmDeleteBancoModalProps> = ({
  isOpen,
  onClose,
  bancoId,
  onConfirm,
}) => {
  const [deleteStatus, setDeleteStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteStatus('loading');
    if (bancoId) {
      try {
        await onConfirm();
        setDeleteStatus('success');
        setTimeout(() => {
          setDeleteStatus('idle');
          onClose();
        }, 1500);
      } catch (error: any) {
        setDeleteStatus('error');
        const apiErrorMessage = error?.response?.data?.error;
        setErrorMessage(
          apiErrorMessage ||
            error.message ||
            'Tivemos problemas ao tentar deletar o Banco. Tente mais tarde ou comunique a equipe técnica.',
        );
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg min-w-[30%] max-w-lg flex flex-col justify-between">
        <div className="flex-grow flex items-center justify-center">
          {deleteStatus === 'idle' && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Confirmar Exclusão
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Tem certeza que deseja remover permanentemente o banco com ID
                &quot;{bancoId}&quot;?
              </p>
            </div>
          )}
          {deleteStatus === 'loading' && (
            <div className="flex items-center justify-center">
              <Carregamento texto="Deletando o Banco..." />
            </div>
          )}
          {deleteStatus === 'success' && (
            <div className="flex items-center justify-center">
              <p className="text-lg font-semibold text-green-600">
                Deletado com sucesso!
              </p>
            </div>
          )}
          {deleteStatus === 'error' && (
            <div className="text-center max-w-2xl">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-500 mb-4">
                ⚠️ Não é Possível Excluir
              </h2>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4">
                <p className="text-red-700 dark:text-red-300 mb-2 font-medium">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}
        </div>
        {(deleteStatus === 'idle' || deleteStatus === 'error') && (
          <div className="flex justify-end gap-2">
            {deleteStatus === 'idle' && (
              <>
                <DefaultButton
                  onClick={onClose}
                  variant="cancel"
                  text="Cancelar"
                />
                <DefaultButton
                  onClick={handleConfirm}
                  variant="confirm"
                  text="Sim, Excluir"
                />
              </>
            )}
            {deleteStatus === 'error' && (
              <DefaultButton onClick={onClose} variant="cancel" text="Fechar" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default BancosContasPage;
