import axios from 'axios';
import { getPgPool } from '@/lib/pg';

interface DadosReceita {
  status: string;
  message?: string;
  natureza_juridica?: string;
  porte?: string;
  situacao?: string;
}

/**
 * Consulta CNPJ na ReceitaWS (API pública gratuita)
 * Retorna dados da empresa incluindo regime tributário
 */
async function consultarCNPJ(cnpj: string): Promise<DadosReceita | null> {
  try {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    console.log(`📡 Consultando CNPJ ${cnpjLimpo} na ReceitaWS...`);
    
    const response = await axios.get<DadosReceita>(
      `https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Sistema-Melo/1.0'
        }
      }
    );

    if (response.data.status === 'ERROR') {
      console.error(`❌ Erro ReceitaWS: ${response.data.message}`);
      return null;
    }

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.warn('⚠️ Rate limit atingido na ReceitaWS');
    } else {
      console.error(`❌ Erro ao consultar ReceitaWS: ${error.message}`);
    }
    return null;
  }
}

/**
 * Determina o CRT baseado nos dados da Receita Federal
 * 1 = Simples Nacional
 * 2 = Simples Nacional - excesso de sublimite
 * 3 = Regime Normal
 */
function determinarCRT(dados: DadosReceita | null): string {
  if (!dados) return '1'; // Default: Simples Nacional

  const porte = dados.porte || '';

  console.log(`📊 Porte empresa: ${porte}`);

  // Empresas de Grande Porte não podem ser Simples Nacional
  if (porte.toLowerCase().includes('demais')) {
    console.log('➡️ CRT = 3 (Regime Normal - Grande Porte)');
    return '3';
  }

  // Default para MEI, ME, EPP: Simples Nacional
  if (porte.toLowerCase().includes('micro') || 
      porte.toLowerCase().includes('pequeno') ||
      porte.toLowerCase().includes('mei')) {
    console.log('➡️ CRT = 1 (Simples Nacional)');
    return '1';
  }

  // Se não conseguiu determinar, usar Simples Nacional como padrão
  console.log('➡️ CRT = 1 (Simples Nacional - padrão)');
  return '1';
}

/**
 * Obtém o CRT da empresa
 * 1. Verifica se já existe no banco
 * 2. Se não existe ou é '1' (padrão), consulta ReceitaWS
 * 3. Atualiza o banco com o CRT correto
 * 4. Retorna o CRT para uso na emissão
 */
export async function obterCRTEmpresa(cnpj: string, ie?: string): Promise<string> {
  const pool = getPgPool();
  
  try {
    // 1. Buscar CRT atual no banco
    const params: any[] = [cnpj];
    let query = `
      SELECT crt, nomecontribuinte 
      FROM db_manaus.dadosempresa 
      WHERE cgc = $1
    `;
    
    // Se IE foi informada, usar também no filtro
    if (ie) {
      query += ` AND inscricaoestadual = $2`;
      params.push(ie);
    }
    
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      console.warn('⚠️ Empresa não encontrada no banco');
      return '1'; // Default
    }

    const empresa = result.rows[0];
    const crtAtual = empresa.crt;

    console.log(`🏢 Empresa: ${empresa.nomecontribuinte}`);
    console.log(`📋 CRT atual no banco: ${crtAtual || '(não definido)'}`);

    // 2. Se já tem CRT definido e diferente de '1', usar ele
    if (crtAtual && crtAtual !== '1') {
      console.log(`✅ Usando CRT existente: ${crtAtual}`);
      return crtAtual;
    }

    // 3. Se não tem ou é padrão '1', consultar ReceitaWS
    console.log('🔍 CRT não definido ou padrão, consultando ReceitaWS...');
    const dadosReceita = await consultarCNPJ(cnpj);
    const crtNovo = determinarCRT(dadosReceita);

    // 4. Atualizar no banco
    const updateParams: any[] = [crtNovo, cnpj];
    let updateQuery = `
      UPDATE db_manaus.dadosempresa 
      SET crt = $1 
      WHERE cgc = $2
    `;
    
    if (ie) {
      updateQuery += ` AND inscricaoestadual = $3`;
      updateParams.push(ie);
    }

    await pool.query(updateQuery, updateParams);
    console.log(`✅ CRT atualizado no banco: ${crtNovo}`);

    return crtNovo;

  } catch (error) {
    console.error('❌ Erro ao obter CRT:', error);
    return '1'; // Fallback: Simples Nacional
  }
}
