/**
 * /api/importacao/[id]/fornecedores
 *
 * GET  → lista os fornecedores da DI (ordenados pela menor adição) com o vínculo
 *        resolvido ao cliente do cadastro (tipo X): aprendido / sugerido / múltiplo /
 *        nenhum, candidatos por prefixo, e avisos do destinatário exterior.
 * POST → grava o vínculo fornecedor(DIe) → cod_cliente:
 *        upsert em dbent_importacao_fornecedor_cliente (reutilizável) +
 *        dbent_importacao_entrada.cod_cliente da(s) fatura(s) desse fornecedor.
 *        Body: { nome_die: string, cod_cliente: string }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import {
  resolverFornecedorCliente,
  avisosDestinatarioExterior,
  chaveVinculo,
  type ClienteCadastro,
} from '@/lib/compras/importacaoHierarquia';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const importacaoId = parseInt(String(req.query.id), 10);
  if (!importacaoId) return res.status(400).json({ message: 'ID de importação inválido' });

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);

  try {
    if (req.method === 'GET') {
      // 1) fornecedores da DI (pela adição), ordenados pela menor adição
      const fornRes = await pool.query(
        `SELECT fornecedor_nome, MIN(numero_adicao) AS primeira_adicao, COUNT(*) AS qtd_adicoes
           FROM dbent_importacao_adicao
          WHERE id_importacao = $1 AND COALESCE(fornecedor_nome,'') <> ''
          GROUP BY fornecedor_nome
          ORDER BY primeira_adicao`,
        [importacaoId],
      );

      // 2) candidatos: clientes estrangeiros (tipo X) do cadastro
      const cliRes = await pool.query(
        `SELECT codcli, nome, nomefant, codpais, cpfcgc FROM dbclien WHERE tipo = 'X'`,
      );
      const candidatos: ClienteCadastro[] = cliRes.rows.map((r: any) => ({
        codCliente: String(r.codcli),
        nome: r.nome || '',
        nomeFant: r.nomefant || null,
        codPais: r.codpais ?? null,
        idEstrangeiro: r.cpfcgc ?? null,
      }));

      // 3) vínculos aprendidos (reutilizáveis)
      const aprRes = await pool.query(
        `SELECT nome_norm, cod_cliente FROM dbent_importacao_fornecedor_cliente`,
      );
      const aprendidos = new Map<string, string>();
      aprRes.rows.forEach((r: any) => aprendidos.set(r.nome_norm, String(r.cod_cliente)));

      // 4) cod_cliente já gravado na fatura (tem prioridade sobre a sugestão)
      const entRes = await pool.query(
        `SELECT fornecedor_nome, cod_cliente FROM dbent_importacao_entrada WHERE id_importacao = $1`,
        [importacaoId],
      );
      const codClienteFatura = new Map<string, string>();
      entRes.rows.forEach((r: any) => {
        if (r.cod_cliente) codClienteFatura.set(r.fornecedor_nome || '', String(r.cod_cliente));
      });
      const byCod = (cod: string) => candidatos.find((c) => c.codCliente === String(cod)) || null;

      const fornecedores = fornRes.rows.map((r: any) => {
        const nomeDie = r.fornecedor_nome as string;
        const resolvido = resolverFornecedorCliente(nomeDie, candidatos, aprendidos);
        // fatura manda: se já gravado, é o vínculo efetivo (status 'learned')
        const codFatura = codClienteFatura.get(nomeDie);
        const codCliente = codFatura || resolvido.codCliente;
        const cliente = codCliente ? byCod(codCliente) : resolvido.cliente || null;
        const status = codFatura ? 'learned' : resolvido.status;
        return {
          nome_die: nomeDie,
          primeira_adicao: Number(r.primeira_adicao),
          qtd_adicoes: Number(r.qtd_adicoes),
          cod_cliente: codCliente,
          status,
          vinculado: !!codCliente,
          candidatos: resolvido.candidatos,
          cliente,
          avisos: codCliente ? avisosDestinatarioExterior(cliente) : [],
        };
      });

      const todosVinculados = fornecedores.length > 0 && fornecedores.every((f) => f.vinculado);
      return res.status(200).json({
        fornecedores,
        total: fornecedores.length,
        vinculados: fornecedores.filter((f) => f.vinculado).length,
        todos_vinculados: todosVinculados,
      });
    }

    if (req.method === 'POST') {
      const nomeDie = String(req.body?.nome_die || '').trim();
      const codCliente = String(req.body?.cod_cliente || '').trim();
      if (!nomeDie || !codCliente)
        return res.status(400).json({ message: 'nome_die e cod_cliente são obrigatórios' });

      // confere que o cliente existe e é estrangeiro (tipo X)
      const cli = await pool.query(
        `SELECT codcli, nome, nomefant, codpais, cpfcgc FROM dbclien WHERE codcli = $1 AND tipo = 'X'`,
        [codCliente],
      );
      if (cli.rows.length === 0)
        return res.status(422).json({ message: 'Cliente não encontrado ou não é do tipo estrangeiro (X)' });

      // 1) vínculo reutilizável
      await pool.query(
        `INSERT INTO dbent_importacao_fornecedor_cliente (nome_norm, cod_cliente, nome_die)
         VALUES ($1, $2, $3)
         ON CONFLICT (nome_norm) DO UPDATE SET cod_cliente = EXCLUDED.cod_cliente, nome_die = EXCLUDED.nome_die`,
        [chaveVinculo(nomeDie), codCliente, nomeDie],
      );
      // 2) fatura(s) desse fornecedor nesta DI
      const upd = await pool.query(
        `UPDATE dbent_importacao_entrada SET cod_cliente = $1
          WHERE id_importacao = $2 AND fornecedor_nome = $3`,
        [codCliente, importacaoId, nomeDie],
      );

      const c = cli.rows[0];
      const cliente: ClienteCadastro = {
        codCliente: String(c.codcli),
        nome: c.nome || '',
        nomeFant: c.nomefant || null,
        codPais: c.codpais ?? null,
        idEstrangeiro: c.cpfcgc ?? null,
      };
      return res.status(200).json({
        success: true,
        nome_die: nomeDie,
        cod_cliente: codCliente,
        faturas_atualizadas: upd.rowCount,
        cliente,
        avisos: avisosDestinatarioExterior(cliente),
      });
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (e: any) {
    console.error('[importacao/fornecedores] erro:', e);
    return res.status(500).json({ message: 'Erro ao processar fornecedores', detail: e.message });
  }
}
