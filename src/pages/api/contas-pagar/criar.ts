import { getPgPool } from '@/lib/pg';
import type { NextApiRequest, NextApiResponse } from 'next';


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const pool = getPgPool();

  try {
    const {
      tipo, // 'F' = Fornecedor, 'T' = Transportadora
      cod_credor, // Código do fornecedor (se tipo = 'F')
      cod_transp, // Código da transportadora (se tipo = 'T')
      cod_conta, // Código da conta contábil
      cod_ccusto, // Código do centro de custo
      cod_comprador, // Código do comprador (opcional)
      dt_venc, // Data de vencimento
      dt_emissao, // Data de emissão (opcional, default hoje)
      valor_pgto, // Valor a pagar
      nro_nf, // Número da nota fiscal (opcional)
      tem_nota, // 'S' ou 'N'
      obs, // Observações (opcional)
      tem_cobr, // Tem cobrança bancária? 'S' ou 'N'
      nro_dup, // Número da duplicata (opcional, se tem_cobr = 'S')
      banco, // Código do banco (opcional)
      parcelado = false, // Se a conta será parcelada
      parcelas = [], // Array de { dias: number, vencimento: string }
      // Campos de pagamento internacional
      eh_internacional = false, // Se é pagamento internacional
      moeda, // Código da moeda (EUR, USD, etc)
      taxa_conversao, // Taxa de câmbio
      valor_moeda, // Valor na moeda estrangeira
      nro_invoice, // Número da invoice (internacional)
      nro_contrato, // Número do contrato (internacional)
      notas_conhecimento = [], // Array de notas de conhecimento vinculadas
      // possui_entrada = false, // Possui entrada aduaneira
    } = req.body;

    console.log('💰 [Criar Conta] Recebido:', {
      tipo,
      cod_transp,
      valor_pgto,
      notas_conhecimento: notas_conhecimento?.length || 0,
      titulo_importado: notas_conhecimento && notas_conhecimento.length > 0
    });

    // Validações
    if (!tipo || !['F', 'T'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo inválido. Use F (Fornecedor) ou T (Transportadora)' });
    }

    if (tipo === 'F' && !cod_credor) {
      return res.status(400).json({ erro: 'Código do credor é obrigatório para tipo Fornecedor' });
    }

    if (tipo === 'T' && !cod_transp) {
      return res.status(400).json({ erro: 'Código da transportadora é obrigatório' });
    }

    if (!cod_conta) {
      return res.status(400).json({ erro: 'Conta contábil é obrigatória' });
    }

    // Validações específicas para pagamento internacional
    if (eh_internacional) {
      if (!moeda) {
        return res.status(400).json({ erro: 'Moeda é obrigatória para pagamento internacional' });
      }
      if (!taxa_conversao || parseFloat(taxa_conversao) <= 0) {
        return res.status(400).json({ erro: 'Taxa de conversão inválida' });
      }
      if (!valor_moeda || parseFloat(valor_moeda) <= 0) {
        return res.status(400).json({ erro: 'Valor na moeda estrangeira é obrigatório' });
      }
    }

    if (!dt_venc) {
      return res.status(400).json({ erro: 'Data de vencimento é obrigatória' });
    }

    if (!valor_pgto || parseFloat(valor_pgto) <= 0) {
      return res.status(400).json({ erro: 'Valor inválido' });
    }

    // Validações
    if (!tipo || !dt_venc || !valor_pgto) {
      return res.status(400).json({
        erro: 'Campos obrigatórios não preenchidos',
        detalhes: 'tipo, dt_venc e valor_pgto são obrigatórios'
      });
    }

    // Validar valor_pgto (máximo: 999.999.999,99)
    const valorNumerico = parseFloat(valor_pgto);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      return res.status(400).json({
        erro: 'Valor inválido',
        detalhes: 'O valor deve ser maior que zero'
      });
    }
    if (valorNumerico > 999999999.99) {
      return res.status(400).json({
        erro: 'Valor muito grande',
        detalhes: 'O valor máximo permitido é R$ 999.999.999,99'
      });
    }

    // Função para truncar strings e converter para string
    const toString = (val: any, maxLen?: number): string | null => {
      if (val === null || val === undefined || val === '') return null;
      const str = String(val).trim();
      return maxLen ? str.substring(0, maxLen) : str;
    };

    // Determinar quantas parcelas criar
    const totalParcelas = parcelado && parcelas.length > 0 ? parcelas.length : 1;
    const valorParcela = parseFloat(valor_pgto) / totalParcelas;
    
    // Para distribuir os centavos restantes
    const valorParcelaFormatado = Math.floor(valorParcela * 100) / 100;
    const restocentavos = parseFloat(valor_pgto) - (valorParcelaFormatado * totalParcelas);
    
    // Gerar base do nro_dup se não fornecido
    let baseDup = nro_dup || nro_nf || '';
    if (!baseDup && parcelado && totalParcelas > 1) {
      // Gerar um ID único baseado em timestamp
      baseDup = `DUP${Date.now().toString().slice(-8)}`;
    }

    // Array para armazenar as contas criadas
    const contasCriadas = [];
    
    // Data de emissão
    const dataEmissao = dt_emissao || new Date().toISOString().split('T')[0];

    // Melhorar observação com informações das notas de conhecimento
    let observacaoFinal = obs || '';
    if (notas_conhecimento && notas_conhecimento.length > 0) {
      const infoNotas = `Pagamento de ${notas_conhecimento.length} CT-e(s): ${notas_conhecimento.map((n: any) => `${n.codtransp}-${n.nrocon}`).join(', ')}`;
      observacaoFinal = observacaoFinal ? `${observacaoFinal} | ${infoNotas}` : infoNotas;
    }

    // Criar cada parcela
    for (let i = 0; i < totalParcelas; i++) {
      // Gerar próximo cod_pgto e pag_cof_id
      const maxCodResult = await pool.query(
        'SELECT COALESCE(MAX(cod_pgto::integer), 0) + 1 as next_cod FROM dbpgto'
      );
      const nextCodPgto = maxCodResult.rows[0].next_cod.toString().padStart(9, '0');

      const maxPagCofResult = await pool.query(
        'SELECT COALESCE(MAX(pag_cof_id), 0) + 1 as next_pag_cof_id FROM dbpgto'
      );
      const nextPagCofId = maxPagCofResult.rows[0].next_pag_cof_id;

      // Calcular data de vencimento desta parcela
      // Se parcelado, usar vencimento do array, senão usar dt_venc
      const dataVencFormatada = parcelado && parcelas[i] 
        ? parcelas[i].vencimento 
        : dt_venc;

      // Calcular valor desta parcela (última parcela recebe os centavos restantes)
      const valorDestaParcela = i === totalParcelas - 1 
        ? valorParcelaFormatado + restocentavos
        : valorParcelaFormatado;

      // Gerar nro_dup para esta parcela (formato: base/X ou X/Y)
      const nroDupParcela = totalParcelas > 1 
        ? `${baseDup}/${String(i + 1).padStart(2, '0')}` 
        : (baseDup || null);

      // Inserir a parcela
      const result = await pool.query(
        `INSERT INTO dbpgto (
          cod_pgto,
          pag_cof_id,
          tipo,
          cod_credor,
          cod_transp,
          cod_conta,
          cod_ccusto,
          codcomprador,
          dt_venc,
          dt_emissao,
          valor_pgto,
          nro_nf,
          tem_nota,
          obs,
          tem_cobr,
          nro_dup,
          banco,
          paga,
          cancel,
          eh_internacional,
          moeda,
          taxa_conversao,
          valor_moeda,
          nro_invoice,
          nro_contrato,
          titulo_importado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
        RETURNING cod_pgto, cod_credor, cod_transp, tipo, valor_pgto, dt_venc, nro_dup, banco, eh_internacional, moeda, taxa_conversao, valor_moeda, nro_invoice, nro_contrato, titulo_importado`,
        [
          nextCodPgto, // cod_pgto gerado
          nextPagCofId, // pag_cof_id gerado
          toString(tipo, 1), // varchar(1)
          tipo === 'F' ? toString(cod_credor, 5) : null, // varchar(5)
          tipo === 'T' ? toString(cod_transp, 5) : null, // varchar(5)
          toString(cod_conta, 4), // varchar(4)
          toString(cod_ccusto, 4), // varchar(4)
          toString(cod_comprador, 3), // varchar(3)
          dataVencFormatada,
          dataEmissao,
          valorDestaParcela.toFixed(2),
          toString(nro_nf, 20), // varchar(20)
          tem_nota ? 'S' : 'N',
          toString(observacaoFinal, 250), // varchar(250)
          tem_cobr ? 'S' : 'N',
          toString(nroDupParcela, 20), // varchar(20)
          toString(banco, 3), // varchar(3)
          'N', // paga
          'N', // cancel
          eh_internacional ? 'S' : 'N', // eh_internacional
          eh_internacional ? toString(moeda, 3) : null, // moeda (varchar 3)
          eh_internacional ? parseFloat(taxa_conversao) : null, // taxa_conversao
          eh_internacional ? parseFloat(valor_moeda) / totalParcelas : null, // valor_moeda (dividir por parcelas)
          eh_internacional ? toString(nro_invoice, 30) : null, // nro_invoice
          eh_internacional ? toString(nro_contrato, 30) : null, // nro_contrato
          false, // titulo_importado (sempre false para contas manuais)
        ]
      );

      contasCriadas.push(result.rows[0]);
    }

    // Buscar o nome do credor/transportadora (usar a primeira conta criada como referência)
    const contaCriada = contasCriadas[0];

    // Buscar o nome do credor/transportadora
    let nomeCredor = '';
    if (tipo === 'F' && contaCriada.cod_credor) {
      const fornecedor = await pool.query(
        'SELECT nome FROM dbcredor WHERE cod_credor = $1',
        [contaCriada.cod_credor]
      );
      nomeCredor = fornecedor.rows[0]?.nome || '';
    } else if (tipo === 'T' && contaCriada.cod_transp) {
      const transportadora = await pool.query(
        'SELECT nome FROM dbtransp WHERE codtransp = $1',
        [contaCriada.cod_transp]
      );
      nomeCredor = transportadora.rows[0]?.nome || '';
    }

    return res.status(201).json({
      sucesso: true,
      mensagem: totalParcelas > 1 
        ? `${totalParcelas} parcelas criadas com sucesso!`
        : 'Conta a pagar criada com sucesso',
      total_parcelas: totalParcelas,
      valor_total: parseFloat(valor_pgto),
      valor_parcela: valorParcelaFormatado,
      contas: contasCriadas.map(c => ({
        ...c,
        nome_credor: nomeCredor,
      })),
    });
  } catch (error: any) {
    console.error('Erro ao criar conta a pagar:', error);
    return res.status(500).json({
      erro: 'Erro ao criar conta a pagar',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
