'use client';

/**
 * Consulta (SOMENTE LEITURA) do cadastro do cliente a partir do Caixa.
 * Tem busca própria (qualquer cliente por código/nome/CPF-CNPJ) — não depende
 * da busca de documento do Caixa. Também abre direto num cliente (codcli) quando
 * acionado a partir de um título.
 *   - lista:   /api/clientes/get?search=
 *   - detalhe: /api/clientes/get/[id]  (traz contatos/telefones/emails)
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { User, X, Loader2, Phone, Mail, Search, ArrowLeft } from 'lucide-react';

const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// CPF (<=11 dígitos) = Física; senão Jurídica.
const docInfo = (cpfcgc?: string) => {
  const dig = String(cpfcgc || '').replace(/\D/g, '');
  if (!dig) return { tipo: '—', doc: '—' };
  if (dig.length <= 11) {
    const d = dig.padStart(11, '0');
    return { tipo: 'Física (CPF)', doc: `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` };
  }
  const d = dig.padStart(14, '0');
  return { tipo: 'Jurídica (CNPJ)', doc: `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` };
};

// Indicador de IE do destinatário (indIEDest da NF-e): 1 contribuinte, 2 isento, 9 não contribuinte.
const fmtSitTrib = (v: any) => {
  const s = String(v ?? '').trim();
  const map: Record<string, string> = { '1': '1 - Contribuinte ICMS', '2': '2 - Isento de IE', '9': '9 - Não contribuinte' };
  return map[s] || (s ? s : '—');
};
const fmtPais = (v: any) => {
  const s = String(v ?? '').trim();
  if (!s || s === '0') return '—';
  return s === '1058' ? '1058 - BRASIL' : s;
};

// Seção com título + grade de campos.
function Secao({ titulo, destaque, children }: { titulo: string; destaque?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? 'border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10' : 'border-gray-200 dark:border-slate-700'}`}>
      <div className="text-[11px] font-semibold text-gray-500 uppercase mb-2">{titulo}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** opcional: abre direto no cadastro deste cliente (ex.: a partir de um título). */
  codcli?: string | null;
  nomeCliente?: string;
}

export default function ModalConsultaCliente({ isOpen, onClose, codcli, nomeCliente }: Props) {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cli, setCli] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregarPorId = (id: string) => {
    setCarregando(true);
    setCli(null);
    fetch(`/api/clientes/get/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) setCli(d);
        else toast.error(d?.error || 'Cliente não encontrado.');
      })
      .catch(() => toast.error('Erro ao carregar o cliente.'))
      .finally(() => setCarregando(false));
  };

  // Ao abrir: com codcli → detalhe direto; sem codcli → modo busca.
  useEffect(() => {
    if (!isOpen) return;
    setBusca('');
    setLista([]);
    setCli(null);
    if (codcli) carregarPorId(codcli);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, codcli]);

  // Busca (debounced) — só no modo lista (sem cliente carregado).
  useEffect(() => {
    if (!isOpen || cli || carregando) return;
    const termo = busca.trim();
    if (termo.length < 2) { setLista([]); return; }
    const t = setTimeout(() => {
      setBuscando(true);
      fetch(`/api/clientes/get?search=${encodeURIComponent(termo)}&perPage=25`)
        .then((r) => r.json())
        .then((d) => setLista(d.data || []))
        .catch(() => setLista([]))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [busca, isOpen, cli, carregando]);

  if (!isOpen) return null;

  // contatos vem como JSON string [{type:'phone'|'email', value, obs}]
  let telefones: { value: string; obs: string }[] = [];
  let emails: string[] = [];
  try {
    const arr = cli?.contatos ? JSON.parse(cli.contatos) : [];
    telefones = arr.filter((c: any) => c.type === 'phone').map((c: any) => ({ value: c.value, obs: c.obs }));
    emails = arr.filter((c: any) => c.type === 'email').map((c: any) => c.value);
  } catch {}
  if (cli?.email && !emails.includes(cli.email)) emails.unshift(cli.email);

  const di = docInfo(cli?.cpfcgc);

  const Campo = ({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) => (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono tabular-nums' : ''} break-words`}>{children ?? '—'}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center gap-2 px-5 py-3.5 border-b border-gray-200 dark:border-slate-700">
          {cli && (
            <button className="text-gray-400 hover:text-gray-600" onClick={() => setCli(null)} title="Voltar à busca">
              <ArrowLeft size={18} />
            </button>
          )}
          <User size={18} />
          <span className="font-bold">Cadastro do cliente</span>
          {cli?.codcli && <span className="text-sm text-gray-400 font-mono">· {cli.codcli}</span>}
          <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Modo BUSCA (sem cliente carregado) */}
        {!cli && !carregando && (
          <div className="shrink-0 px-5 py-3 border-b border-gray-200 dark:border-slate-700">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente por código, nome ou CPF/CNPJ…"
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          {carregando ? (
            <div className="py-10 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Carregando…
            </div>
          ) : cli ? (
            /* DETALHE — completo, para validar rejeições de NF-e */
            <div className="flex flex-col gap-4 p-5">
              <div>
                <div className="font-bold text-base">{cli.nome || nomeCliente || '—'}</div>
                {cli.nomefant && cli.nomefant !== cli.nome && (
                  <div className="text-sm text-gray-500">{cli.nomefant}</div>
                )}
              </div>

              {/* Identificação */}
              <Secao titulo="Identificação">
                <Campo label="Código" mono>{cli.codcli}</Campo>
                <Campo label="Tipo pessoa">{di.tipo}</Campo>
                <Campo label="CPF/CNPJ" mono>{di.doc}</Campo>
                <Campo label="Status">{cli.status || '—'}</Campo>
                <Campo label="Tipo cliente">{cli.tipocliente || '—'}</Campo>
                <Campo label="Classe (codcc)">{cli.codcc || '—'}</Campo>
                <Campo label="Vendedor" mono>{cli.codvend || '—'}</Campo>
                <Campo label="Cód. único" mono>{cli.codunico || '—'}</Campo>
              </Secao>

              {/* Fiscal — campos que costumam causar rejeição SEFAZ */}
              <Secao titulo="Fiscal (NF-e)" destaque>
                <Campo label="Inscr. Estadual" mono>{cli.iest || '—'}</Campo>
                <Campo label="Indicador IE / Sit. trib." mono>{fmtSitTrib(cli.sit_tributaria)}</Campo>
                <Campo label="SUFRAMA" mono>{cli.isuframa || '—'}</Campo>
                <Campo label="Habilita SUFRAMA">{String(cli.habilitasuframa ?? '') === 'S' ? 'Sim' : (cli.habilitasuframa || '—')}</Campo>
                <Campo label="Inscr. Municipal" mono>{cli.imun || '—'}</Campo>
                <Campo label="País" mono>{fmtPais(cli.codpais)}</Campo>
                <Campo label="Cód. Município (IBGE)" mono>{cli.codmunicipio || '—'}</Campo>
                <Campo label="Regime (tipoemp)">{cli.tipoemp || '—'}</Campo>
              </Secao>

              {/* Endereço principal */}
              <Secao titulo="Endereço">
                <Campo label="Logradouro">{cli.ender || '—'}</Campo>
                <Campo label="Número" mono>{cli.numero || '—'}</Campo>
                <Campo label="Complemento">{cli.complemento || '—'}</Campo>
                <Campo label="Bairro">{cli.bairro || '—'}</Campo>
                <Campo label="Cidade">{cli.cidade || '—'}</Campo>
                <Campo label="UF" mono>{cli.uf || '—'}</Campo>
                <Campo label="CEP" mono>{cli.cep || '—'}</Campo>
                <Campo label="Referência">{cli.referencia || '—'}</Campo>
              </Secao>

              {/* Endereço de cobrança (se houver) */}
              {(cli.endercobr || cli.cidadecobr || cli.cepcobr) && (
                <Secao titulo="Endereço de cobrança">
                  <Campo label="Logradouro">{cli.endercobr || '—'}</Campo>
                  <Campo label="Número" mono>{cli.numerocobr || '—'}</Campo>
                  <Campo label="Complemento">{cli.complementocobr || '—'}</Campo>
                  <Campo label="Bairro">{cli.bairrocobr || '—'}</Campo>
                  <Campo label="Cidade">{cli.cidadecobr || '—'}</Campo>
                  <Campo label="UF" mono>{cli.ufcobr || '—'}</Campo>
                  <Campo label="CEP" mono>{cli.cepcobr || '—'}</Campo>
                  <Campo label="Cód. Município" mono>{cli.codmunicipiocobr || '—'}</Campo>
                </Secao>
              )}

              {/* Financeiro */}
              <Secao titulo="Financeiro">
                <Campo label="Limite" mono>R$ {brl(cli.limite)}</Campo>
                <Campo label="Débito atual" mono>
                  <span className={Number(cli.debito) > 0 ? 'text-red-600 dark:text-red-400' : ''}>R$ {brl(cli.debito)}</span>
                </Campo>
                <Campo label="Disponível" mono>R$ {brl(Number(cli.limite || 0) - Number(cli.debito || 0))}</Campo>
                <Campo label="Atraso (dias)" mono>{cli.atraso ?? 0}</Campo>
                <Campo label="Classe pgto">{cli.claspgto || '—'}</Campo>
                <Campo label="Banco">{cli.banco || '—'}</Campo>
                <Campo label="Acréscimo" mono>{cli.acrescimo != null ? `${brl(cli.acrescimo)}%` : '—'}</Campo>
                <Campo label="Desconto" mono>{cli.desconto != null ? `${brl(cli.desconto)}%` : '—'}</Campo>
              </Secao>

              {/* Contato */}
              <div>
                <div className="text-[11px] font-semibold text-gray-500 uppercase mb-2">Contato</div>
                <div className="flex flex-col gap-1.5 text-sm">
                  {cli.emailnfe && String(cli.emailnfe).trim() && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-blue-500" /> <span>{cli.emailnfe}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">E-mail NF-e</span>
                    </div>
                  )}
                  {telefones.map((t, i) => (
                    <div key={`t${i}`} className="flex items-center gap-2">
                      <Phone size={14} className="text-gray-400" /> <span className="font-mono">{t.value}</span>
                      {t.obs && t.obs !== 'Telefone' && <span className="text-xs text-gray-400">· {t.obs}</span>}
                    </div>
                  ))}
                  {emails.map((e, i) => (
                    <div key={`e${i}`} className="flex items-center gap-2">
                      <Mail size={14} className="text-gray-400" /> <span>{e}</span>
                    </div>
                  ))}
                  {telefones.length === 0 && emails.length === 0 && !cli.emailnfe && (
                    <span className="text-gray-400">Sem contatos cadastrados.</span>
                  )}
                </div>
              </div>

              {cli.obs && String(cli.obs).trim() && (
                <div>
                  <div className="text-[11px] font-semibold text-gray-500 uppercase mb-1">Observação</div>
                  <div className="text-sm whitespace-pre-wrap">{cli.obs}</div>
                </div>
              )}
            </div>
          ) : busca.trim().length < 2 ? (
            <div className="py-10 text-center text-sm text-gray-400">Digite ao menos 2 caracteres para buscar.</div>
          ) : buscando ? (
            <div className="py-10 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Buscando…
            </div>
          ) : lista.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">Nenhum cliente encontrado.</div>
          ) : (
            /* LISTA */
            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {lista.map((c) => {
                const d = docInfo(c.cpfcgc);
                return (
                  <li key={c.codcli}>
                    <button
                      type="button"
                      onClick={() => carregarPorId(String(c.codcli))}
                      className="w-full text-left px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 flex items-center gap-3"
                    >
                      <span className="font-mono text-xs text-gray-400 w-16 shrink-0">{c.codcli}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate">{c.nome}</span>
                        <span className="block text-xs text-gray-400 truncate">
                          {d.doc}{(c.cidade || c.uf) ? ` · ${[c.cidade, c.uf].filter(Boolean).join(' - ')}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 flex items-center px-5 py-3 border-t border-gray-200 dark:border-slate-700">
          <span className="text-xs text-gray-400">
            {cli ? 'Somente consulta' : lista.length > 0 ? `${lista.length} cliente(s)` : 'Somente consulta'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
