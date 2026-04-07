import React from 'react';
import Modal from '@/components/common/Modal';
import DashboardFinanceiro from '@/components/common/DashboardFinanceiro';
import { ContaPagar } from '@/hooks/useContasPagar';

interface ModaisDashboardProps {
  // Modal Individual
  modalDashboardAberto: boolean;
  setModalDashboardAberto: (aberto: boolean) => void;
  contaSelecionada: ContaPagar | null;
  setContaSelecionada: (conta: ContaPagar | null) => void;
  
  // Modal Geral
  modalDashboardGeralAberto: boolean;
  setModalDashboardGeralAberto: (aberto: boolean) => void;
  contasPagar: ContaPagar[];
  
  // Resumo
  resumoContas: {
    cod_pgto: string;
    status: 'pendente' | 'pago' | 'pago_parcial' | 'cancelado';
    valor_pgto: number;
    valor_pago: number;
  }[];
}

const ModaisDashboard: React.FC<ModaisDashboardProps> = ({
  modalDashboardAberto,
  setModalDashboardAberto,
  contaSelecionada,
  setContaSelecionada,
  modalDashboardGeralAberto,
  setModalDashboardGeralAberto,
  contasPagar,
  resumoContas,
}) => {
  const calcularResumo = () => ({
    totalContas: resumoContas.length,
    totalPendentes: resumoContas.filter(c => c.status === 'pendente').length,
    totalParciais: resumoContas.filter(c => c.status === 'pago_parcial').length,
    totalPagas: resumoContas.filter(c => c.status === 'pago').length,
    valorTotalPendente: resumoContas
      .filter(c => c.status === 'pendente' || c.status === 'pago_parcial')
      .reduce((acc, c) => {
        const valorPgto = Number(c.valor_pgto) || 0;
        const valorPago = Number(c.valor_pago) || 0;
        return c.status === 'pago_parcial' ? acc + (valorPgto - valorPago) : acc + valorPgto;
      }, 0)
  });

  return (
    <>
      {/* Modal Dashboard Individual */}
      {modalDashboardAberto && contaSelecionada && (
        <Modal
          isOpen={modalDashboardAberto}
          onClose={() => {
            setModalDashboardAberto(false);
            setContaSelecionada(null);
          }}
          title={`Dashboard - ${contaSelecionada.nome_credor || 'Conta'}`}
          width="w-11/12 max-w-7xl"
        >
          <DashboardFinanceiro
            tipo="individual"
            conta={contaSelecionada}
            resumo={calcularResumo()}
          />
        </Modal>
      )}

      {/* Modal Dashboard Geral */}
      {modalDashboardGeralAberto && (
        <Modal
          isOpen={modalDashboardGeralAberto}
          onClose={() => setModalDashboardGeralAberto(false)}
          title="Dashboard Financeiro Geral"
          width="w-11/12 max-w-7xl"
        >
          <DashboardFinanceiro
            tipo="geral"
            todasContas={contasPagar}
            resumo={calcularResumo()}
          />
        </Modal>
      )}
    </>
  );
};

export default ModaisDashboard;
