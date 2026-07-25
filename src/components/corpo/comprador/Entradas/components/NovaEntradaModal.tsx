import React, { useState } from 'react';
import { X, Package, FileText, DollarSign, Building2, Truck, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FornecedorAutocomplete } from '../../RequisicoesCompra/components/FornecedorAutocomplete';
import { CompradorAutocomplete } from '../../RequisicoesCompra/components/CompradorAutocomplete';
import CadastroConhecimentoModal from '../../EntradaXml/components/CadastroConhecimentoModal';

interface NovaEntradaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CFOPS = [
  '1101 - Compra para industrialização',
  '1102 - Compra para comercialização',
  '2101 - Compra p/ industrialização (interestadual)',
  '2102 - Compra p/ comercialização (interestadual)',
];

const hoje = () => new Date().toISOString().split('T')[0];

export const NovaEntradaModal: React.FC<NovaEntradaModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Dados da Nota Fiscal
  const [numeroNF, setNumeroNF] = useState('');
  const [serie, setSerie] = useState('001');
  const [operacao, setOperacao] = useState('');
  const [dataEmissao, setDataEmissao] = useState(hoje());
  const [chave, setChave] = useState('');
  const [informarSelo, setInformarSelo] = useState(false);
  const [numeroSelo, setNumeroSelo] = useState('');
  const [dataSelo, setDataSelo] = useState(hoje());
  const [numeroDI, setNumeroDI] = useState('');
  const [dataDI, setDataDI] = useState('');
  const [valorDolar, setValorDolar] = useState('');

  // Fiscal
  const [icms, setIcms] = useState('');
  const [baseICMS, setBaseICMS] = useState('');
  const [totalProdutos, setTotalProdutos] = useState('');
  const [totalIPI, setTotalIPI] = useState('0');
  const [totalNF, setTotalNF] = useState('');
  const [cfop, setCfop] = useState('');

  // Fornecedor / Comprador
  const [fornecedor, setFornecedor] = useState<any>(null);
  const [comprador, setComprador] = useState<{ codigo: string; nome: string } | null>(null);

  // Conhecimento
  const [temConhecimento, setTemConhecimento] = useState(false);
  const [showConhecimento, setShowConhecimento] = useState(false);
  const [dadosConhecimento, setDadosConhecimento] = useState<any>(null);

  // Cálculo do Custo
  const [desconto, setDesconto] = useState('0');
  const [custoFinanceiro, setCustoFinanceiro] = useState('0');
  const [acrescimo, setAcrescimo] = useState('0');
  const [verbaMkt, setVerbaMkt] = useState('0');
  const [zerarIPI, setZerarIPI] = useState(false);
  const [zerarST, setZerarST] = useState(false);

  // Extras
  const [observacoes, setObservacoes] = useState('');
  const [origemBA, setOrigemBA] = useState(false);
  const [naoConstarAnalises, setNaoConstarAnalises] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!fornecedor?.cod_credor) {
      toast({ title: 'Fornecedor obrigatório', description: 'Selecione um fornecedor.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/entradas/criar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_credor: fornecedor.cod_credor,
          codcomprador: comprador?.codigo || null,
          nroform: numeroNF || null,
          serie: serie || null,
          operacao: operacao || null,
          dtnota: dataEmissao || null,
          chave: chave || null,
          selo: informarSelo ? numeroSelo || null : null,
          dtselo: informarSelo ? dataSelo || null : null,
          nrodi: numeroDI || null,
          dtdi: dataDI || null,
          valordolar: valorDolar,
          icms, baseicms: baseICMS, totalprod: totalProdutos, totalipi: totalIPI, totalnf: totalNF, cfop: cfop || null,
          custofin: custoFinanceiro, desconto, acrescimo, verba_tmk: verbaMkt,
          zerar_ipi: zerarIPI ? 'S' : 'N', zerar_st: zerarST ? 'S' : 'N',
          origem: origemBA ? 'B' : 'A',
          obs: observacoes || null,
          temcusto: naoConstarAnalises ? 'N' : 'S',
          temcon: temConhecimento ? 'S' : 'N',
          codtransp: temConhecimento ? dadosConhecimento?.codtransp || null : null,
          conhecimento: temConhecimento ? dadosConhecimento : null,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({ title: 'Entrada criada!', description: `Entrada ${data.codent} criada. (Seleção de itens: próxima fase.)` });
        onSuccess();
        onClose();
      } else {
        toast({ title: 'Erro ao criar entrada', description: data.error || 'Erro desconhecido', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro de comunicação', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const secao = (icon: React.ReactNode, titulo: string) => (
    <h3 className="text-sm font-semibold text-[#347AB6] dark:text-blue-300 mb-2 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-1">
      {icon}
      {titulo}
    </h3>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="text-[#347AB6]" size={22} />
            Nova Entrada de Mercadoria
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Dados da Nota Fiscal */}
          <div>
            {secao(<FileText size={16} />, 'Dados da Nota Fiscal')}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>No. Nota</Label>
                <Input value={numeroNF} onChange={(e) => setNumeroNF(e.target.value)} placeholder="000000" />
              </div>
              <div>
                <Label>Série</Label>
                <Input value={serie} onChange={(e) => setSerie(e.target.value)} />
              </div>
              <div>
                <Label>Operação</Label>
                <Input value={operacao} onChange={(e) => setOperacao(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Data Emissão</Label>
                <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>CFOP</Label>
                <select
                  value={cfop}
                  onChange={(e) => setCfop(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="">Selecione o CFOP</option>
                  {CFOPS.map((cf) => (
                    <option key={cf} value={cf.split(' - ')[0]}>{cf}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>No. DI</Label>
                <Input value={numeroDI} onChange={(e) => setNumeroDI(e.target.value)} />
              </div>
              <div>
                <Label>Data DI</Label>
                <Input type="date" value={dataDI} onChange={(e) => setDataDI(e.target.value)} />
              </div>
              <div>
                <Label>Valor Dólar</Label>
                <Input type="number" step="0.0001" value={valorDolar} onChange={(e) => setValorDolar(e.target.value)} placeholder="0,00" />
              </div>
              <div className="md:col-span-3">
                <Label>Chave</Label>
                <Input value={chave} onChange={(e) => setChave(e.target.value)} placeholder="44 dígitos (opcional)" />
              </div>
              {/* Selo (opcional) */}
              <div className="md:col-span-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" checked={informarSelo} onChange={(e) => setInformarSelo(e.target.checked)} />
                  Informar Selo
                </label>
                {informarSelo && (
                  <div className="grid grid-cols-2 gap-3 mt-2 pl-6">
                    <div>
                      <Label>No. Selo</Label>
                      <Input value={numeroSelo} onChange={(e) => setNumeroSelo(e.target.value)} />
                    </div>
                    <div>
                      <Label>Data do Selo</Label>
                      <Input type="date" value={dataSelo} onChange={(e) => setDataSelo(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Valores fiscais */}
          <div>
            {secao(<DollarSign size={16} />, 'Valores')}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label>ICMS alíquota (%)</Label>
                <Input type="number" step="0.01" value={icms} onChange={(e) => setIcms(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Base ICMS</Label>
                <Input type="number" step="0.01" value={baseICMS} onChange={(e) => setBaseICMS(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Total Produtos</Label>
                <Input type="number" step="0.01" value={totalProdutos} onChange={(e) => setTotalProdutos(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Total IPI</Label>
                <Input type="number" step="0.01" value={totalIPI} onChange={(e) => setTotalIPI(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Total NF</Label>
                <Input type="number" step="0.01" value={totalNF} onChange={(e) => setTotalNF(e.target.value)} placeholder="0,00" />
              </div>
            </div>
          </div>

          {/* Fornecedor / Comprador */}
          <div>
            {secao(<Building2 size={16} />, 'Fornecedor e Comprador')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Fornecedor *</Label>
                <FornecedorAutocomplete value={fornecedor} onChange={(f) => setFornecedor(f)} />
              </div>
              <div>
                <Label>Comprador</Label>
                <CompradorAutocomplete
                  value={comprador}
                  onChange={(codigo, nome) => setComprador(codigo ? { codigo, nome } : null)}
                />
              </div>
            </div>
          </div>

          {/* Conhecimento */}
          <div>
            {secao(<Truck size={16} />, 'Dados do Conhecimento')}
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input
                type="checkbox"
                checked={temConhecimento}
                onChange={(e) => {
                  setTemConhecimento(e.target.checked);
                  if (!e.target.checked) setDadosConhecimento(null);
                }}
              />
              Tem Conhecimento
            </label>
            {temConhecimento && (
              <div className="mt-2 pl-6">
                {dadosConhecimento ? (
                  <div className="p-3 border border-green-300 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                    <p><strong>CTe:</strong> {dadosConhecimento.nrocon} / {dadosConhecimento.serie} — transp. {dadosConhecimento.codtransp}</p>
                    <p><strong>Tipo:</strong> {dadosConhecimento.cif === 'S' ? 'CIF' : 'FOB'} · Total {dadosConhecimento.totalcon}</p>
                    <button onClick={() => setShowConhecimento(true)} className="mt-2 text-blue-600 text-xs">Editar conhecimento</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowConhecimento(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm flex items-center gap-2"
                  >
                    <Truck size={14} /> Cadastrar Conhecimento
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cálculo do Custo */}
          <div>
            {secao(<Calculator size={16} />, 'Cálculo do Custo')}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Desconto (%)</Label>
                <Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
              </div>
              <div>
                <Label>Custo Financeiro (%)</Label>
                <Input type="number" step="0.01" value={custoFinanceiro} onChange={(e) => setCustoFinanceiro(e.target.value)} />
              </div>
              <div>
                <Label>Acréscimo (%)</Label>
                <Input type="number" step="0.01" value={acrescimo} onChange={(e) => setAcrescimo(e.target.value)} />
              </div>
              <div>
                <Label>Verba Mkt (%)</Label>
                <Input type="number" step="0.01" value={verbaMkt} onChange={(e) => setVerbaMkt(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={zerarIPI} onChange={(e) => setZerarIPI(e.target.checked)} /> ZERAR IPI
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={zerarST} onChange={(e) => setZerarST(e.target.checked)} /> ZERAR ST
              </label>
            </div>
          </div>

          {/* Extras */}
          <div>
            <Label>Observação</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} placeholder="Observações adicionais..." />
            <div className="flex flex-col gap-2 mt-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={origemBA} onChange={(e) => setOrigemBA(e.target.checked)} /> Origem BA
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-red-600 font-medium">
                <input type="checkbox" checked={naoConstarAnalises} onChange={(e) => setNaoConstarAnalises(e.target.checked)} />
                Esta entrada NÃO deve constar nas análises de compras!
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Abandonar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#347AB6] hover:bg-[#2a5f8f] text-white"
          >
            {loading ? 'Salvando...' : 'Salvar dados e selecionar itens'}
          </Button>
        </div>
      </div>

      {/* Modal de Conhecimento */}
      <CadastroConhecimentoModal
        isOpen={showConhecimento}
        onClose={() => setShowConhecimento(false)}
        onSalvar={(dados: any) => {
          setDadosConhecimento(dados);
          setShowConhecimento(false);
        }}
      />
    </div>
  );
};
