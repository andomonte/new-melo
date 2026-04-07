import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const {
        requisicao_id,
        titulo_numero,
        valor,
        data_vencimento,
        parcela,
        status = 'PENDENTE',
        observacoes
      } = req.body;

      // Validações
      if (!requisicao_id || !titulo_numero || !valor || !data_vencimento) {
        return res.status(400).json({
          message: 'Campos obrigatórios: requisicao_id, titulo_numero, valor, data_vencimento'
        });
      }

      // Verificar se a requisição existe
      const requisicao = await prisma.$queryRaw`
        SELECT req_id FROM cmp_requisicao WHERE req_id_composto = ${requisicao_id}
      ` as any[];

      if (!requisicao || requisicao.length === 0) {
        return res.status(404).json({
          message: 'Requisição não encontrada'
        });
      }

      // Inserir conta a pagar
      await prisma.$queryRaw`
        INSERT INTO contas_pagar (
          requisicao_id,
          titulo_numero,
          valor,
          data_vencimento,
          parcela,
          status,
          observacoes,
          created_at,
          updated_at
        ) VALUES (
          ${requisicao_id},
          ${titulo_numero},
          ${valor},
          ${data_vencimento},
          ${parcela || 1},
          ${status},
          ${observacoes || null},
          NOW(),
          NOW()
        )
      `;

      // Registrar no histórico
      await prisma.$queryRaw`
        INSERT INTO requisicoes_historico (
          requisicao_id,
          acao,
          detalhes,
          tipo,
          usuario,
          created_at
        ) VALUES (
          ${requisicao_id},
          'Conta a pagar adicionada',
          'Título ${titulo_numero} - Valor: R$ ${valor} - Vencimento: ${data_vencimento}',
          'FINANCEIRO',
          'Sistema',
          NOW()
        )
      `;

      res.status(201).json({
        success: true,
        message: 'Conta a pagar criada com sucesso'
      });

    } catch (error) {
      console.error('Erro ao criar conta a pagar:', error);
      res.status(500).json({
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  } else {
    res.status(405).json({ message: 'Método não permitido' });
  }

  await prisma.$disconnect();
}