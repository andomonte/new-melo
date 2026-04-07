import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPrisma } from '@/lib/prismaClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const prisma = getPrisma(filial);
  const { id } = req.query;

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { selectedItems, userId } = req.body;

    if (!selectedItems || selectedItems.length === 0) {
      return res.status(400).json({ error: 'Nenhum item selecionado para processamento' });
    }

    // Buscar a NFe e seus detalhes
    const nfe = await prisma.dbnfe_ent.findUnique({
      where: { codnfe_ent: id as string },
      include: {
        dbnfe_ent_emit: true,
        dbnfe_ent_dest: true,
        dbnfe_ent_det: true,
      },
    });

    if (!nfe) {
      return res.status(404).json({ error: 'NFe não encontrada' });
    }

    if (nfe.exec === 'S') {
      return res.status(400).json({ error: 'NFe já foi processada' });
    }

    // Verificar se existe tabela de entradas (pode ser que ainda não exista no sistema)
    // Por enquanto, vamos apenas marcar a NFe como processada
    
    await prisma.$transaction(async (tx: { dbnfe_ent: { update: (arg0: { where: { codnfe_ent: string; }; data: { exec: string; dtexec: Date; codusr: any; }; }) => any; }; }) => {
      // Marcar NFe como processada
      await tx.dbnfe_ent.update({
        where: { codnfe_ent: id as string },
        data: {
          exec: 'S',
          dtexec: new Date(),
          codusr: userId,
        },
      });

      // Aqui seria criada a entrada de mercadoria baseada nos itens selecionados
      // Como não temos a estrutura de entradas ainda, vamos apenas simular o processamento
      
      // TODO: Implementar criação da entrada de mercadoria
      // Exemplo:
      // - Criar registro na tabela de entradas
      // - Criar itens da entrada baseados nos itens selecionados da NFe
      // - Atualizar estoque se necessário
      // - Gerar movimentação contábil se necessário
      
      console.log('Processando NFe:', {
        nfeId: id,
        selectedItems,
        userId,
        emitente: nfe.dbnfe_ent_emit?.[0]?.xnome,
        valorTotal: nfe.vnf,
      });
    });

    res.status(200).json({
      message: 'NFe processada com sucesso',
      nfeId: id,
      processedItems: selectedItems.length,
    });

  } catch (error) {
    console.error('Erro ao processar NFe:', error);
    res.status(500).json({ error: (error as Error).message });
  }
}