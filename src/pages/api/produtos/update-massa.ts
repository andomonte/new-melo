import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * API para alteração em massa de produtos
 *
 * Replica SpAltUnicoCampoAlfa, SpAltUnicoCampoNumber, SpAltUnicoCampoFloat do Delphi
 *
 * Permite alterar um campo específico em múltiplos produtos de uma vez
 *
 * POST /api/produtos/update-massa
 * Body: {
 *   campo: string,          // Nome do campo a alterar
 *   valor: any,             // Novo valor
 *   codprods: string[]      // Array de códigos de produtos
 * }
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { campo, valor, codprods } = req.body;

  // Validações
  if (!campo || campo.trim() === '') {
    return res.status(400).json({ error: 'Campo é obrigatório' });
  }

  if (valor === undefined || valor === null) {
    return res.status(400).json({ error: 'Valor é obrigatório' });
  }

  if (!Array.isArray(codprods) || codprods.length === 0) {
    return res.status(400).json({
      error: 'Nenhum produto selecionado',
      message: 'Selecione pelo menos um produto para alterar.',
    });
  }

  // Lista de campos permitidos para alteração em massa
  const camposPermitidos = [
    // Dados Cadastrais
    'codmarca',
    'codgpf',
    'codgpp',
    'curva',
    'inf',
    'unimed',
    'tabelado',
    'compradireta',
    'tipo',
    'dolar',
    'multiplo',
    'multiplocompra',
    'coddesc',

    // Dados Fiscais
    'trib',
    'clasfiscal',
    'cest',
    'strib',
    'percsubst',
    'isentoipi',
    'ipi',
    'isentopiscofins',
    'pis',
    'cofins',
    'descontopiscofins',
    'ii',

    // Custos e Preços
    'prcompra',
    'prfabr',
    'prcomprasemst',
    'pratualdesp',
    'prcustoatual',
    'preconf',
    'precosnf',
    'prvenda',
    'primp',
    'impfat',
    'impfab',
    'concor',
    'txdolarcompra',
    'txdolarvenda',
    'txdolarfabrica',
    'txdolarcompramedio',

    // Margens
    'margem',
    'margempromo',

    // Custos de Mercado
    'cmercd',
    'cmercf',
    'cmerczf',

    // Comissões
    'comdifeext',
    'comdifeext_int',
    'comdifint',

    // Estoque
    'qtestmin',
    'qtestmax',

    // Especiais
    'naotemst',
    'prodepe',
    'hanan',
  ];

  if (!camposPermitidos.includes(campo)) {
    return res.status(400).json({
      error: 'Campo não permitido',
      message: `O campo "${campo}" não pode ser alterado em massa.`,
      camposPermitidos,
    });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Construir query de UPDATE
    // Usar ANY($2::text[]) para fazer update em múltiplos produtos
    const updateQuery = `
      UPDATE db_manaus.dbprod
      SET ${campo} = $1
      WHERE codprod = ANY($2::text[])
    `;

    const result = await client.query(updateQuery, [valor, codprods]);

    await client.query('COMMIT');

    const qtdAtualizada = result.rowCount || 0;

    return res.status(200).json({
      message: 'Alteração em massa realizada com sucesso',
      campo,
      valor,
      produtosAtualizados: qtdAtualizada,
      codprods,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar produtos em massa:', error);
    return res.status(500).json({
      error: 'Erro ao atualizar produtos',
      message: error.message,
    });
  } finally {
    client.release();
  }
}
