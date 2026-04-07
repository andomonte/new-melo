import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface ProdutoSugerido {
  codprod: string;
  referencia: string;
  descricao: string;
  marca: string;
  estoque: number;
  tipo: string;
  confianca: 'alta' | 'media'; // alta = match exato, media = match parcial
}

interface SugestaoResponse {
  success: boolean;
  sugestao?: ProdutoSugerido;  // ÚNICA sugestão (para backward compatibility)
  sugestoes?: ProdutoSugerido[]; // MÚLTIPLAS sugestões
  jaVisto: boolean; // se true, esse produto já foi associado antes
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SugestaoResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    referenciaNFe,  // código do produto que veio na NFe (cProd)
    codCredor,      // fornecedor (pode ser CNPJ ou código de 5 dígitos)
    codMarca        // marca (opcional)
  } = req.body;

  if (!referenciaNFe || !codCredor) {
    return res.status(400).json({
      success: false,
      jaVisto: false,
      message: 'Referência da NFe e código do fornecedor são obrigatórios'
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    console.log('🔍 Buscando sugestão inteligente para:', {
      referenciaNFe,
      codCredor,
      codMarca
    });

    // Se codCredor for CNPJ (mais de 5 dígitos), buscar código do fornecedor
    let codCredorFinal = codCredor;
    if (codCredor.length > 5) {
      console.log('   🔄 Convertendo CNPJ para código de fornecedor...');
      const credorResult = await client.query(`
        SELECT cod_credor
        FROM dbcredor
        WHERE cpf_cgc = $1
           OR UPPER(TRIM(nome)) = (
             SELECT UPPER(TRIM(xnome))
             FROM dbnfe_ent_emit
             WHERE cpf_cnpj = $1
             LIMIT 1
           )
        LIMIT 1
      `, [codCredor]);

      if (credorResult.rows.length > 0) {
        codCredorFinal = credorResult.rows[0].cod_credor;
        console.log(`   ✅ CNPJ ${codCredor} → Código ${codCredorFinal}`);
      } else {
        console.log(`   ⚠️ Fornecedor não encontrado para CNPJ/código: ${codCredor}`);
        return res.status(200).json({
          success: true,
          jaVisto: false,
          message: 'Fornecedor não encontrado no cadastro'
        });
      }
    }

    // ESTRATÉGIA 1: Busca exata (REFERENCIA + FORNECEDOR + MARCA)
    // Essa é a mesma lógica do Oracle SELECIONA_REF_FABRICA
    let result;

    if (codMarca) {
      result = await client.query(`
        SELECT
          p.codprod,
          p.ref as referencia,
          p.descr as descricao,
          COALESCE(m.descr, 'SEM MARCA') as marca,
          COALESCE(p.qtest, 0) - COALESCE(p.qtdreservada, 0) as estoque,
          p.tipo,
          'alta' as confianca
        FROM dbref_fabrica rf
        INNER JOIN dbprod_ref_fabrica prf ON rf.cod_id = prf.cod_id
        INNER JOIN dbprod p ON prf.codprod = p.codprod
        LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
        WHERE rf.referencia = $1
          AND rf.codcredor = $2
          AND rf.codmarca = $3
          AND p.inf NOT IN ('D')
          AND p.excluido <> 1
        ORDER BY p.codprod
      `, [referenciaNFe, codCredorFinal, codMarca]);
    }

    // ESTRATÉGIA 2: Busca sem marca (apenas REFERENCIA + FORNECEDOR)
    if (!result || result.rows.length === 0) {
      console.log('⚠️ Não encontrou com marca, tentando sem marca...');

      result = await client.query(`
        SELECT
          p.codprod,
          p.ref as referencia,
          p.descr as descricao,
          COALESCE(m.descr, 'SEM MARCA') as marca,
          COALESCE(p.qtest, 0) - COALESCE(p.qtdreservada, 0) as estoque,
          p.tipo,
          'media' as confianca
        FROM dbref_fabrica rf
        INNER JOIN dbprod_ref_fabrica prf ON rf.cod_id = prf.cod_id
        INNER JOIN dbprod p ON prf.codprod = p.codprod
        LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
        WHERE rf.referencia = $1
          AND rf.codcredor = $2
          AND p.inf NOT IN ('D')
          AND p.excluido <> 1
        ORDER BY p.codprod
      `, [referenciaNFe, codCredorFinal]);
    }

    if (result.rows.length === 0) {
      console.log('❌ Nenhuma sugestão encontrada - produto nunca visto antes');
      return res.status(200).json({
        success: true,
        jaVisto: false,
        message: 'Nenhuma sugestão disponível - primeira vez que vemos este produto'
      });
    }

    // Mapear todas as sugestões
    const sugestoes: ProdutoSugerido[] = result.rows.map(row => ({
      codprod: row.codprod,
      referencia: row.referencia,
      descricao: row.descricao,
      marca: row.marca,
      estoque: parseInt(row.estoque || 0),
      tipo: row.tipo || 'PRODUTO',
      confianca: row.confianca
    }));

    console.log(`✅ ${sugestoes.length} sugestão(ões) encontrada(s)`);

    // Retornar primeira sugestão para backward compatibility + array completo
    return res.status(200).json({
      success: true,
      sugestao: sugestoes[0],  // Backward compatibility
      sugestoes,               // Novo: array completo
      jaVisto: true
    });

  } catch (error) {
    console.error('❌ Erro ao buscar sugestão:', error);
    return res.status(500).json({
      success: false,
      jaVisto: false,
      message: 'Erro ao buscar sugestão inteligente'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
