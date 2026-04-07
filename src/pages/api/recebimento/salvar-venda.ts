import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { getUserFromRequest } from '@/lib/authHelper';
import { executeQuery } from '@/lib/databaseHelpers';

interface SalvarVendaRequest {
  CODIGO: string;
  NRODOC: string;
  CODCF: string;
  NOMECF: string;
  VALOR: number;
  ARMAZEM: number;
}

interface DbservimpRecord {
  CODIGO: string;
  NRODOC: string;
  TIPODOC: string;
  CODCF: string;
  NOMECF: string;
  NOMEUSR: string;
  VALOR: number;
  DATA: string;
  HORA: string;
  NROIMP: string;
  IMPRESSO: string;
  ARMAZEM: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Validar autenticação
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const {
      CODIGO,
      NRODOC,
      CODCF,
      NOMECF,
      VALOR,
      ARMAZEM,
    }: SalvarVendaRequest = req.body;

    // Validar campos obrigatórios
    if (
      !CODIGO ||
      !NRODOC ||
      !CODCF ||
      !NOMECF ||
      VALOR === undefined ||
      ARMAZEM === undefined
    ) {
      return res.status(400).json({
        error:
          'Campos obrigatórios: CODIGO, NRODOC, CODCF, NOMECF, VALOR, ARMAZEM',
      });
    }

    // Validar tipos
    if (typeof VALOR !== 'number' || VALOR < 0) {
      return res.status(400).json({
        error: 'VALOR deve ser um número positivo',
      });
    }

    if (typeof ARMAZEM !== 'number') {
      return res.status(400).json({
        error: 'ARMAZEM deve ser um número',
      });
    }

    // Validar tamanhos dos campos
    if (CODIGO.length > 9) {
      return res.status(400).json({
        error: 'CODIGO deve ter no máximo 9 caracteres',
      });
    }

    if (NRODOC.length > 9) {
      return res.status(400).json({
        error: 'NRODOC deve ter no máximo 9 caracteres',
      });
    }

    if (CODCF.length > 5) {
      return res.status(400).json({
        error: 'CODCF deve ter no máximo 5 caracteres',
      });
    }

    if (NOMECF.length > 40) {
      return res.status(400).json({
        error: 'NOMECF deve ter no máximo 40 caracteres',
      });
    }

    // Gerar data e hora atuais
    const now = new Date();
    const DATA = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const HORA = now.toTimeString().split(' ')[0]; // HH:MM:SS

    // SOLUÇÃO PROBLEMA 6: NROIMP deve ter sempre o valor estático "01"
    // Constante para melhor manutenibilidade
    const NROIMP_FIXO = '01' as const;
    const novoNroimp = NROIMP_FIXO; // Valor fixo conforme requisito

    // Preparar dados para inserção
    const novoRegistro: DbservimpRecord = {
      CODIGO,
      NRODOC,
      TIPODOC: 'F', // Sempre 'F' conforme regra
      CODCF,
      NOMECF,
      NOMEUSR: (user.login_user_name || user.login_user_login || '').substring(
        0,
        10,
      ), // Limitar a 10 chars
      VALOR,
      DATA,
      HORA,
      NROIMP: novoNroimp,
      IMPRESSO: 'N', // Sempre 'N' conforme regra
      ARMAZEM,
    };

    // Inserir registro na tabela dbservimp
    const insertQuery = `
      INSERT INTO dbservimp (
        "CODIGO", "NRODOC", "TIPODOC", "CODCF", "NOMECF", "NOMEUSR", 
        "VALOR", "DATA", "HORA", "NROIMP", "IMPRESSO", "ARMAZEM"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING *
    `;

    const insertParams = [
      novoRegistro.CODIGO,
      novoRegistro.NRODOC,
      novoRegistro.TIPODOC,
      novoRegistro.CODCF,
      novoRegistro.NOMECF,
      novoRegistro.NOMEUSR,
      novoRegistro.VALOR,
      novoRegistro.DATA,
      novoRegistro.HORA,
      novoRegistro.NROIMP,
      novoRegistro.IMPRESSO,
      novoRegistro.ARMAZEM,
    ];

    const insertResult = await executeQuery(
      client,
      insertQuery,
      insertParams,
      'inserir venda na dbservimp',
    );

    if (!insertResult.success) {
      return res.status(500).json({
        error: 'Erro ao salvar venda',
        details: insertResult.error,
      });
    }

    const vendaSalva = insertResult.data?.[0];

    return res.status(201).json({
      message: 'Venda salva com sucesso',
      data: vendaSalva,
      info: {
        nroimp_gerado: novoNroimp,
        usuario: user.login_user_name || user.login_user_login,
        data_hora: `${DATA} ${HORA}`,
      },
    });
  } catch (error) {
    console.error('Erro ao salvar venda na dbservimp:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  } finally {
    client.release();
  }
}
