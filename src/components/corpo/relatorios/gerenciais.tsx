/**
 * Telas do menu Relatórios › Gerenciais: uma tela por relatório do catálogo (mesma ordem do
 * Delphi), todas sobre a RelatorioPadrao. Referências estáveis (criadas uma vez) para o menu.
 */
import React from 'react';
import RelatorioPadrao from './RelatorioPadrao';
import { RELATORIOS_GERENCIAIS, hrefGerencial } from '@/lib/relatorios/gerenciais/catalogo';

const telas: Record<string, React.FC> = {};
for (const r of RELATORIOS_GERENCIAIS) {
  const Tela: React.FC = () => <RelatorioPadrao key={r.slug} slug={r.slug} />;
  Tela.displayName = `RelatorioGerencial_${r.slug}`;
  telas[r.slug] = Tela;
}

/** Itens de 3º nível do menu (Relatórios › Gerenciais › …). */
export const MENU_RELATORIOS_GERENCIAIS = RELATORIOS_GERENCIAIS.map((r) => ({
  name: r.titulo,
  href: hrefGerencial(r.slug),
  corpo: telas[r.slug],
}));
