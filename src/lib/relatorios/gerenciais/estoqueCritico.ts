import type { Relatorio } from '../tipos';
import { relatorioEstoqueMinimo } from './estoqueSaturado';

/**
 * Relatórios › Gerenciais › Estoque Crítico (Delphi: frmEstoqueCritico / RELATORIOS.ESTOQUE_CRITICO).
 * Inverso do Estoque Saturado: estoque físico abaixo do mínimo. Mesma implementação (ver
 * estoqueSaturado.ts para as diferenças em relação ao legado).
 */
export const relatorio: Relatorio = relatorioEstoqueMinimo('falta', 'estoqueCritico', 'Estoque Crítico');
