import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import ModalFormulario from '@/components/common/modalform';
import FormInput from '@/components/common/FormInput';
import { MailCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fatura: any;
  onCobrancaSalva?: () => void;
}

interface Banco {
  banco: string;
  nome: string;
}

interface DadosEmpresa {
  cgc?: string;
  inscricaoestadual?: string;
  nomecontribuinte?: string;
  municipio?: string;
  uf?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  telefone?: string;
  [key: string]: any;
}

interface DadosSacado {
  codcli?: string;
  nomefant?: string;
  cpfcgc?: string;
  ender?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  [key: string]: any;
}

const getValue = (value: any, defaultValue: string | number = ''): string => {
  if (value === null || value === undefined || value === '')
    return String(defaultValue);
  return String(value).trim();
};

export default function ModalCobranca({
  isOpen,
  onClose,
  fatura,
  onCobrancaSalva,
}: Props) {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [tiposDocumentoOriginais, setTiposDocumentoOriginais] = useState<
    string[]
  >([]);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<
    { dias: number; vencimento: string }[]
  >([]);
  const [dadosEmpresa, setDadosEmpresa] = useState<DadosEmpresa | null>(null);
  const [dadosSacado, setDadosSacado] = useState<DadosSacado | null>(null);
  const [form, setForm] = useState({
    banco: '',
    tipoFatura: 'BOLETO',
    prazoSelecionado: '',
    valorVista: '', // valor de entrada
    habilitarValor: false, // se habilita input de valor de entrada
    impostoNa1Parcela: false,
    freteNa1Parcela: false,
  });
  const [totais, setTotais] = useState({
    totalFatura: 0,
  });
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const opcoesTipoFatura = useMemo(() => {
    if (!form.banco) {
      return [];
    }

    const bancoSelecionado = bancos.find((b) => b.banco === form.banco);

    if (bancoSelecionado?.nome === 'MELO') {
      const opcoesUnicas = new Set(['BOLETO', ...tiposDocumentoOriginais]);
      return Array.from(opcoesUnicas).map((doc) => ({
        value: doc,
        label: doc,
      }));
    }

    return [{ value: 'BOLETO', label: 'BOLETO' }];
  }, [form.banco, tiposDocumentoOriginais, bancos]);

  useEffect(() => {
    if (isOpen) {
      setDadosEmpresa(null);
      setDadosSacado(null);
      setIsPreviewMode(false);
      setPreviewURL(null);

      axios.get('/api/faturamento/opcoes-cobranca').then((res) => {
        setBancos(res.data.bancos);
        setTiposDocumentoOriginais(res.data.tiposDocumento);
      });

      axios
        .get('/api/faturamento/dadosempresa')
        .then((res) => {
          setDadosEmpresa(res.data);
        })
        .catch((err) => {
          console.error('Erro ao buscar dados da empresa:', err);
          toast.error('Não foi possível carregar os dados da empresa.');
        });

      const codcli = fatura.codcli || fatura.cliente?.codcli;
      if (codcli) {
        axios
          .get(`/api/faturamento/cliente/${codcli}`)
          .then((res) => {
            setDadosSacado(res.data);
          })
          .catch((err) => {
            console.error(`Erro ao buscar cliente ${codcli}:`, err);
            toast.error('Dados do cliente (sacado) não encontrados.');
          });
      } else {
        toast.warning('Código do cliente não encontrado na fatura.');
      }

      setTotais({
        totalFatura: Number(fatura.totalnf ?? 0),
      });

      if (fatura.banco) {
        handleChange('banco', fatura.banco);
      }
    }
  }, [isOpen, fatura]);

  useEffect(() => {
    const isCurrentTypeValid = opcoesTipoFatura.some(
      (opt) => opt.value === form.tipoFatura,
    );
    if (!isCurrentTypeValid && opcoesTipoFatura.length > 0) {
      handleChange('tipoFatura', opcoesTipoFatura[0].value);
    }
  }, [opcoesTipoFatura]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => {
      // Cria um novo objeto de estado com a alteração inicial
      const newState = { ...prev, [field]: value };

      // **LÓGICA ADICIONADA**
      // Se o campo que mudou foi o 'banco'...
      if (field === 'banco') {
        const bancoSelecionado = bancos.find((b) => b.banco === value);

        // Se o nome do banco for 'MELO', define 'CARTEIRA' como padrão.
        if (bancoSelecionado?.nome === 'MELO') {
          newState.tipoFatura = 'CARTEIRA';
        } else {
          // Para qualquer outro banco, o padrão volta a ser 'BOLETO'.
          newState.tipoFatura = 'BOLETO';
        }
      }

      return newState;
    });
  };

  const gerarDataVencimento = (prazoEmDias: string | number): string => {
    const dias = parseInt(String(prazoEmDias), 10);
    if (isNaN(dias)) return '';
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + dias);
    return hoje.toLocaleDateString('pt-BR');
  };

  type ParcelaPreview = {
    documento: string;
    vencimento: string;
    valor: number;
    nossoNumero: string;
    tipo: string;
    banco: string;
  };

  const previewParcelas: ParcelaPreview[] = useMemo(() => {
    if (parcelas.length === 0) return [];
    let total = totais.totalFatura;
    let valorEntrada = 0;
    if (form.habilitarValor && form.valorVista) {
      valorEntrada = parseFloat(form.valorVista) || 0;
      if (valorEntrada > total) valorEntrada = total;
      total = total - valorEntrada;
    }
    const valorParcela = parcelas.length > 0 ? total / parcelas.length : 0;

    const parcelasArray: ParcelaPreview[] = parcelas.map((p, index) => ({
      documento: `NF${fatura.nroform}${String.fromCharCode(65 + index)}`,
      vencimento: gerarDataVencimento(p.dias),
      valor: valorParcela,
      nossoNumero: `0217208${index + 9}`,
      tipo: form.tipoFatura,
      banco: form.banco,
    }));

    return parcelasArray;
  }, [parcelas, form, totais.totalFatura, fatura.nroform]);

  const gerarMultiplosBoletosPDF = () => {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let y = margin;
    const TICKET_BLOCK_HEIGHT = 400;

    if (previewParcelas.length === 0 || !dadosSacado || !dadosEmpresa) {
      doc.text(
        'Adicione parcelas e aguarde o carregamento dos dados.',
        margin,
        y,
      );
      return doc;
    }

    previewParcelas.forEach((parcela, index) => {
      if (y + TICKET_BLOCK_HEIGHT > pageHeight - margin && index > 0) {
        doc.addPage();
        y = margin;
      }
      y = drawTicketBlock(doc, y, parcela, dadosEmpresa, dadosSacado);
    });

    return doc;
  };

  const drawTicketBlock = (
    doc: jsPDF,
    startY: number,
    parcela: any,
    empresa: DadosEmpresa | null,
    sacado: DadosSacado | null,
  ) => {
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - margin * 2;
    let y = startY;

    const drawField = (
      title: string,
      value: string,
      x: number,
      yPos: number,
      width: number,
      height: number,
      options: any = {},
    ) => {
      const {
        valueAlign = 'left',
        valueSize = 9,
        titleSize = 6,
        titleYOffset = 8,
        valueYOffset = 20,
      } = options;

      doc.setLineWidth(0.5);
      doc.rect(x, yPos, width, height);

      doc.setFontSize(titleSize).setFont('helvetica', 'normal');
      doc.text(title.toUpperCase(), x + 3, yPos + titleYOffset);

      let textX = valueAlign === 'right' ? x + width - 3 : x + 3;
      if (valueAlign === 'center') textX = x + width / 2;

      doc.setFontSize(valueSize).setFont('helvetica', 'bold');
      const textOptions: any = { align: valueAlign };
      doc.text(value, textX, yPos + valueYOffset, textOptions);
    };

    doc.setFont('helvetica', 'bold').setFontSize(12);
    doc.text(getValue(empresa?.nomecontribuinte), margin, y);

    const bancoInfo = bancos.find((b) => b.banco === form.banco);
    doc.text(
      `${bancoInfo?.nome || 'Banco'} | ${bancoInfo?.banco || '000'}`,
      pageWidth - margin,
      y,
      { align: 'right' },
    );
    y += 12;
    doc.setFontSize(8);
    doc.text('SEU DISTRIBUIDOR 100% ATACADO', margin, y);
    y += 15;

    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('RECIBO DO CLIENTE', margin, y);
    y += 12;

    doc.setFont('helvetica', 'normal').setFontSize(8);
    doc.text('Nome do Cliente', margin, y);
    y += 10;
    const sacadoNome = `(${getValue(sacado?.codcli)}) ${getValue(
      sacado?.nomefant,
    )} CNPJ ${getValue(sacado?.cpfcgc)}`;
    const sacadoEndereco = `${getValue(sacado?.ender)} - ${getValue(
      sacado?.bairro,
    )} - ${getValue(sacado?.cidade)}/${getValue(sacado?.uf)} CEP:${getValue(
      sacado?.cep,
    )}`;
    doc.text(sacadoNome, margin, y);
    y += 10;
    doc.text(sacadoEndereco, margin, y);
    y += 15;

    doc.text(`Número Docto.: ${parcela.documento}`, margin, y);
    doc.text(`Data do Vencto: ${parcela.vencimento}`, margin + 250, y);
    doc.text(
      `Valor Documento: ${parcela.valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })}`,
      margin + 400,
      y,
    );
    y += 15;

    doc.text(`Nosso Número: ${parcela.nossoNumero}`, margin, y);
    doc.text('Autenticação Mecânica (no verso)', pageWidth - margin, y, {
      align: 'right',
    });

    y += 15;
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 15;

    doc.setFont('helvetica', 'bold').setFontSize(14);
    doc.text(
      `${bancoInfo?.nome || 'Banco'} | ${bancoInfo?.banco || '000'}`,
      margin,
      y + 18,
    );
    const linhaDigitavel =
      '03399.00094 56000.000028 17208.901011 8 11440000140372';
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text(linhaDigitavel, pageWidth - margin, y + 18, { align: 'right' });
    y += 28;

    const fieldY1 = y;
    const mainWidth = contentWidth - 160;
    drawField(
      'Local de Pagamento',
      'Pagável em qualquer agência bancária. Após o vencimento somente nas agências do Banco Santander.',
      margin,
      fieldY1,
      mainWidth,
      35,
    );
    drawField(
      'Vencimento',
      parcela.vencimento,
      margin + mainWidth,
      fieldY1,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY2 = fieldY1 + 35;
    drawField(
      'Cedente',
      `${getValue(empresa?.nomecontribuinte)} - CNPJ: ${getValue(
        empresa?.cgc,
      )}`,
      margin,
      fieldY2,
      mainWidth,
      25,
    );
    drawField(
      'Agência / Cód.Cedente',
      '1403/0009560',
      margin + mainWidth,
      fieldY1 + 25,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY3 = fieldY2 + 25;
    drawField(
      'Data de Emissão',
      new Date().toLocaleDateString('pt-BR'),
      margin,
      fieldY3,
      90,
      25,
    );
    drawField('Número Docto', parcela.documento, margin + 90, fieldY3, 110, 25);
    drawField(
      'Espécie Docto',
      getValue(form.tipoFatura, 'DM'),
      margin + 200,
      fieldY3,
      80,
      25,
    );
    drawField('Aceite', 'N', margin + 280, fieldY3, 40, 25);
    drawField(
      'Data Processamento',
      new Date().toLocaleDateString('pt-BR'),
      margin + 320,
      fieldY3,
      mainWidth - 320,
      25,
    );
    drawField(
      'Nosso Número',
      parcela.nossoNumero,
      margin + mainWidth,
      fieldY3,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY4 = fieldY3 + 25;
    drawField('Uso do Banco', '', margin, fieldY4, 90, 25);
    drawField('CIP', '', margin + 90, fieldY4, 60, 25);
    drawField(
      'Carteira',
      'COBRANCA SIMPLES - RCR',
      margin + 150,
      fieldY4,
      170,
      25,
    );
    drawField('Moeda', 'R$', margin + 320, fieldY4, 45, 25);
    drawField('Quantidade', '', margin + 365, fieldY4, mainWidth - 365, 25);
    drawField(
      '(=) Valor do Docto',
      parcela.valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
      margin + mainWidth,
      fieldY4,
      160,
      25,
      { valueAlign: 'right' },
    );

    const fieldY5 = fieldY4 + 25;
    const instrucoes = `:: Senhor(a) caixa, não receber em CHEQUES.
:: Após o vencimento cobrar mora de R$ 3.74 por dia de atraso.
:: Título sujeito a protesto à partir de 11 dias após vencimento.`;
    drawField(
      'Instruções (Todas informações deste bloqueto são de exclusiva responsabilidade do cedente)',
      instrucoes,
      margin,
      fieldY5,
      mainWidth,
      60,
      { valueSize: 7, valueYOffset: 15 },
    );
    drawField(
      '(-) Desconto/Abatimento',
      '',
      margin + mainWidth,
      fieldY5,
      160,
      20,
      { valueAlign: 'right' },
    );
    drawField('(+) Mora/Multa', '', margin + mainWidth, fieldY5 + 20, 160, 20, {
      valueAlign: 'right',
    });
    drawField(
      '(=) Valor Cobrado',
      '',
      margin + mainWidth,
      fieldY5 + 40,
      160,
      20,
      { valueAlign: 'right' },
    );

    y = fieldY5 + 65;
    doc.setFont('helvetica', 'normal').setFontSize(6);
    doc.text('SACADO', margin, y);
    y += 8;
    doc.setFont('helvetica', 'bold').setFontSize(9);
    doc.text(sacadoNome, margin, y);
    y += 10;
    doc.text(sacadoEndereco, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(6);
    doc.text('SACADOR/AVALISTA', margin + mainWidth, y);

    y += 10;
    const barcodeValue = `03398114400001403729000956000000021720890101`;
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, barcodeValue, {
        displayValue: false,
        margin: 0,
        height: 40,
        width: 1.2,
      });
      doc.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        margin,
        y,
        contentWidth - 200,
        40,
      );
    } catch (e) {
      console.error('Erro no JsBarcode:', e);
    }

    y += 45;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text(
      'Autenticação Mecânica / Ficha de Compensação',
      pageWidth - margin,
      y,
      { align: 'right' },
    );

    return y + 10;
  };

  const handleGerarPreview = () => {
    if (parcelas.length === 0) {
      return toast.error('Adicione ao menos uma parcela para gerar o preview.');
    }
    if (!dadosEmpresa || !dadosSacado) {
      return toast.error(
        'Aguarde o carregamento dos dados da empresa e do cliente.',
      );
    }

    const doc = gerarMultiplosBoletosPDF();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    setPreviewURL(url);
    setIsPreviewMode(true);
  };

  const handleSalvarCobranca = async () => {
    try {
      await axios.post('/api/faturamento/salvar-cobranca', {
        codfat: fatura.codfat,
        codcli:
          fatura.codcli ?? fatura.cliente?.codcli ?? fatura.dbclien?.codcli,
        banco: form.banco,
        tipofat: form.tipoFatura,
        tipoDoc: form.tipoFatura,
        parcelas: previewParcelas.map((p) => ({
          vencimento: p.vencimento.split('/').reverse().join('-'),
          valor: parseFloat(String(p.valor)),
          documento: p.documento,
          nossoNumero: p.nossoNumero,
        })),
      });

      toast.success('Cobrança salva com sucesso!');
      onCobrancaSalva?.();
      onClose();
    } catch (err) {
      toast.error('Erro ao salvar cobrança.');
      console.error(err);
    }
  };

  const handleVoltarParaEdicao = () => {
    setIsPreviewMode(false);
    if (previewURL) {
      URL.revokeObjectURL(previewURL);
    }
    setPreviewURL(null);
  };

  const handleCloseModal = () => {
    handleVoltarParaEdicao();
    onClose();
  };
  const handleenviaremail = async () => {
    try {
      toast.success('Cobrança enviada  para o email do cliente com sucesso!');
    } catch (error: any) {
      toast.error('error ao  enviar cobrança para o email do cliente.');
    }
  };
  return (
    <ModalFormulario
      titulo={`Gerar Cobrança - Fatura ${
        fatura.nrovenda || fatura.codfat || fatura.nroform || ''
      }`}
      tabs={[]}
      activeTab=""
      setActiveTab={() => {}}
      handleSubmit={() => {}}
      handleClear={() => {}}
      onClose={handleCloseModal}
      footer={
        // Um único contêiner que apenas agrupa os botões.
        // O ModalFormulario pai se encarregará de alinhá-lo à direita.
        <div className="flex items-center gap-x-3">
          {isPreviewMode ? (
            // Usamos um React Fragment (<>) para retornar os dois botões lado a lado
            <>
              <button
                type="button"
                onClick={handleVoltarParaEdicao}
                // Estilo padronizado para botões secundários
                className="px-4 py-2 text-sm font-medium text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-700"
              >
                Voltar e Editar
              </button>
              <button
                type="button"
                onClick={handleSalvarCobranca}
                // Estilo padronizado para botões de confirmação
                className="px-4 py-2 text-sm  text-white bg-green-600 rounded-md hover:bg-green-700 font-bold"
              >
                Salvar Cobrança
              </button>
              <button
                className="flex items-center px-4 py-2 text-sm  text-white bg-blue-900 font-bold rounded-md hover:bg-blue-800 transition-colors"
                onClick={handleenviaremail}
              >
                {/* A classe 'mr-2' cria um pequeno espaço entre o ícone e o texto */}
                <MailCheck className="mr-2 h-4 w-4" />
                Enviar Cobrança
              </button>
            </>
          ) : (
            // Botão para o estado inicial
            <button
              type="button"
              onClick={handleGerarPreview}
              // Estilo padronizado para botões primários
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Gerar Boleto
            </button>
          )}
        </div>
      }
      renderTabContent={() =>
        isPreviewMode && previewURL ? (
          // CORREÇÃO: Contêiner principal para o modo de preview.
          // Define uma altura grande (75% da altura da tela) e um layout de coluna flex.
          <div className="w-full h-[75vh] flex flex-col">
            <h3 className="text-sm font-semibold mb-2 text-white flex-shrink-0">
              Pré-visualização da Cobrança
            </h3>

            {/* Contêiner do Iframe que irá crescer para preencher o espaço */}
            <div className="flex-grow rounded bg-gray-300">
              <iframe
                src={previewURL}
                className="w-full h-full border-none rounded" // h-full para preencher o pai
                title="Pré-visualização da Cobrança"
              />
            </div>
          </div>
        ) : (
          // O modo de edição do formulário continua o mesmo
          <div className="grid grid-cols-2 gap-4 text-white">
            <fieldset className="col-span-1 border border-gray-600 rounded p-4">
              <legend className="text-sm font-semibold text-white px-2">
                Banco e Faturamento
              </legend>
              <div>
                <label className="block font-semibold mb-1">Banco</label>
                <select
                  className="w-full bg-gray-900 border border-gray-700 rounded p-1"
                  value={form.banco}
                  onChange={(e) => handleChange('banco', e.target.value)}
                >
                  <option value="">Selecione</option>
                  {bancos.map((banco) => (
                    <option key={banco.banco} value={banco.banco}>
                      {banco.nome}
                    </option>
                  ))}
                </select>
              </div>
          <div className="mt-4">
            <label className="block font-semibold mb-1">
              Tipo de Fatura/Documento
            </label>
            <select
              className="w-full bg-gray-900 border border-gray-700 rounded p-1"
              value={form.tipoFatura}
              onChange={(e) => handleChange('tipoFatura', e.target.value)}
              disabled={!form.banco}
            >
              {opcoesTipoFatura.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Checkbox e input para valor de entrada */}
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="habilitarValor"
              checked={form.habilitarValor}
              onChange={e => handleChange('habilitarValor', e.target.checked)}
            />
            <label htmlFor="habilitarValor" className="font-semibold select-none">Habilitar valor de entrada</label>
            {form.habilitarValor && (
              <input
                type="number"
                min={0}
                max={totais.totalFatura}
                step="0.01"
                className="ml-2 w-32 bg-gray-900 border border-gray-700 rounded p-1"
                placeholder="Valor de entrada"
                value={form.valorVista}
                onChange={e => handleChange('valorVista', e.target.value)}
              />
            )}
          </div>
            </fieldset>
            <fieldset className="col-span-1 border border-gray-600 rounded p-4">
              <legend className="text-sm font-semibold text-white px-2">
                Prazo e Parcela
              </legend>
              <div>
                <label className="block font-semibold mb-1">
                  Prazo (em dias)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-full bg-gray-900 border border-gray-700 rounded p-1"
                    value={form.prazoSelecionado}
                    onChange={(e) =>
                      handleChange('prazoSelecionado', e.target.value)
                    }
                    placeholder="Ex: 30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const dias = parseInt(form.prazoSelecionado);
                      if (!dias || dias <= 0)
                        return toast.error('Insira um prazo válido em dias.');
                      const vencimento = new Date();
                      vencimento.setDate(vencimento.getDate() + dias);
                      setParcelas([
                        ...parcelas,
                        {
                          dias,
                          vencimento: vencimento.toISOString().split('T')[0],
                        },
                      ]);
                      handleChange('prazoSelecionado', '');
                    }}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 whitespace-nowrap"
                  >
                    + Adic.
                  </button>
                </div>
              </div>
              <ul className="mt-3 text-white text-sm space-y-1 h-24 overflow-y-auto">
                {parcelas.map((p, i) => (
                  <li
                    key={i}
                    className="flex justify-between items-center bg-gray-800 p-1 rounded"
                  >
                    <span>
                      {p.dias} dias →{' '}
                      {new Date(p.vencimento).toLocaleDateString('pt-BR')}
                    </span>
                    <button
                      onClick={() =>
                        setParcelas(parcelas.filter((_, idx) => idx !== i))
                      }
                      className="text-red-500 hover:text-red-400 text-xs"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          </div>
        )
      }
    />
  );
}
