// src/components/corpo/comprador/RequisicoesCompra/context/RequisitionContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { RequisitionDTO } from '@/data/requisicoesCompra/types/requisition';
import {
  getRequisicoesCompra,
  saveRequisition,
} from '@/data/requisicoesCompra/requisicoesCompra';
import type { Meta } from '@/data/common/meta';

interface RequisitionContextValue {
  requisitions: RequisitionDTO[];
  meta: Meta | null;
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (f: string) => void;
  fetchRequisitions: () => Promise<void>;
  isModalOpen: boolean;
  openModal: (req?: RequisitionDTO) => void;
  closeModal: () => void;
  selectedRequisition: RequisitionDTO | null;
}

const RequisitionContext = createContext<RequisitionContextValue | undefined>(
  undefined,
);

export const RequisitionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [requisitions, setRequisitions] = useState<RequisitionDTO[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] =
    useState<RequisitionDTO | null>(null);

  // ⚡️ Use page/perPage se quiser paginação, ou adapte conforme sua tela:
  const page = 1;
  const perPage = 10;

  const fetchRequisitions = async () => {
    setLoading(true);
    try {
      const { data, meta } = await getRequisicoesCompra({
        page,
        perPage,
        search,
      });
      setRequisitions(data);
      setMeta(meta);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar requisições');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
    // eslint-disable-next-line
  }, [search]);

  const openModal = (req?: RequisitionDTO) => {
    setSelectedRequisition(req ?? null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRequisition(null);
  };

  return (
    <RequisitionContext.Provider
      value={{
        requisitions,
        meta,
        loading,
        error,
        search,
        setSearch,
        fetchRequisitions,
        isModalOpen,
        openModal,
        closeModal,
        selectedRequisition,
      }}
    >
      {children}
    </RequisitionContext.Provider>
  );
};

export function useRequisitionContext(): RequisitionContextValue {
  const ctx = useContext(RequisitionContext);
  if (!ctx)
    throw new Error(
      'useRequisitionContext must be used within RequisitionProvider',
    );
  return ctx;
}
