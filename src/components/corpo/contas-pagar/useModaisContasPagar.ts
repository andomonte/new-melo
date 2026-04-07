import { useState } from 'react';
import { ContaPagar } from '@/hooks/useContasPagar';

export const useModaisContasPagar = () => {
  const [contaSelecionada, setContaSelecionada] = useState<ContaPagar | null>(null);
  const [modalPagoAberto, setModalPagoAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalGerarTituloAberto, setModalGerarTituloAberto] = useState(false);
  const [modalNovaContaAberto, setModalNovaContaAberto] = useState(false);
  const [modalConfirmacaoValor, setModalConfirmacaoValor] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [modalParcelasAberto, setModalParcelasAberto] = useState(false);
  const [modalSelecionarParcelaAberto, setModalSelecionarParcelaAberto] = useState(false);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [modalSelecaoColunas, setModalSelecaoColunas] = useState(false);
  const [modalDashboardAberto, setModalDashboardAberto] = useState(false);
  const [modalDashboardGeralAberto, setModalDashboardGeralAberto] = useState(false);
  const [modalNotasAssociadasAberto, setModalNotasAssociadasAberto] = useState(false);
  const [modalCancelarPagamentoAberto, setModalCancelarPagamentoAberto] = useState(false);
  const [modalObservacoesAberto, setModalObservacoesAberto] = useState(false);
  const [modalPagamentoLoteAberto, setModalPagamentoLoteAberto] = useState(false);

  const fecharTodosModais = () => {
    setModalPagoAberto(false);
    setModalEditarAberto(false);
    setModalCancelarAberto(false);
    setModalDetalhesAberto(false);
    setModalGerarTituloAberto(false);
    setModalNovaContaAberto(false);
    setModalConfirmacaoValor(false);
    setModalHistoricoAberto(false);
    setModalParcelasAberto(false);
    setModalSelecionarParcelaAberto(false);
    setModalExportarAberto(false);
    setModalSelecaoColunas(false);
    setModalDashboardAberto(false);
    setModalDashboardGeralAberto(false);
    setModalNotasAssociadasAberto(false);
    setModalCancelarPagamentoAberto(false);
    setModalObservacoesAberto(false);
    setModalPagamentoLoteAberto(false);
    setContaSelecionada(null);
  };

  return {
    // Estados
    contaSelecionada,
    setContaSelecionada,
    modalPagoAberto,
    setModalPagoAberto,
    modalEditarAberto,
    setModalEditarAberto,
    modalCancelarAberto,
    setModalCancelarAberto,
    modalDetalhesAberto,
    setModalDetalhesAberto,
    modalGerarTituloAberto,
    setModalGerarTituloAberto,
    modalNovaContaAberto,
    setModalNovaContaAberto,
    modalConfirmacaoValor,
    setModalConfirmacaoValor,
    modalHistoricoAberto,
    setModalHistoricoAberto,
    modalParcelasAberto,
    setModalParcelasAberto,
    modalSelecionarParcelaAberto,
    setModalSelecionarParcelaAberto,
    modalExportarAberto,
    setModalExportarAberto,
    modalSelecaoColunas,
    setModalSelecaoColunas,
    modalDashboardAberto,
    setModalDashboardAberto,
    modalDashboardGeralAberto,
    setModalDashboardGeralAberto,
    modalNotasAssociadasAberto,
    setModalNotasAssociadasAberto,
    modalCancelarPagamentoAberto,
    setModalCancelarPagamentoAberto,
    modalObservacoesAberto,
    setModalObservacoesAberto,
    modalPagamentoLoteAberto,
    setModalPagamentoLoteAberto,
    // Função auxiliar
    fecharTodosModais,
  };
};
