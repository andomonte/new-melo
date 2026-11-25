/**
 * Registro (SERVIDOR) dos relatórios gerenciais: slug → módulo. Não importar em componente de tela
 * (traz o SQL); a tela usa catalogo.ts e pede a definição pela API /api/relatorios/gerenciais/[slug].
 */
import type { Relatorio } from '../tipos';
import { relatorio as r0 } from './cautelasAberto';
import { relatorio as r1 } from './extratoItens';
import { relatorio as r2 } from './extratoRaioX';
import { relatorio as r3 } from './extratoItemNF';
import { relatorio as r4 } from './extratoDetalhado';
import { relatorio as r5 } from './faturasSemTitulos';
import { relatorio as r6 } from './listagemVendas';
import { relatorio as r7 } from './produtosNE';
import { relatorio as r8 } from './pendenciaProdutos';
import { relatorio as r9 } from './produtosPromocao';
import { relatorio as r10 } from './resumoDoctosGrupoMarca';
import { relatorio as r11 } from './produtoSemDemanda';
import { relatorio as r12 } from './rankingVendedores';
import { relatorio as r13 } from './comissaoGerencial';
import { relatorio as r14 } from './comissaoFinanceiro';
import { relatorio as r15 } from './comissaoCliente';
import { relatorio as r16 } from './notasSemCobranca';
import { relatorio as r17 } from './listagemVendasDiaria';
import { relatorio as r18 } from './resumoDocumentos';
import { relatorio as r19 } from './vendasTelemarketing';
import { relatorio as r20 } from './metasPerfil';
import { relatorio as r21 } from './metasCliente';
import { relatorio as r22 } from './acompanhamentoVendas';
import { relatorio as r23 } from './analiseFaturamento';
import { relatorio as r24 } from './analiseDetalhadaFaturamento';
import { relatorio as r25 } from './analiseFaturamentoTele';
import { relatorio as r26 } from './analiseVendas';
import { relatorio as r27 } from './cmv';
import { relatorio as r28 } from './vendasDesbloqueadas';
import { relatorio as r29 } from './faturamento2Vendedor';
import { relatorio as r30 } from './analiseCompraVendas';
import { relatorio as r31 } from './projecaoCompra';
import { relatorio as r32 } from './pedidosPorComprador';
import { relatorio as r33 } from './comprasOrigemAB';
import { relatorio as r34 } from './curvaAbc';
import { relatorio as r35 } from './projetarVendas';
import { relatorio as r36 } from './estoqueSuprido';
import { relatorio as r37 } from './saidaProdutoVendedor';
import { relatorio as r38 } from './estoqueSaturado';
import { relatorio as r39 } from './estoqueCritico';
import { relatorio as r40 } from './produtosSemEntrada';
import { relatorio as r41 } from './licitacoes';
import { relatorio as r42 } from './produtosFagNF';
import { relatorio as r43 } from './acompanhamentoSony';
import { relatorio as r44 } from './acompanhamentoHBuster';
import { relatorio as r45 } from './acompanhamentoSachs';
import { relatorio as r46 } from './produtosClientesFags';

const TODOS: Relatorio[] = [r0, r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19, r20, r21, r22, r23, r24, r25, r26, r27, r28, r29, r30, r31, r32, r33, r34, r35, r36, r37, r38, r39, r40, r41, r42, r43, r44, r45, r46];

export const RELATORIOS_GERENCIAIS_SERVIDOR: Record<string, Relatorio> =
  Object.fromEntries(TODOS.map((r) => [r.slug, r]));
