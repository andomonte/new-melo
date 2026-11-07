import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { credoresDaNota, produtosDaReferencia } from '@/lib/compras/refFabrica';

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
    await client.query(`SET search_path TO ${process.env.DB_SCHEMA || 'db_manaus'}`);

    console.log('🔍 Buscando sugestão inteligente para:', {
      referenciaNFe,
      codCredor,
      codMarca
    });

    const credores = await credoresDaNota(client, codCredor);
    if (credores.proprios.length === 0 && credores.mesmaEmpresa.length === 0) {
      console.log(`   ⚠️ Fornecedor não encontrado para CNPJ/código: ${codCredor}`);
      return res.status(200).json({
        success: true,
        jaVisto: false,
        message: 'Fornecedor não encontrado no cadastro'
      });
    }

    const produtos = await produtosDaReferencia(client, referenciaNFe, credores, codMarca);

    if (produtos.length === 0) {
      console.log('❌ Nenhuma sugestão encontrada - produto nunca visto antes');
      return res.status(200).json({
        success: true,
        jaVisto: false,
        message: 'Nenhuma sugestão disponível - primeira vez que vemos este produto'
      });
    }

    // Mapear todas as sugestões
    const sugestoes: ProdutoSugerido[] = produtos.map(row => ({
      codprod: row.codprod,
      referencia: row.referencia,
      descricao: row.descricao,
      marca: row.marca,
      estoque: parseInt(String(row.estoque || 0)),
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
