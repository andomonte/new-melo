import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import ModalFormulario from '@/components/common/modalform';
import FormInput from '@/components/common/FormInput';
import { DefaultButton } from '@/components/common/Buttons';
import DataTable from '@/components/common/DataTable'; // ajuste o path se necessário
import DataTableSimples from '@/components/common/DataTableSimple';
import DetalhesProdutoModal from './modalProdutos/DetalhesProdutoModal';
import DetalhesClienteModal from './modalDetlahesCliente';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onVendaAdicionada: (venda: any) => void;
  vendaInicial?: any;
  nrovendaInicial?: string;
}

export default function AdicionarVendaModal({
  isOpen,
  onClose,
  onVendaAdicionada,
  vendaInicial,
  nrovendaInicial,
}: Props) {
  const [codigoBusca, setCodigoBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [venda, setVenda] = useState<any | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<any | null>(
    null,
  );
  const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false);
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'ENTRADA' | 'SAIDA'>(
    'SAIDA',
  );
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [tipoOperacao, setTipoOperacao] = useState('');
  const [checkboxes, setCheckboxes] = useState({
    zerarIPI: false,
    zerarICMS: false,
    zerarSubstituicao: false,
    impostoAntecipado: false,
    descontoICMSSuframa: false,
  });
  const [expandidas, setExpandidas] = useState<string[]>([]);

  useEffect(() => {
    if (vendaInicial) {
      setVenda(vendaInicial);
      setExpandidas([]);
    }
    if (nrovendaInicial) setCodigoBusca(nrovendaInicial);
  }, [vendaInicial, nrovendaInicial]);
  const buscarVenda = async () => {
    if (!codigoBusca.trim()) {
      toast.warning('Informe o número da venda.');
      return;
    }

    setCarregando(true);
    try {
      const { data } = await axios.get(
        `/api/faturamento/detalhes-venda?nrovenda=${codigoBusca}`,
      );
      setVenda(data);
      setModalClienteAberto(true); // abre o modal automaticamente
    } catch (err) {
      toast.error('Venda não encontrada.');
      setVenda(null);
    } finally {
      setCarregando(false);
    }
  };

  const handleSubmit = () => {
    if (venda) {
      onVendaAdicionada({
        ...venda,
        tipoMovimentacao,
        tipoOperacao,
        checkboxes,
      });
      onClose();
    }
  };

  const handleCheckboxChange = (campo: keyof typeof checkboxes) => {
    setCheckboxes((prev) => ({ ...prev, [campo]: !prev[campo] }));
  };

  const toggleExpand = (id: string) => {
    setExpandidas((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  };

  const limparCampos = () => {
    setCodigoBusca('');
    setVenda(null);
    setTipoMovimentacao('SAIDA');
    setTipoOperacao('');
    setCheckboxes({
      zerarIPI: false,
      zerarICMS: false,
      zerarSubstituicao: false,
      impostoAntecipado: false,
      descontoICMSSuframa: false,
    });
    setExpandidas([]);
  };

  return isOpen ? (
    <>
      <ModalFormulario
        titulo="Revisão Fatura"
        activeTab="dados"
        tabs={[]}
        setActiveTab={() => {}}
        loading={carregando}
        handleSubmit={handleSubmit}
        handleClear={limparCampos}
        footer={null}
        onClose={onClose}
        renderTabContent={() => (
          <div className="grid grid-cols-1 gap-4">
            <div className="flex gap-2 items-end">
              <FormInput
                label="Número da Venda"
                name="codigobusca"
                type="text"
                value={codigoBusca}
                onChange={(e) => setCodigoBusca(e.target.value)}
              />
              <DefaultButton
                text="Buscar"
                variant="confirm"
                type="button"
                onClick={buscarVenda}
              />
            </div>

            {venda && (
              <>
                <div className="flex items-center justify-between mt-2">
                  <strong>
                    {venda.nrovenda} — {venda.dbclien?.nome}
                  </strong>

                  <div className="flex gap-2">
                    <DefaultButton
                      text={
                        expandidas.includes(venda.codvenda + '-cliente')
                          ? 'Esconder Detalhes'
                          : 'Exibir Detalhes'
                      }
                      type="button"
                      onClick={() => toggleExpand(venda.codvenda + '-cliente')}
                    />
                    <DefaultButton
                      text={
                        expandidas.includes(venda.codvenda)
                          ? 'Esconder Produtos'
                          : 'Ver Produtos'
                      }
                      type="button"
                      onClick={() => toggleExpand(venda.codvenda)}
                    />
                  </div>
                </div>


                {venda?.dbitvenda && expandidas.includes(venda.codvenda) && (
                  <div className="mt-4">
                    <DataTableSimples
                      headers={[
                        'Código',
                        'Produto',
                        'Marca',
                        'Unimed',
                        'Referencia',
                        'Qtd',
                        'Preço Unit.',
                        'Preço Venda',
                      ]}
                      rows={venda.dbitvenda.map((item: any) => ({
                        codprod: item.codprod,
                        descr: item.dbprod?.descr ?? '—',
                        codmarca: item.dbprod?.codmarca ?? '—',
                        unimed: item.dbprod?.unimed ?? '—',
                        ref: item.dbprod?.ref ?? '—',
                        qtd: item.qtd,
                        prunit: `R$ ${parseFloat(item.prunit).toFixed(2)}`,
                        prvenda: item.dbprod?.prvenda
                          ? `R$ ${parseFloat(item.dbprod.prvenda).toFixed(2)}`
                          : '—',
                        original: item,
                      }))}
                      onRowClick={(row) => {
                        setProdutoSelecionado(row.original);
                        setModalDetalhesOpen(true);
                      }}
                    />
                    <DetalhesProdutoModal
                      isOpen={modalDetalhesOpen}
                      onClose={() => setModalDetalhesOpen(false)}
                      produto={produtoSelecionado}
                      venda={venda}
                      
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      />
      <DetalhesClienteModal
        isOpen={modalClienteAberto}
        onClose={() => setModalClienteAberto(false)}
        cliente={venda?.dbclien}
      />
    </>
  ) : null;
}
