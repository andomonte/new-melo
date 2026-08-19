/**
 * Orquestrador "faturar pré-venda no Caixa" (front). Reusa os endpoints prontos do
 * faturamento SEM tocá-los. Sequência (igual handleProcessoCompleto):
 *   salvar → dados-fatura-completos → dadosempresa → obter-proximo-numero-nfe →
 *   emitir/emitir-cupom → (falhou? reverter-fatura) → título gerado.
 *
 * Decisão do usuário: se QUALQUER etapa falhar, desfaz tudo (reverter-fatura).
 * Depois disso, o chamador dá baixa no título via /api/caixa/receber (nasce baixado).
 */
import { selecionarTipoEmissao } from '@/services/fiscal/selecionarTipoEmissao';

export interface DetalhesPreVenda {
  dbclien: any;
  dbvenda: any; // { codvenda, nrovenda, codvend, codcli, total, cnpj_empresa, ie_empresa }
  dbitvenda: any[];
  resumoFinanceiro: { totalProdutos: number; totalGeral: number };
}

export interface FaturarResultado {
  codfat: string;
  cod_receb: string;
  valorTitulo: number;
  nfe: { status?: string; motivo?: string; chaveAcesso?: string; protocolo?: string; pdfBase64?: string; modelo: string };
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

export async function faturarPreVenda(params: {
  detalhes: DetalhesPreVenda;
  codConta: string;
  username: string;
  onStep?: (etapa: string) => void;
}): Promise<FaturarResultado> {
  const { detalhes, codConta, username, onStep } = params;
  const { dbclien, dbvenda, resumoFinanceiro } = detalhes;
  const total = Number(resumoFinanceiro.totalGeral);
  const hoje = hojeISO();
  onStep?.('Faturando (fatura, itens e estoque)…');

  // 1) FATURAR (fatura + itens + baixa estoque + título) — atômico no salvar.ts
  const salvarBody = {
    cliente: dbclien,
    vendedor: dbvenda.codvend,
    transportadora: '00051',
    data: hoje,
    pedido: dbvenda.nrovenda,
    totalprod: Number(resumoFinanceiro.totalProdutos),
    totalfat: total,
    totalnf: total,
    cod_conta: codConta,
    tipodoc: 'N',
    cobranca: 'S',
    insc07: 'N',
    tipo_movimentacao: 'SAIDA',
    tipo_operacao: 'VENDA',
    vendas: [dbvenda.codvenda],
    usuario_associacao: dbclien.codcli,
    // cobrança à vista: 1 título com o total (recebido em seguida no caixa)
    cobranca_dados: {
      banco: '0',
      tipofat: 'DINHEIRO',
      codvenda: dbvenda.codvenda,
      parcelas: [{ vencimento: hoje, valor: total, documento: `NF${dbvenda.nrovenda}A`, nossoNumero: '1' }],
    },
  };
  const sv = await jfetch('/api/faturamento/salvar', { method: 'POST', body: salvarBody });
  if (!sv.ok || !sv.json.codfat) {
    throw new Error(sv.json.error || sv.json.erro || 'Falha ao faturar a pré-venda.');
  }
  const codfat: string = sv.json.codfat;

  // A partir daqui, QUALQUER falha → reverter tudo.
  try {
    // 2) dados da fatura recém-criada (payload da emissão)
    onStep?.('Preparando emissão…');
    const fc = await jfetch(`/api/faturamento/dados-fatura-completos?codfat=${encodeURIComponent(codfat)}`);
    if (!fc.ok) throw new Error('Falha ao carregar a fatura para emissão.');
    const dbfatura = fc.json.dbfatura;
    const cliFat = fc.json.dbclien || dbclien;
    const vendaFat = fc.json.dbvenda || dbvenda;
    const itensFat = fc.json.dbitvenda || detalhes.dbitvenda;

    // 3) emitente
    const cnpjEmp = dbvenda.cnpj_empresa || vendaFat.cnpj_empresa || '';
    const ieEmp = dbvenda.ie_empresa || vendaFat.ie_empresa || '';
    const emp = await jfetch(
      `/api/faturamento/dadosempresa?cgc=${encodeURIComponent(cnpjEmp)}&inscricaoestadual=${encodeURIComponent(ieEmp)}`,
    );
    const emitente = emp.ok ? emp.json : null;

    const serie = dbfatura?.serie || '2';
    const doc = String(cliFat?.cpfcgc || dbclien.cpfcgc || '');
    const sel = selecionarTipoEmissao(doc);
    const nomeDoc = sel.modelo === '55' ? 'NF-e' : 'NFC-e';

    // 4) reserva o próximo número da série e ESCREVE no payload (senão sai número já usado → 539)
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

    // 5) EMITIR com retry em duplicidade (539) — igual ao handleProcessoCompleto
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
    const autorizada = nf?.ok && nf?.json?.sucesso === true && st === '100';
    if (!autorizada) {
      onStep?.('Falhou — desfazendo tudo…');
      const rev = await jfetch('/api/caixa/reverter-fatura', { method: 'POST', body: { codfat } }).catch(
        () => ({ ok: false } as any),
      );
      const motivo = nf?.json?.motivo || nf?.json?.erro || 'erro na SEFAZ';
      throw new Error(
        rev.ok
          ? `NF não autorizada (${st || nf?.httpStatus}): ${motivo}. Fatura desfeita.`
          : `NF não autorizada (${st || nf?.httpStatus}): ${motivo}. ATENÇÃO: não consegui desfazer a fatura ${codfat} — verifique na Consulta de Faturas.`,
      );
    }

    // 6) título gerado pela fatura (para dar baixa em seguida)
    onStep?.('Buscando título gerado…');
    const tf = await jfetch(`/api/caixa/titulo-fatura?codfat=${encodeURIComponent(codfat)}`);
    if (!tf.ok || !tf.json?.cod_receb) {
      await jfetch('/api/caixa/reverter-fatura', { method: 'POST', body: { codfat } }).catch(() => {});
      throw new Error('Fatura emitida mas título não localizado — operação desfeita.');
    }

    return {
      codfat,
      cod_receb: tf.json.cod_receb,
      valorTitulo: Number(tf.json.valor_pgto ?? total),
      nfe: {
        status: st,
        motivo: nf.json?.motivo,
        chaveAcesso: nf.json?.chaveAcesso,
        protocolo: nf.json?.protocolo,
        pdfBase64: nf.json?.pdfBase64,
        modelo: sel.modelo,
      },
    };
  } catch (e) {
    // rede de segurança: qualquer erro não tratado → tenta reverter
    await jfetch('/api/caixa/reverter-fatura', { method: 'POST', body: { codfat } }).catch(() => {});
    throw e;
  }
}
