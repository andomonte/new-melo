import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies';
import { VendedorGruposProduto } from '@/data/vendedores/vendedores';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { detalhado_vendedor, grupos_produto, pst, ...vendedorData } = req.body;

  const { codvend } = vendedorData;

  if (!codvend || typeof codvend !== 'string') {
    return res
      .status(400)
      .json({ error: 'ID do vendedor (codvend) é obrigatório.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');

    // ✅ CORREÇÃO: Removemos campos que não deveriam ser atualizados na tabela dbvend
    const camposParaRemover = [
      'NOMERAZAO',
      'detalhado_vendedor',
      'grupos_produto',
      'pst',
      'classe_vendedor',
    ];

    camposParaRemover.forEach((campo) => {
      if (Object.prototype.hasOwnProperty.call(vendedorData, campo)) {
        delete vendedorData[campo];
      }
    });

    const colunasNumericas = [
      'valobj',
      'comnormal',
      'comtele',
      'debito',
      'credito',
      'limite',
      'comobj',
      'valobjf',
      'valobjm',
      'valobjsf',
    ];

    // Definindo limitações de tamanho para campos específicos baseado na estrutura real do banco
    const limitesCaracteres: { [key: string]: number } = {
      codcv: 3, // varchar(3) - confirmado pelo erro do banco
      status: 5, // varchar(5) - observado: 1 char
      ra_mat: 20, // observado: 6 chars
    };

    // Lista de campos válidos para a tabela dbvend
    const camposValidosDbvend = [
      'nome',
      'valobj',
      'comnormal',
      'comtele',
      'debito',
      'credito',
      'limite',
      'status',
      'codcv',
      'comobj',
      'valobjf',
      'valobjm',
      'valobjsf',
      'ra_mat',
    ];

    const dadosParaUpdate: { [key: string]: any } = {};

    for (const key in vendedorData) {
      if (
        key !== 'codvend' &&
        Object.prototype.hasOwnProperty.call(vendedorData, key) &&
        camposValidosDbvend.includes(key) // Só processa campos válidos
      ) {
        if (colunasNumericas.includes(key)) {
          dadosParaUpdate[key] = parseFloat(vendedorData[key]) || 0;
        } else {
          let valor = vendedorData[key];

          // Aplicar limitação de caracteres se definida
          if (limitesCaracteres[key] && typeof valor === 'string') {
            console.log(
              `Campo ${key} truncado de ${valor.length} para ${limitesCaracteres[key]} caracteres`,
            );
            valor = valor.substring(0, limitesCaracteres[key]);
          }

          // Log para debug - verificar tamanhos dos campos
          if (typeof valor === 'string' && valor.length > 50) {
            console.log(
              `ATENÇÃO: Campo ${key} tem ${valor.length} caracteres:`,
              valor.substring(0, 100) + '...',
            );
          }

          dadosParaUpdate[key] = valor;
        }
      }
    }

    console.log(
      'Dados para update:',
      Object.keys(dadosParaUpdate).map(
        (key) =>
          `${key}: ${typeof dadosParaUpdate[key]} (${
            typeof dadosParaUpdate[key] === 'string'
              ? dadosParaUpdate[key].length + ' chars'
              : 'N/A'
          })`,
      ),
    );

    const fields = Object.keys(dadosParaUpdate);
    if (fields.length > 0) {
      const setClause = fields
        .map((field, index) => `"${field}" = $${index + 1}`)
        .join(', ');
      const values = fields.map((field) => dadosParaUpdate[field]);
      const updateQuery = `UPDATE dbvend SET ${setClause} WHERE codvend = $${
        fields.length + 1
      }`;

      // Log para debug - mostrar query e valores
      console.log('Query:', updateQuery);
      console.log('Valores:', [...values, codvend]);

      await client.query(updateQuery, [...values, codvend]);
    }

    const updatedVendedorResult = await client.query(
      'SELECT * FROM dbvend WHERE codvend = $1',
      [codvend],
    );
    const updatedVendedor = updatedVendedorResult.rows[0];

    if (!updatedVendedor) {
      await client.query('ROLLBACK');
      return res
        .status(404)
        .json({ error: 'Vendedor não encontrado após a atualização.' });
    }

    if (pst && pst.codpst) {
      await client.query(
        `INSERT INTO dbvend_pst (codvend, codpst, local)
           VALUES ($1, $2, $3)
           ON CONFLICT (codvend) DO UPDATE SET codpst = EXCLUDED.codpst, local = EXCLUDED.local;`,
        [updatedVendedor.codvend, pst.codpst, pst.local || 'MAO'],
      );
    }

    if (detalhado_vendedor) {
      await client.query(
        `INSERT INTO dbdados_vend (codvend, bairro, cep, cidade, estado, celular, logradouro, nome, tipo, cpf_cnpj)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (codvend) DO UPDATE SET bairro = EXCLUDED.bairro, cep = EXCLUDED.cep, cidade = EXCLUDED.cidade, estado = EXCLUDED.estado, celular = EXCLUDED.celular, logradouro = EXCLUDED.logradouro, nome = EXCLUDED.nome, tipo = EXCLUDED.tipo, cpf_cnpj = EXCLUDED.cpf_cnpj;`,
        [
          updatedVendedor.codvend,
          detalhado_vendedor.bairro || null,
          detalhado_vendedor.cep || null,
          detalhado_vendedor.cidade || null,
          detalhado_vendedor.estado || null,
          detalhado_vendedor.celular || null,
          detalhado_vendedor.logradouro || null,
          detalhado_vendedor.nome || null,
          detalhado_vendedor.tipo || null,
          detalhado_vendedor.cpf_cnpj || null,
        ],
      );
    }

    if (grupos_produto) {
      const currentCodgppInRequest = grupos_produto.map(
        (g: VendedorGruposProduto) => g.codgpp,
      );
      if (currentCodgppInRequest.length > 0) {
        await client.query(
          `DELETE FROM dbvendgpp WHERE codvend = $1 AND codgpp NOT IN (${currentCodgppInRequest
            .map((_: string, i: number) => `$${i + 2}`)
            .join(',')});`,
          [updatedVendedor.codvend, ...currentCodgppInRequest],
        );
      } else {
        await client.query(`DELETE FROM dbvendgpp WHERE codvend = $1;`, [
          updatedVendedor.codvend,
        ]);
      }
      if (grupos_produto.length > 0) {
        const valuesPlaceholders = grupos_produto
          .map(
            (_: VendedorGruposProduto, index: number) =>
              `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${
                index * 5 + 4
              }, $${index * 5 + 5})`,
          )
          .join(',');
        const allValues = grupos_produto.flatMap(
          (grupo: VendedorGruposProduto) => [
            updatedVendedor.codvend,
            grupo.codgpp,
            grupo.exclusivo,
            grupo.comdireta || 0.0,
            grupo.comindireta || 0.0,
          ],
        );
        await client.query(
          `INSERT INTO dbvendgpp (codvend, codgpp, exclusivo, comdireta, comindireta)
             VALUES ${valuesPlaceholders}
             ON CONFLICT (codvend, codgpp) DO UPDATE SET exclusivo = EXCLUDED.exclusivo, comdireta = EXCLUDED.comdireta, comindireta = EXCLUDED.comindireta;`,
          allValues,
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ data: serializeBigInt(updatedVendedor) });
  } catch (error) {
    await client?.query('ROLLBACK');
    console.error('Erro ao atualizar vendedor:', error);

    // Verifica se é erro de tamanho de campo
    if (
      error instanceof Error &&
      error.message.includes('valor é muito longo')
    ) {
      const match = error.message.match(/character varying\((\d+)\)/);
      const limite = match ? match[1] : 'desconhecido';
      res.status(400).json({
        error: `Um dos campos excede o limite de ${limite} caracteres. Verifique os dados inseridos.`,
        details: 'Campo muito longo para o banco de dados',
      });
    } else {
      res.status(500).json({ error: 'Erro ao atualizar vendedor.' });
    }
  } finally {
    if (client) {
      client.release();
    }
  }
}
