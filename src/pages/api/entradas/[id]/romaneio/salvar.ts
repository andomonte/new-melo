import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface RomaneioItem {
  arm_id: number;
  qtd: number;
}

interface ItemRequest {
  produto_cod: string;
  quantidade_total: number;
  multiplo: number;
  romaneio: RomaneioItem[];
}

interface SalvarRomaneioRequest {
  itens: ItemRequest[];
}

interface SalvarRomaneioResponse {
  ok: boolean;
  entrada_id: number;
  numero_entrada: string;
  itens_salvos: number;
  total_separacoes: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SalvarRomaneioResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;
  const { itens }: SalvarRomaneioRequest = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'ID da entrada é obrigatório'
    });
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({
      error: 'Lista de itens é obrigatória'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();

    // Iniciar transação
    await client.query('BEGIN');

    // 1. Buscar dados da entrada
    const entradaResult = await client.query(`
      SELECT id, numero_entrada, status, nfe_id
      FROM db_manaus.entradas_estoque
      WHERE id = $1
    `, [parseInt(id)]);

    if (entradaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Entrada não encontrada'
      });
    }

    const entrada = entradaResult.rows[0];

    // 2. Validar status - pode criar romaneio se entrada estiver PENDENTE ou PRECO_CONFIRMADO
    // Não pode criar romaneio se já DISPONIVEL_VENDA (já confirmou estoque)
    const statusPermitidos = ['PENDENTE', 'PRECO_CONFIRMADO'];
    if (!statusPermitidos.includes(entrada.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Não é possível criar/alterar romaneio. Entrada está com status: ${entrada.status}. Status permitidos: ${statusPermitidos.join(', ')}`
      });
    }

    // 3. Verificar se já tem romaneio (não pode editar depois de salvo!)
    const romaneioExistente = await client.query(`
      SELECT COUNT(*) as total
      FROM db_manaus.dbitent_armazem
      WHERE codent = $1
    `, [entrada.numero_entrada]);

    if (parseInt(romaneioExistente.rows[0].total) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Romaneio já foi salvo e não pode ser alterado. Para modificar, cancele a entrada e crie uma nova.'
      });
    }

    // 4. Validar armazéns existem e estão ativos
    const armIds = [...new Set(itens.flatMap(i => i.romaneio.map(r => r.arm_id)))];

    if (armIds.length > 0) {
      const armazensResult = await client.query(`
        SELECT arm_id FROM db_manaus.cad_armazem
        WHERE arm_id = ANY($1) AND arm_status = 'A'
      `, [armIds]);

      const armazensValidos = new Set(armazensResult.rows.map(r => r.arm_id));
      const armazensInvalidos = armIds.filter(id => !armazensValidos.has(id));

      if (armazensInvalidos.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Armazéns inválidos ou inativos: ${armazensInvalidos.join(', ')}`
        });
      }
    }

    // 5. Validar cada item
    for (const item of itens) {
      // 5.1. Validar soma das quantidades
      const soma = item.romaneio.reduce((acc, r) => acc + r.qtd, 0);
      if (Math.abs(soma - item.quantidade_total) > 0.001) { // Tolerância para float
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Produto ${item.produto_cod}: soma das separações (${soma}) diferente da quantidade total (${item.quantidade_total})`
        });
      }

      // 5.2. Validar múltiplo
      for (const rom of item.romaneio) {
        if (rom.qtd > 0 && rom.qtd % item.multiplo !== 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `Produto ${item.produto_cod}: quantidade ${rom.qtd} no armazém ${rom.arm_id} não é múltiplo de ${item.multiplo}`
          });
        }
      }
    }

    // 6. Salvar romaneio
    let totalSeparacoes = 0;

    for (const item of itens) {
      // Buscar req_id do item
      const reqResult = await client.query(`
        SELECT req_id FROM db_manaus.entrada_itens
        WHERE entrada_id = $1 AND produto_cod = $2
        LIMIT 1
      `, [entrada.id, item.produto_cod]);

      const req_id = reqResult.rows[0]?.req_id || null;

      // Se não tiver separação, usar armazém padrão (1003) para todo o produto
      if (item.romaneio.length === 0) {
        await client.query(`
          INSERT INTO db_manaus.dbitent_armazem (codent, codprod, codreq, arm_id, qtd)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          entrada.numero_entrada,
          item.produto_cod,
          req_id,
          1003, // Armazém padrão do sistema
          item.quantidade_total
        ]);
        totalSeparacoes++;
      } else {
        // Inserir cada separação
        for (const rom of item.romaneio) {
          if (rom.qtd > 0) {
            await client.query(`
              INSERT INTO db_manaus.dbitent_armazem (codent, codprod, codreq, arm_id, qtd)
              VALUES ($1, $2, $3, $4, $5)
            `, [
              entrada.numero_entrada,
              item.produto_cod,
              req_id,
              rom.arm_id,
              rom.qtd
            ]);
            totalSeparacoes++;
          }
        }
      }
    }

    // 7. Marcar entrada como tendo romaneio realizado (est_alocado=1)
    // Este campo indica que os produtos foram FISICAMENTE distribuídos nos armazéns
    await client.query(`
      UPDATE db_manaus.entradas_estoque
      SET est_alocado = 1
      WHERE id = $1
    `, [entrada.id]);

    // Commit da transação
    await client.query('COMMIT');

    console.log(`✅ Romaneio salvo: ${itens.length} itens, ${totalSeparacoes} separações`);

    return res.status(200).json({
      ok: true,
      entrada_id: entrada.id,
      numero_entrada: entrada.numero_entrada,
      itens_salvos: itens.length,
      total_separacoes: totalSeparacoes
    });

  } catch (error: any) {
    console.error('Erro ao salvar romaneio:', error);

    if (client) {
      await client.query('ROLLBACK');
    }

    return res.status(500).json({
      error: `Erro ao salvar romaneio: ${error.message}`
    });

  } finally {
    if (client) {
      client.release();
    }
  }
}