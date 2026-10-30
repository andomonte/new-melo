/**
 * Faturar pré-venda (front). Reusa os endpoints prontos do faturamento SEM tocá-los.
 *
 * Dois modos:
 *  - faturarEEmitirNota (CAIXA, fiel ao Delphi): salvar (fatura + itens + estoque + título
 *    RECIBO em aberto, numa transação) → emitir NF. Se a NF falhar, a fatura e o título
 *    FICAM (sem rollback, como o CAIXA.FATURAR + gerarNFe do Delphi); a nota é reenviada
 *    depois com emitirNotaDaFatura. O recebimento é um passo separado (/api/caixa/receber).
 *  - faturarPreVenda (TRANSFERÊNCIA): mesma sequência, mas desfaz tudo (reverter-fatura)
 *    se qualquer etapa falhar.
 */
import { selecionarTipoEmissao } from '@/services/fiscal/selecionarTipoEmissao';

export interface DetalhesPreVenda {
  dbclien: any;
  dbvenda: any; // { codvenda, nrovenda, codvend, codcli, total, cnpj_empresa, ie_empresa }
  dbitvenda: any[];
  resumoFinanceiro: { totalProdutos: number; totalGeral: number };
}

export interface ResultadoNota {
  autorizada: boolean;
  status?: string;
  motivo?: string;
  numero?: string;
  chaveAcesso?: string;
  protocolo?: string;
  pdfBase64?: string;
  modelo: string;
  nomeDoc: string;
}

export interface FaturarResultado {
  codfat: string;
  cod_receb: string;
  valorTitulo: number;
  nfe: { status?: string; motivo?: string; chaveAcesso?: string; protocolo?: string; pdfBase64?: string; modelo: string };
}

export interface FaturaCaixaResultado {
  codfat: string;
  /** Título RECIBO em aberto gerado pela fatura (null = não localizado). */
  cod_receb: string | null;
  valorTitulo: number;
  nota: ResultadoNota;
}

async function jfetch(url: string, opts?: { method?: string; body?: any }) {
  const resp = await fetch(url, {
    method: opts?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  return { ok: resp.ok, httpStatus: resp.status, json };
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

// Prioriza o motivo real da SEFAZ (cStat/xMotivo na rejeição 400); no erro 500 o
// emitir-cupom manda o detalhe real em `detalhe` (o `erro` é genérico).
function motivoDaNota(nf: any): string {
  return (
    nf?.json?.motivo ||
    nf?.json?.detalhe ||
    (nf?.json?.erro && nf?.json?.erro !== 'Erro no processamento do cupom fiscal.' ? nf?.json?.erro : '') ||
    nf?.json?.erro ||
    'erro na SEFAZ'
  );
}

function tipoNota(doc: string) {
  const sel = selecionarTipoEmissao(doc);
  return { sel, nomeDoc: sel.modelo === '55' ? 'NF-e' : 'NFC-e' };
}

function montarSalvarBody(params: {
  detalhes: DetalhesPreVenda;
  codConta: string;
  tipoOperacao: string;
  comCobranca: boolean;
  codvendas?: string[];
}) {
  const { dbclien, dbvenda, resumoFinanceiro } = params.detalhes;
  const total = Number(resumoFinanceiro.totalGeral);
  const hoje = hojeISO();
  return {
    cliente: dbclien,
    vendedor: dbvenda.codvend,
    transportadora: '00051',
    data: hoje,
    pedido: dbvenda.nrovenda,
    totalprod: Number(resumoFinanceiro.totalProdutos),
    totalfat: total,
    totalnf: total,
    cod_conta: params.codConta,
    tipodoc: 'N',
    cobranca: params.comCobranca ? 'S' : 'N',
    insc07: 'N',
    tipo_movimentacao: 'SAIDA',
    tipo_operacao: params.tipoOperacao,
    // uma fatura/NF agrupando todas as vendas selecionadas (mesmo cliente)
    vendas: params.codvendas && params.codvendas.length ? params.codvendas : [dbvenda.codvenda],
    // cobrança à vista: 1 título com o total. DINHEIRO → forma_fat '1' (RECIBO), igual ao
    // CALCULAR_PRETITULO(...,'RECIBO') do Delphi. Transferência = sem título.
    cobranca_dados: params.comCobranca
      ? {
          banco: '0',
          tipofat: 'DINHEIRO',
          codvenda: dbvenda.codvenda,
          parcelas: [{ vencimento: hoje, valor: total, documento: `NF${dbvenda.nrovenda}A`, nossoNumero: '1' }],
        }
      : null,
  };
}

/**
 * Emite (ou reenvia) a NF de uma fatura JÁ gravada. Não desfaz nada.
 * Rejeição da SEFAZ volta como { autorizada: false, motivo }; só lança se não
 * conseguir nem carregar a fatura.
 * `fallback` = detalhes da pré-venda (usados se a fatura não trouxer cliente/venda/itens).
 */
export async function emitirNotaDaFatura(params: {
  codfat: string;
  fallback?: DetalhesPreVenda;
  onStep?: (etapa: string) => void;
}): Promise<ResultadoNota> {
  const { codfat, fallback, onStep } = params;

  onStep?.('Preparando emissão…');
  const fc = await jfetch(`/api/faturamento/dados-fatura-completos?codfat=${encodeURIComponent(codfat)}`);
  if (!fc.ok) throw new Error('Falha ao carregar a fatura para emissão.');
  const dbfatura = fc.json.dbfatura;
  const cliFat = fc.json.dbclien || fallback?.dbclien;
  const vendaFat = fc.json.dbvenda || fallback?.dbvenda;
  const itensFat = fc.json.dbitvenda || fallback?.dbitvenda;

  const doc = String(cliFat?.cpfcgc || fallback?.dbclien?.cpfcgc || '');
  const { sel, nomeDoc } = tipoNota(doc);

  // Reenvio: se a nota desta fatura já foi autorizada (ex.: timeout que autorizou), não emite de novo.
  const dn = dbfatura?.dadosNFe;
  if (dbfatura?.nfe_status === '100') {
    return {
      autorizada: true,
      status: '100',
      numero: dn?.numeroNFe,
      chaveAcesso: dn?.chaveAcesso,
      protocolo: dn?.protocolo,
      modelo: sel.modelo,
      nomeDoc,
    };
  }

  // emitente
  const cnpjEmp = fallback?.dbvenda?.cnpj_empresa || vendaFat?.cnpj_empresa || '';
  const ieEmp = fallback?.dbvenda?.ie_empresa || vendaFat?.ie_empresa || '';
  const emp = await jfetch(
    `/api/faturamento/dadosempresa?cgc=${encodeURIComponent(cnpjEmp)}&inscricaoestadual=${encodeURIComponent(ieEmp)}`,
  );
  const emitente = emp.ok ? emp.json : null;

  const serie = dbfatura?.serie || '2';

  // reserva o próximo número da série e ESCREVE no payload (senão sai número já usado → 539)
  onStep?.('Reservando número da nota…');
  let numR = await jfetch('/api/faturamento/obter-proximo-numero-nfe', {
    method: 'POST',
    body: { serie, numeroAtual: '1' },
  });
  if (numR.json?.proximoNumero) dbfatura.nroform = String(numR.json.proximoNumero).padStart(9, '0');

  const emitirBody = {
    dbclien: cliFat,
    dbvenda: [vendaFat],
    dbfatura, // nroform é atualizado a cada tentativa (mutação por referência)
    dbitvenda: itensFat,
    emitente,
    statusVenda: { tipodoc: 'N', cobranca: 'S', insc07: 'N' },
    codfat,
    isAgrupamento: false,
    observacoes: '.',
  };

  // EMITIR com retry em duplicidade (539) — igual ao handleProcessoCompleto
  let nf: any = null;
  let st = '';
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    onStep?.(tentativa === 1 ? `Emitindo ${nomeDoc}…` : `Reenviando ${nomeDoc} (tentativa ${tentativa})…`);
    nf = await jfetch(sel.endpoint, { method: 'POST', body: emitirBody });
    st = String(nf.json?.status ?? '');
    if (nf.ok && nf.json?.sucesso === true && st === '100') break; // autorizada
    if (st === '539' && tentativa < 3) {
      // duplicidade → reserva outro número e tenta de novo
      onStep?.('Número duplicado — reservando outro…');
      numR = await jfetch('/api/faturamento/obter-proximo-numero-nfe', {
        method: 'POST',
        body: { serie, numeroAtual: dbfatura.nroform || '1' },
      });
      if (numR.json?.proximoNumero) dbfatura.nroform = String(numR.json.proximoNumero).padStart(9, '0');
      continue;
    }
    break; // outra rejeição ou esgotou tentativas
  }
  const autorizada = !!(nf?.ok && nf?.json?.sucesso === true && st === '100');
  return {
    autorizada,
    status: st || String(nf?.httpStatus ?? ''),
    motivo: autorizada ? nf.json?.motivo : motivoDaNota(nf),
    numero: autorizada ? dbfatura.nroform : undefined,
    chaveAcesso: nf?.json?.chaveAcesso,
    protocolo: nf?.json?.protocolo,
    pdfBase64: nf?.json?.pdfBase64,
    modelo: sel.modelo,
    nomeDoc,
  };
}

/**
 * CAIXA — passo "Faturar e emitir nota" (Delphi: Avançar → CAIXA.FATURAR + gerarNFe).
 * Lança só se a FATURA não for gravada (nada foi criado). Daí em diante não desfaz nada:
 * nota rejeitada volta em `nota.autorizada = false` para o operador reenviar.
 */
export async function faturarEEmitirNota(params: {
  detalhes: DetalhesPreVenda;
  codConta: string;
  codvendas?: string[];
  onStep?: (etapa: string) => void;
}): Promise<FaturaCaixaResultado> {
  const { detalhes, onStep } = params;
  const total = Number(detalhes.resumoFinanceiro.totalGeral);

  // 1) FATURAR (fatura + itens + baixa estoque + título RECIBO em aberto) — atômico no salvar.ts
  onStep?.('Faturando (fatura, itens e estoque)…');
  const sv = await jfetch('/api/faturamento/salvar', {
    method: 'POST',
    body: montarSalvarBody({
      detalhes,
      codConta: params.codConta,
      tipoOperacao: 'VENDA',
      comCobranca: true,
      codvendas: params.codvendas,
    }),
  });
  if (!sv.ok || !sv.json.codfat) {
    throw new Error(sv.json.error || sv.json.erro || 'Falha ao faturar a pré-venda.');
  }
  const codfat: string = sv.json.codfat;

  // 2) título gerado pela fatura
  onStep?.('Buscando título gerado…');
  let cod_receb: string | null = null;
  let valorTitulo = total;
  const tf = await jfetch(`/api/caixa/titulo-fatura?codfat=${encodeURIComponent(codfat)}`).catch(
    () => ({ ok: false, json: {} } as any),
  );
  if (tf.ok && tf.json?.cod_receb) {
    cod_receb = tf.json.cod_receb;
    valorTitulo = Number(tf.json.valor_pgto ?? total);
  }

  // 3) EMITIR NF — falha NÃO desfaz a fatura (fiel ao Delphi)
  let nota: ResultadoNota;
  try {
    nota = await emitirNotaDaFatura({ codfat, fallback: detalhes, onStep });
  } catch (e: any) {
    const { sel, nomeDoc } = tipoNota(String(detalhes.dbclien?.cpfcgc || ''));
    nota = { autorizada: false, motivo: e?.message || 'Falha ao emitir a nota.', modelo: sel.modelo, nomeDoc };
  }

  return { codfat, cod_receb, valorTitulo, nota };
}

/**
 * TRANSFERÊNCIA — faturar + emitir; se QUALQUER etapa falhar, desfaz tudo (reverter-fatura).
 */
export async function faturarPreVenda(params: {
  detalhes: DetalhesPreVenda;
  codConta: string;
  username: string;
  onStep?: (etapa: string) => void;
  /** 'VENDA' (default, caixa) ou 'TRANSFERENCIA' (define CFOP no salvar). */
  tipoOperacao?: string;
  /** true (default): gera cobrança/título. false: sem título (ex.: transferência). */
  comCobranca?: boolean;
  /** Códigos das vendas a agrupar numa ÚNICA fatura/NF. Default: [detalhes.dbvenda.codvenda]. */
  codvendas?: string[];
}): Promise<FaturarResultado> {
  const { detalhes, codConta, onStep } = params;
  const tipoOperacao = params.tipoOperacao || 'VENDA';
  const comCobranca = params.comCobranca !== false;
  const total = Number(detalhes.resumoFinanceiro.totalGeral);
  onStep?.('Faturando (fatura, itens e estoque)…');

  // 1) FATURAR (fatura + itens + baixa estoque + título) — atômico no salvar.ts
  const sv = await jfetch('/api/faturamento/salvar', {
    method: 'POST',
    body: montarSalvarBody({ detalhes, codConta, tipoOperacao, comCobranca, codvendas: params.codvendas }),
  });
  if (!sv.ok || !sv.json.codfat) {
    throw new Error(sv.json.error || sv.json.erro || 'Falha ao faturar a pré-venda.');
  }
  const codfat: string = sv.json.codfat;

  // A partir daqui, QUALQUER falha → reverter tudo.
  try {
    const nota = await emitirNotaDaFatura({ codfat, fallback: detalhes, onStep });
    if (!nota.autorizada) {
      onStep?.('Falhou — desfazendo tudo…');
      const rev = await jfetch('/api/caixa/reverter-fatura', { method: 'POST', body: { codfat } }).catch(
        () => ({ ok: false } as any),
      );
      throw new Error(
        rev.ok
          ? `NF não autorizada (${nota.status}): ${nota.motivo}. Fatura desfeita.`
          : `NF não autorizada (${nota.status}): ${nota.motivo}. ATENÇÃO: não consegui desfazer a fatura ${codfat} — verifique na Consulta de Faturas.`,
      );
    }

    // título gerado pela fatura (só quando há cobrança — transferência não tem título)
    let cod_receb = '';
    let valorTitulo = total;
    if (comCobranca) {
      onStep?.('Buscando título gerado…');
      const tf = await jfetch(`/api/caixa/titulo-fatura?codfat=${encodeURIComponent(codfat)}`);
      if (!tf.ok || !tf.json?.cod_receb) {
        await jfetch('/api/caixa/reverter-fatura', { method: 'POST', body: { codfat } }).catch(() => {});
        throw new Error('Fatura emitida mas título não localizado — operação desfeita.');
      }
      cod_receb = tf.json.cod_receb;
      valorTitulo = Number(tf.json.valor_pgto ?? total);
    }

    return {
      codfat,
      cod_receb,
      valorTitulo,
      nfe: {
        status: nota.status,
        motivo: nota.motivo,
        chaveAcesso: nota.chaveAcesso,
        protocolo: nota.protocolo,
        pdfBase64: nota.pdfBase64,
        modelo: nota.modelo,
      },
    };
  } catch (e) {
    // rede de segurança: qualquer erro não tratado → tenta reverter
    await jfetch('/api/caixa/reverter-fatura', { method: 'POST', body: { codfat } }).catch(() => {});
    throw e;
  }
}
