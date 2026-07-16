import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';

export type TipoAux = 'marca' | 'grupoFuncao' | 'grupoProduto';

interface CadastroRapidoAuxProps {
  aberto: boolean;
  tipo: TipoAux;
  onClose: () => void;
  /** Chamado quando o registro é criado com sucesso (código + descrição). */
  onCriado: (codigo: string, descr: string) => void;
  /** Já cadastrados, para acusar duplicidade enquanto digita. O servidor
   *  revalida — esta lista pode estar desatualizada. */
  existentes?: { codigo: string; descr: string }[];
}

/** Compara como o usuário enxerga: ignora caixa, acentos e espaços repetidos —
 *  "Bosch", "BOSCH " e "BÓSCH" são a mesma marca. */
const normalizar = (s: string) =>
  (s || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

/** Campo obrigatório além da Descrição, quando a API exige (ex.: Segmento no
 *  Grupo de Produto — obrigatório igual ao Delphi). */
type CampoExtra = {
  rotulo: string;
  url: string;
  /** Monta as opções a partir do payload da API. */
  opcoes: (d: any) => { valor: string; texto: string }[];
  erroVazio: string;
};

const CONFIG: Record<
  TipoAux,
  {
    titulo: string;
    url: string;
    body: (descr: string, extra?: string) => Record<string, any>;
    extrair: (d: any) => { codigo?: string; descr?: string };
    extra?: CampoExtra;
  }
> = {
  marca: {
    titulo: 'Nova Marca',
    url: '/api/marcas/add',
    body: (descr) => ({ descr, bloquear_preco: 'S' }),
    extrair: (d) => ({ codigo: d?.data?.codmarca, descr: d?.data?.descr }),
  },
  grupoFuncao: {
    titulo: 'Novo Grupo de Função',
    url: '/api/gruposFuncao/add',
    body: (descr) => ({ descr }),
    extrair: (d) => ({ codigo: d?.data?.codgpf, descr: d?.data?.descr }),
  },
  grupoProduto: {
    titulo: 'Novo Grupo de Produto',
    url: '/api/gruposProduto/add',
    // /api/gruposProduto/add rejeita sem codseg ("O Segmento é obrigatório").
    body: (descr, extra) => ({ descr, codseg: extra }),
    extrair: (d) => ({ codigo: d?.data?.codgpp, descr: d?.data?.descr }),
    extra: {
      rotulo: 'Segmento',
      url: '/api/segmentos/get?perPage=999',
      opcoes: (d) =>
        (d?.data || []).map((s: any) => ({
          valor: String(s.codsegmento ?? '').trim(),
          texto: `${String(s.codsegmento ?? '').trim()} - ${String(s.descricao ?? '').trim()}`,
        })),
      erroVazio: 'O Segmento é obrigatório.',
    },
  },
};

/**
 * Modal de cadastro rápido (código gerado automaticamente, só a Descrição) para
 * criar Marca / Grupo de Função / Grupo de Produto na hora, sem sair do
 * cadastro de produto. Ao salvar, devolve o código para já ser selecionado.
 */
const CadastroRapidoAux: React.FC<CadastroRapidoAuxProps> = ({
  aberto,
  tipo,
  onClose,
  onCriado,
  existentes = [],
}) => {
  const [descr, setDescr] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [extra, setExtra] = useState('');
  const [extraOpcoes, setExtraOpcoes] = useState<
    { valor: string; texto: string }[]
  >([]);
  const [carregandoExtra, setCarregandoExtra] = useState(false);

  useEffect(() => {
    if (aberto) {
      setDescr('');
      setErro('');
      setSalvando(false);
      setExtra('');
    }
  }, [aberto, tipo]);

  // Carrega as opções do campo extra (ex.: Segmento) ao abrir
  useEffect(() => {
    const cfgExtra = CONFIG[tipo].extra;
    if (!aberto || !cfgExtra) {
      setExtraOpcoes([]);
      return;
    }
    let vivo = true;
    setCarregandoExtra(true);
    fetch(cfgExtra.url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo) setExtraOpcoes(d ? cfgExtra.opcoes(d) : []);
      })
      .catch(() => {
        if (vivo) setExtraOpcoes([]);
      })
      .finally(() => {
        if (vivo) setCarregandoExtra(false);
      });
    return () => {
      vivo = false;
    };
  }, [aberto, tipo]);

  const alvo = normalizar(descr);

  // Já existe exatamente esta descrição? (bloqueia o salvar)
  const duplicada = alvo
    ? existentes.find((e) => normalizar(e.descr) === alvo)
    : undefined;

  // Parecidas — pega o quase-duplicado ("BOSCH" vs "BOSCH DIESEL") que a
  // comparação exata não pega. Só informa, não bloqueia.
  const similares =
    alvo.length >= 2 && !duplicada
      ? existentes
          .filter((e) => normalizar(e.descr).includes(alvo))
          .slice(0, 4)
      : [];

  if (!aberto) return null;
  const cfg = CONFIG[tipo];

  const salvar = async () => {
    setErro('');
    const d = descr.trim();
    if (!d) {
      setErro('Informe a descrição.');
      return;
    }
    if (duplicada) {
      setErro(`Já cadastrado como ${duplicada.codigo} - ${duplicada.descr}.`);
      return;
    }
    if (cfg.extra && !extra) {
      setErro(cfg.extra.erroVazio);
      return;
    }
    setSalvando(true);
    try {
      const resp = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg.body(d, extra)),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErro(data?.error || data?.message || 'Falha ao cadastrar.');
        return;
      }
      const { codigo, descr: descrCriada } = cfg.extrair(data);
      if (!codigo) {
        setErro('Cadastrado, mas não foi possível obter o código.');
        return;
      }
      onCriado(String(codigo).trim(), String(descrCriada ?? d).trim());
      onClose();
    } catch (e) {
      setErro('Erro ao cadastrar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-blue-600 dark:text-blue-300">
            {cfg.titulo}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-red-500"
          >
            <X size={18} />
          </button>
        </div>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Descrição *
        </label>
        <input
          type="text"
          autoFocus
          value={descr}
          onChange={(e) => setDescr(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              salvar();
            }
          }}
          className={`w-full h-10 px-3 text-sm border rounded bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100 ${
            duplicada
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-300 dark:border-zinc-600'
          }`}
          placeholder="Digite a descrição"
        />

        {/* Duplicidade: já existe com essa descrição */}
        {duplicada && (
          <p className="flex items-center gap-1 text-red-500 text-xs mt-1">
            <AlertCircle size={13} />
            Já cadastrado como{' '}
            <strong>
              {duplicada.codigo} - {duplicada.descr}
            </strong>
          </p>
        )}

        {/* Parecidas: alerta o quase-duplicado sem impedir o cadastro */}
        {similares.length > 0 && (
          <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <AlertCircle size={13} />
              Já existe parecido:
            </span>
            <ul className="mt-0.5 ml-4 list-disc">
              {similares.map((s) => (
                <li key={s.codigo}>
                  {s.codigo} - {s.descr}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Campo extra exigido pela API (ex.: Segmento no Grupo de Produto) */}
        {cfg.extra && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              {cfg.extra.rotulo} *
            </label>
            <select
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              disabled={carregandoExtra}
              className="w-full h-10 px-3 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100 disabled:opacity-50"
            >
              <option value="">
                {carregandoExtra
                  ? 'Carregando...'
                  : `Selecione o ${cfg.extra.rotulo.toLowerCase()}`}
              </option>
              {extraOpcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </select>
          </div>
        )}

        {erro && !duplicada && (
          <p className="text-red-500 text-xs mt-1">{erro}</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !!duplicada}
            title={duplicada ? 'Já existe um registro com essa descrição' : undefined}
            className="flex items-center gap-1 px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CadastroRapidoAux;
