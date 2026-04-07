import React, { useContext } from 'react';
import { AuthContext } from '@/contexts/authContexts';
import { BiSolidError } from 'react-icons/bi';
import { BsPersonVcard, BsBoxes } from 'react-icons/bs';
import { GiShoppingCart } from 'react-icons/gi';
import { PiSmileySadFill } from 'react-icons/pi';
import SelecionarTodosDesconto from './selectTodosDesconto';
import { MdClose } from 'react-icons/md';
import { FaSave } from 'react-icons/fa';
import { FaBagShopping } from 'react-icons/fa6';
import api from '@/components/services/api';
import { calcImposto } from '@/lib/calcImposto';
import TableProd from './tableProd';
import TableProdRef from './tableProdRef';
import TableCar from './tableCar';
import TableCarMobile from './tableCarMobile';
import TableClient from './tableClient';
import Carregamento from '@/utils/carregamento';
import useFocusCli from './userFocus/cliUseFocus';
import useFocusProd from './userFocus/prodUseFocus';
import MascaraReal from '@/utils/mascaraReal';
import ConfirmaDel from './confirmaDelete';
import InformeCliente from './informeCliente';
import SelectInput from '@/components/common/SelectInputFixo';
import SelecionarVendedor from './selectVendedor';
import SelecionarOperador from './selectOperador';
import SelecionarEntrega from './selectEntrega';
import SelecionarTransporte from './selectTransporte';
import SelecionarDocumento from './selectDocumento';
import { Button } from '@/components/ui/button';
import SalvarPdf from './gerarPdf';
import ModalPrazoParcelas from './prazo';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
const META_KEY = 'metaVendaMelo';
const HYDRATE_DONE_KEY = 'novavenda_hydrate_done'; // << NOVO
type CtxArea = 'tableProd' | 'tableProdRef';
type FPagamento = { id: string; descricao: string };
// === fora do componente (no topo do arquivo) ===

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isOutros = (d: unknown) => norm(d).includes('outro');
const isBoleto = (d: unknown) => norm(d).includes('boleto');
const isCarteira = (d: unknown) => norm(d).includes('carteira');
const isPix = (d: unknown) => norm(d).includes('pix');
const isDinheiro = (d: unknown) => norm(d).includes('dinheiro');
const isCartaoCredito = (d: unknown) => {
  const n = norm(d);
  return n.includes('cartao') && n.includes('credito');
};
const isCartaoDebito = (d: unknown) => {
  const n = norm(d);
  return n.includes('cartao') && n.includes('debito');
};

const isPrazoAvista = (p: unknown) => {
  const n = norm(p);
  return (
    !n || // ← vazio => tratar como À VISTA
    n === 'À VISTA' ||
    n === 'A VISTA' || // sem acento
    n === 'AVISTA' || // sem espaço
    n.startsWith('À VISTA') || // cobre "À VISTA (VE)", "(V)", "(D)"
    n.startsWith('A VISTA')
  );
};

const isPrazoUmDigitoMenorQue7 = (p: unknown) => {
  const s = String(p ?? '').trim();
  return /^\d$/.test(s) && Number(s) < 7;
};

type CtxGlobal = {
  open: boolean;
  area: CtxArea | null;
  index: number | null;
  // pontos são opcionais pra você; servem só se quiser reaproveitar
  points?: { x: number; y: number };
};
type TransporteOption = {
  CODTPTRANSP: string;
  DESCR: string;
  [k: string]: any;
};

type Armazens = {
  value: string;
  label: string;
};

// Copie esta interface do seu arquivo do modal
interface ParcelaItem {
  id: number;
  dataVencimento: Date;
  dias: number;
}

// --- helpers numéricos (pt-BR) ---

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function createProduto(
  codigo: string,
  descrição: string,
  marca: string,
  estoque: string,
  preço: string,
  ref: string,
  quantidade: string,
  descriçãoEditada: string,
  totalItem: string,
  precoItemEditado: string,
  tipoPreço: string,
  desconto: number,
  origem: string,
) {
  return {
    codigo,
    descrição,
    marca,
    estoque,
    preço,
    ref,
    quantidade,
    descriçãoEditada,
    totalItem,
    precoItemEditado,
    tipoPreço,
    desconto,
    origem,
  };
}
function createCliente(
  codigo: string,
  nome: string,
  documento: string,
  nomeFantasia: string,
  saldo: number,
) {
  return {
    codigo,
    nome,
    documento,
    nomeFantasia,
    saldo,
  };
}

function createClienteSel(
  codigo: string,
  nome: string,
  documento: string,
  nomeFantasia: string,
  saldo: number,
  status: string,
  desconto: number,
  IPI: string,
  ICMS: string,
  zona: string,
  CLASPGTO: string,
  UF: string,
  TIPO: string,
  limiteAtraso: number,
  diasAtrasado: number,
  tipoPreco: string,
  CODVEND: string,
  FONE: string,
  ENDER: string,
  BAIRRO: string,
  CIDADE: string,
  CEP: string,
  KICKBACK: boolean,
) {
  return {
    codigo,
    nome,
    documento,
    nomeFantasia,
    saldo,
    status,
    desconto,
    IPI,
    ICMS,
    zona,
    CLASPGTO,
    UF,
    TIPO,
    limiteAtraso,
    diasAtrasado,
    tipoPreco,
    CODVEND,
    FONE,
    ENDER,
    BAIRRO,
    CIDADE,
    CEP,
    KICKBACK,
  };
}
function createListaCliente(
  LIMITE_DISPONIVEL: number,
  ACRESCIMO: number,
  ATRASO: number,
  BAIRRO: string,
  BAIRROCOBR: string,
  BANCO: string,
  BLOQUEAR_PRECO: string,
  CEP: string,
  CEPCOBR: string,
  CIDADE: string,
  CIDADECOBR: string,
  CLASPGTO: string,
  CODBAIRRO: string,
  CODBAIRROCOBR: string,
  CODCC: string,
  CODCLI: string,
  CODMUNICIPIO: string,
  CODMUNICIPIOCOBR: string,
  CODPAIS: number,
  CODPAISCOBR: number,
  CODTMK: string,
  CODUNICO: string,
  CODVEND: string,
  COMPLEMENTO: string,
  COMPLEMENTOCOBR: string,
  CONTATO: string,
  CPFCGC: string,
  DATACAD: string,
  DEBITO: number,
  DESCONTO: number,
  EMAIL: string,
  EMAILNFE: string,
  ENDER: string,
  ENDERCOBR: string,
  FAIXAFIN: string,
  HABILITASUFRAMA: string,
  ICMS: string,
  IEST: string,
  IMUN: string,
  IPI: string,
  ISUFRAMA: string,
  KICKBACK: boolean,
  LIMITE: number,
  LOCAL_ENTREGA: string,
  NOME: string,
  NOMEFANT: string,
  NUMERO: string,
  NUMEROCOBR: string,
  OBS: string,
  PRVENDA: string,
  REFERENCIA: string,
  REFERENCIACOBR: string,
  SIT_TRIBUTARIA: number,
  SOCIOS: string,
  STATUS: string,
  TIPO: string,
  TIPOCLIENTE: string,
  TIPOEMP: string,
  UF: string,
  UFCOBR: string,
) {
  return {
    LIMITE_DISPONIVEL,
    ACRESCIMO,
    ATRASO,
    BAIRRO,
    BAIRROCOBR,
    BANCO,
    BLOQUEAR_PRECO,
    CEP,
    CEPCOBR,
    CIDADE,
    CIDADECOBR,
    CLASPGTO,
    CODBAIRRO,
    CODBAIRROCOBR,
    CODCC,
    CODCLI,
    CODMUNICIPIO,
    CODMUNICIPIOCOBR,
    CODPAIS,
    CODPAISCOBR,
    CODTMK,
    CODUNICO,
    CODVEND,
    COMPLEMENTO,
    COMPLEMENTOCOBR,
    CONTATO,
    CPFCGC,
    DATACAD,
    DEBITO,
    DESCONTO,
    EMAIL,
    EMAILNFE,
    ENDER,
    ENDERCOBR,
    FAIXAFIN,
    HABILITASUFRAMA,
    ICMS,
    IEST,
    IMUN,
    IPI,
    ISUFRAMA,
    KICKBACK,
    LIMITE,
    LOCAL_ENTREGA,
    NOME,
    NOMEFANT,
    NUMERO,
    NUMEROCOBR,
    OBS,
    PRVENDA,
    REFERENCIA,
    REFERENCIACOBR,
    SIT_TRIBUTARIA,
    SOCIOS,
    STATUS,
    TIPO,
    TIPOCLIENTE,
    TIPOEMP,
    UF,
    UFCOBR,
  };
}

interface client {
  LIMITE_DISPONIVEL: number;
  ACRESCIMO: number;
  ATRASO: number;
  BAIRRO: string;
  BAIRROCOBR: string;
  BANCO: string;
  BLOQUEAR_PRECO: string;
  CEP: string;
  CEPCOBR: string;
  CIDADE: string;
  CIDADECOBR: string;
  CLASPGTO: string;
  CODBAIRRO: string;
  CODBAIRROCOBR: string;
  CODCC: string;
  CODCLI: string;
  CODMUNICIPIO: string;
  CODMUNICIPIOCOBR: string;
  CODPAIS: number;
  CODPAISCOBR: number;
  CODTMK: string;
  CODUNICO: string;
  CODVEND: string;
  COMPLEMENTO: string;
  COMPLEMENTOCOBR: string;
  CONTATO: string;
  CPFCGC: string;
  DATACAD: string;
  DEBITO: number;
  DESCONTO: number;
  EMAIL: string;
  EMAILNFE: string;
  ENDER: string;
  ENDERCOBR: string;
  FAIXAFIN: string;
  HABILITASUFRAMA: string;
  ICMS: string;
  IEST: string;
  IMUN: string;
  IPI: string;
  ISUFRAMA: string;
  KICKBACK: boolean;
  LIMITE: number;
  LOCAL_ENTREGA: string;
  NOME: string;
  NOMEFANT: string;
  NUMERO: string;
  NUMEROCOBR: string;
  OBS: string;
  PRVENDA: string;
  REFERENCIA: string;
  REFERENCIACOBR: string;
  SIT_TRIBUTARIA: number;
  SOCIOS: string;
  STATUS: string;
  TIPO: string;
  TIPOCLIENTE: string;
  TIPOEMP: string;
  UF: string;
  UFCOBR: string;
}
const dadosCliente = [
  {
    LIMITE_DISPONIVEL: 0,
    ACRESCIMO: 0,
    ATRASO: 0,
    BAIRRO: '',
    BAIRROCOBR: '',
    BANCO: '',
    BLOQUEAR_PRECO: '',
    CEP: '',
    CEPCOBR: '',
    CIDADE: '',
    CIDADECOBR: '',
    CLASPGTO: '',
    CODBAIRRO: '',
    CODBAIRROCOBR: '',
    CODCC: '',
    CODCLI: '',
    CODMUNICIPIO: '',
    CODMUNICIPIOCOBR: '',
    CODPAIS: 0,
    CODPAISCOBR: 0,
    CODTMK: '',
    CODUNICO: '',
    CODVEND: '',
    COMPLEMENTO: '',
    COMPLEMENTOCOBR: '',
    CONTATO: '',
    CPFCGC: '',
    DATACAD: '',
    DEBITO: 0,
    DESCONTO: 0,
    EMAIL: '',
    EMAILNFE: '',
    ENDER: '',
    ENDERCOBR: '',
    FAIXAFIN: '',
    HABILITASUFRAMA: '',
    ICMS: '',
    IEST: '',
    IMUN: '',
    IPI: '',
    ISUFRAMA: '',
    KICKBACK: false,
    LIMITE: 0,
    LOCAL_ENTREGA: '',
    NOME: '',
    NOMEFANT: '',
    NUMERO: '',
    NUMEROCOBR: '',
    OBS: '',
    PRVENDA: '',
    REFERENCIA: '',
    REFERENCIACOBR: '',
    SIT_TRIBUTARIA: 0,
    SOCIOS: '',
    STATUS: '',
    TIPO: '',
    TIPOCLIENTE: '',
    TIPOEMP: '',
    UF: '',
    UFCOBR: '',
  },
];

/* const keysCliente = [
  'ACRESCIMO',
  'ATRASO',
  'BAIRRO',
  'BAIRROCOBR',
  'BANCO',
  'BLOQUEAR_PRECO',
  'CEP',
  'CEPCOBR',
  'CIDADE',
  'CIDADECOBR',
  'CLASPGTO',
  'CODBAIRRO',
  'CODBAIRROCOBR',
  'CODCC',
  'CODCLI',
  'CODMUNICIPIO',
  'CODMUNICIPIOCOBR',
  'CODPAIS',
  'CODPAISCOBR',
  'CODTMK',
  'CODUNICO',
  'CODVEND',
  'COMPLEMENTO',
  'COMPLEMENTOCOBR',
  'CONTATO',
  'CPFCGC',
  'DATACAD',
  'DEBITO',
  'DESCONTO',
  'EMAIL',
  'EMAILNFE',
  'ENDER',
  'ENDERCOBR',
  'FAIXAFIN',
  'HABILITASUFRAMA',
  'ICMS',
  'IEST',
  'IMUN',
  'IPI',
  'ISUFRAMA',
  'KICKBACK',
  'LIMITE',
  'LOCAL_ENTREGA',
  'NOME',
  'NOMEFANT',
  'NUMERO',
  'NUMEROCOBR',
  'OBS',
  'PRVENDA',
  'REFERENCIA',
  'REFERENCIACOBR',
  'SIT_TRIBUTARIA',
  'SOCIOS',
  'STATUS',
  'TIPO',
  'TIPOCLIENTE',
  'TIPOEMP',
  'UF',
  'UFCOBR',
]; */
const tipoVenda = [
  'BALCÃO',
  'ZFM',
  'INTERIOR',
  'ALC',
  'AMAZ. OCIDENTAL',
  'FORA ESTADO',
  'FORA ESTADO VAREJO',
  'RORAIMA',
];

// --- UTIL: normalizador numérico igual ao do lib (garante robustez) ---
// Converte string/number em número, aceitando formatos "18.04", "18,04", "1.234,56", "1,234.56", etc.
const toN = (v: any): number => {
  if (typeof v === 'number') return v;

  const s = String(v ?? '').trim();
  if (!s) return 0;

  // remove símbolos de moeda/espaços, mantém dígitos, ponto, vírgula e sinal
  const raw = s.replace(/[^\d.,-]/g, '');

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  if (hasComma && hasDot) {
    // o separador decimal costuma ser o que aparece por último
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    const dec = lastComma > lastDot ? ',' : '.';
    const thou = dec === ',' ? '.' : ',';
    const normalized = raw
      .replace(new RegExp('\\' + thou, 'g'), '')
      .replace(dec, '.');
    return Number(normalized);
  }

  if (hasComma) {
    // só vírgula -> trate como decimal
    // (ex.: "18,04" => 18.04, "1,234,567" -> 1234567)
    if (raw.split(',').length > 2) return Number(raw.replace(/,/g, '')); // múltiplas vírgulas = milhares
    return Number(raw.replace(',', '.'));
  }

  if (hasDot) {
    // só ponto -> na maioria dos casos é decimal (ex.: "18.04")
    // mas se for padrão de milhares "1.234" ou "12.345.678", remova pontos:
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ''));
    // senão, considere o último ponto como decimal e remova os anteriores (caso raro)
    const parts = raw.split('.');
    if (parts.length > 2)
      return Number(parts.slice(0, -1).join('') + '.' + parts.at(-1));
    return Number(raw); // formato simples "18.04"
  }

  // sem separadores, só dígitos/sinal
  return Number(raw);
};

// --- UTIL: mapeia um item do carrinho + contexto da tela para params do calc ---
function buildCalcParamsFromItem(
  item: {
    codigo: string;
    quantidade: string;
    precoItemEditado: string;
    totalItem: string;
  },
  ctx: {
    clienteCodigo: string;
    documentoCOD_OPERACAO?: string; // "1" para VENDA, etc.
    uf_empresa?: string;
  },
) {
  // Defaults seguros para o seu fluxo de venda
  const tipoMovimentacao: 'SAIDA' | 'ENTRADA' = 'SAIDA';
  const tipoOperacao: 'VENDA' | 'DEVOLUCAO' | 'TRANSFERENCIA' =
    ctx.documentoCOD_OPERACAO === '2' ? 'DEVOLUCAO' : 'VENDA';
  const tipoFatura: 'NOTA_FISCAL' | 'CUPOM' = 'NOTA_FISCAL';
  const zerarSubstituicao: 'N' | 'S' = 'N';

  // Aqui opto por NÃO usar auto (usarAuto=false) porque você já computa totalItem
  // — evita divergência de arredondamento.
  const usarAuto = false;

  return {
    tipoMovimentacao,
    tipoOperacao,
    tipoFatura,
    zerarSubstituicao,
    codProd: item.codigo,
    codCli: ctx.clienteCodigo || '',
    quantidade: item.quantidade,
    valorUnitario: item.precoItemEditado,
    usarAuto,
    totalItem: item.totalItem,
  } as Parameters<typeof calcImposto>[0];
}
// normaliza p/ comparar nomes iguais com acento/maiúsculas/espaços diferentes
function normalizeKey(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function dedupeTransporte(rows: TransporteOption[]): TransporteOption[] {
  const seen = new Map<string, TransporteOption>();

  for (const r of rows ?? []) {
    const rawDescr = String(r.DESCR ?? r.descr ?? '');
    const cleanDescr = rawDescr.replace(/\s+/g, ' ').trim();
    if (!cleanDescr) continue;

    // coerção para STRING (o filho exige string)
    const codStr = r.CODTPTRANSP != null ? String(r.CODTPTRANSP) : '';
    const key = normalizeKey(cleanDescr);

    if (!seen.has(key)) {
      seen.set(key, { ...r, DESCR: cleanDescr, CODTPTRANSP: codStr });
    } else {
      // se quiser manter o "menor código", compare numericamente
      const prev = seen.get(key)!;
      const prevNum = Number(prev.CODTPTRANSP);
      const currNum = Number(codStr);
      const pickCurr =
        !Number.isFinite(prevNum) && Number.isFinite(currNum)
          ? true
          : Number.isFinite(prevNum) && Number.isFinite(currNum)
          ? currNum < prevNum
          : false;

      if (pickCurr) {
        seen.set(key, { ...r, DESCR: cleanDescr, CODTPTRANSP: codStr });
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) =>
    String(a.DESCR).localeCompare(String(b.DESCR), 'pt-BR'),
  );
}

function ModalBloqueio({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 2147483647, background: 'rgba(0,0,0,0.4)' }}
    >
      <div className="bg-white rounded-xl shadow max-w-md w-full p-6 text-center">
        <div className="mb-3 text-red-600 text-3xl">!</div>
        <p className="whitespace-pre-line text-center">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Ok
        </button>
      </div>
    </div>
  );
}

export default function HomeVenda() {
  const { user } = useContext(AuthContext);
  const perfilUser = user;

  // DETECÇÃO DE VENDEDOR — usa apenas user.codusr
  const getVendedorFromUser = (u: any) => {
    const v = u?.codusr;
    if (typeof v === 'string') return v.trim() || null;
    if (typeof v === 'number') return String(v);
    return null;
  };

  const codigoVendedor = React.useMemo(
    () => getVendedorFromUser(perfilUser),
    [perfilUser],
  );
  const hasVendedor = !!codigoVendedor;

  const prodInputRef = useFocusProd<HTMLInputElement>();
  const cliInputRef = useFocusCli<HTMLInputElement>();
  // bloqueio por preço editado abaixo do preço da tabela (quando usuário não tem BPV nem MPV)
  const [blocPrecoEdit, setBlocPrecoEdit] = React.useState(false);

  const [pesquisa, setPesquisa] = React.useState('');
  const [obrigFP, setObrigFP] = React.useState(false);
  const [obrigPrazo, setObrigPrazo] = React.useState(false);
  const [obrigTranporte, setObrigTransporte] = React.useState(false);
  const [valTransp, setValTransp] = React.useState('R$ 0,00');
  const [valTranspDec, setValTranspDec] = React.useState(0);
  const [descontoTodos, setDescontoTodos] = React.useState(0);
  const [descontoTodosAtivo, setDescontoTodosAtivo] = React.useState(false);
  const [pesquisaCli, setPesquisaCli] = React.useState('');
  const [iconesInfo, setIconeInfo] = React.useState('none');
  const [mensagem, setMensagem] = React.useState('');
  const [loadingProd, setLoadingProd] = React.useState(false);
  const [loadingRef, setLoadingRef] = React.useState(false);
  const [loadingCli, setLoadingCli] = React.useState(false);
  // ⬇️ junto aos outros useState
  const [sortBy, setSortBy] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc' | null>(null);

  const [tela, setTela] = React.useState('0');
  const [obsFat, setObsFat] = React.useState('');
  const [requisição, setRequisição] = React.useState('');
  const [nPedido, setNPedido] = React.useState('');
  const [prazo, setPrazo] = React.useState<number | string>(() => {
    const saved = sessionStorage.getItem('prazoVendaMelo');
    if (saved) {
      const prazos = JSON.parse(saved) as ParcelaItem[];
      // Concatena os dias para preencher o input
      return prazos.map((item) => item.dias).join(' ');
    }
    return '';
  });
  const [blocFin, setBlocFin] = React.useState(false);
  const [statusVenda, setStatusVenda] = React.useState('VENDA LIBERADA');
  const [blocDesc, setBlocDesc] = React.useState(false);
  const [dadosTransporte, setDadosTransporte] = React.useState<
    TransporteOption[]
  >([]);
  const [dadosDocumento, setDadosDocumento] = React.useState([
    {
      COD_OPERACAO: '1',
      DESCR: 'VENDA',
    },
  ]);
  const [dadosVendedor, setDadosVendedor] = React.useState([
    {
      CODCV: '',
      CODVEND: '',
      COMNORMAL: '',
      COMOBJ: '',
      COMTELE: '',
      CREDITO: '',
      DEBITO: '',
      LIMITE: '',
      NOME: '',
      RA_MAT: '',
      STATUS: '',
      VALOBJ: '',
      VALOBJF: '',
      VALOBJM: '',
      VALOBJSF: '',
    },
  ]);
  const [dadosEmpresa, setDadosEmpresa] = React.useState({
    CGC: '',
    INSCRICAOESTADUAL: '',
    NOMECONTRIBUINTE: '',
    MUNICIPIO: '',
    UF: '',
    FAX: '',
    CODIGOCONVENIO: '',
    CODIGONATUREZA: '',
    CODIGOFINALIDADE: '',
    LOGRADOURO: '',
    NUMERO: '',
    COMPLEMENTO: '',
    BAIRRO: '',
    CEP: '',
    CONTATO: '',
    TELEFONE: '',
    SUFRAMA: '',
    EMAIL: '',
    INSCRICAOESTADUAL_07: '',
    INSCRICAOMUNICIPAL: '',
    ID_TOKEN: '',
  });

  // const [openModalPrazo, setOpenModalPrazo] = React.useState(false);
  const [totalVenda, setTotalVenda] = React.useState(0);
  const [totalVendaSemDesconto, setTotalVendaSemDesconto] = React.useState(0);
  const [precoCliente, setPrecoCliente] = React.useState('');
  const [dadosClienteSel, setDadosClienteSel] = React.useState({
    codigo: '',
    nome: '',
    documento: '',
    nomeFantasia: '',
  });
  //  const [clienteProp, setClientePro] = React.useState([]);
  const [cliente, setCliente] = React.useState<
    {
      codigo: string;
      nome: string;
      documento: string;
      nomeFantasia: string;
      saldo: number;
    }[]
  >([{ codigo: '01', nome: '', documento: '', nomeFantasia: '', saldo: 0 }]);
  const [clienteSelect, setClienteSelect] = React.useState<{
    codigo: string;
    nome: string;
    documento: string;
    nomeFantasia: string;
    saldo: number;
    status: string;
    desconto: number;
    IPI: string;
    ICMS: string;
    zona: string;
    CLASPGTO: string;
    UF: string;
    TIPO: string;
    limiteAtraso: number;
    diasAtrasado: number;
    tipoPreco: string;
    CODVEND: string;
    FONE: string;
    ENDER: string;
    BAIRRO: string;
    CIDADE: string;
    CEP: string;
    KICKBACK: boolean;
  }>({
    codigo: '',
    nome: '',
    documento: '',
    nomeFantasia: '',
    saldo: 0,
    status: '',
    desconto: 0,
    IPI: '',
    ICMS: '',
    zona: '',
    CLASPGTO: '',
    UF: '',
    TIPO: '',
    limiteAtraso: 0,
    diasAtrasado: 0,
    tipoPreco: '',
    CODVEND: '',
    FONE: '',
    ENDER: '',
    BAIRRO: '',
    CIDADE: '',
    CEP: '',
    KICKBACK: false,
  });
  const [listaProd, setListaProd] = React.useState<
    {
      CODPROD: string;
      DESCR: string;
      MARCA: string;
      QTDDISPONIVEL: number;
      PRECOVENDA: number;
      REF: string;
      CODGPE: string;
      MARGEM_MIN_VENDA?: number;
    }[]
  >([]);
  const [listaCliente, setListaCliente] =
    React.useState<client[]>(dadosCliente);

  const [dentroCli, setDentroCli] = React.useState(false);
  const [dentroProd, setDentroProd] = React.useState(false);
  const [showProd, setShowProd] = React.useState(false);
  const [documento, setDocumento] = React.useState(() => {
    const saved = sessionStorage.getItem('documentoVendaMelo');
    return saved ? JSON.parse(saved) : { COD_OPERACAO: '', DESCR: '' };
  });
  const [pedido, setPedido] = React.useState('');
  const [obs, setObs] = React.useState('');
  const [fPagamento, setFPagamento] = React.useState('');
  const [avista, setAvista] = React.useState(false);
  const [statusFPagamento, setStatusFPagamento] = React.useState(true);
  const [checkOperador, setCheckOperador] = React.useState(false);
  const [checkLocal, setCheckLocal] = React.useState(false);
  const [openOperador, setOpenOperador] = React.useState(false);
  const [openLocal, setOpenLocal] = React.useState(false);
  const [checkVendedor, setCheckVendedor] = React.useState(false);
  const [openVendedor, setOpenVendedor] = React.useState(false);
  const [showCli, setShowCli] = React.useState(false);
  const [openEsvaziar, setOpenEsvaziar] = React.useState(false);
  const [openInfoCliente, setOpenInfoCliente] = React.useState(false);
  // const [causa, setCausa] = React.useState('');
  const [openFim, setOpenFim] = React.useState(false);
  const [produto, setProduto] = React.useState<
    {
      codigo: string;
      descrição: string;
      marca: string;
      estoque: string;
      preço: string;
      ref: string;
      quantidade: string;
      descriçãoEditada: string;
      totalItem: string;
      precoItemEditado: string;
      tipoPreço: string;
      desconto: number;
      origem: string;
      margemMinima?: number;
    }[]
  >([
    {
      codigo: 'nenhum',
      descrição: 'produto',
      marca: '',
      estoque: '',
      preço: '',
      ref: '',
      quantidade: '0',
      descriçãoEditada: '',
      totalItem: '',
      precoItemEditado: '',
      tipoPreço: '',
      desconto: 0,
      origem: '',
    },
  ]);
  const [produtoRef, setProdutoRef] = React.useState<
    {
      codigo: string;
      descrição: string;
      marca: string;
      estoque: string;
      preço: string;
      ref: string;
      quantidade: string;
      descriçãoEditada: string;
      totalItem: string;
      precoItemEditado: string;
      tipoPreço: string;
      desconto: number;
      origem: string;
      margemMinima?: number;
    }[]
  >([
    {
      codigo: 'nenhum',
      descrição: 'produto',
      marca: '',
      estoque: '',
      preço: '',
      ref: '',
      quantidade: '0',
      descriçãoEditada: '',
      totalItem: '',
      precoItemEditado: '',
      tipoPreço: '',
      desconto: 0,
      origem: '',
    },
  ]);
  const [openModalPrazo, setOpenModalPrazo] = React.useState(false);
  const [prazosArray, setPrazosArray] = React.useState<ParcelaItem[]>(() => {
    const saved = sessionStorage.getItem('prazoVendaMelo');
    return saved ? JSON.parse(saved) : [];
  });
  const [carrinho, setCarrinho] = React.useState<
    {
      codigo: string;
      descrição: string;
      marca: string;
      estoque: string;
      preço: string;
      ref: string;
      quantidade: string;
      descriçãoEditada: string;
      totalItem: string;
      precoItemEditado: string;
      tipoPreço: string;
      desconto: number;
      origem: string;
      margemMinima?: number;
    }[]
  >([]);

  const [transporteSel, setTransporteSel] = React.useState<{
    CODTPTRANSP: string;
    DESCR: string;
  }>({
    CODTPTRANSP: '',
    DESCR: '',
  });

  const [vendedorSel, setVendedorSel] = React.useState<{
    codigo: string;
    nome: string;
  }>({
    codigo: '',
    nome: '',
  });

  const [operadorSel, setOperadorSel] = React.useState<{
    codigo: string;
    nome: string;
  }>({
    codigo: '',
    nome: '',
  });
  const [localSel, setLocalSel] = React.useState<{
    codigo: string;
    nome: string;
  }>({
    codigo: '',
    nome: '',
  });

  const [openPdf, setOpenPdf] = React.useState(false);
  const [pagina, setPagina] = React.useState(0);
  const [tamanhoPagina, setTamanhoPagina] = React.useState(10);
  const [totalClientes, setTotalClientes] = React.useState(0);
  const [opcoesFP, setOpcoesFP] = React.useState<FPagamento[]>([]);

  // Modal de envio / status
  const [envioOpen, setEnvioOpen] = React.useState(false);
  const [envioStep, setEnvioStep] = React.useState<
    'montando' | 'enviando' | 'ok' | 'erro'
  >('montando');
  const [envioMsg, setEnvioMsg] = React.useState<string>('');
  const [envioResp, setEnvioResp] = React.useState<any>(null);

  // Modal de salvar / status
  const [salvarOpen, setSalvarOpen] = React.useState(false);
  const [salvarStep, setSalvarStep] = React.useState<
    'montando' | 'enviando' | 'ok' | 'erro'
  >('montando');
  const [salvarMsg, setSalvarMsg] = React.useState<string>('');
  const [salvarResp, setSalvarResp] = React.useState<any>(null);
  // >>> Nova Venda: guarda o draft_id atual
  const draftIdRef = React.useRef<string | null>(null);

  // normaliza número e devolve null se não vier nada

  const armazens =
    user.armazens?.map((a) => ({
      value: String(a.id_armazem),
      label: a.nome ?? 'sem armazem associado', // dependendo de como veio do backend
    })) || [];
  const [selectedArmazem, setSelectedArmazem] = React.useState<
    Armazens | undefined
  >(
    armazens[0], // Define um valor inicial padrão, como o primeiro da lista.
  );
  const [isLoading, setIsLoading] = React.useState(false);
  // Mostra o overlay de bloqueio do carrinho (modal global)
  const [bloqueioCarrinho, setBloqueioCarrinho] = React.useState(false);
  const [savedDraftId, setSavedDraftId] = React.useState<string | null>(null);

  // === Draft persistente ===
  const DRAFT_KEY = 'vendaDraftIdMelo';

  // Mensagem padrão (2 linhas)
  const MSG_SEM_VENDEDOR =
    'Esta tela não pode ser usada pois não há um VENDEDOR associado a este perfil.\n' +
    'Solicite ao TI essa associação e retorne à tela.';

  //bloco de menu supenso
  const [ctxGlobal, setCtxGlobal] = React.useState<CtxGlobal>({
    open: false,
    area: null,
    index: null,
    points: { x: 0, y: 0 },
  });

  // Modal de obrigatórios ausentes
  const [obrigOpen, setObrigOpen] = React.useState(false);
  const [obrigList, setObrigList] = React.useState<string[]>([]);
  const router = useRouter();
  // handler simples que os filhos vão chamar quando abrirem/fecharem
  const handleCtxChange = (next: CtxGlobal) => setCtxGlobal(next);

  // destino da lista
  const CENTRAL_VENDAS_PATH = '/vendas/centralVendas';

  React.useEffect(() => {
    const ctrl = new AbortController();

    (async () => {
      try {
        const resp = await fetch('/api/vendas/fpagamento', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: ctrl.signal,
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const json: { ok: boolean; data: unknown[] } = await resp.json();

        const rows: FPagamento[] = Array.isArray(json?.data)
          ? (json.data as unknown[])
              .map(
                (o: any): FPagamento => ({
                  id: String(o?.id ?? o?.ID ?? o?.codigo ?? ''),
                  descricao: String(
                    o?.descricao ?? o?.DESCRICAO ?? o?.descr ?? '',
                  ),
                }),
              )
              .filter((o) => o.id.length > 0 && o.descricao.length > 0)
          : [];

        setOpcoesFP(rows);
      } catch (e: any) {
        console.error('[fpagamento] erro:', e?.message || e);
        setOpcoesFP([]); // evita ficar com estado “antigo”
      }
    })();

    return () => ctrl.abort();
  }, []);

  // 1) Helper: compacta por codigo/codprod somando quantidades e recalculando total
  function compactarCarrinho(itens: any[]) {
    const map = new Map<string, any>();

    for (const it of itens ?? []) {
      const key = String(it?.codigo ?? it?.codprod ?? '').trim();
      if (!key) continue;

      const unit = toN(it?.precoItemEditado ?? it?.preço ?? it?.preco ?? 0);
      const q = toN(it?.quantidade ?? it?.qtd ?? 0);
      const desc = toN(it?.desconto ?? 0);

      if (!map.has(key)) {
        map.set(key, {
          ...it,
          codigo: key,
          qtd: q,
          quantidade: String(q),
          precoItemEditado: unit,
          preço: unit,
          preco: unit,
          desconto: desc,
          totalItem: String(round2(unit * q)),
        });
      } else {
        const acc = map.get(key);
        const novaQtd = toN(acc.qtd) + q;
        const descontoFinal = toN(it?.desconto ?? acc?.desconto ?? 0);
        map.set(key, {
          ...acc,
          qtd: novaQtd,
          quantidade: String(novaQtd),
          desconto: descontoFinal,
          totalItem: String(round2(unit * novaQtd)),
        });
      }
    }
    return Array.from(map.values());
  }

  // 2) Assinatura estável: evita setState desnecessário/loops
  function assinaturaCarrinho(itens: any[]) {
    return (itens ?? [])
      .map((it) => {
        const key = String(it?.codigo ?? it?.codprod ?? '').trim();
        const q = toN(it?.quantidade ?? it?.qtd ?? 0);
        const pu = toN(it?.precoItemEditado ?? it?.preço ?? it?.preco ?? 0);
        return `${key}:${q}@${pu}`;
      })
      .sort()
      .join('|');
  }

  // 3) Efeito de deduplicação SEM loop
  React.useEffect(() => {
    if (!Array.isArray(carrinho) || carrinho.length === 0) return;

    const dedup = compactarCarrinho(carrinho);
    const sigA = assinaturaCarrinho(carrinho);
    const sigB = assinaturaCarrinho(dedup);

    if (sigA !== sigB) {
      // somente atualiza se mudou de fato
      setCarrinho(dedup);
    }
  }, [carrinho]);

  function handleIrParaCentralVendas() {
    try {
      sessionStorage.setItem(
        'telaAtualMelo',
        JSON.stringify(CENTRAL_VENDAS_PATH),
      );
    } catch {}
    router.replace('/'); // mesmo roteamento central que você já usa
  }
  // ⬇️ perto dos demais handlers (useCallback)
  const handleMudouOrdenacao = React.useCallback(
    ({
      sortBy,
      sortDir,
    }: {
      sortBy: string | null;
      sortDir: 'asc' | 'desc' | null;
    }) => {
      setSortBy(sortBy);
      setSortDir(sortDir);
      // setPagina(0); // reset de página quando muda ordenação
    },
    [],
  );

  // monta "CODIGO - NOME" (igual o que você digita no campo)
  function joinLocalEntrega(
    localSel?: { codigo?: string; nome?: string } | null,
  ) {
    if (!localSel) return null;
    const codigo = (localSel.codigo ?? '').trim();
    const nome = (localSel.nome ?? '').trim();
    if (!codigo && !nome) return null;
    return [codigo, nome].filter(Boolean).join(' - ');
  }

  const metaHydratedRef = React.useRef(false);
  // >>> Nova Venda: LÊ o draft_id salvo (inclusive após F5) e mantém em memória
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem('vendaDraftIdMelo');
      draftIdRef.current = saved || null;
    } catch {
      draftIdRef.current = null;
    }
  }, []);

  // 1) Hidrata do storage no mount (antes de qualquer write)
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(META_KEY);
      if (raw) {
        const meta = JSON.parse(raw);
        if (!savedDraftId) {
          const id = sessionStorage.getItem('vendaDraftIdMelo');
          if (id) setSavedDraftId(id);
        }

        if (meta.localSel && meta.localSel.nome.length)
          setLocalSel(meta.localSel);
        if (typeof meta.checkLocal === 'boolean')
          setCheckLocal(meta.checkLocal);
      }
    } catch {}
    // libera os writes só depois de tentar hidratar
  }, [savedDraftId]);

  // 2) Persiste localSel/checkLocal somente após hidratar
  React.useEffect(() => {
    if (!metaHydratedRef.current) return; // evita sobrescrever no refresh

    try {
      const raw = sessionStorage.getItem(META_KEY);
      const meta = raw ? JSON.parse(raw) : {};
      const next = { ...meta };

      // só grava localSel quando tiver algo de fato
      if (localSel && (localSel.codigo || localSel.nome)) {
        next.localSel = localSel;
      } else {
        delete next.localSel;
      }

      // grava sempre que checkLocal for boolean
      if (typeof checkLocal === 'boolean') next.checkLocal = checkLocal;

      sessionStorage.setItem(META_KEY, JSON.stringify(next));
    } catch {}
  }, [localSel, checkLocal]);

  // Só persiste quando houver dados válidos (não sobrescreve com vazio)
  React.useEffect(() => {
    if (sessionStorage.getItem(HYDRATE_DONE_KEY) !== '1') return;
    try {
      const raw = sessionStorage.getItem('metaVendaMelo');
      const meta = raw ? JSON.parse(raw) : {};

      const hasOp =
        !!operadorSel &&
        (Boolean(operadorSel.codigo) || Boolean(operadorSel.nome));

      if (hasOp) {
        sessionStorage.setItem(
          'metaVendaMelo',
          JSON.stringify({ ...meta, operadorSel }),
        );
      }
      // se não tiver operador válido, NÃO escreve nada (evita apagar o que veio da Central Vendas)
    } catch {}
  }, [operadorSel]);

  // SUBSTITUA toda a sua função handleSalvarVenda por esta versão
  async function handleSalvarVenda() {
    // abre o modal primeiro
    setSalvarOpen(true);
    setSalvarStep('montando');
    setSalvarMsg('Preparando os dados do rascunho...');

    try {
      // validações
      if (!clienteSelect?.codigo) {
        setSalvarStep('erro');
        setSalvarMsg('Selecione um cliente.');
        toast?.error?.('Selecione um cliente.');
        return;
      }
      if (!Array.isArray(carrinho) || carrinho.length === 0) {
        setSalvarStep('erro');
        setSalvarMsg('Carrinho vazio.');
        toast?.error?.('Carrinho vazio.');
        return;
      }

      const armId = Number(selectedArmazem?.value || 0);
      if (!armId) {
        setSalvarStep('erro');
        setSalvarMsg('Selecione um armazém.');
        toast?.error?.('Selecione um armazém.');
        return;
      }

      // (1) evita itens repetidos por codigo/codprod
      const itensUnicos = (() => {
        const seen = new Set<string>();
        const arr: any[] = [];
        for (const it of carrinho ?? []) {
          const cod = String((it as any)?.codigo ?? (it as any)?.codprod ?? '');
          if (!cod) continue;
          if (seen.has(cod)) continue;
          seen.add(cod);
          arr.push(it);
        }
        return arr;
      })();
      // helper local para normalizar números vindos como "1.234,56" ou "45,02"

      // converte preço/quantidade/desconto para number correto
      const itensSanitizados = itensUnicos.map((it: any) => {
        const rawPreco =
          it.precoItemEditado ?? it.prunit ?? it.preço ?? it.preco ?? 0;

        const precoUnit = toN(rawPreco);
        const qtd = toN(it.quantidade ?? it.qtd);
        const desc = toN(it.desconto ?? 0);

        return {
          ...it,
          // mantenho todos os aliases coerentes (backend aceita qualquer um)
          prunit: precoUnit,
          precoItemEditado: precoUnit,
          preço: precoUnit,
          preco: precoUnit,

          qtd: qtd,
          quantidade: qtd,

          desconto: desc,
        };
      });

      const prazosPayload = Array.isArray(prazosArray)
        ? prazosArray.map((p: any) => ({
            data: p.dataVencimento, // string ISO ou Date
            dia: Number(p.dias) ?? null, // inteiro
          }))
        : [];

      // (2) lê um draft já salvo para forçar UPDATE
      let savedDraftId: string | undefined =
        (draftIdRef?.current as string | null) || undefined;

      if (!savedDraftId) {
        try {
          const id = sessionStorage.getItem('vendaDraftIdMelo');
          if (id) savedDraftId = id;
        } catch {}
      }
      if (!savedDraftId) {
        try {
          const rawMeta = sessionStorage.getItem('metaVendaMelo');
          const meta = rawMeta ? JSON.parse(rawMeta) : {};
          if (meta?.draftId) savedDraftId = String(meta.draftId);
        } catch {}
      }

      // monta o payload com o MESMO header do finalizar
      const payload = {
        // redundante, mas o endpoint aceita nos dois lugares
        draft_id: savedDraftId ?? undefined,

        header: {
          operacao: Number(documento?.COD_OPERACAO),
          codcli: String(clienteSelect?.codigo),
          codusr: Number(perfilUser?.codusr),
          pedido: String(pedido ?? ''),
          tipo: 'P',
          tele: operadorSel?.nome ? 'S' : 'N',
          transp: transporteSel?.DESCR ?? '',
          codtptransp: transporteSel?.CODTPTRANSP
            ? Number(transporteSel.CODTPTRANSP)
            : null,
          vlrfrete: Number(valTranspDec ?? 0),
          prazo: String(prazo ?? ''),
          tipo_desc: String(precoCliente ?? ''),
          obs: String(obs ?? ''),
          obsfat: String(obsFat ?? ''),
          bloqueada: '0',
          estoque_virtual: 'N',
          uName: String(perfilUser?.usuario),
          nomecf:
            clienteSelect?.nome?.trim?.() ||
            clienteSelect?.nomeFantasia?.trim?.() ||
            null,
          vendedor: vendedorSel?.codigo ? String(vendedorSel.codigo) : null,
          vendedorNome: vendedorSel?.nome ? String(vendedorSel.nome) : null,
          operador: operadorSel?.codigo ? String(operadorSel.codigo) : null,
          operadorNome: operadorSel?.nome || null,
          checkOperador: !!checkOperador,
          checkVendedor: !!checkVendedor,

          // header também recebe
          draft_id: savedDraftId ?? undefined,
          arm_id: armId,
          formaPagamento: fPagamento || null,
          avista: !!avista,
          statusFPagamento: !!statusFPagamento,
          requisicao: requisição ?? '',
          localentregacliente: joinLocalEntrega(localSel),
        },

        // (1) envia itens sem duplicatas + arm_id
        itens: itensSanitizados.map((it: any) => ({
          ...it,
          arm_id: armId,
          margem_min_venda:
            Number(
              it.margemMinima ??
                it.MARGEM_MIN_VENDA ??
                it.margem_min_venda ??
                0,
            ) || 0,
        })),

        prazos: prazosPayload,
      };

      setSalvarStep('enviando');
      setSalvarMsg('Salvando rascunho...');

      const resp = await fetch('/api/vendas/salvar-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setSalvarStep('erro');
        setSalvarMsg(data?.error || 'Falha ao salvar.');
        toast?.error?.(data?.error || 'Falha ao salvar.');
        return;
      }

      // (3) persiste o draft_id retornado (nomes flexíveis)
      const returnedDraftId =
        data?.draft_id ?? data?.id ?? data?.external_id ?? null;

      if (returnedDraftId) {
        const idStr = String(returnedDraftId);
        // ref (para o ciclo de vida atual)
        try {
          if (draftIdRef) draftIdRef.current = idStr;
        } catch {}
        // storage direto
        try {
          sessionStorage.setItem('vendaDraftIdMelo', idStr);
        } catch {}
        // também registra no META
        try {
          const rawMeta = sessionStorage.getItem('metaVendaMelo');
          const meta = rawMeta ? JSON.parse(rawMeta) : {};
          meta.draftId = idStr;
          sessionStorage.setItem('metaVendaMelo', JSON.stringify(meta));
        } catch {}
      }

      setSalvarStep('ok');
      setSalvarMsg('Rascunho salvo!');
      setSalvarResp(data); // mostra o ID no modal se vier
    } catch (e: any) {
      setSalvarStep('erro');
      setSalvarMsg(e?.message || 'Erro inesperado ao salvar.');
      toast?.error?.(e?.message || 'Erro inesperado ao salvar.');
    }
  }

  React.useEffect(() => {
    try {
      // já tem id? não faz nada
      const id = sessionStorage.getItem('vendaDraftIdMelo');

      if (id) return;

      // tenta recuperar do header snapshot
      const rawHeader = sessionStorage.getItem('vendaHeaderMelo');
      const header = rawHeader ? JSON.parse(rawHeader) : null;

      if (header?.draft_id) {
        sessionStorage.setItem('vendaDraftIdMelo', String(header.draft_id));
        return;
      }

      // fallback: tenta do META
      const rawMeta = sessionStorage.getItem('metaVendaMelo');
      const meta = rawMeta ? JSON.parse(rawMeta) : null;
      if (meta?.draftId) {
        sessionStorage.setItem('vendaDraftIdMelo', String(meta.draftId));
        return;
      }
    } catch {}
  }, []);

  // opcional: clicar fora fecha tudo
  React.useEffect(() => {
    function onDown(_e: MouseEvent) {
      if (ctxGlobal.open) setCtxGlobal((s) => ({ ...s, open: false }));
    }
    window.addEventListener('click', onDown);
    return () => window.removeEventListener('click', onDown);
  }, [ctxGlobal.open]);

  // Carrega os metadados (obs, obsFat, forma pgto, transporte, operador, local, vista, prazos, frete, documento, vendedor...)
  // se existirem no sessionStorage (ex.: vindo de "Central Vendas" via draft)
  // RESTAURA metadados da venda a partir do sessionStorage (META_KEY)
  // 🔁 RESTORE: carrega o meta salvo quando a tela abre
  React.useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(META_KEY);

      if (!raw) return;

      const meta = JSON.parse(raw) as any;

      // ... todos seus setStates (obs, obsFat, pedido, prazos, frete, seleções, etc.)

      // requisição (aceita com e sem acento)
      const req = meta['requisição'] ?? meta['requisicao'];
      if (req !== undefined) setRequisição(req);
      if (meta.fPagamento !== undefined) setFPagamento(meta.fPagamento);
      if (meta.vista !== undefined) setAvista(!!meta.vista);
      if (meta.statusFPagamento !== undefined)
        setStatusFPagamento(!!meta.statusFPagamento);

      //prazo
      // prazos
      if (Array.isArray(meta.prazosArray)) {
        setPrazosArray(meta.prazosArray as any);
        setPrazo(
          meta.prazoStr ?? meta.prazosArray.map((p: any) => p.dias).join(' '),
        );
      }
      // textos
      if (meta.obs !== undefined) setObs(meta.obs);
      if (meta.obsFat !== undefined) setObsFat(meta.obsFat);
      if (meta.pedido !== undefined) setPedido(meta.pedido);

      // documento
      if (meta.documento) setDocumento(meta.documento);
      // vendedor
      if (meta.vendedorSel) setVendedorSel(meta.vendedorSel);
      // (se você tiver checkVendedor no estado, habilite-o quando vier valor)
      if (typeof setCheckVendedor === 'function') {
        if (typeof meta.checkVendedor === 'boolean')
          setCheckVendedor(!!meta.checkVendedor);
        else if (
          meta.vendedorSel &&
          (meta.vendedorSel.codigo || meta.vendedorSel.nome)
        )
          setCheckVendedor(true);
      }

      // operador
      if (meta.operadorSel) setOperadorSel(meta.operadorSel);
      if (typeof meta.checkOperador === 'boolean')
        setCheckOperador(!!meta.checkOperador);
      // transporte
      if (meta.transporteSel) setTransporteSel(meta.transporteSel);

      // local
      if (meta.localSel) setLocalSel(meta.localSel);
      if (typeof meta.checkLocal === 'boolean') {
        setCheckLocal(!!meta.checkLocal);
      } else if (
        meta.localSel &&
        (meta.localSel.codigo || meta.localSel.nome)
      ) {
        setCheckLocal(true);
      }
      // frete
      if (meta.valTransp !== undefined) setValTransp(meta.valTransp);
      if (typeof meta.valTranspDec === 'number')
        setValTranspDec(meta.valTranspDec);

      // ✅ Hidratação concluída: libera AUTOSAVE (persistente mesmo em StrictMode)
      sessionStorage.setItem(HYDRATE_DONE_KEY, '1');
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Persiste metadados relevantes da venda em UMA chave
  // PERSISTE metadados relevantes em UMA chave (META_KEY)
  // 💾 AUTOSAVE: persiste o "meta" sempre que algo mudar
  React.useEffect(() => {
    // ⛔ não salve enquanto a hidratação não terminar
    if (sessionStorage.getItem(HYDRATE_DONE_KEY) !== '1') return;

    const metaParcial = {
      obs,
      obsFat,
      pedido,
      fPagamento,
      vista: avista,
      statusFPagamento,
      prazosArray,
      prazoStr: prazo,
      valTransp,
      valTranspDec,
      documento,
      vendedorSel,
      operadorSel,
      transporteSel,
      checkOperador,
      localSel,
      checkLocal,
      ['requisição']: requisição,
    };

    try {
      const prevRaw = sessionStorage.getItem(META_KEY);
      const prev = prevRaw ? JSON.parse(prevRaw) : {};
      const merged = { ...prev, ...metaParcial }; // mantém draftId etc.
      sessionStorage.setItem(META_KEY, JSON.stringify(merged));
    } catch {}
  }, [
    obs,
    obsFat,
    pedido,
    fPagamento,
    avista,
    statusFPagamento,
    prazosArray,
    prazo,
    valTransp,
    valTranspDec,
    documento,
    vendedorSel,
    operadorSel,
    transporteSel,
    localSel,
    requisição,
    checkOperador,
    checkLocal,
  ]);

  function validarObrigatorios(): string[] {
    const faltas: string[] = [];

    // Regra do seu código: prazo só é obrigatório se o cliente tiver saldo para pagar a vista
    if (!prazo && clienteSelect?.saldo - totalVenda >= 0) {
      faltas.push('Prazo');
    }

    // Transporte obrigatório
    if (!transporteSel?.DESCR?.length) {
      faltas.push('Tipo de transporte');
    }

    // Pelo seu menu, forma de pagamento também é obrigatória
    if (!fPagamento?.length) {
      faltas.push('Forma de pagamento');
    }

    // Estados que bloqueiam a operação
    if (
      statusVenda === 'VENDA BLOQUEADA' ||
      statusVenda === 'BLOQUEIO FINANCEIRO'
    ) {
      faltas.push('Status da venda impede a operação');
    }

    return faltas;
  }

  const opcoesFPFiltradas = React.useMemo(() => {
    // remove "Outros" sempre
    const base = opcoesFP.filter((o) => !isOutros(o.descricao));

    if (isPrazoAvista(prazo)) {
      // À vista: PIX + Débito + Dinheiro + Crédito (sem Carteira/Boleto)
      return base.filter(
        (o) =>
          isPix(o.descricao) ||
          isCartaoDebito(o.descricao) ||
          isDinheiro(o.descricao) ||
          isCartaoCredito(o.descricao),
      );
    }

    if (isPrazoUmDigitoMenorQue7(prazo)) {
      // 1 dígito < 7: Crédito + Carteira + Débito + PIX + Dinheiro (SEM Boleto)
      return base.filter(
        (o) =>
          !isBoleto(o.descricao) &&
          (isCartaoCredito(o.descricao) ||
            isCarteira(o.descricao) ||
            isCartaoDebito(o.descricao) ||
            isPix(o.descricao) ||
            isDinheiro(o.descricao)),
      );
    }

    // Caso geral: Crédito + Carteira + Boleto
    return base.filter(
      (o) =>
        isCartaoCredito(o.descricao) ||
        isCarteira(o.descricao) ||
        isBoleto(o.descricao),
    );
  }, [opcoesFP, prazo]);

  //prazo
  const handlePrazosSalvos = (novoArrayDePrazos: ParcelaItem[]) => {
    // Apenas substitui o array anterior pelo novo array vindo do modal
    setPrazosArray(novoArrayDePrazos);
    setOpenModalPrazo(false);

    // Verifique se o array não está vazio para evitar erros
    if (novoArrayDePrazos.length > 0) {
      // 1. Crie a string formatada concatenando o campo `dias` de cada objeto
      const diasConcatenados = novoArrayDePrazos
        .map((item) => item.dias)
        .join(' '); // Ex: "30 60 90"

      // 2. Atualize o estado do input de prazo com a nova string
      setPrazo(diasConcatenados);
      setObrigPrazo(false); // Seta para não ser mais obrigatório
    } else {
      // Se o array estiver vazio, limpa o input
      setPrazo('');
    }
  };

  React.useEffect(() => {
    if (sessionStorage.getItem(HYDRATE_DONE_KEY) !== '1') return;
    try {
      const raw = sessionStorage.getItem(META_KEY);
      const meta = raw ? JSON.parse(raw) : {};
      meta.obsFat = obsFat ?? '';

      sessionStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {}
  }, [obsFat]);

  /**
   * Persiste FORMA DE PAGAMENTO (e flags relacionadas) quando mudar
   */
  React.useEffect(() => {
    if (sessionStorage.getItem(HYDRATE_DONE_KEY) !== '1') return;
    try {
      const raw = sessionStorage.getItem(META_KEY);
      const meta = raw ? JSON.parse(raw) : {};
      meta.fPagamento = fPagamento ?? '';

      // se essas flags influenciam a forma, salve junto
      meta.vista = !!avista;
      meta.statusFPagamento = !!statusFPagamento;

      sessionStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {}
  }, [fPagamento, avista, statusFPagamento]);

  const handleArmazemChange = (value: string) => {
    // Encontre o objeto do armazém correspondente ao valor selecionado.
    const newArmazem = armazens.find((armazem) => armazem.value === value);
    if (newArmazem) {
      setProduto([]);
      setPesquisa('');
      setSelectedArmazem(newArmazem);

      //      setProduto([]);
    }
  };
  // === helpers locais ===
  const isTipoBalcao = (tipo: any): boolean => {
    const raw = String(tipo ?? '');
    // remove acentos (balcão -> balcao) e compara em minúsculas
    const s =
      raw
        .normalize?.('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() || raw.toLowerCase();
    return s.includes('balcao') || s === 'b' || s === 'balc';
  };

  function resolvePromoInfoDoItem(it: any) {
    try {
      const p =
        (Array.isArray(it?.promocoes) && it.promocoes[0]) ||
        it?.promocao ||
        null;

      if (!p?.ativa) return {};
      if (typeof isTipoBalcao === 'function' && isTipoBalcao(it?.tipoPreço)) {
        return {};
      }

      const qtd = toN(it?.quantidade ?? 0);
      const min = toN(p?.qtde_minima_item ?? 1);
      const disp = Math.max(
        0,
        toN(p?.qtd_total_item ?? 0) - toN(p?.qtdvendido ?? 0),
      );
      if (qtd < min || disp <= 0) return {};

      const maxCli = toN(p?.qtde_maxima_item ?? qtd);
      const promoQty = Math.max(0, Math.min(qtd, maxCli || qtd, disp || qtd));
      if (promoQty <= 0) return {};

      // IMPORTANTE: O backend atualiza qtdvendido pelo id_promocao_item
      // (identificador único do item na tabela dbpromocao_item)
      const id_promocao_item =
        Number(p?.id_promocao_item) ||
        Number(p?.idPromocaoItem) ||
        undefined;

      // Também enviamos id_promocao para referência
      const promocao_id =
        Number(p?.id_promocao) ||
        Number(p?.idPromocao) ||
        Number(p?.promocao_id) ||
        undefined;

      return {
        id_promocao_item, // ID do item de promoção (para baixa do qtdvendido)
        promocao_id,      // ID da promoção principal (para referência)
        promoQty,         // Quantidade promocional vendida
        quantidade_promocional: promoQty, // Alias para compatibilidade
        codgpp: p?.codgpp ?? undefined,
      };
    } catch {
      return {};
    }
  }

  const handleFinalizar = async () => {
    const prazosPayload = Array.isArray(prazosArray)
      ? prazosArray.map((p: any) => ({
          data: p.dataVencimento, // string ISO ou Date
          dia: Number(p.dias) ?? null, // inteiro
        }))
      : [];
    try {
      setEnvioOpen(true);
      setEnvioStep('montando');
      setEnvioMsg('Preparando os dados para envio...');

      const payload = {
        header: {
          operacao: Number(documento?.COD_OPERACAO),
          codcli: String(clienteSelect?.codigo),
          codusr: Number(perfilUser?.codusr),
          pedido: String(pedido ?? ''),
          tipo: 'P',
          tele: operadorSel?.nome ? 'S' : 'N',
          transp: transporteSel?.DESCR ?? '',
          codtptransp: transporteSel?.CODTPTRANSP
            ? Number(transporteSel.CODTPTRANSP)
            : null,
          vlrfrete: Number(valTranspDec ?? 0),
          prazo: String(prazo ?? ''),
          tipo_desc: String(precoCliente ?? ''),
          obs: String(obs ?? ''),
          obsfat: String(obsFat ?? ''),
          bloqueada: '0',
          estoque_virtual: 'N',
          uName: String(perfilUser?.usuario),
          nomecf:
            clienteSelect?.nome?.trim?.() ||
            clienteSelect?.nomeFantasia?.trim?.() ||
            null,
          // já existiam no endpoint (mantidos se você usa):
          vendedor: vendedorSel?.codigo ? String(vendedorSel.codigo) : null,
          operador: operadorSel?.codigo ? String(operadorSel.codigo) : null,
          formaPagamento: fPagamento || null,
          avista: !!avista, // ou 'S'/'N' se o backend preferir
          statusFPagamento: !!statusFPagamento,
          requisicao: requisição ?? '',
          localentregacliente: joinLocalEntrega(localSel),
        },

        itens: (carrinho ?? []).map((val: any, idx: number) => {
          const aliq = val.aliquotas ?? {};
          const imp = val.impostos ?? {};
          const dbg = val.debugImposto ?? val.debug ?? {};

          // Valor bruto (qtd × prunit) - base fiscal correta para NFe
          // IMPORTANTE: Não usar totalItem pois pode ter desconto de promoção
          const qtdItem = toN(val?.quantidade ?? 1);
          const prunitItem = toN(val?.precoItemEditado ?? val?.preço ?? 0);
          const valorBruto = qtdItem * prunitItem;

          const extrasFiscais = {
            icms: aliq.icms ?? null,
            ipi: aliq.ipi ?? null,
            mva: aliq.agregado ?? null,
            totalicms: imp.valorICMS ?? null,
            totalipi: imp.valorIPI ?? null,
            totalsubst_trib: imp.valorICMS_Subst ?? null,
            valorpis: imp.valorPIS ?? null,
            valorcofins: imp.valorCOFINS ?? null,
            // Usar valor bruto como fallback para bases fiscais (não totalItem)
            baseicms: dbg.baseICMS ?? dbg.base_icms ?? dbg.bases?.icms ?? valorBruto,
            baseipi: dbg.baseIPI ?? dbg.base_ipi ?? dbg.bases?.ipi ?? valorBruto,
            basesubst_trib: dbg.baseST ?? dbg.base_st ?? dbg.bases?.st ?? null,
            basepis: dbg.basePIS ?? dbg.base_pis ?? dbg.bases?.pis ?? valorBruto,
            basecofins:
              dbg.baseCOFINS ?? dbg.base_cofins ?? dbg.bases?.cofins ?? valorBruto,
            totalproduto:
              dbg.totalProduto ?? dbg.total_produto ?? valorBruto,
            icmsinterno_dest:
              dbg.icmsInternoDest ?? dbg.icms_interno_dest ?? null,
            icmsexterno_orig:
              dbg.icmsExternoOrig ?? dbg.icms_externo_orig ?? null,
            totalicmsdesconto: dbg.totalICMSDesconto ?? null,
            fcp: dbg.fcp ?? null,
            base_fcp: dbg.base_fcp ?? null,
            valor_fcp: dbg.valor_fcp ?? null,
            fcp_subst: dbg.fcp_subst ?? null,
            basefcp_subst: dbg.basefcp_subst ?? null,
            valorfcp_subst: dbg.valorfcp_subst ?? null,
            ftp_st: dbg.ftp_st ?? null,
            fcp_substret: dbg.fcp_substret ?? null,
            basefcp_substret: dbg.basefcp_substret ?? null,
            valorfcp_substret: dbg.valorfcp_substret ?? null,
            codint: val.codint ?? null,
            cfop: val.cfop ?? null,
            tipocfop: val.tipocfop ?? null,
            ncm: val.ncm ?? null,
            cstipi: val.cstipi ?? null,
            cstpis: val.cstpis ?? null,
            cstcofins: val.cstcofins ?? null,
            csticms: val.csticms ?? null,
          };

          const promo = resolvePromoInfoDoItem(val);

          return {
            codprod: String(val?.codigo ?? val?.codprod ?? ''),
            qtd: toN(val?.quantidade),
            prunit: toN(val?.precoItemEditado ?? val?.preço ?? 0),
            arm_id: Number(selectedArmazem?.value),
            ref: String(val?.ref ?? ''),
            descr: String(val?.descrição ?? val?.descricao ?? ''),
            desconto: toN(val?.desconto ?? 0),
            codvend: vendedorSel?.codigo ? String(vendedorSel.codigo) : null,
            codoperador: operadorSel?.codigo
              ? String(operadorSel.codigo)
              : null,
            nritem: String(idx + 1),
            ...extrasFiscais,
            ...promo, // { promocao_id?, qtd_promo?, codgpp? }
          };
        }),

        prazos: prazosPayload,
      };

      // validações existentes
      if (!payload.header.codcli) {
        setEnvioStep('erro');
        setEnvioMsg('Selecione um cliente.');
        toast.error('Selecione um cliente.');
        return;
      }
      if (!payload.itens.length) {
        setEnvioStep('erro');
        setEnvioMsg('Carrinho vazio.');
        toast.error('Carrinho vazio.');
        return;
      }
      if (payload.itens.some((i: any) => !i.arm_id || i.arm_id <= 0)) {
        setEnvioStep('erro');
        setEnvioMsg('Defina o ARMAZÉM (arm_id) de todos os itens.');
        toast.error('Defina o ARMAZÉM (arm_id) de todos os itens.');
        return;
      }
      if (payload.itens.some((i: any) => i.qtd <= 0 || i.prunit <= 0)) {
        setEnvioStep('erro');
        setEnvioMsg('Quantidade e preço unitário devem ser > 0.');
        toast.error('Quantidade e preço unitário devem ser > 0.');
        return;
      }

      setEnvioStep('enviando');
      setEnvioMsg('Enviando venda para o servidor...');

      const { data } = await api.post(
        '/api/vendas/postgresql/finalizarVenda',
        payload,
      );

      if (data?.ok) {
        setEnvioStep('ok');
        setEnvioResp(data);
        setEnvioMsg(
          `Venda salva: Nº ${data.nrovenda} (status ${data.status}).`,
        );
        toast.success(
          `Venda salva! Nº: ${data.nrovenda} (status ${data.status})`,
        );
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {}
      } else {
        const msg =
          data?.error ||
          data?.message ||
          (data?.code === 'STOCK_ERROR'
            ? 'Sem saldo suficiente em um ou mais itens.'
            : 'Falha ao finalizar venda.');
        setEnvioStep('erro');
        setEnvioMsg(msg);
        setEnvioResp(data);
        toast.error(msg);
        console.error('FinalizarVenda ERROR payload:', data);
      }
    } catch (err: any) {
      console.error('FinalizarVenda EXCEPTION:', err);
      setEnvioStep('erro');
      setEnvioMsg(err?.message || 'Erro inesperado ao finalizar venda.');
      toast.error('Erro inesperado ao finalizar venda.');
    }
  };

  const handleInfoCliente = async (statusCliente: boolean) => {
    setOpenInfoCliente(statusCliente);
  };

  const handleDelete = async (statusDel: boolean) => {
    setOpenEsvaziar(false);

    if (statusDel) {
      sessionStorage.setItem('carrinhoMelo', JSON.stringify([]));
      setCarrinho([]);
      resetPersistenciaVenda(true);
      setProduto([]);
      setProdutoRef([]);
      setPrazosArray([]);
    }
  };

  const mudouPagina = ({
    pagina,
    linhas,
  }: {
    pagina: string;
    linhas: string;
  }) => {
    setPagina(Number(pagina));
    setTamanhoPagina(Number(linhas));
  };

  //atualizar itens de uma venda vinda de cetral de vendas
  // === utils de storage (remova se já existirem iguais no arquivo) ===
  function getJSON<T = any>(k: string, def: T): T {
    try {
      const v = sessionStorage.getItem(k);
      return v ? JSON.parse(v) : def;
    } catch {
      return def;
    }
  }
  function setJSON(k: string, v: any) {
    try {
      sessionStorage.setItem(k, JSON.stringify(v));
    } catch {}
  }

  // === wrapper p/ usar o SEU toN com valor default (evita NaN) ===
  const n = (v: any, def = 0) => {
    const x = toN(v);
    return Number.isFinite(x) ? x : def;
  };

  // === Recalcula totais/aliases de 1 item (usa o SEU toN via n()) ===
  const recomputeItem = React.useCallback((item: any) => {
    const qtd = n(item.qtd ?? item.quantidade ?? item.quantidadeNum ?? 0, 0);
    const unit = n(
      item.precoItemEditado ??
        item['preço'] ??
        item.preco ??
        item.prunit ??
        item.precoUnitario ??
        item.prvenda,
      0,
    );
    const desc = n(item.desconto ?? 0, 0);

    const bruto = qtd * unit;
    const liquido = Math.round(bruto * (1 - desc / 100) * 100) / 100;

    return {
      ...item,
      // aliases de unitário (numéricos)
      prunit: unit,
      preco_unit: unit,
      vlunit: unit,
      vlrunit: unit,
      prvenda: unit,
      // aliases de total (numéricos)
      totitem: liquido,
      total_item: liquido,
      vlrtotal: liquido,
      // campos que sua UI também lê
      vltotalItem: liquido,
      totalItem: String(liquido),
      precoItemEditado: unit,
      precoUnitario: unit,
      preco: unit,
      preço: unit,
    };
  }, []);

  // === Reconsulta preço/estoque de 1 item pelo endpoint de produto ===
  const refreshItemPreco = React.useCallback(
    async (item: any, armIdFallback?: number | string) => {
      const chave = String(
        item.ref ?? item.codigo ?? item.codprod ?? '',
      ).trim();
      if (!chave) return recomputeItem(item); // sem chave -> só recalc

      const arm_id = item.arm_id ?? armIdFallback ?? 1001;

      try {
        // const resp = await api.post('/api/vendas/dbOracle/produto', {
        const resp = await api.post('/api/vendas/postgresql/produto', {
          descricao: chave,
          arm_id,
          pagina: 0,
          tamanhoPagina: 1,
        });
        const rows = resp?.data?.data ?? resp?.data ?? [];
        const p = Array.isArray(rows) ? rows[0] : rows;

        // extrai preço unitário "canônico" usando seu toN
        const unit =
          n(p?.prvenda) ||
          n(p?.preco) ||
          n(p?.preço) ||
          n(p?.vlunit) ||
          n(p?.vlrunit) ||
          n(item?.precoItemEditado) ||
          n(item?.preço) ||
          n(item?.preco) ||
          n(item?.prunit) ||
          n(item?.precoUnitario);

        const merged = {
          ...item,
          codprod: String(
            p?.CODPROD ?? p?.codprod ?? item?.codprod ?? item?.codigo ?? '',
          ),
          codigo: String(
            p?.CODPROD ?? p?.codprod ?? item?.codigo ?? item?.codprod ?? '',
          ),
          ref: String(p?.REF ?? p?.ref ?? item?.ref ?? ''),
          descrição: String(
            p?.DESCR ??
              p?.descr ??
              item?.descrição ??
              item?.descriçãoEditada ??
              '',
          ),
          descricao: String(p?.DESCR ?? p?.descr ?? item?.descricao ?? ''),
          estoque: String(p?.QTEST ?? p?.qtest ?? item?.estoque ?? ''),
          arm_id: p?.ARM_ID ?? p?.arm_id ?? arm_id,
          margemMinima:
            Number(
              p?.MARGEM_MIN_VENDA ??
                p?.margem_min_venda ??
                item.margemMinima ??
                0,
            ) || undefined,
          // preço unitário atualizado
          precoItemEditado: unit,
          precoUnitario: unit,
          preco: unit,
          preço: unit,
          prvenda: unit,
          prunit: unit,
        };

        return recomputeItem(merged);
      } catch (err) {
        console.error('Falha ao atualizar preço do item', chave, err);
        return recomputeItem(item);
      }
    },
    [recomputeItem],
  );

  // === Cinto de segurança: garante arm_id logo na abertura ===
  React.useEffect(() => {
    try {
      const header = getJSON<any>('vendaHeaderMelo', null) || {};
      const armIdHeader = header?.arm_id ?? header?.header?.arm_id ?? null;

      if (armIdHeader != null) {
        // grava em uma chave única para qualquer rotina precisar
        sessionStorage.setItem('armIdMelo', String(armIdHeader));
      }
    } catch {}
  }, []);

  // === 1) Se draft_id === "atualizar": atualiza itens e header, uma vez ===
  React.useEffect(() => {
    let draftId: string | null = null;
    try {
      draftId = sessionStorage.getItem('vendaDraftIdMelo');
    } catch {}

    if (draftId !== 'atualizar') return;

    const header = getJSON<any>('vendaHeaderMelo', null) || {};
    const armIdHeader = header?.arm_id ?? header?.header?.arm_id;

    // lê de onde a sua tela consome (ajuste as chaves se necessário)
    const itensA = getJSON<any[]>('vendaItensMelo', []);
    const itensB = getJSON<any[]>('vendaCarrinhoMelo', []);
    const itens = itensA?.length ? itensA : itensB;

    if (!Array.isArray(itens) || itens.length === 0) {
      try {
        sessionStorage.removeItem('vendaDraftIdMelo');
      } catch {}
      return;
    }

    (async () => {
      const atualizados: any[] = [];
      for (const it of itens) {
        const novo = await refreshItemPreco(it, armIdHeader);
        atualizados.push(novo);
      }

      // regrava nos storages que a NovaVenda já consome
      setJSON('vendaItensMelo', atualizados);
      setJSON('vendaCarrinhoMelo', atualizados);

      // atualiza total no header (se sua tela não recalcular sozinha)
      try {
        const total = atualizados.reduce(
          (acc, x) => acc + n(x.vltotalItem ?? x.total_item ?? x.totitem, 0),
          0,
        );
        const novoHeader = header?.header
          ? { ...header, header: { ...header.header, totalVenda: total } }
          : { ...header, totalVenda: total };
        setJSON('vendaHeaderMelo', novoHeader);
      } catch {}

      // limpa flag
      try {
        sessionStorage.removeItem('vendaDraftIdMelo');
      } catch {}

      // se você mantém state local dos itens/totais, atualize aqui:
      // setItens(atualizados); setTotal(total);
    })();
  }, [refreshItemPreco]);

  // === 2) Hidrata dados do cliente (uma vez) quando veio de Central Vendas ===
  React.useEffect(() => {
    let veioDeCentralVendas = false;
    try {
      veioDeCentralVendas = !!sessionStorage.getItem('vendaDraftIdMelo');
    } catch {}

    if (!veioDeCentralVendas) return;

    const header = getJSON<any>('vendaHeaderMelo', null) || {};
    const h = header?.header ?? header;
    const codcli = String(h?.codcli ?? '').trim();

    // só chama buscarCliente quando for código "seco" de 5 dígitos
    if (!codcli || codcli.length !== 5) return;

    (async () => {
      try {
        // const r = await api.post('/api/vendas/dbOracle/buscarCliente', {
        const r = await api.post('/api/vendas/postgresql/buscarCliente', {
          descricao: codcli,
          pagina,
          tamanhoPagina,
          order_by: sortBy ?? undefined,
          order: sortDir ?? undefined,
        });

        const cliente = Array.isArray(r?.data?.data)
          ? r.data.data[0]
          : r?.data?.data ?? r?.data;
        if (!cliente) return;

        // merge no header atual
        const novoHeader = header?.header
          ? {
              ...header,
              header: {
                ...header.header,
                cliente,
                codcli: cliente?.codcli ?? codcli,
              },
            }
          : { ...header, cliente, codcli: cliente?.codcli ?? codcli };

        setJSON('vendaHeaderMelo', novoHeader);
      } catch (e) {
        console.error('Falha ao hidratar cliente por codcli', codcli, e);
      }
    })();
    // roda uma única vez no carregamento vindo de Central Vendas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //---------------------------------------------------
  //criar pdf no node js via api
  /* const handleCriaPdfVenda = async () => {
    if (openFim) setOpenPdf(!openPdf);
    setOpenFim(false);
  }; */

  const handleBuscarProd = async () => {
    let PRVENDA = '0';
    if (clienteSelect.codigo)
      PRVENDA = JSON.parse(
        sessionStorage.getItem('precoClienteMelo') as string,
      );

    //muda aqui a chamada de consulta ao banco
    await api
      // .post('/api/vendas/dbOracle/produto', {
      .post('/api/vendas/postgresql/produto', {
        descricao: pesquisa,
        PRVENDA,
        arm_id: selectedArmazem?.value,
      })
      .then((response) => {
        if (response.data.length) {
          setListaProd(response.data);

          const arrayProd: {
            codigo: string;
            descrição: string;
            marca: string;
            estoque: string;
            preço: string;
            ref: string;
            quantidade: string;
            descriçãoEditada: string;
            totalItem: string;
            precoItemEditado: string;
            tipoPreço: string;
            desconto: number;
            origem: string;
            margemMinima?: number;
          }[] = [];

          response.data.map((val: any) => {
            if (val.CODPROD) {
              const novo = createProduto(
                val.CODPROD,
                val.DESCR ? val.DESCR : '',
                val.MARCA ? val.MARCA : '',
                val.QTDDISPONIVEL ? String(val.QTDDISPONIVEL) : '',
                val.PRECOVENDA ? String(val.PRECOVENDA) : '',
                val.REF ? val.REF : '',
                '0',
                val.DESCR ? val.DESCR : '',
                '',
                val.PRECOVENDA ? String(val.PRECOVENDA) : '',
                tipoVenda[Number(PRVENDA)],
                0,
                val.DOLAR ? String(val.DOLAR) : '',
              );

              // >>> anexe a margem mínima para usar depois (UI + payloads)
              (novo as any).margemMinima =
                Number(val.MARGEM_MIN_VENDA ?? val.margem_min_venda ?? 0) || 0;

              // >>> anexe as promoções ativas do produto
              (novo as any).promocoes = val.PROMOCOES_ATIVAS ?? [];

              // >>> anexe o preço kickback se existir
              (novo as any).PRECO_KICKBACK = val.PRECO_KICKBACK ?? null;

              // >>> anexe o preço original da tabela (para restaurar ao desativar kickback)
              (novo as any).PRECOVENDA = val.PRECOVENDA ?? null;

              arrayProd.push(novo);
            }
          });

          setProduto(arrayProd);
          setShowProd(true);
          setLoadingProd(false);
        } else {
          setMensagem('Nenhum produto encontrado');
          setIconeInfo('none');
          setShowProd(false);
          setProduto([]);
          setProdutoRef([]);
          setLoadingProd(false);
        }
      })
      .catch((error: string) => {
        console.log(error);
        setIconeInfo('falha');
        setMensagem(
          'Não conseguimos acessar o banco de dados, comunique a equipe técnica!!!',
        );
        setShowProd(false);
        setProduto([]);
        setProdutoRef([]);
        setLoadingProd(false);
      });
  };

  //-------INÍCIO DE ATUALIZAR CLIENTE DE Central VENDAS -----------------------

  function aplicarClienteNaTela(valCli: any) {
    // resumo que você usa na UI
    setClienteSelect(
      createClienteSel(
        valCli.CODCLI ?? '',
        valCli.NOME ?? '',
        valCli.CPFCGC ?? '',
        valCli.NOMEFANT ?? '',
        Number(valCli.DEBITO ?? 0) * -1, // seu saldo é tratado como "atual - débito"
        String(valCli.STATUS ?? ''),
        Number(valCli.DESCONTO ?? 0),
        String(valCli.IPI ?? ''),
        String(valCli.ICMS ?? ''),
        String(valCli.ZONA ?? ''),
        String(valCli.CLASPGTO ?? ''),
        String(valCli.UF ?? ''),
        String(valCli.TIPO ?? ''),
        Number(valCli.LIMITE ?? 0),
        Number(valCli.ATRASO ?? 0),
        String(valCli.PRVENDA ?? ''),
        String(valCli.CODVEND ?? ''),
        String(valCli.FONE ?? ''),
        String(valCli.ENDER ?? ''),
        String(valCli.BAIRRO ?? ''),
        String(valCli.CIDADE ?? ''),
        String(valCli.CEP ?? ''),
        Boolean(valCli.KICKBACK),
      ),
    );

    // lista “completa” (igual você já monta em buscarCliente)
    setListaCliente([
      createListaCliente(
        valCli.LIMITE_DISPONIVEL,
        valCli.ACRESCIMO,
        valCli.ATRASO,
        valCli.BAIRRO,
        valCli.BAIRROCOBR,
        valCli.BANCO,
        valCli.BLOQUEAR_PRECO,
        valCli.CEP,
        valCli.CEPCOBR,
        valCli.CIDADE,
        valCli.CIDADECOBR,
        valCli.CLASPGTO,
        valCli.CODBAIRRO,
        valCli.CODBAIRROCOBR,
        valCli.CODCC,
        valCli.CODCLI,
        valCli.CODMUNICIPIO,
        valCli.CODMUNICIPIOCOBR,
        valCli.CODPAIS,
        valCli.CODPAISCOBR,
        valCli.CODTMK,
        valCli.CODUNICO,
        valCli.CODVEND,
        valCli.COMPLEMENTO,
        valCli.COMPLEMENTOCOBR,
        valCli.CONTATO,
        valCli.CPFCGC,
        valCli.DATACAD,
        valCli.DEBITO,
        valCli.DESCONTO,
        valCli.EMAIL,
        valCli.EMAILNFE,
        valCli.ENDER,
        valCli.ENDERCOBR,
        valCli.FAIXAFIN,
        valCli.HABILITASUFRAMA,
        valCli.ICMS,
        valCli.IEST,
        valCli.IMUN,
        valCli.IPI,
        valCli.ISUFRAMA,
        valCli.KICKBACK,
        valCli.LIMITE,
        valCli.LOCAL_ENTREGA,
        valCli.NOME,
        valCli.NOMEFANT,
        valCli.NUMERO,
        valCli.NUMEROCOBR,
        valCli.OBS,
        valCli.PRVENDA,
        valCli.REFERENCIA,
        valCli.REFERENCIACOBR,
        valCli.SIT_TRIBUTARIA,
        valCli.SOCIOS,
        valCli.STATUS,
        valCli.TIPO,
        valCli.TIPOCLIENTE,
        valCli.TIPOEMP,
        valCli.UF,
        valCli.UFCOBR,
      ),
    ]);

    // classe/tabela de preço do cliente — você já usa em vários lugares
    const classe = String(valCli.PRVENDA ?? '');
    setPrecoCliente(classe);
    try {
      sessionStorage.setItem('precoClienteMelo', JSON.stringify(classe));
    } catch {}

    // Preenche “Entrega” com “CODIGO - NOME”
    const localEntrega = (valCli.LOCAL_ENTREGA ?? '').trim();
    if (localEntrega) {
      // split “CODIGO - NOME” se quiser exibir os 2 campos no dropdown
      const [codigo, ...rest] = localEntrega.split(' - ');
      setLocalSel({
        codigo: (codigo ?? '').trim(),
        nome: rest.join(' - ').trim(),
      });
      setCheckLocal(true);
    }

    // Por fim, persiste no META **apenas depois da hidratação**
    if (sessionStorage.getItem('novavenda_hydrate_done') === '1') {
      try {
        const raw = sessionStorage.getItem('metaVendaMelo');
        const meta = raw ? JSON.parse(raw) : {};
        const next = {
          ...meta,
          // leve snapshot útil para reload:
          clienteSelect: {
            codigo: valCli.CODCLI ?? '',
            nome: valCli.NOME ?? '',
            documento: valCli.CPFCGC ?? '',
            nomeFantasia: valCli.NOMEFANT ?? '',
          },
          localSel: localEntrega
            ? {
                codigo: (localEntrega.split(' - ')[0] ?? '').trim(),
                nome: (
                  localEntrega.split(' - ').slice(1).join(' - ') ?? ''
                ).trim(),
              }
            : meta.localSel,
          checkLocal: !!localEntrega,
          precoCliente: classe,
        };
        sessionStorage.setItem('metaVendaMelo', JSON.stringify(next));
      } catch {}
    }
  }
  React.useEffect(() => {
    // Só tenta se a tela veio de Central Vendas (tem draft_id salvo)
    let draftId: string | null = null;
    try {
      draftId = sessionStorage.getItem('vendaDraftIdMelo');
    } catch {}
    if (!draftId) return;

    // Header/snapshot gravado por Central Vendas
    let header: any = null;
    try {
      header = JSON.parse(sessionStorage.getItem('vendaHeaderMelo') || 'null');
    } catch {}

    const codcli = String(
      header?.codcli ?? header?.header?.codcli ?? '',
    ).trim();

    if (!codcli) return; // sem cliente no draft/header, não faz nada

    (async () => {
      try {
        const { data } = await api.post(
          // '/api/vendas/dbOracle/buscarCliente',
          '/api/vendas/postgresql/buscarCliente',
          { descricao: codcli, pagina: 0, tamanhoPagina: 1 },
        );

        const rows = data?.data ?? data ?? [];
        if (!Array.isArray(rows) || rows.length === 0) return;

        const valCli =
          rows.find((r: any) => String(r?.CODCLI ?? '').trim() === codcli) ||
          rows[0];

        aplicarClienteNaTela(valCli);
      } catch (e) {
        console.error('Auto-hidratar cliente do draft falhou:', e);
      }
    })();
  }, []);

  //-------FIM DE ATUALIZAR CLIENTE DE Central VENDAS -----------------------

  const handleBuscarCliente = React.useCallback(async () => {
    setLoadingCli(true);
    // setShowCli(false);

    await api
      // .post('/api/vendas/dbOracle/buscarCliente', {
      .post('/api/vendas/postgresql/buscarCliente', {
        descricao: pesquisaCli,
        pagina,
        tamanhoPagina,
        order_by: sortBy ?? undefined,
        order: sortDir ?? undefined,
      })
      .then((response) => {
        if (response.data.data?.length) {
          // Lista com todos os dados do cliente para uso posterior

          const arrayListaCli = response.data.data.map((valCli: client) =>
            createListaCliente(
              valCli.LIMITE_DISPONIVEL,
              valCli.ACRESCIMO,
              valCli.ATRASO,
              valCli.BAIRRO,
              valCli.BAIRROCOBR,
              valCli.BANCO,
              valCli.BLOQUEAR_PRECO,
              valCli.CEP,
              valCli.CEPCOBR,
              valCli.CIDADE,
              valCli.CIDADECOBR,
              valCli.CLASPGTO,
              valCli.CODBAIRRO,
              valCli.CODBAIRROCOBR,
              valCli.CODCC,
              valCli.CODCLI,
              valCli.CODMUNICIPIO,
              valCli.CODMUNICIPIOCOBR,
              valCli.CODPAIS,
              valCli.CODPAISCOBR,
              valCli.CODTMK,
              valCli.CODUNICO,
              valCli.CODVEND,
              valCli.COMPLEMENTO,
              valCli.COMPLEMENTOCOBR,
              valCli.CONTATO,
              valCli.CPFCGC,
              valCli.DATACAD,
              valCli.DEBITO,
              valCli.DESCONTO,
              valCli.EMAIL,
              valCli.EMAILNFE,
              valCli.ENDER,
              valCli.ENDERCOBR,
              valCli.FAIXAFIN,
              valCli.HABILITASUFRAMA,
              valCli.ICMS,
              valCli.IEST,
              valCli.IMUN,
              valCli.IPI,
              valCli.ISUFRAMA,
              valCli.KICKBACK,
              valCli.LIMITE,
              valCli.LOCAL_ENTREGA,
              valCli.NOME,
              valCli.NOMEFANT,
              valCli.NUMERO,
              valCli.NUMEROCOBR,
              valCli.OBS,
              valCli.PRVENDA,
              valCli.REFERENCIA,
              valCli.REFERENCIACOBR,
              valCli.SIT_TRIBUTARIA,
              valCli.SOCIOS,
              valCli.STATUS,
              valCli.TIPO,
              valCli.TIPOCLIENTE,
              valCli.TIPOEMP,
              valCli.UF,
              valCli.UFCOBR,
            ),
          );

          const arrayCliente = response.data.data.map((val: any) =>
            createCliente(
              val.CODCLI,
              val.NOME,
              val.CPFCGC,
              val.NOMEFANT,
              val.LIMITE_DISPONIVEL,
            ),
          );
          setListaCliente(arrayListaCli);

          setCliente(arrayCliente);
          setTotalClientes(response.data.total);
          //  setShowCli(true);
        } else {
          setMensagem('Nenhum Cliente encontrado');
          //  setShowCli(false);
          setCliente([]);
        }

        setLoadingCli(false);
      })
      .catch((error: any) => {
        console.log(error);
        setMensagem('Erro ao buscar clientes');
        setIconeInfo('falha');
        // setShowCli(false);
        setCliente([]);
        setLoadingCli(false);
      });
  }, [pesquisaCli, pagina, tamanhoPagina, sortBy, sortDir]);

  const produtoSelecionado = async (novoLabel: string) => {
    if (listaProd.length) {
      if (novoLabel !== '-1') {
        const newItemProd = listaProd[Number(novoLabel)];
        setLoadingRef(true);

        if (newItemProd.CODGPE) {
          let PRVENDA = '0';
          if (clienteSelect.codigo) {
            PRVENDA = JSON.parse(
              sessionStorage.getItem('precoClienteMelo') as string,
            );
          }

          await api
            //  .post('/api/vendas/dbOracle/produtoEquival', {
            .post('/api/dbOracle/produtoEquival', {
              CODGPE: newItemProd.CODGPE,
              PRVENDA,
            })
            .then((response) => {
              if (response.data.length) {
                const arrayProd: {
                  codigo: string;
                  descrição: string;
                  marca: string;
                  estoque: string;
                  preço: string;
                  ref: string;
                  quantidade: string;
                  descriçãoEditada: string;
                  totalItem: string;
                  precoItemEditado: string;
                  tipoPreço: string;
                  desconto: number;
                  origem: string;
                  margemMinima?: number;
                }[] = [];

                response.data.map((val: any) => {
                  if (val.CODPROD && val.CODPROD !== newItemProd.CODPROD) {
                    const newPerfil: any = {
                      ...createProduto(
                        val.CODPROD,
                        val.DESCR ? val.DESCR : '',
                        val.MARCA ? val.MARCA : '',
                        val.QTDDISPONIVEL ? String(val.QTDDISPONIVEL) : '',
                        val.PRECOVENDA ? String(val.PRECOVENDA) : '',
                        val.REF ? val.REF : '',
                        '0',
                        val.DESCR ? val.DESCR : '',
                        '',
                        val.PRECOVENDA ? String(val.PRECOVENDA) : '',
                        tipoVenda[Number(precoCliente)],
                        0,
                        val.DOLAR ? String(val.DOLAR) : '',
                      ), // os 13 parâmetros originais
                      promocoes: val.PROMOCOES_ATIVAS ?? [],
                    };

                    // >>> AQUI setamos a margem mínima vinda do endpoint
                    newPerfil.margemMinima =
                      Number(
                        val.MARGEM_MIN_VENDA ?? val.margem_min_venda ?? 0,
                      ) || 0;

                    arrayProd.push(newPerfil);
                  }
                  return 0;
                });

                setProdutoRef(arrayProd);
                setLoadingRef(false);
              }
            })
            .catch((error: string) => {
              setLoadingRef(false);
              console.log('error busca equivalente', error);
            });
        } else {
          setProdutoRef([
            {
              codigo: 'sem referencia',
              descrição: 'produto',
              marca: '',
              estoque: '',
              preço: '',
              ref: '',
              quantidade: '0',
              descriçãoEditada: '',
              totalItem: '',
              precoItemEditado: '',
              tipoPreço: '',
              desconto: 0,
              origem: '',
            },
          ]);
          setLoadingRef(false);
        }
      } else {
        setProdutoRef([
          {
            codigo: 'nenhum',
            descrição: 'produto',
            marca: '',
            estoque: '',
            preço: '',
            ref: '',
            quantidade: '0',
            descriçãoEditada: '',
            totalItem: '',
            precoItemEditado: '',
            tipoPreço: '',
            desconto: 0,
            origem: '',
          },
        ]);
      }
    }
  };

  const clienteSelecionado = async (novoLabel: string) => {
    setPrecoCliente(listaCliente[Number(novoLabel)].PRVENDA);
    setDadosClienteSel(cliente[Number(novoLabel)]);
    setLoadingCli(true);

    let saldo = 0;
    await api
      .post('/api/dbOracle/buscarCreditoTemp', {
        codClient: cliente[Number(novoLabel)].codigo,
      })
      .then((response) => {
        if (response.data.length) {
          saldo = response.data[0].SALDO;
        } else {
          saldo = listaCliente[Number(novoLabel)].LIMITE_DISPONIVEL;
        }
      })
      .catch((error: string) => {
        console.log(error);
      });

    await api
      // .post('/api/vendas/dbOracle/buscarAtraso', {
      .post('/api/vendas/postgresql/buscarAtraso', {
        codClient: cliente[Number(novoLabel)].codigo,
      })
      .then((response) => {
        const d1 = response.data[0].DT_MIN;
        let diffInMs = 0;
        if (d1) diffInMs = Number(new Date()) - Number(new Date(d1));
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        const newClienteSelecionado = createClienteSel(
          cliente[Number(novoLabel)].codigo,
          cliente[Number(novoLabel)].nome,
          cliente[Number(novoLabel)].documento,
          cliente[Number(novoLabel)].nomeFantasia,
          Number(saldo.toFixed(2)),
          listaCliente[Number(novoLabel)].STATUS,
          listaCliente[Number(novoLabel)].DESCONTO,
          listaCliente[Number(novoLabel)].IPI,
          listaCliente[Number(novoLabel)].ICMS,
          'zona',
          listaCliente[Number(novoLabel)].CLASPGTO,
          listaCliente[Number(novoLabel)].UF,
          listaCliente[Number(novoLabel)].TIPO,
          listaCliente[Number(novoLabel)].ATRASO,
          Number(diffInDays.toFixed()),
          tipoVenda[Number(listaCliente[Number(novoLabel)].PRVENDA)],
          listaCliente[Number(novoLabel)].CODVEND,
          listaCliente[Number(novoLabel)].CONTATO,
          listaCliente[Number(novoLabel)].ENDER,
          listaCliente[Number(novoLabel)].BAIRRO,
          listaCliente[Number(novoLabel)].CIDADE,
          listaCliente[Number(novoLabel)].CEP,
          listaCliente[Number(novoLabel)].KICKBACK,
        );
        setClienteSelect(newClienteSelecionado);
        if (newClienteSelecionado.nome)
          setLocalSel({
            codigo: newClienteSelecionado.codigo,
            nome: newClienteSelecionado.nome,
          });
        const dataAgora = new Date();
        const codigoPedido = ` ${dataAgora.getDate()}${dataAgora.getMonth()}${dataAgora.getFullYear()}${dataAgora.getHours()}${dataAgora.getMinutes()}${dataAgora.getSeconds()}-${
          newClienteSelecionado.codigo
        }`;
        setNPedido(codigoPedido);
      })
      .catch((error: string) => {
        console.log(error);
      });
    setLoadingCli(false);
  };
  const telaSelecionada = (novoLabel: string | number) => {
    const destino = String(novoLabel);

    if (destino === '2' && !hasVendedor) {
      // limpa carrinho se houver algo
      if ((carrinho?.length ?? 0) > 0) {
        setCarrinho([]);
        resetPersistenciaVenda(true);
        try {
          sessionStorage.setItem('carrinhoMelo', JSON.stringify([]));
        } catch {}
      }

      // <<< chaveia a TELA 1 para o BLOCO DE MENSAGEM >>>
      setLoadingProd(false); // garante que não apareça o spinner
      setShowProd(false); // esconde a lista de resultados
      setMensagem(MSG_SEM_VENDEDOR); // usa sua msg de 2 linhas
      setIconeInfo('falha'); // mostra o ícone vermelho
      setDentroProd(false); // (opcional) tira o estado de foco/busca
      setProduto([]); // (opcional) limpa arrays
      setProdutoRef([]); // (opcional) limpa arrays
      setPesquisa(''); // (opcional) zera o input

      toast.error?.('Vendedor não associado ao perfil.');
      return; // não navega para a tela 2
    }

    // navegação normal
    setBloqueioCarrinho(false); // fecha se estiver aberto
    setTela(destino);
  };

  const handleFocusCli = () => {
    if (cliInputRef.current) cliInputRef.current.focus();
  };
  const handleCarrinho = async (novoCar: {
    codigo: string;
    descrição: string;
    marca: string;
    estoque: string;
    preço: string;
    ref: string;
    quantidade: string;
    descriçãoEditada: string;
    totalItem: string;
    precoItemEditado: string;
    tipoPreço: string;
    desconto: number;
    origem: string;
    margemMinima?: number;
  }) => {
    if (!selectedArmazem?.value) {
      toast.error('Selecione um ARMAZÉM antes de adicionar itens.');
      return;
    }

    // >>> NOVO: calcula impostos deste item (quando quantidade > 0)
    const precisaManter = novoCar.quantidade !== '0';
    let impostoDoItem: {
      impostos?: any;
      aliquotas?: any;
      debugImposto?: any;
    } = {};

    if (precisaManter && clienteSelect?.codigo) {
      try {
        const params = buildCalcParamsFromItem(novoCar, {
          clienteCodigo: clienteSelect.codigo,
          documentoCOD_OPERACAO: documento?.COD_OPERACAO,
          uf_empresa: dadosEmpresa.UF,
        });
        const result = await calcImposto(params);
        impostoDoItem = {
          // Agora “impostos” vai com os VALORES EM R$ para o item:
          impostos: result.impostosRs, // <-- (novo) R$ por tributo + totalComImpostos
          aliquotas: result.aliquotas, // mantém igual
          debugImposto: {
            percentuais: result.cardsPercent, // (opcional) % efetivos do motor
            brutoMotor: result.cards, // (opcional) valores na escala da base
            baseCalculo: result?.debug?.input?.baseCalculo ?? null,
          },
        };
      } catch (e) {
        console.error('Erro ao calcular impostos do item:', e);
        // segue sem impostos; se quiser, exiba toast aqui
      }
    }

    // Usar callback funcional para evitar race conditions
    // (quando duas chamadas rápidas chegam antes do state atualizar)
    setCarrinho((oldArray) => {
      // Verificar se item já existe no array ATUAL (não no snapshot externo)
      const existingIndex = oldArray.findIndex(
        (val) => String(val.codigo) === String(novoCar.codigo)
      );

      if (existingIndex !== -1) {
        // Item já existe - atualizar ou remover
        if (precisaManter) {
          const newArray = [...oldArray];
          newArray[existingIndex] = { ...novoCar, ...impostoDoItem };
          return newArray;
        } else {
          // Remover item
          if (oldArray.length === 1) {
            sessionStorage.setItem('carrinhoMelo', JSON.stringify([]));
          }
          return oldArray.filter((_, idx) => idx !== existingIndex);
        }
      } else if (precisaManter) {
        // Item não existe - adicionar
        return [...oldArray, { ...novoCar, ...impostoDoItem }];
      }

      // quantidade = 0 e item não existe: manter array como está
      return oldArray;
    });
  };

  //=================================================
  // receber qual vendedor foi selecionado
  //+++++++++++++++++++++++++++++++++++++++++++++++++

  const handleTransporteSel = (novoTranporte: {
    CODTPTRANSP: string;
    DESCR: string;
  }) => {
    setTransporteSel(novoTranporte);
    setObrigTransporte(false);
  };

  //--------------------------------------------------
  //recuperar carrinho quando a pagina for atualizada
  //-------------------------------------------------
  React.useEffect(() => {
    const resultCar = JSON.parse(
      sessionStorage.getItem('carrinhoMelo') as string,
    );
    const resultCliSel = JSON.parse(
      sessionStorage.getItem('clienteSelectMelo') as string,
    );
    const resultDadosCliSel = JSON.parse(
      sessionStorage.getItem('dadosClienteSelMelo') as string,
    );
    const nPedidoSalvo = JSON.parse(
      sessionStorage.getItem('nPedidoMelo') as string,
    );
    if (nPedidoSalvo) setNPedido(nPedidoSalvo);
    // resultado = result.id;

    if (resultCar && resultCar.length) {
      setCarrinho(resultCar);
      setTela('2');
    }
    if (resultCliSel) setClienteSelect(resultCliSel);
    if (resultDadosCliSel) setDadosClienteSel(resultDadosCliSel);

    api
      .post('/api/vendas/postgresql/buscarVendedor')
      //  .post('/api/vendas/dbOracle/buscarVendedor')
      .then((response) => {
        if (response.data) setDadosVendedor(response.data);
      })
      .catch((error: string) => {
        console.log(error);
      });
    api
      .post('/api/dbOracle/buscarEmpresa')
      .then((response) => {
        if (response.data) setDadosEmpresa(response.data[0]);
      })
      .catch((error: string) => {
        console.log(error);
      });
    api
      .post<TransporteOption[]>('/api/dbOracle/buscarTransporte')
      .then((response) => {
        const rows = Array.isArray(response.data) ? response.data : [];
        setDadosTransporte(dedupeTransporte(rows));
      });

    api
      .post('/api/dbOracle/buscarDocumento')
      .then((response) => {
        if (response.data) setDadosDocumento(response.data);
      })
      .catch((error: string) => {
        console.log(error);
      });
  }, []);

  //-------------------------------------------------
  //armazenar no navegador o carrinho
  //-------------------------------------------------
  React.useEffect(() => {
    // --- totais
    let newTotal = 0;
    for (const it of carrinho) {
      const t = toN((it as any).totalItem);
      newTotal += t;
    }
    newTotal = round2(newTotal);

    let newTotalSemDesconto = 0;
    for (const it of carrinho) {
      const preco = toN(
        (it as any).precoItemEditado ?? (it as any).preço ?? (it as any).preco,
      );

      const qtd = toN((it as any).quantidade);
      newTotalSemDesconto += qtd * preco;
    }
    newTotalSemDesconto = round2(newTotalSemDesconto);

    setTotalVenda(newTotal);
    setTotalVendaSemDesconto(newTotalSemDesconto);

    // --- flags auxiliares existentes (DESCONTO > 2%)
    const checkBlocDesc = carrinho.filter((val) => Number(val.desconto) > 2);
    const checkObsFat = carrinho.filter((val) => Number(val.desconto) !== 0);
    const arrDescTodos = carrinho.filter(
      (val) => val.desconto === Number(descontoTodos) && val.desconto,
    );
    setDescontoTodosAtivo(arrDescTodos.length > 0);

    if (checkBlocDesc.length) {
      setBlocDesc(true);
    } else {
      setBlocDesc(false);
    }

    // ===========================================================
    // BLOQUEIO POR PREÇO EDITADO (sem calcular preço mínimo aqui)
    // Regras:
    // 1) Sem BPV e sem MPV -> bloquear se houver diferença PARA BAIXO
    //    entre preço da tabela e precoItemEditado.
    // 2) Com BPV (tenha ou não MPV) -> nunca bloqueia por preço.
    // 3) Sem BPV mas com MPV -> não bloqueia.
    // ===========================================================
    const funcoes = (perfilUser?.funcoes ?? []) as string[];
    const hasBPV = !!funcoes?.includes('BPV');
    const hasMPV = !!funcoes?.includes('MPV');

    let blockByPrecoEdit = false;

    if (!hasBPV && !hasMPV) {
      const EPS = 1e-6;

      for (const it of carrinho ?? []) {
        const precoTabela = toN((it as any).preço ?? (it as any).preco ?? 0);
        const precoEditado = toN(
          (it as any).precoItemEditado ??
            (it as any).preço ??
            (it as any).preco ??
            0,
        );

        // BLOQUEIA só se editou para BAIXO
        const editedBelow = precoEditado < precoTabela - EPS;
        if (editedBelow) {
          blockByPrecoEdit = true;
          break;
        }
      }
    }
    // ======= AQUI é o bloqueio "oficial" da tela =======
    if (checkBlocDesc.length > 0 || blockByPrecoEdit) {
      setBlocDesc(true);
    } else {
      setBlocDesc(false);
    }
    // hasBPV => nunca bloqueia por preço; (hasMPV sem BPV também não bloqueia)

    // Sinalização global de bloqueio (preço editado OU desconto>2%)
    // liga a flag dedicada a preço editado
    setBlocPrecoEdit(blockByPrecoEdit);

    // status textual (se você quiser manter esse label)
    const blockNow = blockByPrecoEdit || checkBlocDesc.length > 0;
    setStatusVenda(blockNow ? 'VENDA BLOQUEADA' : 'VENDA LIBERADA');

    // --- persiste carrinho/preço cliente (como já fazia)
    if (carrinho.length) {
      sessionStorage.setItem('carrinhoMelo', JSON.stringify(carrinho));
    }
    if (precoCliente) {
      sessionStorage.setItem('precoClienteMelo', JSON.stringify(precoCliente));
    }

    // ==========================
    // NÃO sobrescrever pagamento se já houver meta salva
    // ==========================
    let hasMetaPayment = false;
    try {
      const raw = sessionStorage.getItem('metaVendaMelo');
      if (raw) {
        const meta = JSON.parse(raw);
        hasMetaPayment =
          (meta?.fPagamento && String(meta.fPagamento).length > 0) ||
          (meta?.obsFat && String(meta.obsFat).length > 0) ||
          typeof meta?.vista === 'boolean' ||
          typeof meta?.statusFPagamento === 'boolean';
      }
    } catch {}

    if (hasMetaPayment) return;

    // ==========================
    // Sem meta: aplicar DEFAULTS + regras automáticas (inalteradas)
    // ==========================
    let nextObsFat = '';
    let nextAvista = false;
    let nextStatusFPagamento = true;
    let nextFPagamento = '';

    if (checkObsFat.length) {
      nextObsFat = 'À VISTA (VE)';
      nextAvista = true;
      nextStatusFPagamento = false;
    }

    const clas = (clienteSelect?.CLASPGTO || '').toUpperCase();
    if (clas === 'V') {
      nextObsFat = 'À VISTA (V)';
      nextAvista = true;
      nextStatusFPagamento = false;
    } else if (clas === 'D') {
      nextObsFat = 'À VISTA (D)';
      nextAvista = true;
      nextStatusFPagamento = false;
    }

    if (carrinho.length === 0 && !checkObsFat.length && !clas) {
      nextObsFat = '';
      nextAvista = false;
      nextStatusFPagamento = true;
      nextFPagamento = '';
    }

    setObsFat(nextObsFat);
    setAvista(nextAvista);
    setStatusFPagamento(nextStatusFPagamento);
    setFPagamento(nextFPagamento);
  }, [carrinho, descontoTodos, clienteSelect, precoCliente, perfilUser]);

  //-------------------------------------------------
  React.useEffect(() => {
    let statusInicial = 'VENDA LIBERADA';
    if (totalVenda < 30) statusInicial = 'VALOR MINIMO R$ 30,00';
    if (blocDesc && !blocFin) statusInicial = 'VENDA BLOQUEADA';
    if (blocFin) statusInicial = 'BLOQUEIO FINANCEIRO';
    setStatusVenda(statusInicial);
  }, [blocDesc, blocFin, totalVenda]);

  React.useEffect(() => {
    sessionStorage.setItem('documentoVendaMelo', JSON.stringify(documento));
  }, [documento]);
  React.useEffect(() => {
    sessionStorage.setItem('prazoVendaMelo', JSON.stringify(prazosArray));
  }, [prazosArray]);

  React.useEffect(() => {
    sessionStorage.setItem('nPedidoMelo', JSON.stringify(nPedido));
  }, [nPedido]);

  React.useEffect(() => {
    if (vendedorSel && clienteSelect) {
      if (clienteSelect.codigo !== '') {
        sessionStorage.setItem(
          'clienteSelectMelo',
          JSON.stringify(clienteSelect),
        );
      }

      if (clienteSelect?.codigo !== '' && vendedorSel?.codigo === '') {
        const vendedorCliente = dadosVendedor.filter(
          (val) => val.CODVEND === clienteSelect.CODVEND,
        );
        if (vendedorCliente.length)
          setVendedorSel({
            nome: vendedorCliente[0].NOME,
            codigo: vendedorCliente[0].CODVEND,
          });
      } else {
        // sessionStorage.setItem('vendedorSelMelo', JSON.stringify(vendedorSel));
      }
    }
  }, [clienteSelect, dadosVendedor, vendedorSel, nPedido]);

  React.useEffect(() => {
    if (dadosClienteSel.codigo !== '') {
      sessionStorage.setItem(
        'dadosClienteSelMelo',
        JSON.stringify(dadosClienteSel),
      );
    }
  }, [dadosClienteSel]);
  //------------------------------------------
  React.useEffect(() => {
    sessionStorage.setItem('clienteMelo', JSON.stringify(dadosClienteSel));
    setProduto([]);
    setProdutoRef([]);
  }, [dadosClienteSel]);

  React.useEffect(() => {
    //apontar focu produto e bloquio financeiro
    if (clienteSelect && clienteSelect.codigo) {
      if (clienteSelect.diasAtrasado <= clienteSelect.limiteAtraso) {
        if (prodInputRef.current && tela === '0') prodInputRef.current.focus();
        setBlocFin(false);
      } else {
        setOpenInfoCliente(true);
        setBlocFin(true);
      }
    }
  }, [clienteSelect, prodInputRef, tela]);

  // limpa somente a Entrada (localSel + checkLocal) e o que estiver salvo no META
  const clearEntrada = React.useCallback(() => {
    try {
      const raw = sessionStorage.getItem('metaVendaMelo');
      const meta = raw ? JSON.parse(raw) : {};
      delete meta.localSel;
      delete meta.checkLocal;
      sessionStorage.setItem('metaVendaMelo', JSON.stringify(meta));
    } catch {}
    setLocalSel({ codigo: '', nome: '' });
    setCheckLocal(false);
  }, []);

  function resetPersistenciaVenda(preserveEntrada: boolean = true) {
    // 1) Captura Entrada atual (se for para preservar)
    let keepLocal: {
      localSel?: { codigo: string; nome: string };
      checkLocal?: boolean;
    } | null = null;

    try {
      const raw = sessionStorage.getItem(META_KEY);
      const meta = raw ? JSON.parse(raw) : {};
      if (
        preserveEntrada &&
        (meta?.localSel || typeof meta?.checkLocal === 'boolean')
      ) {
        keepLocal = {
          localSel: meta.localSel ?? { codigo: '', nome: '' },
          checkLocal: !!meta.checkLocal,
        };
      }
    } catch {}

    // 2) Limpa chaves individuais usadas na tela
    [
      'formaPagamentoMelo',
      'condicaoPagamentoMelo',
      'prazoVendaMelo',
      'prazoMelo',

      'transpVendaMelo',
      'codtptranspMelo',
      'vlrFreteMelo',
      'obsVendaMelo',
      'obsFaturamentoMelo',
      'vendedorMelo',
      'operadorMelo',
      'nPedidoMelo',
      'totalVendaMelo',
      'vendaHeaderMelo',
    ].forEach((k) => {
      try {
        sessionStorage.removeItem(k);
      } catch {}
    });

    // 3) Regrava o META mantendo apenas a Entrada (se solicitado)
    try {
      const nextMeta = preserveEntrada && keepLocal ? { ...keepLocal } : {};
      sessionStorage.setItem(META_KEY, JSON.stringify(nextMeta));
    } catch {}

    // 4) Reset de estados (valores coerentes com seus inícios)
    // textos / pagamento
    setObs(''); // string
    setObsFat(''); // string
    setFPagamento(''); // string
    setAvista(false); // boolean
    setStatusFPagamento(true); // boolean

    // prazos
    setPrazosArray([]); // array
    setPrazo(''); // string
    setPedido('');
    // frete
    setValTransp(''); // string "R$ ..."
    setValTranspDec(0); // number
    setTransporteSel({ CODTPTRANSP: '', DESCR: '' }); // objeto

    // seleções
    setDocumento({ COD_OPERACAO: '', DESCR: '' }); // objeto
    setVendedorSel({ codigo: '', nome: '' }); // objeto
    setOperadorSel({ codigo: '', nome: '' }); // objeto
    setCheckOperador(false);

    //pedido
    setNPedido('');
    // requisicao
    setRequisição(''); // string

    // Entrada (somente quando NÃO for preservar)
    if (!preserveEntrada) {
      setLocalSel({ codigo: '', nome: '' }); // objeto
      setCheckLocal(false); // boolean
    }
  }

  const handleLocal = (local: { codigo: string; nome: string }) => {
    if (local.nome !== 'fechar Local') setLocalSel(local);
    else {
      setCheckLocal(!checkLocal);
      setLocalSel({ codigo: clienteSelect.codigo, nome: clienteSelect.nome });
    }
    setOpenLocal(false);
  };

  const handleOperador = (operador: { codigo: string; nome: string }) => {
    if (operador.nome !== 'fechar Operador') {
      setOperadorSel(operador);
      // setCheckOperador(!checkOperador);
    } else {
      setCheckOperador(!checkOperador);
      setOperadorSel({ codigo: '', nome: '' });
    }
    setOpenOperador(false);
  };

  const handleVendedor = (vendedor: { codigo: string; nome: string }) => {
    if (vendedor.nome !== 'fechar vendedor') {
      setVendedorSel(vendedor);
      //setCheckVendedor(!checkVendedor);
    } else {
      setCheckVendedor(!checkVendedor);
      const vendedorCliente = dadosVendedor.filter(
        (val) => val.CODVEND === clienteSelect.CODVEND,
      );
      if (vendedorCliente.length)
        setVendedorSel({
          nome: vendedorCliente[0].NOME,
          codigo: vendedorCliente[0].CODVEND,
        });
    }
    setOpenVendedor(false);
  };

  // use SEMPRE para mudar desconto de UMA linha do carrinho

  //-----------------------------------------
  //Atualizar desconto
  //-----------------------------------------
  // aplica desconto para todos os itens e recalcula os impostos
  // SUBSTITUA a função inteira por esta
  const handleAtualizarDesc = async (dadosDesc: {
    status: boolean;
    novoDesc: string;
  }) => {
    // proteção básica
    if (dadosDesc?.novoDesc == null) return;

    // percentual (ex.: "1", "1,5" etc.)
    const novoDescontoPct = toN(dadosDesc.novoDesc); // <= usa seu util que entende vírgula
    setDescontoTodos(novoDescontoPct);

    // 1) Recalcula o subtotal (totalItem) LÍQUIDO de cada item
    const EPS = 1e-6; // pode ficar no topo do arquivo; se já existir, reutilize

    const itensComSubtotal = (carrinho || []).map((it) => {
      const qtd = toN(it.quantidade);
      const preco = toN((it as any).precoItemEditado ?? (it as any).preço);

      const bruto = qtd * preco;

      // trava desconto se o preço foi editado para baixo
      const pTabela = toN((it as any).preço ?? (it as any).preco ?? 0);
      const pEdit = toN(
        (it as any).precoItemEditado ??
          (it as any).preço ??
          (it as any).preco ??
          0,
      );
      const editedBelow = pEdit < pTabela - EPS;

      // se editedBelow => total fica igual ao bruto (sem desconto) e desconto = 0
      const liquido = editedBelow
        ? bruto
        : +(bruto * (1 - novoDescontoPct / 100)).toFixed(2);

      return {
        ...it,
        totalItem: String(liquido),
        desconto: editedBelow ? 0 : novoDescontoPct,
        descriçãoEditada: it.descriçãoEditada
          ? it.descriçãoEditada
          : it.descrição,
      };
    });

    // 2) Recalcula impostos para TODOS os itens com base no NOVO subtotal
    const ctx = {
      clienteCodigo: clienteSelect?.codigo || '',
      documentoCOD_OPERACAO: documento?.COD_OPERACAO,
    };

    const itensRecalculados = await Promise.all(
      itensComSubtotal.map(async (item) => {
        try {
          if (!ctx.clienteCodigo) return item;

          const base = buildCalcParamsFromItem(item, ctx); // já existe no seu arquivo
          const params = {
            ...base,
            usarAuto: false, // força usar o subtotal que passamos
            totalItem: toN(item.totalItem), // << líquido em R$
          };

          const result = await calcImposto(params);
          console.log('result imposto', result);

          return {
            ...item,
            // IMPORTANTE: usa os VALORES em R$ vindos do motor
            impostos: result.impostosRs,
            aliquotas: result.aliquotas,
            debugImposto: {
              percentuais: result.cardsPercent,
              brutoMotor: result.cards,
              baseCalculo:
                result?.debug?.input?.baseCalculo ??
                result?.debug?.baseCalculo ??
                null,
            },
          };
        } catch (e) {
          console.error('Erro ao recalcular imposto (descontoTodos):', e);
          return item;
        }
      }),
    );

    // 3) Seta no carrinho (o restante dos totais da tela já é derivado do carrinho)
    setCarrinho(itensRecalculados);
  };

  //só usar se tiver a necessidade de calcular tudo novamente
  //em caso de mudanças de dados que precise
  async function _recalcularCarrinhoInteiro() {
    if (!clienteSelect?.codigo || !carrinho.length) return;

    const ctx = {
      clienteCodigo: clienteSelect.codigo,
      documentoCOD_OPERACAO: documento?.COD_OPERACAO,
    };
    const novos = await Promise.all(
      carrinho.map(async (item) => {
        try {
          const params = buildCalcParamsFromItem(item, ctx);
          const res = await calcImposto(params);
          return {
            ...item,
            impostos: res.cards,
            aliquotas: res.aliquotas,
            debugImposto: res.debug,
          };
        } catch {
          return item;
        }
      }),
    );
    setCarrinho(novos);
  }

  const handleDocumento = (dadosDoc: {
    COD_OPERACAO: string;
    DESCR: string;
  }) => {
    setDocumento(dadosDoc);
  };
  const handleFPagamento = (value: string) => {
    setFPagamento(value);
    setObrigFP(false);
  };
  //=========================================
  const [buscaAtivada, setBuscaAtivada] = React.useState(false);
  React.useEffect(() => {
    setIsLoading(carrinho.length > 0);
  }, [carrinho]);

  React.useEffect(() => {
    if (buscaAtivada) {
      handleBuscarCliente();
    }
  }, [pagina, tamanhoPagina, buscaAtivada, handleBuscarCliente]);

  React.useEffect(() => {
    handleBuscarCliente();
  }, [sortBy, sortDir, handleBuscarCliente]);

  // Salva em sessionStorage os campos que ainda estavam sumindo no refresh
  React.useEffect(() => {
    try {
      const META_KEY = 'metaVendaMelo';
      const raw = sessionStorage.getItem(META_KEY);
      const meta = raw ? JSON.parse(raw) : {};

      // Atualiza apenas o que nos interessa aqui
      const next = {
        ...meta,
        obsFat, // textarea "Obs Fat"
        fPagamento, // select "Forma de pagamento"
      };

      sessionStorage.setItem(META_KEY, JSON.stringify(next));
    } catch {}
  }, [obsFat, fPagamento]);

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      className=" select-none h-[calc(100%)] w-[calc(100%)]  dark:bg-slate-900"
    >
      <div className=" h-auto bg-gray-50 dark:bg-zinc-800  w-full flex justify-center items-center ">
        <div className="flex space-x-6 mt-2 mb-2 h-full py-0   w-[98%]  justify-center items-center ">
          <div className="space-y-2 sm:space-y-0 w-full flex-col flex sm:flex-row sm:space-x-4 items-center justify-center ">
            <SelectInput
              name="armazens"
              options={armazens}
              defaultValue={selectedArmazem?.value}
              onValueChange={handleArmazemChange}
              disabled={isLoading}
            />
            <div className="w-full   flex items-center justify-center ">
              <div className="w-full">
                {clienteSelect.codigo !== '' ? (
                  <div className="relative h-10 w-full min-w-[200px]">
                    <div
                      className={`${
                        carrinho.length ? 'hidden' : ''
                      } absolute top-2/4 right-3 grid h-5 
                      w-5 -translate-y-2/4 place-items-center 
                      text-gray-500`}
                    >
                      <MdClose
                        size={20}
                        onClick={() => {
                          setPrecoCliente('');
                          setTela('0');
                          setOpenInfoCliente(false);
                          setClienteSelect({
                            codigo: '',
                            nome: '',
                            documento: '',
                            nomeFantasia: '',
                            saldo: 0,
                            status: '',
                            desconto: 0,
                            IPI: '',
                            ICMS: '',
                            zona: '',
                            CLASPGTO: '',
                            UF: '',
                            TIPO: '',
                            limiteAtraso: 0,
                            diasAtrasado: 0,
                            tipoPreco: '',
                            CODVEND: '',
                            FONE: '',
                            ENDER: '',
                            BAIRRO: '',
                            CIDADE: '',
                            CEP: '',
                            KICKBACK: false,
                          });
                          clearEntrada();
                          setNPedido('');
                          setDadosClienteSel({
                            codigo: '',
                            nome: '',
                            documento: '',
                            nomeFantasia: '',
                          });
                          setMensagem('');
                          handleFocusCli();
                          setProduto([]);
                          setProdutoRef([]);
                          sessionStorage.setItem(
                            'clienteSelectMelo',
                            JSON.stringify({
                              codigo: '',
                              nome: '',
                              documento: '',
                              nomeFantasia: '',
                              saldo: 0,
                              status: '',
                              desconto: 0,
                              IPI: '',
                              ICMS: '',
                              zona: '',
                              CLASPGTO: '',
                              UF: '',
                              TIPO: '',
                              limiteAtraso: 0,
                              diasAtrasado: 0,
                              tipoPreco: '',
                              CODVEND: '',
                            }),
                          );
                          sessionStorage.setItem(
                            'dadosClienteSelMelo',
                            JSON.stringify({
                              codigo: '',
                              nome: '',
                              documento: '',
                              nomeFantasia: '',
                            }),
                          );
                        }}
                        className={`${
                          clienteSelect.codigo !== ''
                            ? 'cursor-pointer text-orange-600 dark:text-orange-200 hover:text-orange-500'
                            : 'text-gray-300'
                        } `}
                      />
                    </div>
                    <input
                      className="peer h-full w-full
                    rounded-[7px] border  
                  border-gray-300 dark:border-gray-400
                  dark:focus:border-orange-200
                    dark:focus:border-t-transparent
                    bg-transparent 
                    px-3 py-2.5 !pr-9 font-sans 
                     font-normal text-orange-600
                    dark:text-orange-300 
                    focus:text-orange-600
                    dark:focus:text-orange-200
                    outline outline-0 transition-all   
                    focus:border-1 focus:border-orange-600
                    focus:border-t-transparent 
                    dark:border-t-transparent
                    border-t-transparent focus:outline-0 
                    disabled:border-0 disabled:bg-gray-50"
                      value={
                        dadosClienteSel.codigo
                          ? ` ${dadosClienteSel.codigo} - ${dadosClienteSel.nome}`
                          : ''
                      }
                      placeholder={
                        dentroCli ? `Cliente (Cod, Nome, CNPJ)` : '  '
                      }
                    />
                    <label
                      className="before:content[' ']
                  text-gray-400 
                  after:content[' '] pointer-events-none
                  absolute left-0 -top-1.5 flex h-full
                  w-full select-none text-[11px]
                  font-normal leading-tight
                  text-gray-400 transition-all
                  before:pointer-events-none
                  before:mt-[6.5px] before:mr-1
                  before:box-border before:block
                  before:h-1.5 before:w-2.5
                  before:rounded-tl-md before:border-t
                  before:border-l before:border-gray-300
                  before:transition-all after:pointer-events-none
                  after:mt-[6.5px] after:ml-1 after:box-border
                  after:block after:h-1.5 after:w-2.5
                  after:flex-grow after:rounded-tr-md
                  after:border-t after:border-r
                  after:border-gray-300 after:transition-all
                  dark:after:border-gray-400
                  peer-placeholder-shown:
                  peer-placeholder-shown:leading-[3.75]
                  peer-placeholder-shown:text-gray-500
                  peer-placeholder-shown:before:border-transparent
                  peer-placeholder-shown:after:border-transparent
                  peer-focus:text-[11px] peer-focus:leading-tight
                 peer-focus:text-orange-600
                  dark:peer-focus:text-orange-200
                  peer-focus:before:border-t-1
                  peer-focus:before:border-l-2
                  peer-focus:before:border-orange-600
                  dark:peer-focus:before:border-l-2
                  dark:peer-focus:before:border-orange-200
                  peer-focus:after:border-t-1
                  peer-focus:after:border-r-2
                peer-focus:after:border-orange-600
                dark:peer-focus:after:border-orange-200
                  peer-disabled:text-transparent
                  peer-disabled:before:border-transparent
                  peer-disabled:after:border-transparent
                  peer-disabled:peer-placeholder-shown:text-gray-500"
                    >
                      Cliente Selecionado
                    </label>
                  </div>
                ) : (
                  <div className="relative h-10 w-full min-w-[200px]">
                    <div className="absolute top-2/4 right-3 grid h-5 w-5 -translate-y-2/4 place-items-center text-gray-500">
                      <BsPersonVcard
                        size={20}
                        className={`${
                          tela === '0'
                            ? 'text-orange-500 dark:text-orange-200'
                            : 'text-gray-300 dark:text-gray-500'
                        } `}
                      />
                    </div>
                    <input
                      ref={cliInputRef}
                      autoFocus
                      className="peer h-full w-full
                     
                    rounded-[7px] border  
                  border-gray-300 dark:border-gray-50
                  
                    dark:focus:border-t-transparent
                    
                    bg-transparent 
                    
                    px-3 py-2.5 !pr-9 font-sans 
                     font-normal
                    focus:text-orange-600 
                    focus:border-1
                    dark:focus:text-orange-200
                    dark:focus:border-2
                    dark:focus:border-orange-200 
                    outline outline-0 transition-all   
                    focus:border-orange-600
                    focus:border-t-transparent 
                    dark:border-t-transparent
                    placeholder-shown:border-t  
                 placeholder-shown:border-gray-300
                 placeholder-shown:placeholder-gray-400 
                 dark:placeholder-shown:placeholder-gray-500
                 dark:placeholder-shown:border-gray-400
                 
                    border-t-transparent focus:outline-0 
                    disabled:border-0 disabled:bg-gray-50
                    "
                      value={pesquisaCli || ''}
                      onChange={(e) => {
                        setIconeInfo('');
                        setMensagem('');
                        const newE = e.target.value.toLocaleUpperCase();

                        setPesquisaCli(newE);
                        setBuscaAtivada(false); // <- ESSENCIAL PARA PARAR A BUSCA AUTOMÁTICA ENQUANTO DIGITA
                      }}
                      onFocus={() => {
                        setMensagem('');
                        setLoadingCli(false);
                        setIconeInfo('');
                        setTela('0');
                        setDentroCli(true);
                      }}
                      onBlur={() => {
                        setDentroCli(false);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key.toLowerCase() === 'enter' &&
                          pesquisaCli.length > 2
                        ) {
                          setMensagem('');
                          setLoadingCli(true);
                          setShowCli(true);
                          setIconeInfo('');
                          setPagina(0); // reinicia a paginação
                          setBuscaAtivada(true); // <-- ativa a flag
                          handleBuscarCliente();
                        }

                        if (
                          event.key.toLowerCase() === 'enter' &&
                          pesquisaCli.length < 3
                        ) {
                          setMensagem('');
                          setIconeInfo('');
                          setLoadingCli(false);
                          setCliente([]);
                          setShowCli(false);
                          setBuscaAtivada(false); // <-- desativa se busca inválida
                        }
                      }}
                      placeholder={
                        dentroCli ? `Cliente (Cod, Nome, CNPJ)` : '  '
                      }
                    />
                    <label
                      className="before:content[' ']
                  after:content[' '] pointer-events-none
                  absolute left-0 -top-1.5 flex h-full
                  w-full select-none text-[11px]
                  font-normal leading-tight
                  text-gray-400 transition-all
                  before:pointer-events-none
                  before:mt-[6.5px] before:mr-1
                  before:box-border before:block
                  before:h-1.5 before:w-2.5
                  before:rounded-tl-md before:border-t
                  before:border-l before:border-gray-300
                  before:transition-all after:pointer-events-none
                  after:mt-[6.5px] after:ml-1 after:box-border
                  after:block after:h-1.5 after:w-2.5
                  after:flex-grow after:rounded-tr-md
                  after:border-t after:border-r
                  after:border-gray-300 after:transition-all
                  
                  peer-placeholder-shown:
                  peer-placeholder-shown:leading-[3.75]
                  dark:peer-placeholder-shown:text-gray-500 
                  dark:peer-placeholder:text-gray-500 
                  peer-placeholder-shown:before:border-transparent
                  peer-placeholder-shown:after:border-transparent
                  peer-focus:text-[11px] peer-focus:leading-tight
                 peer-focus:text-orange-600
                 dark:peer-focus:text-orange-200
                  
                  peer-focus:before:border-t-1
                  peer-focus:before:border-l-1
                  peer-focus:before:border-orange-600
                  
                  dark:peer-focus:before:border-t-2
                  dark:peer-focus:before:border-l-2
                  dark:peer-focus:after:border-t-2
                  dark:*:peer-focus:after:border-r-2
                  dark:peer-focus:before:border-orange-200
                  peer-focus:after:border-t-1
                  peer-focus:after:border-r-1
                peer-focus:after:border-orange-600
                dark:peer-focus:after:border-orange-200
                  peer-disabled:text-transparent
                  peer-disabled:before:border-transparent
                  peer-disabled:after:border-transparent"
                    >
                      Pesquisar Cliente
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full   flex items-center justify-center ">
              <div className="relative h-10 w-full min-w-[200px]">
                <div className="absolute top-2/4 right-3 grid h-5 w-5 -translate-y-2/4 place-items-center text-gray-500">
                  <BsBoxes
                    size={20}
                    className={`${
                      tela === '1'
                        ? 'text-blue-500 dark:text-blue-200'
                        : 'text-gray-300 dark:text-gray-500'
                    } `}
                  />
                </div>
                <input
                  className="peer h-full w-full rounded-[7px] 
                border border-gray-300 dark:border-gray-400
                 dark:focus:border-blue-300
                 dark:focus:border-t-transparent
                 bg-transparent px-3 py-2.5 !pr-9 
                 font-sans  font-normal 
                 text-gray-400
                 focus:text-blue-600  
                 dark:text-gray-600 
                 dark:focus:text-blue-200 outline outline-0 
                 transition-all   focus:border-2 
                 focus:border-blue-300 focus:border-t-transparent
                 dark:border-t-transparent 
                 
                 border-t-transparent focus:outline-0 
                 placeholder-shown:border-t  
                 dark:placeholder-shown:border-gray-400
                 placeholder-shonw:border-gray-400
                 placeholder-shown:border-gray-300
                 placeholder-shown:placeholder-gray-400 
                 dark:placeholder-shown:placeholder-gray-500
                  disabled:border-0 disabled:bg-gray-50"
                  ref={prodInputRef}
                  value={pesquisa || ''}
                  onFocus={() => {
                    setMensagem('');
                    setIconeInfo('');
                    setLoadingProd(false);
                    // NÃO mude pra '1' se estivermos mostrando o aviso na tela 2
                    if (!(String(tela) === '2' && !hasVendedor)) {
                      setTela('1');
                    }
                    setDentroProd(true);
                    setPesquisa('');
                  }}
                  onBlur={() => {
                    setDentroProd(false);
                  }}
                  onChange={(e) => {
                    const newE = e.target.value.toLocaleUpperCase();

                    setMensagem('');
                    setIconeInfo('');
                    setPesquisa(newE);

                    //              if (newE.length < 3) setProduto([]);
                    return 0;
                  }}
                  onKeyDown={(event) => {
                    // idem: só manda pra '1' se não estivermos na 2 sem vendedor
                    if (!(String(tela) === '2' && !hasVendedor)) {
                      setTela('1');
                    }
                    if (
                      event.key.toLowerCase() === 'enter' &&
                      pesquisa.length > 2
                    ) {
                      setMensagem('');
                      setIconeInfo('');
                      setLoadingProd(true);
                      setShowProd(false);
                      handleBuscarProd();
                    }
                    if (
                      event.key.toLowerCase() === 'enter' &&
                      pesquisa.length < 3
                    ) {
                      setMensagem('');
                      setIconeInfo('');
                      setLoadingProd(false);
                      setProduto([]);
                      setProdutoRef([]);
                    }
                  }}
                  disabled={false}
                  type="text"
                  placeholder={
                    dentroProd ? `Buscar Produto (ref ou descrição)` : '  '
                  }
                />
                <label
                  className="text-gray-400 
                before:content[' '] after:content[' '] 
              pointer-events-none absolute left-0 -top-1.5 
              flex h-full w-full select-none text-[11px] font-normal 
              leading-tight  transition-all 
              before:pointer-events-none before:mt-[6.5px] 
              before:mr-1 before:box-border before:block 
              before:h-1.5 before:w-2.5 before:rounded-tl-md
              before:border-t before:border-l 
              before:border-gray-300 before:transition-all 
              after:pointer-events-none after:mt-[6.5px] 
              after:ml-1 after:box-border after:block 
              after:h-1.5 after:w-2.5 after:flex-grow 
              after:rounded-tr-md after:border-t after:border-r 
              after:border-gray-300 after:transition-all 
              dark:after:border-gray-500
              peer-focus:after:border-t-2
              peer-placeholder-shown: 
              peer-placeholder-shown:leading-[3.75] 
              peer-placeholder-shown:text-gray-400
              dark:peer-placeholder-shown:text-gray-500 
              peer-placeholder-shown:before:border-transparent 
              peer-placeholder-shown:after:border-transparent 
              peer-focus:text-[11px] peer-focus:leading-tight 
              peer-focus:text-blue-500
              dark:peer-focus:text-blue-200
              peer-focus:before:border-t-1 
              peer-focus:before:border-l-2 
              peer-focus:before:border-blue-300 
              peer-focus:after:border-t-1 
              peer-focus:after:border-r-2
              peer-focus:after:border-blue-300 
              peer-disabled:text-transparent 
              peer-disabled:before:border-transparent 
              peer-disabled:after:border-transparent "
                >
                  Pesquisar Produto
                </label>
              </div>
            </div>
          </div>
          <div className="relative inline-flex">
            <div
              onClick={() => {
                telaSelecionada('2');
              }}
              className={`w-8 h-8 ${
                tela === '2'
                  ? ' dark:bg-green-500 dark:text-green-800 bg-green-600 text-green-50'
                  : 'dark:bg-gray-600 dark:text-gray-300 bg-gray-200'
              } font-sans  items-center rounded-lg font-bold dark:text-white flex justify-center `}
            >
              <div className="w-full  font-sans font-bold flex justify-center ">
                <GiShoppingCart className="text-[20px]" />
              </div>
            </div>
            <span className="absolute top-0.8 left-2 grid min-h-[24px] min-w-[24px] translate-x-2/4 -translate-y-2/4 place-items-center rounded-full bg-red-500 py-1 px-1 text-[8px] md:text-[10px] text-white">
              {carrinho.length ? carrinho.length : 0}
            </span>
          </div>
        </div>
      </div>

      {tela === '0' ? (
        <div className="h-[calc(100vh-2rem)] lg:h-[calc(100vh-4rem)] w-full border-b border-gray-300 flex justify-center items-start">
          {!openInfoCliente ? (
            <div className="w-full h-full">
              {showCli ? (
                <div className="h-full w-full flex justify-center items-start">
                  {cliente.length ? (
                    <div className="h-[calc(100%-8rem)] w-full flex justify-center items-start">
                      <TableClient
                        clienteSelecionado={clienteSelecionado}
                        data2={cliente}
                        pagina={pagina}
                        setPagina={setPagina}
                        tamanhoPagina={tamanhoPagina}
                        setTamanhoPagina={setTamanhoPagina}
                        total={totalClientes}
                        mudouPagina={mudouPagina}
                        mudouOrdenacao={handleMudouOrdenacao} // ⬅️ NOVO
                        loading={loadingCli}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex-col flex justify-center items-center">
                      <div className="py-4 flex justify-center">
                        <PiSmileySadFill
                          className="dark:text-yellow-300 text-yellow-600"
                          size={60}
                        />
                      </div>
                      <div className="text-center font-bold dark:text-yellow-300 text-yellow-600">
                        Nenhum Cliente Emcontrado
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[calc(100%-7rem)] w-full border-t border-gray-300 flex justify-center items-center">
                  <div className="h-full w-full">
                    <div className="h-[calc(100%-3rem)] flex justify-center items-center">
                      {mensagem.length ? (
                        <div>
                          <div>
                            {iconesInfo === 'falha' && (
                              <div className="py-4 flex justify-center">
                                <BiSolidError
                                  className="dark:text-red-200 text-red-400"
                                  size={60}
                                />
                              </div>
                            )}
                            {iconesInfo === 'none' && (
                              <div className="py-4 flex justify-center">
                                <PiSmileySadFill
                                  className="dark:text-yellow-200 text-yellow-300"
                                  size={60}
                                />
                              </div>
                            )}
                          </div>
                          <div className="text-center whitespace-pre-line">
                            {mensagem}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="py-4 flex justify-center">
                            <BsPersonVcard
                              className="dark:text-orange-300 text-orange-600"
                              size={60}
                            />
                          </div>
                          <div className="text-center font-bold dark:text-orange-300 text-orange-600">
                            PESQUISAR UM CLIENTE
                          </div>
                          <div className="font-bold text-orange-600 dark:text-orange-300">
                            Digite pelo menos 3 digitos e pressione enter...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <InformeCliente
              handleInfoCliente={handleInfoCliente}
              clienteSelect={clienteSelect}
            />
          )}
        </div>
      ) : null}
      {tela === '1' ? (
        <div className="h-full  w-full border-b border-gray-300  flex justify-center items-start ">
          <div className="w-full h-full">
            {showProd && produto?.length ? (
              <div className="w-full h-full">
                <div className="h-[45vh] w-full    flex justify-center items-start ">
                  <TableProd
                    data2={produto || []}
                    tela={tela}
                    telaSelecionada={telaSelecionada}
                    produtoSelecionado={produtoSelecionado}
                    cliente={dadosClienteSel.nome}
                    kickback={clienteSelect.KICKBACK || false}
                    handleCarrinho={handleCarrinho}
                    descontoTodos={descontoTodosAtivo}
                    ctxGlobal={ctxGlobal}
                    onCtxChange={handleCtxChange}
                  />
                </div>
                <div className="h-10   w-full flex justify-center items-center " />
                {loadingRef ? (
                  <div className="h-[calc(40vh)] ">
                    <Carregamento />
                  </div>
                ) : (
                  <div className="h-[45vh] w-full    flex justify-center items-start ">
                    {produtoRef.length && produtoRef[0]?.codigo !== 'nenhum' ? (
                      <div className="h-full w-full">
                        {produtoRef[0].codigo !== 'sem referencia' ? (
                          <div className="h-8 bg-gray-100 dark:bg-neutral-800 w-full flex justify-center items-center ">
                            ITENS EQUIVALENTES
                          </div>
                        ) : null}

                        <div className="h-[24vh] w-full lg:h-[18vh]   flex justify-center items-start ">
                          {produtoRef[0].codigo !== 'sem referencia' ? (
                            <TableProdRef
                              data2={produtoRef || []}
                              tela={tela}
                              telaSelecionada={telaSelecionada}
                              produtoSelecionado={produtoSelecionado}
                              cliente={dadosClienteSel.nome}
                              handleCarrinho={handleCarrinho}
                              descontoTodos={descontoTodosAtivo}
                              kickback={clienteSelect.KICKBACK || false}
                              ctxGlobal={ctxGlobal}
                              onCtxChange={handleCtxChange}
                            />
                          ) : (
                            <div className="h-full flex justify-center items-center font-bold  w-full  ">
                              Não tem equivalentes para esse item
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="font-bold bg-gray-50 dark:bg-neutral-900 w-full h-[calc(100%-2rem)] flex justify-center items-center">
                        CLICK NO ITEM PARA VER O EQUIVALENTE
                      </div>
                    )}{' '}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[calc(100%)] w-full border-t border-gray-300  flex justify-center items-center ">
                <div className="h-full w-full">
                  <div className="h-[calc(100%)]  flex justify-center items-center">
                    {mensagem.length ? (
                      <div>
                        <div>
                          {iconesInfo === 'falha' ? (
                            <div className="py-4 flex justify-center">
                              <BiSolidError
                                className=" dark:text-red-200 text-red-400"
                                size={60}
                              />{' '}
                            </div>
                          ) : null}
                          {iconesInfo === 'none' ? (
                            <div className="py-4 flex justify-center">
                              <PiSmileySadFill
                                className=" dark:text-yellow-200 text-yellow-300"
                                size={60}
                              />{' '}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-center whitespace-pre-line">
                          {mensagem}
                        </div>
                      </div>
                    ) : (
                      <div>
                        {loadingProd ? (
                          <Carregamento />
                        ) : (
                          <div>
                            <div>
                              {iconesInfo === '' ? (
                                <div className="py-4 flex justify-center">
                                  <BsBoxes
                                    className=" dark:text-blue-200 text-[#347AB6]"
                                    size={60}
                                  />{' '}
                                </div>
                              ) : null}
                            </div>
                            <div>
                              <div className="text-center font-bold dark:text-blue-200 text-[#347AB6]">
                                PESQUISAR UM PRODUTO
                              </div>
                              <div className=" font-bold dark:text-blue-200 text-[#347AB6]">
                                Digite pelo menos 3 digitos e pressione enter...
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {tela === '2' && hasVendedor ? (
        <div className="h-[calc(100%-7rem)]  w-full border-b border-gray-300  flex justify-center items-start ">
          <div className="w-full h-full">
            {carrinho?.length ? (
              <div className="w-full h-full">
                <div className="h-[calc(44%)] w-full flex justify-center items-start ">
                  {/*maior que sm ele mostra */}

                  <div className="hidden sm:flex h-full w-full">
                    <TableCar
                      kickback={clienteSelect.KICKBACK || false}
                      data2={carrinho || []}
                      tela={tela}
                      telaSelecionada={telaSelecionada}
                      produtoSelecionado={produtoSelecionado}
                      cliente={dadosClienteSel.nome}
                      handleCarrinho={handleCarrinho}
                      descontoTodos={descontoTodosAtivo}
                    />
                  </div>
                  <div className="flex sm:hidden h-full w-full">
                    <TableCarMobile
                      data2={carrinho || []}
                      tela={tela}
                      telaSelecionada={telaSelecionada}
                      produtoSelecionado={produtoSelecionado}
                      cliente={dadosClienteSel.nome}
                      handleCarrinho={handleCarrinho}
                    />
                  </div>
                </div>

                <div className="text-[10px] md:text-[12px] h-full max-h-[calc(55%)] w-full  ">
                  <div
                    className="h-[15%] bg-green-50 dark:bg-zinc-900 
                                  flex items-center w-full border-b
                                  border-gray-300 dark:border-gray-400"
                  >
                    <div className="flex px-6 w-full h-auto items-center">
                      <div className="flex w-[65%] space-x-6  ">
                        <div className="flex space-x-1 text-green-700 dark:text-green-300 justify-start  ">
                          <div className="text-[8px] md:text-[10px] flex items-center text-gray-400">
                            IPI:
                          </div>
                          <div className="text-primary flex items-center">
                            {clienteSelect.IPI}
                          </div>
                        </div>
                        <div className="flex space-x-1 text-slate-800 justify-start ">
                          <div className="text-[8px] md:text-[10px] px-1 flex items-center text-gray-400">
                            ICMS ST:
                          </div>
                          <div className="text-primary flex items-center">
                            {clienteSelect.ICMS}
                          </div>
                        </div>
                      </div>
                      <div className="w-full min-w-32  h-full space-x-3 text-primary flex items-center">
                        <SelecionarTodosDesconto
                          statusDesc={descontoTodosAtivo}
                          descontoTodos={descontoTodos}
                          handleAtualizarDesc={handleAtualizarDesc}
                        />
                        <div
                          className={` space-x-2 w-full font-normal flex justify-start items-center  `}
                        >
                          <div className={` h-full w-full flex  items-center`}>
                            <div
                              className={`${descontoTodos ? 'flex' : 'hidden'}`}
                            >
                              <div
                                className={` flex justify-start items-center`}
                              >
                                {descontoTodos ? descontoTodos : ''}
                              </div>

                              <div
                                className={` flex justify-start items-center`}
                              >
                                % à vista
                              </div>
                            </div>

                            <div
                              className={` ml-2 h-full  flex justify-start items-center`}
                            >
                              (R${' '}
                              {totalVendaSemDesconto
                                ? Number(
                                    totalVendaSemDesconto - totalVenda,
                                  ).toFixed(2)
                                : ''}
                              )
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-center  w-[15%] min-w-64   ">
                        <div className="flex text-slate-800 justify-center ">
                          <div className="text-primary font-bold   text-yellow-600 dark:text-yellow-200">
                            <div className=" h-auto">
                              <div className="w-full h-8 text-green-100 hover:text-gray-300 dark:hover:bg-red-600 hover:bg-red-600   bg-red-400 dark:bg-red-400 flex justify-center items-center  rounded-md mr-6 sm:mr-3 min-w-32  ">
                                <div className=" h-full w-full flex justify-center">
                                  <div className=" flex items-center font-bold text-[8px] md:text-[10px] ">
                                    <button
                                      id="decreaseButton"
                                      type="button"
                                      onClick={() => {
                                        setOpenEsvaziar(true);
                                      }}
                                    >
                                      ESVAZIAR CARRINHO
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-center  w-[20%]  ">
                        <div className="flex text-slate-800 justify-center  ">
                          <div className="text-primary font-bold  text-yellow-600 dark:text-yellow-200">
                            <div className="px-6 h-auto">
                              <div className="w-full  border border-green-600 h-8 flex justify-center items-center  rounded-md mr-6 sm:mr-3 min-w-32  ">
                                <div className=" h-full w-full flex justify-center">
                                  <div className=" flex items-center font-bold  text-orange-600 dark:text-yellow-400">
                                    {MascaraReal(totalVenda)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="h-[15%] bg-green-50 dark:bg-zinc-900 
                                  flex items-center w-full border-b
                                  border-gray-300 dark:border-gray-400"
                  >
                    <div className="flex px-6 w-full h-auto">
                      <div className=" flex justify-center items-center  w-full  ">
                        <div className="w-full flex text-slate-800 justify-center  ">
                          <div className="w-full text-primary   text-yellow-600 dark:text-yellow-200">
                            <div className=" w-[100%] grid grid-cols-1 lg:grid-cols-2   ">
                              <div className="w-full grid grid-cols-11 lg:grid-cols-7  gap-0  space-x-1 text-slate-800 justify-start">
                                <div className="flex w-full col-span-10 lg:col-span-5   space-x-1 text-green-700 dark:text-green-300 justify-start  ">
                                  <div className="text-[10px]  flex items-center text-gray-400">
                                    cliente:
                                  </div>
                                  <div className="text-[10px] lg:text-[11px] w-full text-primary flex items-center">
                                    {clienteSelect.codigo} -{' '}
                                    {clienteSelect.nome}
                                  </div>
                                </div>

                                <div className="flex space-x-1 text-slate-800 justify-end lg:justify-start   ">
                                  <div className="text-[10px] px-1 flex items-center text-gray-400">
                                    desconto:
                                  </div>
                                  <div className="text-[10px] text-primary flex items-center">
                                    {clienteSelect.tipoPreco}
                                  </div>
                                </div>
                              </div>
                              <div className="w-full grid grid-cols-4 gap-0  space-x-1 text-slate-800 justify-start  ">
                                <div className=" flex w-full space-x-1 text-slate-800 justify-start lg:justify-center  ">
                                  <div className=" text-[10px] px-0 flex items-center text-gray-400">
                                    saldo atual:
                                  </div>
                                  <div
                                    className={`${
                                      clienteSelect.saldo > 0
                                        ? 'text-blue-600'
                                        : 'text-red-600 dark:text-red-300'
                                    }   flex items-center`}
                                  >
                                    {MascaraReal(clienteSelect.saldo)}
                                  </div>
                                </div>
                                <div className="flex w-full col-span-2 space-x-1 text-slate-800 justify-center  ">
                                  <div className="text-[10px] px-1 flex items-center text-gray-400">
                                    saldo pós venda:
                                  </div>
                                  <div
                                    className={`${
                                      clienteSelect.saldo - totalVenda > 0
                                        ? 'text-blue-600'
                                        : 'text-red-800 dark:text-red-300'
                                    }   flex items-center`}
                                  >
                                    {MascaraReal(
                                      clienteSelect.saldo - totalVenda,
                                    )}
                                  </div>
                                </div>
                                <div className="flex  mr-3 lg:mr-0 space-x-1 text-slate-800 justify-end lg:justify-center  ">
                                  <div className="text-[10px] px-1 flex items-center text-gray-400">
                                    Zona:
                                  </div>
                                  <div className="text-[10px] text-primary flex items-center">
                                    SEM ZONA
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="h-[15%]  dark:bg-zinc-900 
                                  flex items-center w-full "
                  >
                    <div className="flex px-6 w-full h-full">
                      <div className="w-[34%] h-full flex justify-start gap-2 lg:gap-6 xl:gap-2 ">
                        <div className="flex w-[28%]  lg:w-[20%]  justify-start space-x-1 text-slate-800  ">
                          <div className="text-[8px] md:text-[10px] px-1 flex items-center text-gray-600">
                            <div className="flex items-center space-x-2">
                              <div className="flex  items-center ">
                                <input
                                  id="default-checkbox"
                                  type="checkbox"
                                  value=""
                                  checked={checkVendedor}
                                  onChange={() => {
                                    // setCheckVendedor(!checkVendedor);

                                    const checkVend1 = !checkVendedor;

                                    if (checkVend1) {
                                      const vendedorCliente =
                                        dadosVendedor.filter(
                                          (val) =>
                                            val.CODVEND ===
                                            clienteSelect.CODVEND,
                                        );
                                      if (vendedorCliente.length)
                                        setVendedorSel({
                                          nome: vendedorCliente[0].NOME,
                                          codigo: vendedorCliente[0].CODVEND,
                                        });
                                    }
                                    setCheckVendedor(!checkVendedor);
                                    if (checkVend1) setOpenVendedor(true);
                                    else {
                                      const vendedorCliente =
                                        dadosVendedor.filter(
                                          (val) =>
                                            val.CODVEND ===
                                            clienteSelect.CODVEND,
                                        );
                                      if (vendedorCliente.length)
                                        setVendedorSel({
                                          nome: vendedorCliente[0].NOME,
                                          codigo: vendedorCliente[0].CODVEND,
                                        });
                                    }
                                  }}
                                  className={`${
                                    user.funcoes?.filter(
                                      (val) =>
                                        (val as { sigla?: string }).sigla ===
                                        'EV',
                                    )
                                      ? 'flex'
                                      : 'hidden'
                                  } w-4 h-4 text-blue-600 
                                            bg-gray-100 border-gray-300 
                                            rounded focus:ring-blue-500  
                                            dark:focus:ring-blue-600 
                                            dark:ring-offset-gray-800  
                                            focus:ring-0 dark:bg-gray-700 
                                            dark:border-gray-600`}
                                />
                                <label className="ms-2  font-medium text-gray-500 dark:text-gray-300">
                                  Vendedor:
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                        {openVendedor ? (
                          <div
                            className={`w-[6%]   ${
                              openVendedor ? 'flex justify-start' : 'hidden'
                            }  text-primary flex items-center`}
                          >
                            <SelecionarVendedor
                              handleVendedor={handleVendedor}
                            />
                          </div>
                        ) : null}
                        <div className="  flex justify-start h-full   w-[78%] min-w-64   ">
                          <div className="flex h-full w-full  justify-center  ">
                            <div className="w-full h-full text-primary   text-yellow-600 dark:text-yellow-200">
                              <div className="w-full h-full">
                                <div className="w-full h-full text-gray-100 min-w-32  ">
                                  <div className=" h-full w-full flex justify-center">
                                    <div className="w-full h-full flex items-center ">
                                      <div
                                        className={` w-full h-full 
                                           'flex'  space-x-1 justify-start  `}
                                      >
                                        <div className=" w-full h-full   flex items-center text-gray-800 dark:text-gray-200">
                                          <div className=" w-full flex justify-start ">
                                            <div className="hidden lg:flex">
                                              {vendedorSel?.codigo} -{' '}
                                              {vendedorSel?.nome.substring(
                                                0,
                                                30,
                                              )}
                                            </div>
                                            <div className="flex lg:hidden">
                                              {vendedorSel?.codigo} -{' '}
                                              {vendedorSel?.nome.substring(
                                                0,
                                                15,
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="w-[33%] h-full flex justify-start gap-2 lg:gap-6 xl:gap-2 ">
                        <div className="flex w-[28%]  lg:w-[20%]  justify-start space-x-1 text-slate-800  ">
                          <div className="text-[8px] md:text-[10px] px-1 flex items-center text-gray-600">
                            <div className="flex items-center ">
                              <input
                                id="default-checkbox"
                                type="checkbox"
                                value=""
                                checked={checkOperador}
                                onChange={() => {
                                  const valCheckOperador = !checkOperador;
                                  setCheckOperador(valCheckOperador);
                                  if (valCheckOperador) setOpenOperador(true);
                                  else setOperadorSel({ codigo: '', nome: '' });
                                }}
                                className={`flex w-4 h-4 text-blue-600 
                                            bg-gray-100 border-gray-300 
                                            rounded focus:ring-blue-500  
                                            dark:focus:ring-blue-600 
                                            dark:ring-offset-gray-800  
                                            focus:ring-0 dark:bg-gray-700 
                                            dark:border-gray-600`}
                              />
                              <label className="ms-2  font-medium text-gray-500 dark:text-gray-300">
                                Operador:
                              </label>
                            </div>
                          </div>
                        </div>
                        {openOperador ? (
                          <div
                            className={` h-full    ${
                              openOperador ? 'flex justify-start' : 'hidden'
                            }  text-primary flex items-center`}
                          >
                            <SelecionarOperador
                              handleOperador={handleOperador}
                            />
                          </div>
                        ) : null}
                        <div className="flex  h-full justify-start  w-[79%]    ">
                          <div className="flex w-full h-full  justify-center  ">
                            <div className="w-full h-full text-primary   text-yellow-600 dark:text-yellow-200">
                              <div className="w-full h-full">
                                <div className="w-full h-full text-gray-100   ">
                                  <div className=" h-full w-full flex justify-center">
                                    <div className="w-full flex items-center ">
                                      <div
                                        className={` w-full ${
                                          checkOperador ? 'flex' : 'hidden'
                                        } space-x-1 text-slate-800 justify-start  `}
                                      >
                                        <div className="w-full  px-1 flex items-center text-gray-500 dark:text-gray-300 ">
                                          <div className=" w-full flex justify-start ">
                                            <div>
                                              {operadorSel?.nome.substring(
                                                0,
                                                18,
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="w-[33%] h-full flex justify-start gap-2 lg:gap-6 xl:gap-2">
                        <div className="flex w-[28%]  lg:w-[20%]  justify-start space-x-1 text-slate-800  ">
                          <div className="text-[8px] md:text-[10px] px-1 flex items-center text-gray-600">
                            <div className="flex items-center space-x-2">
                              <div className="flex  items-center ">
                                <input
                                  id="default-checkbox"
                                  type="checkbox"
                                  value=""
                                  checked={checkLocal}
                                  onChange={() => {
                                    if (checkLocal)
                                      setLocalSel({
                                        codigo: clienteSelect.codigo,
                                        nome: clienteSelect.nome,
                                      });
                                    setCheckLocal(!checkLocal);
                                    if (!checkLocal) setOpenLocal(true);
                                  }}
                                  className={`${
                                    clienteSelect.tipoPreco.toLocaleUpperCase() ===
                                    'FORA ESTADO'
                                      ? 'flex'
                                      : 'hidden'
                                  } w-4 h-4 text-blue-600 
                                            bg-gray-100 border-gray-300 
                                            rounded focus:ring-blue-500  
                                            dark:focus:ring-blue-600 
                                            dark:ring-offset-gray-800  
                                            focus:ring-0 dark:bg-gray-700 
                                            dark:border-gray-600`}
                                />
                                <label className="ms-2  font-medium text-gray-500 dark:text-gray-300">
                                  Entrega:
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                        {openLocal ? (
                          <div
                            className={`w-[6%]   ${
                              openLocal ? 'flex justify-start' : 'hidden'
                            }  text-primary flex items-center`}
                          >
                            <SelecionarEntrega handleLocal={handleLocal} />
                          </div>
                        ) : null}
                        <div className="  flex justify-start h-full   w-[78%] min-w-64   ">
                          <div className="flex h-full w-full  justify-center  ">
                            <div className="w-full h-full text-primary   text-yellow-600 dark:text-yellow-200">
                              <div className="w-full h-full">
                                <div className="w-full h-full   min-w-32  ">
                                  <div className=" h-full w-full flex justify-center">
                                    <div className="w-full h-full flex items-center ">
                                      <div
                                        className={` w-full h-full 
                                           'flex'  space-x-1  justify-start  `}
                                      >
                                        <div className=" w-full h-full   flex items-center text-gray-500 dark:text-gray-300">
                                          <div className=" w-full flex justify-start ">
                                            <div className="hidden lg:flex">
                                              {localSel?.codigo} -{' '}
                                              {localSel?.nome.substring(0, 30)}
                                            </div>
                                            <div className="flex lg:hidden">
                                              {localSel?.codigo} -{' '}
                                              {localSel?.nome.substring(0, 15)}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="h-[15%]  dark:bg-zinc-900 
                                  flex items-center w-full 
                                  border-gray-300 dark:border-gray-400"
                  >
                    <div className="flex px-6 w-full h-auto">
                      <div className="flex  w-full   ">
                        <div className="flex w-full space-x-4   ">
                          <div className="flex w-[100%]  space-x-1 text-gray-700 dark:text-gray-300 justify-start  ">
                            <div className="w-full text-primary flex items-center">
                              <SelecionarDocumento
                                dadosDocumento={dadosDocumento}
                                handleDocumento={handleDocumento}
                              />
                            </div>
                          </div>
                          <div className="flex w-[100%]  space-x-1 text-gray-700 dark:text-gray-300 justify-start  ">
                            <div className="w-full text-primary flex items-center">
                              <div className="relative  h-full w-full min-w-[200px]">
                                <input
                                  className="peer h-full w-full
                                  rounded-[7px] border  
                                border-gray-300 dark:border-gray-50
                                  dark:focus:border-t-transparent
                                  bg-transparent 
                                  px-3 py-2.5 !pr-9 font-sans 
                                   font-normal
                                focus:text-gray-600 
                                  focus:border-1
                                dark:focus:text-gray-200
                                  dark:focus:border-2
                                dark:focus:border-gray-200 
                                  outline outline-0 transition-all   
                                focus:border-gray-600
                                  focus:border-t-transparent 
                                  dark:border-t-transparent
                                  placeholder-shown:border-t  
                                placeholder-shown:border-gray-300
                                placeholder-shown:placeholder-gray-400 
                                dark:placeholder-shown:placeholder-gray-500
                                dark:placeholder-shown:border-gray-400
                                  border-t-transparent focus:outline-0 
                                  disabled:border-0 disabled:bg-gray-50"
                                  value={obsFat || ''}
                                  onChange={(e) => {
                                    if (statusFPagamento)
                                      setObsFat(e.target.value);
                                    return 0;
                                  }}
                                  placeholder={'  '}
                                />
                                <label
                                  className="before:content[' ']
                                  after:content[' '] pointer-events-none
                                  absolute left-0 -top-1.5 flex h-full
                                  w-full select-none text-[11px]
                                  font-normal leading-tight
                                  text-gray-400 transition-all
                                  before:pointer-events-none
                                  before:mt-[6.5px] before:mr-1
                                  before:box-border before:block
                                  before:h-1.5 before:w-2.5
                                  before:rounded-tl-md before:border-t
                                  before:border-l before:border-gray-300
                                  before:transition-all after:pointer-events-none
                                  after:mt-[6.5px] after:ml-1 after:box-border
                                  after:block after:h-1.5 after:w-2.5
                                  after:flex-grow after:rounded-tr-md
                                  after:border-t after:border-r
                                  after:border-gray-300 after:transition-all
                                  
                                  peer-placeholder-shown:
                                  peer-placeholder-shown:leading-[3.75]
                                  dark:peer-placeholder-shown:text-gray-500 
                                  dark:peer-placeholder:text-gray-500 
                                  peer-placeholder-shown:before:border-transparent
                                  peer-placeholder-shown:after:border-transparent
                                  peer-focus:text-[11px] peer-focus:leading-tight
                                  peer-focus:text-gray-600
                                  dark:peer-focus:text-gray-200
                                  
                                  peer-focus:before:border-t-1
                                  peer-focus:before:border-l-1
                                  peer-focus:before:border-gray-600
                                  
                                  dark:peer-focus:before:border-l-1
                                  dark:peer-focus:before:border-gray-200
                                  peer-focus:after:border-t-1
                                  peer-focus:after:border-r-1
                                peer-focus:after:border-gray-600
                                dark:peer-focus:after:border-gray-200
                                  peer-disabled:text-transparent
                                  peer-disabled:before:border-transparent
                                  peer-disabled:after:border-transparent"
                                >
                                  Obs Fat
                                </label>
                              </div>
                            </div>
                          </div>
                          <div className="flex w-[100%]  space-x-1 text-gray-700 dark:text-gray-300 justify-start  ">
                            <div className="w-full text-primary flex items-center">
                              <div className="relative  h-full w-full min-w-[200px]">
                                <input
                                  className="peer h-full w-full
                                  rounded-[7px] border  
                                border-gray-300 dark:border-gray-50
                                  dark:focus:border-t-transparent
                                  bg-transparent 
                                  px-3 py-2.5 !pr-9 font-sans 
                                   font-normal
                                focus:text-gray-600 
                                  focus:border-1
                                dark:focus:text-gray-200
                                  dark:focus:border-2
                                dark:focus:border-gray-200 
                                  outline outline-0 transition-all   
                                focus:border-gray-600
                                  focus:border-t-transparent 
                                  dark:border-t-transparent
                                  placeholder-shown:border-t  
                                placeholder-shown:border-gray-300
                                placeholder-shown:placeholder-gray-400 
                                dark:placeholder-shown:placeholder-gray-500
                                dark:placeholder-shown:border-gray-400
                                  border-t-transparent focus:outline-0 
                                  disabled:border-0 disabled:bg-gray-50"
                                  value={pedido || ''}
                                  onChange={(e) => {
                                    setPedido(e.target.value);
                                    return 0;
                                  }}
                                  placeholder={'  '}
                                />
                                <label
                                  className="before:content[' ']
                                  after:content[' '] pointer-events-none
                                  absolute left-0 -top-1.5 flex h-full
                                  w-full select-none text-[11px]
                                  font-normal leading-tight
                                  text-gray-400 transition-all
                                  before:pointer-events-none
                                  before:mt-[6.5px] before:mr-1
                                  before:box-border before:block
                                  before:h-1.5 before:w-2.5
                                  before:rounded-tl-md before:border-t
                                  before:border-l before:border-gray-300
                                  before:transition-all after:pointer-events-none
                                  after:mt-[6.5px] after:ml-1 after:box-border
                                  after:block after:h-1.5 after:w-2.5
                                  after:flex-grow after:rounded-tr-md
                                  after:border-t after:border-r
                                  after:border-gray-300 after:transition-all
                                  
                                  peer-placeholder-shown:
                                  peer-placeholder-shown:leading-[3.75]
                                  dark:peer-placeholder-shown:text-gray-500 
                                  dark:peer-placeholder:text-gray-500 
                                  peer-placeholder-shown:before:border-transparent
                                  peer-placeholder-shown:after:border-transparent
                                  peer-focus:text-[11px] peer-focus:leading-tight
                                  peer-focus:text-gray-600
                                  dark:peer-focus:text-gray-200
                                  
                                  peer-focus:before:border-t-1
                                  peer-focus:before:border-l-1
                                  peer-focus:before:border-gray-600
                                  
                                  dark:peer-focus:before:border-l-1
                                  dark:peer-focus:before:border-gray-200
                                  peer-focus:after:border-t-1
                                  peer-focus:after:border-r-1
                                peer-focus:after:border-gray-600
                                dark:peer-focus:after:border-gray-200
                                  peer-disabled:text-transparent
                                  peer-disabled:before:border-transparent
                                  peer-disabled:after:border-transparent"
                                >
                                  Pedido
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="h-[15%] mt-1 dark:bg-zinc-900 
                                  flex items-center w-full 
                                  border-gray-300 dark:border-gray-400"
                  >
                    <div className="flex px-6 w-full h-auto">
                      <div className="flex  w-full   ">
                        <div className="flex w-full space-x-4   ">
                          <div className="flex w-[100%]  space-x-1 text-gray-700 dark:text-gray-300 justify-start  ">
                            <div className="w-full text-primary flex items-center">
                              <div className="relative  h-full w-full min-w-[200px]">
                                <input
                                  className={`peer h-full w-full
    ${obrigPrazo ? 'bg-red-100 dark:bg-red-900/30 ring-1 ring-red-400' : ''}
    rounded-[7px] border  border-gray-300 dark:border-gray-50
                  
                    dark:focus:border-t-transparent
                    
                    bg-transparent 
                    
                    px-3 py-2.5 !pr-9 font-sans 
                     font-normal
                    focus:text-gray-600 
                    focus:border-1
                    dark:focus:text-gray-200
                    dark:focus:border-2
                    dark:focus:border-gray-200 
                    outline outline-0 transition-all   
                    focus:border-gray-600
                    focus:border-t-transparent 
                    dark:border-t-transparent
                    placeholder-shown:border-t  
                 placeholder-shown:border-gray-300
                 placeholder-shown:placeholder-gray-400 
                 dark:placeholder-shown:placeholder-gray-500
                 dark:placeholder-shown:border-gray-400
                 
                    border-t-transparent focus:outline-0 
                    disabled:border-0 disabled:bg-gray-50
                    `}
                                  value={
                                    clienteSelect.saldo - totalVenda > 0
                                      ? prazo
                                      : 'À VISTA'
                                  }
                                  // A função que o onChange está chamando deve ser parecida com esta.

                                  // Substitua o seu onFocus atual por ambos os eventos
                                  onFocus={() => {
                                    // Sua lógica para abrir o modal
                                    if (clienteSelect.saldo - totalVenda > 0) {
                                      setOpenModalPrazo(true);
                                    }
                                  }}
                                  onChange={(e) => {
                                    // Sua lógica de onChange original
                                    const value = e.target.value;
                                    setPrazo(value);
                                    setObrigPrazo(false);
                                  }}
                                  placeholder={''}
                                />
                                <label
                                  className="before:content[' ']
                                  after:content[' '] pointer-events-none
                                  absolute left-0 -top-1.5 flex h-full
                                  w-full select-none text-[11px]
                                  font-normal leading-tight
                                  text-gray-400 transition-all
                                  before:pointer-events-none
                                  before:mt-[6.5px] before:mr-1
                                  before:box-border before:block
                                  before:h-1.5 before:w-2.5
                                  before:rounded-tl-md before:border-t
                                  before:border-l before:border-gray-300
                                  before:transition-all after:pointer-events-none
                                  after:mt-[6.5px] after:ml-1 after:box-border
                                  after:block after:h-1.5 after:w-2.5
                                  after:flex-grow after:rounded-tr-md
                                  after:border-t after:border-r
                                  after:border-gray-300 after:transition-all
                                  
                                  peer-placeholder-shown:
                                  peer-placeholder-shown:leading-[3.75]
                                  dark:peer-placeholder-shown:text-gray-500 
                                  dark:peer-placeholder:text-gray-500 
                                  peer-placeholder-shown:before:border-transparent
                                  peer-placeholder-shown:after:border-transparent
                                  peer-focus:text-[11px] peer-focus:leading-tight
                                peer-focus:text-gray-600
                                dark:peer-focus:text-gray-200
                                  
                                  peer-focus:before:border-t-1
                                  peer-focus:before:border-l-1
                                  peer-focus:before:border-gray-600
                                  
                                  dark:peer-focus:before:border-l-1
                                  dark:peer-focus:before:border-gray-200
                                  peer-focus:after:border-t-1
                                  peer-focus:after:border-r-1
                                peer-focus:after:border-gray-600
                                dark:peer-focus:after:border-gray-200
                                  peer-disabled:text-transparent
                                  peer-disabled:before:border-transparent
                                  peer-disabled:after:border-transparent"
                                >
                                  Prazo{' '}
                                  {`${obrigPrazo ? ' é obrigatório' : ''}`}
                                </label>
                              </div>
                            </div>
                          </div>
                          <div className="flex w-[100%]  space-x-1 text-gray-700 dark:text-gray-300 justify-start  ">
                            <div className="w-full text-primary flex items-center">
                              <div className="relative  h-full w-full min-w-[200px]">
                                <input
                                  className="peer h-full w-full
                     
                                  rounded-[7px] border  
                                border-gray-300 dark:border-gray-50
                                
                                  dark:focus:border-t-transparent
                                  
                                  bg-transparent 
                                  
                                  px-3 py-2.5 !pr-9 font-sans 
                                   font-normal
                                  focus:text-gray-600 
                                  focus:border-1
                                  dark:focus:text-gray-200
                                  dark:focus:border-2
                                  dark:focus:border-gray-200 
                                  outline outline-0 transition-all   
                                  focus:border-gray-600
                                  focus:border-t-transparent 
                                  dark:border-t-transparent
                                  placeholder-shown:border-t  
                              placeholder-shown:border-gray-300
                              placeholder-shown:placeholder-gray-400 
                              dark:placeholder-shown:placeholder-gray-500
                              dark:placeholder-shown:border-gray-400
                              
                                  border-t-transparent focus:outline-0 
                                  disabled:border-0 disabled:bg-gray-50
                                  "
                                  value={requisição || ''}
                                  onChange={(e) => {
                                    setRequisição(e.target.value);
                                    return 0;
                                  }}
                                  placeholder={''}
                                />
                                <label
                                  className="before:content[' ']
                                  after:content[' '] pointer-events-none
                                  absolute left-0 -top-1.5 flex h-full
                                  w-full select-none text-[11px]
                                  font-normal leading-tight
                                  text-gray-400 transition-all
                                  before:pointer-events-none
                                  before:mt-[6.5px] before:mr-1
                                  before:box-border before:block
                                  before:h-1.5 before:w-2.5
                                  before:rounded-tl-md before:border-t
                                  before:border-l before:border-gray-300
                                  before:transition-all after:pointer-events-none
                                  after:mt-[6.5px] after:ml-1 after:box-border
                                  after:block after:h-1.5 after:w-2.5
                                  after:flex-grow after:rounded-tr-md
                                  after:border-t after:border-r
                                  after:border-gray-300 after:transition-all
                                  
                                  peer-placeholder-shown:
                                  peer-placeholder-shown:leading-[3.75]
                                  dark:peer-placeholder-shown:text-gray-500 
                                  dark:peer-placeholder:text-gray-500 
                                  peer-placeholder-shown:before:border-transparent
                                  peer-placeholder-shown:after:border-transparent
                                  peer-focus:text-[11px] peer-focus:leading-tight
                                peer-focus:text-gray-600
                                dark:peer-focus:text-gray-200
                                  
                                  peer-focus:before:border-t-1
                                  peer-focus:before:border-l-1
                                  peer-focus:before:border-gray-600
                                  
                                  dark:peer-focus:before:border-l-1
                                  dark:peer-focus:before:border-gray-200
                                  peer-focus:after:border-t-1
                                  peer-focus:after:border-r-1
                                peer-focus:after:border-gray-600
                                dark:peer-focus:after:border-gray-200
                                  peer-disabled:text-transparent
                                  peer-disabled:before:border-transparent
                                  peer-disabled:after:border-transparent"
                                >
                                  Requisição
                                </label>
                              </div>
                            </div>
                          </div>
                          <div className="flex w-[100%]  space-x-1 text-gray-700 dark:text-gray-300 justify-start  ">
                            <div className="w-full text-primary flex items-center">
                              <div className="relative  h-full w-full min-w-[200px]">
                                <input
                                  className="peer h-full w-full
                     
                                    rounded-[7px] border  
                                  border-gray-300 dark:border-gray-50
                                  
                                    dark:focus:border-t-transparent
                                    
                                    bg-transparent 
                                    
                                    px-3 py-2.5 !pr-9 font-sans 
                                     font-normal
                                    focus:text-gray-600 
                                    focus:border-1
                                    dark:focus:text-gray-200
                                    dark:focus:border-2
                                    dark:focus:border-gray-200 
                                    outline outline-0 transition-all   
                                    focus:border-gray-600
                                    focus:border-t-transparent 
                                    dark:border-t-transparent
                                    placeholder-shown:border-t  
                                placeholder-shown:border-gray-300
                                placeholder-shown:placeholder-gray-400 
                                dark:placeholder-shown:placeholder-gray-500
                                dark:placeholder-shown:border-gray-400
                                
                                    border-t-transparent focus:outline-0 
                                    disabled:border-0 disabled:bg-gray-50
                                    "
                                  value={obs || ''}
                                  onChange={(e) => {
                                    setObs(e.target.value);
                                    return 0;
                                  }}
                                  placeholder={''}
                                />
                                <label
                                  className="before:content[' ']
                                  after:content[' '] pointer-events-none
                                  absolute left-0 -top-1.5 flex h-full
                                  w-full select-none text-[11px]
                                  font-normal leading-tight
                                  text-gray-400 transition-all
                                  before:pointer-events-none
                                  before:mt-[6.5px] before:mr-1
                                  before:box-border before:block
                                  before:h-1.5 before:w-2.5
                                  before:rounded-tl-md before:border-t
                                  before:border-l before:border-gray-300
                                  before:transition-all after:pointer-events-none
                                  after:mt-[6.5px] after:ml-1 after:box-border
                                  after:block after:h-1.5 after:w-2.5
                                  after:flex-grow after:rounded-tr-md
                                  after:border-t after:border-r
                                  after:border-gray-300 after:transition-all
                                  
                                  peer-placeholder-shown:
                                  peer-placeholder-shown:leading-[3.75]
                                  dark:peer-placeholder-shown:text-gray-500 
                                  dark:peer-placeholder:text-gray-500 
                                  peer-placeholder-shown:before:border-transparent
                                  peer-placeholder-shown:after:border-transparent
                                  peer-focus:text-[11px] peer-focus:leading-tight
                                peer-focus:text-gray-600
                                dark:peer-focus:text-gray-200
                                  
                                  peer-focus:before:border-t-1
                                  peer-focus:before:border-l-1
                                  peer-focus:before:border-gray-600
                                  
                                  dark:peer-focus:before:border-l-1
                                  dark:peer-focus:before:border-gray-200
                                  peer-focus:after:border-t-1
                                  peer-focus:after:border-r-1
                                peer-focus:after:border-gray-600
                                dark:peer-focus:after:border-gray-200
                                  peer-disabled:text-transparent
                                  peer-disabled:before:border-transparent
                                  peer-disabled:after:border-transparent"
                                >
                                  Observação
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="h-[19%] space-x-3  dark:bg-zinc-900 
                                  flex items-center w-full border-b
                                  border-gray-300 dark:border-gray-400"
                  >
                    <div className="flex px-6 w-full h-full]">
                      <div className="flex w-full    ">
                        <div className="flex w-full   ">
                          <div className="flex w-full  space-x-5 text-green-700 dark:text-green-300 justify-start  ">
                            <div
                              className={`w-[65%] text-primary flex items-center ${
                                obrigTranporte
                                  ? 'bg-red-50 dark:bg-red-900/30 ring-1 ring-red-400 rounded-md p-1'
                                  : ''
                              }`}
                            >
                              <SelecionarTransporte
                                dadosTransporte={dadosTransporte}
                                obrigTransporte={obrigTranporte}
                                transporteSel={transporteSel}
                                handleTransporteSel={handleTransporteSel}
                              />
                            </div>

                            <div className="w-[30%]">
                              <div className="flex w-[100%]  space-x-1 text-gray-700 dark:text-gray-300 justify-start  ">
                                <div className="w-full text-primary flex items-center">
                                  <div className="relative  h-full w-full min-w-[120px]">
                                    <input
                                      className="peer h-full w-full
                     
                                    rounded-[7px] border  
                                  border-gray-300 dark:border-gray-50
                                  
                                    dark:focus:border-t-transparent
                                    
                                    bg-transparent 
                                    
                                    px-3 py-2.5 !pr-9 font-sans 
                                     font-normal
                                    focus:text-gray-600 
                                    focus:border-1
                                    dark:focus:text-gray-200
                                    dark:focus:border-2
                                    dark:focus:border-gray-200 
                                    outline outline-0 transition-all   
                                    focus:border-gray-600
                                    focus:border-t-transparent 
                                    dark:border-t-transparent
                                    placeholder-shown:border-t  
                                placeholder-shown:border-gray-300
                                placeholder-shown:placeholder-gray-400 
                                dark:placeholder-shown:placeholder-gray-500
                                dark:placeholder-shown:border-gray-400
                                
                                    border-t-transparent focus:outline-0 
                                    disabled:border-0 disabled:bg-gray-50
                                    "
                                      value={valTransp}
                                      onChange={(e) => {
                                        const ourNumber =
                                          e.target.value.replace(
                                            /[^0-9]/g,
                                            '.',
                                          );

                                        setValTransp(ourNumber);
                                        setValTranspDec(Number(ourNumber));
                                        return 0;
                                      }}
                                      onFocus={() => {
                                        setValTransp('');
                                      }}
                                      onBlur={() => {
                                        const newValor = Number(
                                          valTransp,
                                        ).toLocaleString('pt-br', {
                                          style: 'currency',
                                          currency: 'BRL',
                                        });
                                        setValTransp(newValor);
                                      }}
                                      placeholder={''}
                                    />
                                    <label
                                      className="before:content[' ']
                                  after:content[' '] pointer-events-none
                                  absolute left-0 -top-1.5 flex h-full
                                  w-full select-none text-[11px]
                                  font-normal leading-tight
                                  text-gray-400 transition-all
                                  before:pointer-events-none
                                  before:mt-[6.5px] before:mr-1
                                  before:box-border before:block
                                  before:h-1.5 before:w-2.5
                                  before:rounded-tl-md before:border-t
                                  before:border-l before:border-gray-300
                                  before:transition-all after:pointer-events-none
                                  after:mt-[6.5px] after:ml-1 after:box-border
                                  after:block after:h-1.5 after:w-2.5
                                  after:flex-grow after:rounded-tr-md
                                  after:border-t after:border-r
                                  after:border-gray-300 after:transition-all
                                  
                                  peer-placeholder-shown:
                                  peer-placeholder-shown:leading-[3.75]
                                  dark:peer-placeholder-shown:text-gray-500 
                                  dark:peer-placeholder:text-gray-500 
                                  peer-placeholder-shown:before:border-transparent
                                  peer-placeholder-shown:after:border-transparent
                                  peer-focus:text-[11px] peer-focus:leading-tight
                                peer-focus:text-gray-600
                                dark:peer-focus:text-gray-200
                                  
                                  peer-focus:before:border-t-1
                                  peer-focus:before:border-l-1
                                  peer-focus:before:border-gray-600
                                  
                                  dark:peer-focus:before:border-l-1
                                  dark:peer-focus:before:border-gray-200
                                  peer-focus:after:border-t-1
                                  peer-focus:after:border-r-1
                                peer-focus:after:border-gray-600
                                dark:peer-focus:after:border-gray-200
                                  peer-disabled:text-transparent
                                  peer-disabled:before:border-transparent
                                  peer-disabled:after:border-transparent"
                                    >
                                      Valor Transporte
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className=" flex w-full    ">
                              <div className="flex w-full   ">
                                <div className="flex w-full  space-x-1 text-green-700 dark:text-green-300 justify-start  ">
                                  <div className="w-full   space-x-3 text-primary flex items-center">
                                    <Select
                                      value={fPagamento}
                                      onValueChange={handleFPagamento}
                                    >
                                      <SelectTrigger
                                        className={`w-full ${
                                          obrigFP
                                            ? 'bg-red-100 dark:bg-red-900/30 ring-1 ring-red-400'
                                            : ''
                                        }`}
                                      >
                                        <SelectValue
                                          placeholder={`${
                                            obrigFP
                                              ? 'FP é Obrigatória'
                                              : 'Forma de pagamento'
                                          }`}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectGroup>
                                          <SelectLabel>
                                            Opções de Pagamento:
                                          </SelectLabel>

                                          {/* Lista vinda da API: mostra "id - descricao" */}
                                          {opcoesFPFiltradas.length > 0 ? (
                                            opcoesFPFiltradas.map((o) => (
                                              <SelectItem
                                                key={o.id}
                                                value={o.id}
                                              >
                                                {o.descricao}
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <SelectItem disabled value="__sem">
                                              sem opções para o prazo
                                            </SelectItem>
                                          )}
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="w-full">
                              <DropdownMenu
                                open={openFim}
                                onOpenChange={(open) => {
                                  const canOpen = Number(totalVenda) >= 30;
                                  if (!canOpen && open) return; // bloqueia a tentativa de abrir
                                  setOpenFim(open);
                                }}
                              >
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    className={`w-full text-[8px] md:text-[10px] ${
                                      statusVenda === 'VENDA LIBERADA'
                                        ? 'hover:bg-green-500 bg-green-600'
                                        : 'hover:bg-red-500 bg-red-600'
                                    } ${
                                      totalVenda < 30 &&
                                      'hover:bg-gray-600 bg-gray-600'
                                    } font-bold flex items-center`}
                                    variant="outline"
                                    // 🔒 Bloqueia a abertura quando totalVenda <= 30
                                    onPointerDown={(e) => {
                                      const canOpen = Number(totalVenda) > 30;
                                      if (!canOpen) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }
                                    }}
                                    onClick={(e) => {
                                      const canOpen = Number(totalVenda) > 30;
                                      if (!canOpen) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                      }
                                      setOpenFim(true);
                                    }}
                                    aria-disabled={Number(totalVenda) <= 30}
                                    title={
                                      Number(totalVenda) <= 30
                                        ? 'Total deve ser maior que 30 para abrir'
                                        : ''
                                    }
                                  >
                                    <div className="flex  space-x-1 text-green-700 dark:text-green-300 justify-start">
                                      <div
                                        className={`w-full text-[8px] md:text-[10px] ${
                                          statusVenda === 'VENDA LIBERADA' ||
                                          'VALOR MINIMO R$ 30,00'
                                            ? ' text-white'
                                            : ' animate-blink text-white'
                                        } font-bold flex items-center`}
                                      >
                                        {statusVenda}
                                      </div>
                                    </div>
                                  </Button>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent className="w-full">
                                  <DropdownMenuLabel>
                                    O QUE FAZER?
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup>
                                    <DropdownMenuItem
                                      className="w-64"
                                      onSelect={async () => {
                                        setOpenFim(false);
                                        const faltas = validarObrigatorios();
                                        if (faltas.length > 0) {
                                          const faltas2 = validarObrigatorios();

                                          setObrigFP(
                                            faltas2.includes(
                                              'Forma de pagamento',
                                            ),
                                          );
                                          setObrigPrazo(
                                            faltas2.includes('Prazo'),
                                          );
                                          setObrigTransporte(
                                            faltas2.includes(
                                              'Tipo de transporte',
                                            ),
                                          );

                                          if (faltas2.length > 0) {
                                            setObrigList(faltas2);
                                            setObrigOpen(true);
                                            return;
                                          }

                                          setObrigFP(false);
                                          setObrigPrazo(false);
                                          setObrigTransporte(false);

                                          setObrigList(faltas2);
                                          setObrigOpen(true);
                                          return;
                                        }
                                        if (openFim) await handleSalvarVenda();
                                      }}
                                    >
                                      <FaSave />
                                      <span className="ml-2">
                                        Salvar Orçamento
                                      </span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onSelect={() => {
                                        setOpenFim(false);
                                        const faltas = validarObrigatorios();
                                        if (faltas.length > 0) {
                                          const faltas2 = validarObrigatorios();

                                          setObrigFP(
                                            faltas2.includes(
                                              'Forma de pagamento',
                                            ),
                                          );
                                          setObrigPrazo(
                                            faltas2.includes('Prazo'),
                                          );
                                          setObrigTransporte(
                                            faltas2.includes(
                                              'Tipo de transporte',
                                            ),
                                          );

                                          if (faltas2.length > 0) {
                                            setObrigList(faltas2);
                                            setObrigOpen(true);
                                            return;
                                          }

                                          setObrigFP(false);
                                          setObrigPrazo(false);
                                          setObrigTransporte(false);

                                          setObrigList(faltas2);
                                          setObrigOpen(true);
                                          return;
                                        }
                                        handleFinalizar();
                                      }}
                                      disabled={
                                        statusVenda === 'BLOQUEIO FINANCEIRO' ||
                                        statusVenda === 'VENDA BLOQUEADA' ||
                                        blocDesc ||
                                        blocPrecoEdit
                                      }
                                    >
                                      <FaBagShopping />
                                      <span className="ml-2">
                                        Finalizar Venda
                                      </span>
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {openPdf ? (
                              <SalvarPdf
                                usuario={vendedorSel}
                                carrinho={carrinho}
                                setOpenPdf={setOpenPdf}
                                nPedido={nPedido}
                                cliente={clienteSelect}
                                dadosEmpresa={dadosEmpresa}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[calc(100%-7rem)] w-full border-t border-gray-300  flex justify-center items-center ">
                <div className="h-full w-full">
                  <div className="h-[calc(100%-3rem)]  flex justify-center items-center">
                    {mensagem.length ? (
                      <div>
                        <div>
                          {iconesInfo === 'falha' ? (
                            <div className="py-4 flex justify-center">
                              <BiSolidError
                                className=" dark:text-red-200 text-red-400"
                                size={60}
                              />{' '}
                            </div>
                          ) : null}
                          {iconesInfo === 'none' ? (
                            <div className="py-4 flex justify-center">
                              <PiSmileySadFill
                                className=" dark:text-yellow-200 text-yellow-300"
                                size={60}
                              />{' '}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-center whitespace-pre-line">
                          {mensagem}
                        </div>
                      </div>
                    ) : (
                      <div>
                        {loadingProd ? (
                          <Carregamento />
                        ) : (
                          <div>
                            <div>
                              {iconesInfo === '' ? (
                                <div className="py-4 flex justify-center">
                                  <GiShoppingCart
                                    className=" dark:text-green-300 text-green-600"
                                    size={60}
                                  />{' '}
                                </div>
                              ) : null}
                            </div>
                            <div>
                              <div className="w-full h-full flex justify-center items-center dark:text-green-200 text-green-600 font-bold ">
                                O CARRINHO ESTÁ VAZIO
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {openEsvaziar ? <ConfirmaDel handleDelete={handleDelete} /> : null}
        </div>
      ) : null}

      {openModalPrazo ? (
        <ModalPrazoParcelas
          onConfirm={handlePrazosSalvos}
          onClose={() => setOpenModalPrazo(false)}
          // Passe o array de prazos como valor inicial
          dadosIniciais={prazosArray}
        />
      ) : null}
      <ModalBloqueio
        open={bloqueioCarrinho}
        onClose={() => setBloqueioCarrinho(false)}
        message={mensagem || MSG_SEM_VENDEDOR}
      />
      {envioOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              // permite fechar só quando não está enviando
              if (envioStep === 'enviando' || envioStep === 'montando') return;
              setEnvioOpen(false);
              setEnvioResp(null);
              setEnvioMsg('');
              setEnvioStep('montando');
            }}
          />
          {/* card */}
          <div className="relative z-10 w-[92%] max-w-md rounded-xl bg-white p-5 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3">
              {/* ícone / spinner */}
              {envioStep === 'enviando' || envioStep === 'montando' ? (
                <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
              ) : envioStep === 'ok' ? (
                <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white">
                  ✓
                </div>
              ) : (
                <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center text-white">
                  !
                </div>
              )}

              <div className="flex-1">
                <div className="font-semibold text-slate-800">
                  {envioStep === 'montando' && 'Montando dados'}
                  {envioStep === 'enviando' && 'Enviando venda'}
                  {envioStep === 'ok' && 'Venda finalizada'}
                  {envioStep === 'erro' && 'Falha ao finalizar'}
                </div>
                <div className="text-sm text-slate-600 mt-0.5">{envioMsg}</div>
              </div>
            </div>

            {envioStep === 'ok' && envioResp && (
              <div className="mt-3 text-sm text-slate-700">
                <div>
                  <span className="text-slate-500">Código:</span>{' '}
                  {envioResp.codvenda}
                </div>
                <div>
                  <span className="text-slate-500">Número:</span>{' '}
                  {envioResp.nrovenda}
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  {envioResp.status}
                </div>
                <div>
                  <span className="text-slate-500">Total:</span>{' '}
                  {MascaraReal?.(envioResp.total) ?? envioResp.total}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {envioStep === 'ok' || envioStep === 'erro' ? (
                <>
                  {envioStep === 'ok' && (
                    <>
                      {/* Após finalizar, opção de começar uma nova venda limpa */}
                      <button
                        className="px-3 w-36 h-9 rounded-md bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          try {
                            sessionStorage.removeItem('vendaDraftIdMelo');
                          } catch {}
                          setEnvioOpen(false);
                          setSalvarResp(null);
                          setSalvarMsg('');
                          setSalvarStep('montando');

                          // reset mínimo (mantive seus setters já existentes)
                          setCarrinho([]);
                          resetPersistenciaVenda(true);
                          setClienteSelect({
                            codigo: '',
                            nome: '',
                            documento: '',
                            nomeFantasia: '',
                            saldo: 0,
                            status: '',
                            desconto: 0,
                            IPI: '',
                            ICMS: '',
                            zona: '',
                            CLASPGTO: '',
                            UF: '',
                            TIPO: '',
                            limiteAtraso: 0,
                            diasAtrasado: 0,
                            tipoPreco: '',
                            CODVEND: '',
                            FONE: '',
                            ENDER: '',
                            BAIRRO: '',
                            CIDADE: '',
                            CEP: '',
                            KICKBACK: false,
                          });
                          setDadosClienteSel({
                            codigo: '',
                            nome: '',
                            documento: '',
                            nomeFantasia: '',
                          });
                          setPrecoCliente('');
                          setPedido('');
                          setObs('');
                          setObsFat('');
                          setFPagamento('');
                          setAvista(false);
                          setStatusFPagamento(true);
                          setTela('0');

                          try {
                            sessionStorage.setItem(
                              'carrinhoMelo',
                              JSON.stringify([]),
                            );
                            sessionStorage.removeItem('clienteSelectMelo');
                            sessionStorage.removeItem('dadosClienteSelMelo');
                            sessionStorage.removeItem('precoClienteMelo');
                            sessionStorage.removeItem('nPedidoMelo');
                            sessionStorage.removeItem('documentoVendaMelo');
                            sessionStorage.removeItem('prazoVendaMelo');
                            sessionStorage.removeItem(HYDRATE_DONE_KEY);
                          } catch {}
                        }}
                        title="Limpar carrinho e iniciar uma nova venda"
                      >
                        Nova venda
                      </button>
                    </>
                  )}

                  {/* Fechar (inclui caso de erro) */}
                  <button
                    className="px-3 w-36 h-9 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => {
                      try {
                        sessionStorage.removeItem('vendaDraftIdMelo');
                      } catch {}
                      setSalvarOpen(false);
                      setSalvarResp(null);
                      setSalvarMsg('');
                      setSalvarStep('montando');

                      // reset mínimo (mantive seus setters já existentes)
                      setCarrinho([]);
                      resetPersistenciaVenda(true);
                      setClienteSelect({
                        codigo: '',
                        nome: '',
                        documento: '',
                        nomeFantasia: '',
                        saldo: 0,
                        status: '',
                        desconto: 0,
                        IPI: '',
                        ICMS: '',
                        zona: '',
                        CLASPGTO: '',
                        UF: '',
                        TIPO: '',
                        limiteAtraso: 0,
                        diasAtrasado: 0,
                        tipoPreco: '',
                        CODVEND: '',
                        FONE: '',
                        ENDER: '',
                        BAIRRO: '',
                        CIDADE: '',
                        CEP: '',
                        KICKBACK: false,
                      });
                      setDadosClienteSel({
                        codigo: '',
                        nome: '',
                        documento: '',
                        nomeFantasia: '',
                      });
                      setPrecoCliente('');
                      setPedido('');
                      setObs('');
                      setObsFat('');
                      setFPagamento('');
                      setAvista(false);
                      setStatusFPagamento(true);
                      setTela('0');

                      try {
                        sessionStorage.setItem(
                          'carrinhoMelo',
                          JSON.stringify([]),
                        );
                        sessionStorage.removeItem('clienteSelectMelo');
                        sessionStorage.removeItem('dadosClienteSelMelo');
                        sessionStorage.removeItem('precoClienteMelo');
                        sessionStorage.removeItem('nPedidoMelo');
                        sessionStorage.removeItem('documentoVendaMelo');
                        sessionStorage.removeItem('prazoVendaMelo');
                      } catch {}
                      handleIrParaCentralVendas();
                    }}
                    title="Fechar e continuar editando este rascunho"
                  >
                    Central de Vendas
                  </button>
                </>
              ) : (
                <button
                  className="px-3 h-9 rounded-md bg-slate-300 text-slate-700 cursor-not-allowed"
                  disabled
                >
                  Aguarde...
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {salvarOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              // permite fechar só quando não está enviando
              if (salvarStep === 'enviando' || salvarStep === 'montando')
                return;
              setSalvarOpen(false);
              setSalvarResp(null);
              setSalvarMsg('');
              setSalvarStep('montando');
            }}
          />
          {/* card */}
          <div className="relative z-10 w-[92%] max-w-md rounded-xl bg-white p-5 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3">
              {/* ícone / spinner */}
              {salvarStep === 'enviando' || salvarStep === 'montando' ? (
                <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
              ) : salvarStep === 'ok' ? (
                <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white">
                  ✓
                </div>
              ) : (
                <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center text-white">
                  !
                </div>
              )}

              <div className="flex-1">
                <div className="font-semibold text-slate-800">
                  {salvarStep === 'montando' && 'Montando dados'}
                  {salvarStep === 'enviando' && 'Salvando venda'}
                  {salvarStep === 'ok' && 'Rascunho salvo'}
                  {salvarStep === 'erro' && 'Falha ao salvar'}
                </div>
                {salvarStep === 'erro' && (
                  <div className="text-sm text-slate-600 mt-0.5">
                    {salvarMsg}
                  </div>
                )}
              </div>
            </div>

            {/* detalhes opcionais do retorno */}
            {salvarStep === 'ok' && salvarResp && (
              <div className="mt-3 text-sm text-slate-700">
                <div className="flex justify-center">
                  <span className="text-slate-500">ID:</span>{' '}
                  {salvarResp?.draft_id ||
                    salvarResp?.id ||
                    salvarResp?.external_id}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end gap-2">
              {salvarStep === 'ok' || salvarStep === 'erro' ? (
                <>
                  {salvarStep === 'ok' && (
                    <>
                      {/* Fecha e continua na mesma venda (mantém o draft no storage) */}
                      <button
                        className="px-3 w-36 h-9 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => {
                          try {
                            sessionStorage.removeItem('vendaDraftIdMelo');
                          } catch {}
                          setSalvarOpen(false);
                          setSalvarResp(null);
                          setSalvarMsg('');
                          setSalvarStep('montando');

                          // reset mínimo (mantive seus setters já existentes)
                          setCarrinho([]);
                          resetPersistenciaVenda(true);
                          setClienteSelect({
                            codigo: '',
                            nome: '',
                            documento: '',
                            nomeFantasia: '',
                            saldo: 0,
                            status: '',
                            desconto: 0,
                            IPI: '',
                            ICMS: '',
                            zona: '',
                            CLASPGTO: '',
                            UF: '',
                            TIPO: '',
                            limiteAtraso: 0,
                            diasAtrasado: 0,
                            tipoPreco: '',
                            CODVEND: '',
                            FONE: '',
                            ENDER: '',
                            BAIRRO: '',
                            CIDADE: '',
                            CEP: '',
                            KICKBACK: false,
                          });
                          setDadosClienteSel({
                            codigo: '',
                            nome: '',
                            documento: '',
                            nomeFantasia: '',
                          });
                          setPrecoCliente('');
                          setPedido('');
                          setObs('');
                          setObsFat('');
                          setFPagamento('');
                          setAvista(false);
                          setStatusFPagamento(true);
                          setTela('0');

                          try {
                            sessionStorage.setItem(
                              'carrinhoMelo',
                              JSON.stringify([]),
                            );
                            sessionStorage.removeItem('clienteSelectMelo');
                            sessionStorage.removeItem('dadosClienteSelMelo');
                            sessionStorage.removeItem('precoClienteMelo');
                            sessionStorage.removeItem('nPedidoMelo');
                            sessionStorage.removeItem('documentoVendaMelo');
                            sessionStorage.removeItem('prazoVendaMelo');
                          } catch {}
                          handleIrParaCentralVendas();
                        }}
                        title="Fechar e continuar editando este rascunho"
                      >
                        Central de Vendas
                      </button>

                      {/* Nova venda: limpa carrinho/cliente e apaga o draft */}
                      <button
                        className="px-3 w-36 h-9 rounded-md bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => {
                          try {
                            sessionStorage.removeItem('vendaDraftIdMelo');
                          } catch {}
                          setSalvarOpen(false);
                          setSalvarResp(null);
                          setSalvarMsg('');
                          setSalvarStep('montando');

                          // reset mínimo (mantive seus setters já existentes)
                          setCarrinho([]);
                          resetPersistenciaVenda(true);
                          setClienteSelect({
                            codigo: '',
                            nome: '',
                            documento: '',
                            nomeFantasia: '',
                            saldo: 0,
                            status: '',
                            desconto: 0,
                            IPI: '',
                            ICMS: '',
                            zona: '',
                            CLASPGTO: '',
                            UF: '',
                            TIPO: '',
                            limiteAtraso: 0,
                            diasAtrasado: 0,
                            tipoPreco: '',
                            CODVEND: '',
                            FONE: '',
                            ENDER: '',
                            BAIRRO: '',
                            CIDADE: '',
                            CEP: '',
                            KICKBACK: false,
                          });
                          setDadosClienteSel({
                            codigo: '',
                            nome: '',
                            documento: '',
                            nomeFantasia: '',
                          });
                          setPrecoCliente('');
                          setPedido('');
                          setObs('');
                          setObsFat('');
                          setFPagamento('');
                          setAvista(false);
                          setStatusFPagamento(true);
                          setTela('0');

                          try {
                            sessionStorage.setItem(
                              'carrinhoMelo',
                              JSON.stringify([]),
                            );
                            sessionStorage.removeItem('clienteSelectMelo');
                            sessionStorage.removeItem('dadosClienteSelMelo');
                            sessionStorage.removeItem('precoClienteMelo');
                            sessionStorage.removeItem('nPedidoMelo');
                            sessionStorage.removeItem('documentoVendaMelo');
                            sessionStorage.removeItem('prazoVendaMelo');
                            sessionStorage.removeItem(HYDRATE_DONE_KEY);
                          } catch {}
                        }}
                        title="Limpar carrinho e iniciar uma nova venda"
                      >
                        Nova venda
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  className="px-3 h-9 rounded-md bg-slate-300 text-slate-700 cursor-not-allowed"
                  disabled
                >
                  Aguarde...
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal: Itens obrigatórios ausentes */}
      {obrigOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setObrigOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-3 text-lg font-semibold">
              Itens obrigatórios pendentes
            </h2>

            {obrigList.length > 0 ? (
              <div className="mb-4 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-800 dark:border-amber-600/40 dark:bg-amber-400/10 dark:text-amber-200">
                <p className="mb-2 text-sm">
                  Para continuar, preencha os seguintes itens:
                </p>
                <ul className="list-inside list-disc text-sm">
                  {obrigList.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">
                Nenhum item listado.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                onClick={() => setObrigOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
