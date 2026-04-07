import { useState } from 'react';
import { ContaReceber } from '@/hooks/useContasReceber';

export function useModaisContasReceber() {
  // Estados dos modais
  const [modalRecebidoAberto, setModalRecebidoAberto] = useState(false);
  const [modalDashboardAberto, setModalDashboardAberto] = useState(false);
  const [modalDashboardGeralAberto, setModalDashboardGeralAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalNovaContaAberto, setModalNovaContaAberto] = useState(false);
  const [modalConfirmacaoValor, setModalConfirmacaoValor] = useState(false);
  const [modalNotasAssociadasAberto, setModalNotasAssociadasAberto] = useState(false);
  const [modalFiltrosExportacaoAberto, setModalFiltrosExportacaoAberto] = useState(false);
  const [modalExportarExcelAberto, setModalExportarExcelAberto] = useState(false);
  const [modalGerarTituloAberto, setModalGerarTituloAberto] = useState(false);
  const [modalSelecionarParcelasAberto, setModalSelecionarParcelasAberto] = useState(false);
  // Additional modal flags to match ContasAPagar pattern
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [modalParcelasAberto, setModalParcelasAberto] = useState(false);
  const [modalSelecionarParcelaAberto, setModalSelecionarParcelaAberto] = useState(false);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [modalSelecaoColunas, setModalSelecaoColunas] = useState(false);
  const [modalCancelarPagamentoAberto, setModalCancelarPagamentoAberto] = useState(false);
  const [modalObservacoesAberto, setModalObservacoesAberto] = useState(false);
  const [modalPagamentoLoteAberto, setModalPagamentoLoteAberto] = useState(false);

  // Estado da conta selecionada
  const [contaSelecionada, setContaSelecionada] = useState<ContaReceber | null>(null);

  // Funções para abrir modais
  const abrirModalDetalhes = (conta: ContaReceber) => {
    setContaSelecionada(conta);
    setModalDetalhesAberto(true);
  };

  const abrirModalRecebido = (conta: ContaReceber) => {
    setContaSelecionada(conta);
    setModalDashboardAberto(false);
    setModalDashboardGeralAberto(false);
    setModalRecebidoAberto(true);
  };

  const abrirModalEditar = (conta: ContaReceber) => {
    setContaSelecionada(conta);
    setModalEditarAberto(true);
  };

  const abrirModalCancelar = (conta: ContaReceber) => {
    setContaSelecionada(conta);
    setModalCancelarAberto(true);
  };

  const visualizarDetalhesCartao = (conta: ContaReceber) => {
    // TODO: Implementar visualização de detalhes do cartão
    console.log('Visualizar detalhes do cartão para conta:', conta.id);
  };

  // Função para fechar todos os modais
  const fecharTodosModais = () => {
    setModalRecebidoAberto(false);
    setModalEditarAberto(false);
    setModalCancelarAberto(false);
    setModalDetalhesAberto(false);
    setModalNovaContaAberto(false);
    setModalConfirmacaoValor(false);
    setModalNotasAssociadasAberto(false);
    setModalFiltrosExportacaoAberto(false);
    setModalExportarExcelAberto(false);
    setModalGerarTituloAberto(false);
    setModalSelecionarParcelasAberto(false);
    setModalHistoricoAberto(false);
    setModalParcelasAberto(false);
    setModalSelecionarParcelaAberto(false);
    setModalExportarAberto(false);
    setModalSelecaoColunas(false);
    setModalCancelarPagamentoAberto(false);
    setModalObservacoesAberto(false);
    setModalPagamentoLoteAberto(false);
    setModalDashboardAberto(false);
    setModalDashboardGeralAberto(false);
    setContaSelecionada(null);
  };

  return {
    // Estados dos modais
    modalRecebidoAberto,
    modalDashboardAberto,
    modalDashboardGeralAberto,
    modalEditarAberto,
    modalCancelarAberto,
    modalDetalhesAberto,
    modalNovaContaAberto,
    modalConfirmacaoValor,
    modalNotasAssociadasAberto,
    modalFiltrosExportacaoAberto,
    modalExportarExcelAberto,
    modalGerarTituloAberto,
    modalSelecionarParcelasAberto,

    // Setters dos modais
    setModalRecebidoAberto,
    setModalDashboardAberto,
    setModalDashboardGeralAberto,
    setModalEditarAberto,
    setModalCancelarAberto,
    setModalDetalhesAberto,
    setModalNovaContaAberto,
    setModalConfirmacaoValor,
    setModalNotasAssociadasAberto,
    setModalFiltrosExportacaoAberto,
    setModalExportarExcelAberto,
    setModalGerarTituloAberto,
    setModalSelecionarParcelasAberto,
    // Additional setters
    setModalHistoricoAberto,
    setModalParcelasAberto,
    setModalSelecionarParcelaAberto,
    setModalExportarAberto,
    setModalSelecaoColunas,
    setModalCancelarPagamentoAberto,
    setModalObservacoesAberto,
    setModalPagamentoLoteAberto,

    // Conta selecionada
    contaSelecionada,
    setContaSelecionada,

    // Funções para abrir modais
    abrirModalDetalhes,
    abrirModalRecebido,
    abrirModalEditar,
    abrirModalCancelar,
    visualizarDetalhesCartao,

    // Funções utilitárias
    fecharTodosModais,
  };
}