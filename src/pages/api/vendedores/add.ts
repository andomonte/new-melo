// src/pages/api/vendedores/add.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies';
import { incrementStringNumber } from '@/utils/strings';
import { VendedorGruposProduto } from '@/data/vendedores/vendedores';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { detalhado_vendedor, grupos_produto, pst, ...vendedorData } = req.body;

  // ✅ CORREÇÃO: Removemos campos que não deveriam ser inseridos na tabela dbvend
  const camposParaRemover = ['NOMERAZAO', 'classe_vendedor'];

  camposParaRemover.forEach((campo) => {
    if (Object.prototype.hasOwnProperty.call(vendedorData, campo)) {
      delete vendedorData[campo];
    }
  });

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Gerar o próximo codvend
    const latestVendedorResult = await client.query(
      `SELECT codvend FROM dbvend ORDER BY CAST(codvend AS INTEGER) DESC LIMIT 1;`,
    );
    const latestCodvend = latestVendedorResult.rows[0]?.codvend;
    const newCodvend = latestCodvend
      ? incrementStringNumber(latestCodvend)
      : '00001';

    // ✅ CORREÇÃO CRÍTICA: Adiciona codvend aos dados a serem inseridos
    // codvend é VARCHAR(5) NOT NULL @id - obrigatório
    vendedorData.codvend = newCodvend;

    // ✅ CORREÇÃO: Constrói a query de INSERT dinamicamente
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
      codvend: 5, // VARCHAR(5) @id - OBRIGATÓRIO
      nome: 30, // VARCHAR(30)
      codcv: 3, // VARCHAR(3)
      status: 1, // VARCHAR(1) - CORRIGIDO de 5 para 1
      ra_mat: 6, // VARCHAR(6) - CORRIGIDO de 20 para 6
    };

    // Lista de campos válidos para a tabela dbvend
    const camposValidosDbvend = [
      'codvend', // ✅ CRÍTICO: Adicionado - campo obrigatório
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

    // Converte campos numéricos e prepara o objeto final para inserção
    const dadosParaInserir: { [key: string]: any } = {};
    for (const key in vendedorData) {
      if (
        Object.prototype.hasOwnProperty.call(vendedorData, key) &&
        camposValidosDbvend.includes(key)
      ) {
        // Só processa campos válidos
        if (colunasNumericas.includes(key)) {
          dadosParaInserir[key] = parseFloat(vendedorData[key]) || 0;
        } else {
          let valor = vendedorData[key];

          // Aplicar limitação de caracteres se definida
          if (limitesCaracteres[key] && typeof valor === 'string') {
            valor = valor.substring(0, limitesCaracteres[key]);
          }

          dadosParaInserir[key] = valor;
        }
      }
    }

    const columns = Object.keys(dadosParaInserir)
      .map((col) => `"${col}"`)
      .join(', ');
    const placeholders = Object.keys(dadosParaInserir)
      .map((_, i) => `$${i + 1}`)
      .join(', ');
    const values = Object.values(dadosParaInserir);

    const insertVendedorQuery = `
      INSERT INTO dbvend (${columns}) VALUES (${placeholders}) RETURNING *;
    `;

    const newVendedorResult = await client.query(insertVendedorQuery, values);
    const newVendedor = newVendedorResult.rows[0];

    // 3. Inserir dados relacionados (lógica mantida)
    if (pst) {
      await client.query(
        `INSERT INTO dbvend_pst (codvend, codpst, local) VALUES ($1, $2, $3);`,
        [newVendedor.codvend, pst.codpst || null, pst.local || 'MAO'],
      );
    }

    if (detalhado_vendedor) {
      await client.query(
        `INSERT INTO dbdados_vend (codvend, bairro, cep, cidade, estado, celular, logradouro, nome, tipo, cpf_cnpj) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
        [
          newVendedor.codvend,
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

    if (grupos_produto && grupos_produto.length > 0) {
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
          newVendedor.codvend,
          grupo.codgpp,
          grupo.exclusivo,
          grupo.comdireta || 0.0,
          grupo.comindireta || 0.0,
        ],
      );
      await client.query(
        `INSERT INTO dbvendgpp (codvend, codgpp, exclusivo, comdireta, comindireta) VALUES ${valuesPlaceholders};`,
        allValues,
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ data: serializeBigInt(newVendedor) });
  } catch (error: any) {
    await client?.query('ROLLBACK');
    console.error('Erro ao criar vendedor:', error);

    // Tratamento de erros específicos do PostgreSQL
    if (error?.code) {
      switch (error.code) {
        // Erro 23503: Violação de chave estrangeira
        case '23503':
          // Extrai informações do erro
          const constraintName = error.constraint || '';
          const detail = error.detail || '';

          // Identifica qual campo causou o erro
          let campoProblema = '';
          let mensagemAmigavel = '';

          if (constraintName.includes('codcv') || detail.includes('codcv')) {
            campoProblema = 'Classe de Vendedor';
            mensagemAmigavel =
              'A classe de vendedor selecionada não existe ou está inválida.';
          } else {
            // Genérico para outras chaves estrangeiras
            campoProblema = 'Campo relacionado';
            mensagemAmigavel =
              'Um dos valores selecionados não existe no sistema.';
          }

          return res.status(400).json({
            error: `❌ ${campoProblema}: ${mensagemAmigavel}`,
            details: {
              campo: campoProblema,
              sugestao:
                'Verifique se a classe de vendedor foi selecionada corretamente ou deixe em branco.',
              technical: detail,
            },
          });

        // Erro 23502: Campo NOT NULL violado
        case '23502':
          const coluna = error.column || 'desconhecido';
          const nomesAmigaveis: { [key: string]: string } = {
            codvend: 'Código do Vendedor',
            nome: 'Nome',
            valobj: 'Valor Objetivo',
          };
          const nomeCampoAmigavel = nomesAmigaveis[coluna] || coluna;

          return res.status(400).json({
            error: `❌ Campo obrigatório vazio: ${nomeCampoAmigavel}`,
            details: {
              campo: nomeCampoAmigavel,
              sugestao: `O campo "${nomeCampoAmigavel}" é obrigatório e não pode estar vazio.`,
              technical: `Coluna: ${coluna}`,
            },
          });

        // Erro 22001: String muito longa
        case '22001':
          const match = error.message?.match(/character varying\((\d+)\)/);
          const limite = match ? match[1] : 'desconhecido';

          // Tenta identificar qual campo
          let campoExcedido = 'Um dos campos';
          const dadosErro = error.detail || error.message || '';

          if (
            dadosErro.includes('nome') ||
            error.message?.toLowerCase().includes('nome')
          ) {
            campoExcedido = 'Nome';
          } else if (dadosErro.includes('codcv')) {
            campoExcedido = 'Código da Classe';
          } else if (dadosErro.includes('status')) {
            campoExcedido = 'Status';
          } else if (dadosErro.includes('ra_mat')) {
            campoExcedido = 'RA/MAT';
          }

          return res.status(400).json({
            error: `❌ ${campoExcedido} excede o limite de ${limite} caracteres`,
            details: {
              campo: campoExcedido,
              limite: parseInt(limite),
              sugestao: `Reduza o tamanho do campo "${campoExcedido}" para no máximo ${limite} caracteres.`,
            },
          });

        // Erro 23505: Valor duplicado (unique constraint)
        case '23505':
          return res.status(400).json({
            error: '❌ Vendedor já existe no sistema',
            details: {
              campo: 'Código ou Nome',
              sugestao:
                'Este vendedor já está cadastrado. Verifique os dados ou edite o registro existente.',
            },
          });

        default:
          // Erro genérico de banco
          return res.status(500).json({
            error: '❌ Erro ao salvar no banco de dados',
            details: {
              sugestao:
                'Verifique todos os campos e tente novamente. Se o erro persistir, contate o suporte.',
              errorCode: error.code,
            },
          });
      }
    }

    // Erro não é do PostgreSQL (erro de validação, rede, etc)
    if (error instanceof Error) {
      return res.status(500).json({
        error: '❌ Erro ao criar vendedor',
        details: {
          sugestao: 'Verifique sua conexão e tente novamente.',
          message: error.message,
        },
      });
    }

    // Erro desconhecido
    res.status(500).json({
      error: '❌ Erro inesperado ao criar vendedor',
      details: {
        sugestao:
          'Tente novamente. Se o problema persistir, contate o suporte técnico.',
      },
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
