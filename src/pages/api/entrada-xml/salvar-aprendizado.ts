import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface AprendizadoRequest {
  referenciaNFe: string;  // código do produto na NFe (cProd)
  codCredor: string;      // fornecedor
  codProduto: string;     // produto interno que foi associado
  codMarca?: string;      // marca (opcional)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    referenciaNFe,
    codCredor,
    codProduto,
    codMarca
  }: AprendizadoRequest = req.body;

  if (!referenciaNFe || !codCredor || !codProduto) {
    return res.status(400).json({
      success: false,
      error: 'Referência NFe, fornecedor e produto são obrigatórios'
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SET search_path TO db_manaus');

    console.log('💾 Salvando aprendizado:', {
      referenciaNFe,
      codCredor,
      codProduto,
      codMarca
    });

    // Buscar marca do produto se não foi informada
    let marcaProduto = codMarca;
    if (!marcaProduto) {
      const prodResult = await client.query(
        'SELECT codmarca FROM dbprod WHERE codprod = $1',
        [codProduto]
      );
      if (prodResult.rows.length > 0) {
        marcaProduto = prodResult.rows[0].codmarca;
      }
    }

    // ETAPA 1: Verificar se já existe essa combinação em DBREF_FABRICA
    let codId: number;

    const checkRef = await client.query(`
      SELECT cod_id
      FROM dbref_fabrica
      WHERE referencia = $1
        AND codcredor = $2
        AND codmarca = $3
    `, [referenciaNFe, codCredor, marcaProduto || '']);

    if (checkRef.rows.length > 0) {
      // Já existe essa referência
      codId = checkRef.rows[0].cod_id;
      console.log(`  ✅ Referência já existe: cod_id = ${codId}`);
    } else {
      // Criar nova referência
      const maxIdResult = await client.query(
        'SELECT COALESCE(MAX(cod_id), 0) + 1 as next_id FROM dbref_fabrica'
      );
      codId = maxIdResult.rows[0].next_id;

      await client.query(`
        INSERT INTO dbref_fabrica (cod_id, codmarca, referencia, codcredor)
        VALUES ($1, $2, $3, $4)
      `, [codId, marcaProduto || '', referenciaNFe, codCredor]);

      console.log(`  ✅ Nova referência criada: cod_id = ${codId}`);
    }

    // ETAPA 2: Verificar se já existe o relacionamento em DBPROD_REF_FABRICA
    const checkProdRef = await client.query(`
      SELECT 1
      FROM dbprod_ref_fabrica
      WHERE codprod = $1
        AND cod_id = $2
    `, [codProduto, codId]);

    if (checkProdRef.rows.length === 0) {
      // Criar relacionamento produto <-> referência
      await client.query(`
        INSERT INTO dbprod_ref_fabrica (codprod, cod_id)
        VALUES ($1, $2)
      `, [codProduto, codId]);

      console.log(`  ✅ Relacionamento criado: ${codProduto} <-> ${codId}`);
    } else {
      console.log(`  ℹ️ Relacionamento já existia`);
    }

    await client.query('COMMIT');

    console.log('✅ Aprendizado salvo com sucesso!');

    return res.status(200).json({
      success: true,
      message: 'Aprendizado salvo - próximas NFes sugerirão este produto automaticamente',
      codId
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Erro ao salvar aprendizado:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao salvar aprendizado',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
