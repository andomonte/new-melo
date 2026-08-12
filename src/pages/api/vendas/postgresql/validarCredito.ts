// API equivalente à REGRAS_VENDAS.SUBMETER_REGRA do Oracle
// Replica a lógica exata: STATUS_CLIENTE + SEM_LIMITE_FINANCEIRO
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { codcli, valorSolicitado, formaPagamento } = req.body;

  if (!codcli) {
    return res.status(400).json({ error: 'codcli obrigatório' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // 1. INICIALIZAR — carregar dados do cliente
    const cliRes = await client.query(
      `SELECT codcli, status, limite, debito, claspgto, atraso, tipo, uf, cpfcgc
       FROM dbclien WHERE codcli = $1`,
      [codcli],
    );

    if (cliRes.rowCount === 0) {
      return res.status(200).json({ passou: 'NOK', mensagem: 'CLIENTE NÃO ENCONTRADO' });
    }

    const cli = cliRes.rows[0];
    const claspgto = String(cli.claspgto || '').trim().toUpperCase();
    const limite = Number(cli.limite || 0);
    const debito = Number(cli.debito || 0);
    const tipo = String(cli.tipo || '').trim().toUpperCase(); // F=Física, J=Jurídica
    const ufCliente = String(cli.uf || '').trim().toUpperCase();
    const valor = Number(valorSolicitado || 0);
    const fp = String(formaPagamento || '').toUpperCase();

    // UF da empresa
    const empRes = await client.query('SELECT uf FROM dadosempresa LIMIT 1');
    const ufEmpresa = String(empRes.rows[0]?.uf || 'AM').trim().toUpperCase();

    // Crédito temporário
    const credTmpRes = await client.query(
      `SELECT COALESCE(SUM(GREATEST(limite - COALESCE(limite_usado, 0), 0)), 0) as credito_temp
       FROM dbclien_creditotmp
       WHERE codcli = $1
         AND COALESCE(status, '') <> 'F'
         AND datavencimento >= NOW()`,
      [codcli],
    );
    const creditoTemp = Number(credTmpRes.rows[0]?.credito_temp || 0);

    // Formas de pagamento que isentam verificação de crédito
    const isCartao = fp.substring(0, 17) === 'CARTAO DE CREDITO';
    const isAvista = fp.includes('A VISTA');
    const isDeposito = fp.includes('DEPOSITO BANCARIO');
    const isentaCredito = isCartao || isAvista || isDeposito;

    // ========================================
    // 2. STATUS_CLIENTE — verificações de bloqueio
    // ========================================

    // claspgto = 'I' → CLIENTE INATIVO
    if (claspgto === 'I') {
      return res.status(200).json({
        passou: 'NOK',
        mensagem: 'CLIENTE INATIVO',
        status: 'Inativo',
      });
    }

    // claspgto = 'Z' → CLIENTE EM COBRANÇA JUDICIAL
    if (claspgto === 'Z') {
      // Mesmo sendo judicial, se tem crédito temporário suficiente, desbloqueia
      if (creditoTemp >= valor && valor > 0) {
        // Passa — crédito temporário cobre
      } else if (valor > 0 && creditoTemp > 0) {
        return res.status(200).json({
          passou: 'NOK',
          mensagem: `CLIENTE COM CREDITO TEMPORARIO INSUFICIENTE. DISPONÍVEL: R$ ${creditoTemp.toFixed(2)}`,
          status: 'Cobrança Judicial',
        });
      } else {
        return res.status(200).json({
          passou: 'NOK',
          mensagem: 'CLIENTE EM COBRANÇA JUDICIAL',
          status: 'Cobrança Judicial',
        });
      }
    }

    // Pessoa física de outro estado
    if (tipo === 'F' && ufCliente && ufCliente !== ufEmpresa) {
      return res.status(200).json({
        passou: 'NOK',
        mensagem: 'CLIENTE PESSOA FÍSICA DE OUTRO ESTADO',
        status: 'Bloqueado',
      });
    }

    // ========================================
    // 3. SEM_LIMITE_FINANCEIRO — verificação de crédito
    // ========================================

    // Títulos atrasados (CLIENTE.VER_CONTASR_ATRASO)
    const atrasoRes = await client.query(
      `SELECT COUNT(*) as qtd,
              MAX(EXTRACT(DAY FROM NOW() - dt_venc))::int as dias_atraso
       FROM dbreceb
       WHERE codcli = $1
         AND dt_venc < NOW()
         AND COALESCE(rec, 'N') != 'S'
         AND COALESCE(cancel, 'N') != 'S'`,
      [codcli],
    );
    const temTituloAtrasado = Number(atrasoRes.rows[0]?.qtd || 0) > 0;
    const diasAtraso = Number(atrasoRes.rows[0]?.dias_atraso || 0);

    if (temTituloAtrasado) {
      // Se tem crédito temporário suficiente, desbloqueia
      if (creditoTemp >= valor && valor > 0) {
        // Passa — crédito temporário cobre
      } else {
        return res.status(200).json({
          passou: 'NOK',
          mensagem: `CLIENTE COM TITULO(S) ATRASADO(S) — ${diasAtraso} dia(s)`,
          status: 'Títulos Atrasados',
          diasAtraso,
        });
      }
    }

    // Crédito insuficiente (limite - debito < valor)
    // Só verifica se NÃO é à vista, cartão ou depósito
    const saldoDisponivel = (limite - debito) + creditoTemp;

    if (!isentaCredito && valor > 0 && saldoDisponivel < valor) {
      return res.status(200).json({
        passou: 'NOK',
        mensagem: `CLIENTE COM CREDITO INSUFICIENTE. DISPONÍVEL: R$ ${saldoDisponivel.toFixed(2)}`,
        status: 'Sem Crédito',
        saldoDisponivel,
        creditoTemp,
      });
    }

    // ========================================
    // 4. TUDO OK
    // ========================================
    const statusLabel = claspgto === 'V' || claspgto === 'D'
      ? 'À Vista Obrigatório'
      : 'Liberado';

    return res.status(200).json({
      passou: 'OK',
      mensagem: '',
      status: statusLabel,
      saldoDisponivel,
      creditoTemp,
      diasAtraso,
      claspgto,
    });
  } catch (err: any) {
    console.error('[validarCredito] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
