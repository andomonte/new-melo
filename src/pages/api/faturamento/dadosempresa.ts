// pages/api/empresa/dados.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolFilial } from '@/lib/pg';
import { getUserFromRequest } from '@/lib/authHelper';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // 1. Validar o método HTTP, assim como no seu exemplo
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  // Exige usuário logado: emissão fiscal e dados da empresa não são rotas públicas.
  if (!getUserFromRequest(req)) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }

  // 2. Obter parâmetros opcionais para filtrar empresa específica
  const { cgc, inscricaoestadual } = req.query;

  // 3. Conectar ao pool
  const client = await (await getPgPoolFilial(req)).connect();

  try {
    // Se foi fornecida IE, primeiro buscar o CNPJ associado na tabela db_ie
    let cnpjFinal = cgc as string | undefined;
    
    if (inscricaoestadual && !cgc) {
      console.log(`🔍 Buscando CNPJ na db_ie para IE: ${inscricaoestadual}`);
      const ieResult = await client.query(
        `SELECT cgc FROM db_ie WHERE inscricaoestadual = $1`,
        [inscricaoestadual as string]
      );
      
      if (ieResult.rows.length > 0) {
        cnpjFinal = ieResult.rows[0].cgc;
        console.log(`✅ CNPJ encontrado via db_ie: ${cnpjFinal}`);
      } else {
        console.log(`⚠️ IE ${inscricaoestadual} não encontrada em db_ie, buscando direto em dadosempresa`);
      }
    }

    // 4. Montar query para buscar empresa
    let query = `
      SELECT * FROM dadosempresa
      WHERE "certificadoKey" IS NOT NULL
        AND "certificadoCrt" IS NOT NULL
        AND "certificadoKey" != ''
        AND "certificadoCrt" != ''
    `;
    const params: string[] = [];

    // Se temos um CNPJ (direto ou via db_ie), filtrar por ele
    if (cnpjFinal) {
      query += ` AND cgc = $${params.length + 1}`;
      params.push(cnpjFinal);
      console.log(`🔍 Buscando empresa por CNPJ: ${cnpjFinal}`);
    }

    // Se foi fornecida IE e não achou na db_ie, tentar buscar direto na dadosempresa
    if (inscricaoestadual && !cnpjFinal) {
      query += ` AND inscricaoestadual = $${params.length + 1}`;
      params.push(inscricaoestadual as string);
      console.log(`🔍 Buscando empresa por IE direto: ${inscricaoestadual}`);
    }

    query += ` ORDER BY cgc LIMIT 1`;

    const { rows } = await client.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({
        error:
          'Dados da empresa não encontrados ou certificados digitais não configurados. ' +
          'Configure os certificados digitais na seção Admin > Cadastro > Dados Empresa.',
      });
    }

    // 4. Retornar os dados encontrados (a empresa com certificados válidos)
    // Certificado, chave e CSC nunca vão ao navegador: as APIs de emissão os leem do banco.
    // Além de sensíveis, somam ~15 KB que o front reenviava em `emitente` no POST da nota,
    // estourando o limite do nginx (500 antes de chegar ao app).
    const {
      certificadoKey: _key,
      certificadoCrt: _crt,
      cadeiaCrt: _cadeia,
      csc_nfce_homologacao: _cscHom,
      csc_nfce_producao: _cscProd,
      ...empresa
    } = rows[0];
    return res.status(200).json(empresa);
  } catch (error: any) {
    // 5. Tratamento de erro, igual ao seu exemplo
    console.error('Erro ao buscar dados da empresa:', error);
    res
      .status(500)
      .json({
        error: error.message || 'Erro interno ao buscar dados da empresa',
      });
  } finally {
    // 6. Liberar o cliente de volta para o pool, uma etapa crucial
    client.release();
  }
}
