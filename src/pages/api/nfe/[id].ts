import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPrisma } from '../../../lib/prismaClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const prisma = getPrisma(filial);
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
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

      // Transformar dados para o formato esperado pelo frontend
      const nfeFormatted = {
        id: nfe.codnfe_ent,
        numeroNF: nfe.nnf?.toString() || '',
        serie: nfe.serie?.toString() || '',
        chaveNFe: nfe.chave,
        emitente: nfe.dbnfe_ent_emit?.[0]?.xnome || 'N/A',
        cnpjEmitente: nfe.dbnfe_ent_emit?.[0]?.cpf_cnpj || '',
        dataEmissao: nfe.demi?.toISOString() || '',
        dataUpload: nfe.dtimport?.toISOString() || '',
        valorTotal: Number(nfe.vnf) || 0,
        status: nfe.exec === 'S' ? 'PROCESSADA' : (nfe.nprot ? 'RECEBIDA' : 'ERRO'),
        itens: nfe.dbnfe_ent_det?.map((item: { cprod: any; xprod: any; qcom: any; vuncom: any; vprod: any; ncm: any; cfop: { toString: () => any; }; }) => ({
          codigo: item.cprod || '',
          descricao: item.xprod || '',
          quantidade: Number(item.qcom) || 0,
          valorUnitario: Number(item.vuncom) || 0,
          valorTotal: Number(item.vprod) || 0,
          ncm: item.ncm || '',
          cfop: item.cfop?.toString() || '',
        })) || [],
        dadosEmitente: {
          razaoSocial: nfe.dbnfe_ent_emit?.[0]?.xnome || '',
          cnpj: nfe.dbnfe_ent_emit?.[0]?.cpf_cnpj || '',
          ie: nfe.dbnfe_ent_emit?.[0]?.ie || '',
          endereco: {
            logradouro: nfe.dbnfe_ent_emit?.[0]?.xlgr || '',
            numero: nfe.dbnfe_ent_emit?.[0]?.nro || '',
            bairro: nfe.dbnfe_ent_emit?.[0]?.xbairro || '',
            municipio: nfe.dbnfe_ent_emit?.[0]?.xmun || '',
            uf: nfe.dbnfe_ent_emit?.[0]?.uf || '',
            cep: nfe.dbnfe_ent_emit?.[0]?.cep || '',
          },
        },
        dadosDestinatario: {
          razaoSocial: nfe.dbnfe_ent_dest?.[0]?.xnome || '',
          cnpj: nfe.dbnfe_ent_dest?.[0]?.cpf_cnpj || '',
          ie: nfe.dbnfe_ent_dest?.[0]?.ie || '',
          endereco: {
            logradouro: nfe.dbnfe_ent_dest?.[0]?.xlgr || '',
            numero: nfe.dbnfe_ent_dest?.[0]?.nro || '',
            bairro: nfe.dbnfe_ent_dest?.[0]?.xbairro || '',
            municipio: nfe.dbnfe_ent_dest?.[0]?.xmun || '',
            uf: nfe.dbnfe_ent_dest?.[0]?.uf || '',
            cep: nfe.dbnfe_ent_dest?.[0]?.cep || '',
          },
        },
      };

      res.status(200).json(nfeFormatted);
    } catch (error) {
      console.error('Erro ao carregar NFe:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Verificar se a NFe pode ser excluída (apenas se status RECEBIDA)
      const nfe = await prisma.dbnfe_ent.findUnique({
        where: { codnfe_ent: id as string },
      });

      if (!nfe) {
        return res.status(404).json({ error: 'NFe não encontrada' });
      }

      if (nfe.exec === 'S') {
        return res.status(400).json({ error: 'NFe já processada não pode ser excluída' });
      }

      // Excluir em cascata (detalhes primeiro, depois a NFe principal)
      await prisma.$transaction([
        prisma.dbnfe_ent_det.deleteMany({
          where: { codnfe_ent: id as string },
        }),
        prisma.dbnfe_ent_emit.deleteMany({
          where: { codnfe_ent: id as string },
        }),
        prisma.dbnfe_ent_dest.deleteMany({
          where: { codnfe_ent: id as string },
        }),
        prisma.dbnfe_ent.delete({
          where: { codnfe_ent: id as string },
        }),
      ]);

      res.status(200).json({ message: 'NFe excluída com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir NFe:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}