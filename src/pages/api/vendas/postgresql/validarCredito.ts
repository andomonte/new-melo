// API equivalente à REGRAS_VENDAS.SUBMETER_REGRA do Oracle
// Valida se o cliente pode comprar com base em crédito, limite, atraso e forma de pagamento
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
    // 1. Buscar dados do cliente
    const cliRes = await client.query(
      `SELECT codcli, status, limite, debito, claspgto, atraso FROM dbclien WHERE codcli = $1`,
      [codcli],
    );

    if (cliRes.rowCount === 0) {
      return res.status(200).json({ passou: 'NOK', mensagem: 'CLIENTE NÃO ENCONTRADO' });
    }

    const cli = cliRes.rows[0];
    const status = String(cli.status || '1').trim();
    const limite = Number(cli.limite || 0);
    const debito = Number(cli.debito || 0);
    const claspgto = String(cli.claspgto || '').trim().toUpperCase();
    const atrasoPermitido = Number(cli.atraso || 0);
    const valor = Number(valorSolicitado || 0);
    const fp = String(formaPagamento || '').toUpperCase();

    // Cartão de crédito isenta de verificação de crédito (REGRAS_VENDAS linha 86)
    const isCartao = fp.includes('CARTAO DE CREDITO');

    // 2. Verificar status do cliente
    if (status === '2') {
      return res.status(200).json({
        passou: 'NOK',
        mensagem: 'CLIENTE BLOQUEADO',
        status: 'Bloqueado',
      });
    }

    // 3. Classe V, D, Z = à vista obrigatório (sem verificação de crédito a prazo)
    if (['V', 'D', 'Z'].includes(claspgto)) {
      return res.status(200).json({
        passou: 'OK',
        mensagem: '',
        status: status === '4' ? 'Temp.à Vista' : 'À Vista Obrigatório',
        avistaObrigatorio: true,
        claspgto,
      });
    }

    // 4. Cartão de crédito — sempre libera (não consome crédito)
    if (isCartao) {
      return res.status(200).json({
        passou: 'OK',
        mensagem: '',
        status: 'Liberado (Cartão)',
      });
    }

    // 5. Verificar dias de atraso real (contas vencidas não pagas)
    const atrasoRes = await client.query(
      `SELECT MAX(EXTRACT(DAY FROM NOW() - dt_venc))::int as dias_atraso
       FROM dbreceb
       WHERE codcli = $1
         AND dt_venc < NOW()
         AND COALESCE(rec, 'N') != 'S'
         AND COALESCE(cancel, 'N') != 'S'`,
      [codcli],
    );
    const diasAtraso = Number(atrasoRes.rows[0]?.dias_atraso || 0);

    // Se tem atraso acima do permitido
    if (diasAtraso > 0 && diasAtraso > atrasoPermitido) {
      return res.status(200).json({
        passou: 'NOK',
        mensagem: `CLIENTE COM ${diasAtraso} DIAS DE ATRASO (PERMITIDO: ${atrasoPermitido})`,
        status: 'Bloqueado por Atraso',
        diasAtraso,
        atrasoPermitido,
      });
    }

    // 6. Verificar crédito temporário
    const credTmpRes = await client.query(
      `SELECT COALESCE(SUM(GREATEST(limite - COALESCE(limite_usado, 0), 0)), 0) as credito_temp
       FROM dbclien_creditotmp
       WHERE codcli = $1
         AND COALESCE(status, '') <> 'F'
         AND datavencimento >= NOW()`,
      [codcli],
    );
    const creditoTemp = Number(credTmpRes.rows[0]?.credito_temp || 0);

    // 7. Calcular saldo disponível
    const saldoDisponivel = (limite - debito) + creditoTemp;

    // 8. Verificar se tem saldo suficiente para a venda
    // À vista não precisa de crédito
    const isAvista = fp.includes('A VISTA') || fp.includes('DINHEIRO') || fp === 'PIX';
    if (isAvista) {
      return res.status(200).json({
        passou: 'OK',
        mensagem: '',
        status: status === '3' ? 'Temporário' : status === '4' ? 'Temp.à Vista' : 'Liberado',
        saldoDisponivel,
      });
    }

    // Venda a prazo — verifica saldo
    if (valor > 0 && saldoDisponivel < valor) {
      return res.status(200).json({
        passou: 'NOK',
        mensagem: `SALDO INSUFICIENTE. DISPONÍVEL: R$ ${saldoDisponivel.toFixed(2)} | SOLICITADO: R$ ${valor.toFixed(2)}`,
        status: 'Sem Crédito',
        saldoDisponivel,
        creditoTemp,
      });
    }

    // 9. Tudo OK
    return res.status(200).json({
      passou: 'OK',
      mensagem: '',
      status: status === '1' ? 'Liberado' : status === '3' ? 'Temporário' : status === '4' ? 'Temp.à Vista' : 'Liberado',
      saldoDisponivel,
      creditoTemp,
      diasAtraso,
    });
  } catch (err: any) {
    console.error('[validarCredito] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
