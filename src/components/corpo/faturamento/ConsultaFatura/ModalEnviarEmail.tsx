import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, Paperclip, Send, Plus, Loader2 } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onClose: () => void;
  codfat?: string;
  codcli?: string;
  nomeCliente?: string;
  numeroNota?: string;
  /** 'danfe' anexa a DANFE; 'cobranca' o boleto; 'comprovante' o PDF do comprovante. */
  tipo?: 'danfe' | 'cobranca' | 'comprovante';
  /** Código do grupo de pagamento — quando presente, anexa o "Resumo GP" à cobrança. */
  codgp?: string | number | null;
  /** aut_id do comprovante (quando tipo='comprovante'). */
  autId?: string;
}

/**
 * Tela de compor email (estilo Gmail) para enviar a DANFE/cobrança.
 * Pré-preenche os destinatários com os emails do cliente (principal + secundários),
 * permite adicionar/remover, editar assunto e mensagem, e envia com o PDF em anexo.
 */
export default function ModalEnviarEmail({
  open,
  onClose,
  codfat,
  codcli,
  nomeCliente,
  numeroNota,
  tipo = 'danfe',
  codgp,
  autId,
}: Props) {
  const tituloDoc = tipo === 'cobranca' ? 'Cobrança' : tipo === 'comprovante' ? 'Comprovante' : 'DANFE';
  const ehGrupo = codgp != null && String(codgp).trim() !== '';
  const [destinatarios, setDestinatarios] = useState<string[]>([]);
  const [novoEmail, setNovoEmail] = useState('');
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    // reset + pré-preenche
    setNovoEmail('');
    setAssunto(`${tituloDoc}${numeroNota ? ` nº ${numeroNota}` : ''} — MELO Peças`);
    setMensagem(
      `Olá${nomeCliente ? `, ${nomeCliente}` : ''},\n\nSegue em anexo a ${tituloDoc}${
        numeroNota ? ` nº ${numeroNota}` : ''
      }.\n\nAtenciosamente,\nMELO Peças`,
    );
    setDestinatarios([]);
    setCarregando(true);
    const q = codcli ? `codcli=${encodeURIComponent(codcli)}` : `codfat=${encodeURIComponent(codfat || '')}`;
    fetch(`/api/faturamento/emails-cliente?${q}`)
      .then((r) => r.json())
      .then((d) => setDestinatarios(Array.isArray(d?.emails) ? d.emails : []))
      .catch(() => setDestinatarios([]))
      .finally(() => setCarregando(false));
  }, [open, codfat, codcli, nomeCliente, numeroNota, tituloDoc]);

  if (!open) return null;

  const adicionarEmail = () => {
    const e = novoEmail.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL_RE.test(e)) return toast.error('Email inválido.');
    if (destinatarios.includes(e)) {
      setNovoEmail('');
      return;
    }
    setDestinatarios((prev) => [...prev, e]);
    setNovoEmail('');
  };

  const removerEmail = (e: string) => setDestinatarios((prev) => prev.filter((x) => x !== e));

  const enviar = async () => {
    if (destinatarios.length === 0) return toast.error('Adicione ao menos um destinatário.');
    setEnviando(true);
    try {
      if (tipo === 'comprovante') {
        const resp = await fetch('/api/contas-receber/comprovantes/enviar-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aut_id: autId, destinatarios, assunto, mensagem }),
        });
        const d = await resp.json();
        if (!resp.ok) throw new Error(d.detalhes || d.erro || 'Falha ao enviar.');
        toast.success(d.mensagem || 'Comprovante enviado.');
        onClose();
        return;
      }

      if (tipo === 'cobranca') {
        // 1) gera o boleto (PDF) 2) envia com o boleto anexo
        const gb = await fetch('/api/faturamento/gerar-boleto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codfat, codgp: ehGrupo ? codgp : undefined }),
        });
        const gbd = await gb.json();
        if (!gb.ok || !gbd.boleto) throw new Error(gbd.details || gbd.error || 'Falha ao gerar o boleto.');
        // Cobrança de grupo (GP): gera também o Resumo GP para anexar junto do boleto.
        let resumoGpBase64: string | undefined;
        if (ehGrupo) {
          const rg = await fetch(`/api/faturamento/resumo-gp-pdf?codgp=${encodeURIComponent(String(codgp))}`);
          const rgd = await rg.json();
          if (!rg.ok || !rgd.pdf) throw new Error(rgd.detalhes || rgd.erro || 'Falha ao gerar o Resumo GP.');
          resumoGpBase64 = rgd.pdf;
        }
        const resp = await fetch('/api/faturamento/enviar-cobranca-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codfat,
            destinatarios,
            assunto,
            mensagem,
            boletoBase64: gbd.boleto,
            resumoGpBase64,
            codgp: ehGrupo ? codgp : undefined,
          }),
        });
        const d = await resp.json();
        if (!resp.ok) throw new Error(d.detalhes || d.erro || 'Falha ao enviar.');
        toast.success(d.mensagem || 'Boleto enviado.');
        onClose();
        return;
      }

      const resp = await fetch('/api/faturamento/enviar-danfe-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codfat, destinatarios, assunto, mensagem }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.detalhes || d.erro || 'Falha ao enviar.');
      toast.success(d.mensagem || 'Email enviado.');
      onClose();
    } catch (e: any) {
      toast.error(`Erro ao enviar: ${e.message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-center sm:justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col max-h-[92vh]">
        {/* cabeçalho estilo Gmail */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 sm:rounded-t-2xl">
          <span className="font-semibold text-sm">Enviar {tituloDoc}</span>
          <button className="ml-auto text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Para: chips + adicionar */}
          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500 w-12 shrink-0">Para</span>
              {carregando ? (
                <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                  <Loader2 size={13} className="animate-spin" /> carregando emails do cliente…
                </span>
              ) : (
                <>
                  {destinatarios.map((e) => (
                    <span
                      key={e}
                      className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-full pl-3 pr-1.5 py-1 text-xs"
                    >
                      {e}
                      <button onClick={() => removerEmail(e)} className="hover:text-red-600" title="Remover">
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1 flex-1 min-w-[160px]">
                    <input
                      value={novoEmail}
                      onChange={(e) => setNovoEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          adicionarEmail();
                        }
                      }}
                      placeholder="adicionar email…"
                      className="flex-1 min-w-[120px] bg-transparent text-sm outline-none py-1"
                    />
                    {novoEmail.trim() && (
                      <button onClick={adicionarEmail} className="text-blue-600 hover:text-blue-800" title="Adicionar">
                        <Plus size={16} />
                      </button>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Assunto */}
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Assunto"
            className="w-full border-b border-gray-200 dark:border-slate-700 pb-2 mb-2 bg-transparent text-sm outline-none"
          />

          {/* Mensagem */}
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={9}
            className="w-full bg-transparent text-sm outline-none resize-none"
            placeholder="Mensagem…"
          />

          {/* Anexos */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {tipo === 'comprovante' ? (
              <span className="inline-flex items-center gap-2 text-xs bg-gray-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 border border-gray-200 dark:border-slate-700">
                <Paperclip size={14} className="text-gray-500" />
                Comprovante-{autId}.pdf
              </span>
            ) : tipo === 'cobranca' ? (
              <>
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 border border-gray-200 dark:border-slate-700">
                  <Paperclip size={14} className="text-gray-500" />
                  Boleto.pdf
                </span>
                {ehGrupo && (
                  <span className="inline-flex items-center gap-2 text-xs bg-gray-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 border border-gray-200 dark:border-slate-700">
                    <Paperclip size={14} className="text-gray-500" />
                    Resumo-GP-{String(codgp)}.pdf
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 border border-gray-200 dark:border-slate-700">
                  <Paperclip size={14} className="text-gray-500" />
                  DANFE{numeroNota ? ` nº ${numeroNota}` : ''}.pdf
                </span>
                <span className="inline-flex items-center gap-2 text-xs bg-gray-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 border border-gray-200 dark:border-slate-700">
                  <Paperclip size={14} className="text-gray-500" />
                  XML da nota (.xml)
                </span>
              </>
            )}
          </div>
        </div>

        {/* rodapé: Enviar */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={enviar}
            disabled={enviando || carregando}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-full px-5 py-2 disabled:opacity-50"
          >
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
          <span className="text-xs text-gray-400">
            {destinatarios.length} destinatário(s)
          </span>
          <button onClick={onClose} className="ml-auto text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
