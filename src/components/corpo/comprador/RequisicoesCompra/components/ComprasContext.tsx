import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ComprasContextType {
  openNewRequisition: () => void;
  isNewRequisitionOpen: boolean;
  setIsNewRequisitionOpen: (open: boolean) => void;
}

const ComprasContext = createContext<ComprasContextType | undefined>(undefined);

export const useCompras = () => {
  const context = useContext(ComprasContext);
  if (!context) {
    throw new Error('useCompras must be used within a ComprasProvider');
  }
  return context;
};

interface ComprasProviderProps {
  children: ReactNode;
}

export const ComprasProvider: React.FC<ComprasProviderProps> = ({ children }) => {
  const [isNewRequisitionOpen, setIsNewRequisitionOpen] = useState(false);

  const openNewRequisition = () => {
    setIsNewRequisitionOpen(true);
  };

  return (
    <ComprasContext.Provider value={{
      openNewRequisition,
      isNewRequisitionOpen,
      setIsNewRequisitionOpen
    }}>
      {children}
    </ComprasContext.Provider>
  );
};