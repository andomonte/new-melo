import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Edit,
  FileText,
  FileSignature,
  BatteryCharging,
  Undo2,
  DollarSign,
  CircleChevronDown,
  Mail,
  MailCheck,
  List,
  Lock,
  History,
  Ban,
  RefreshCw,
  Receipt,
} from 'lucide-react';
//veroficar
interface Props {
  fatura: any;
  onEspelhoClick: () => void;
  onCobrancaClick: () => void;
  onEditarClick: () => void;
  onCancelarCobranca: () => void;
  onAlterarCobranca?: () => void;
  onFecharFatura: () => void;
  onEmailDanfeClick: () => void;
  onenviarCobrancaClick: () => void;
  onVisualizarRejeicaoClick: () => void;
  onCancelarNotaClick: () => void;
  onCancelarFaturaClick?: () => void;
  onEmitirNotaClick: () => void;
  onVisualizarBoletosClick: () => void;
  onReciboClick: () => void;
  onVerProdutosClick?: () => void;
  onEventoClick?: () => void;
  onCartaCorrecaoClick?: () => void;
  onTermoBateriasClick?: () => void;
  onEstornoClick?: () => void;
  onEmitirDevolucaoClick?: () => void;
  isSelecionada?: boolean;
}

export default function DropdownFatura({
  fatura,
  onEspelhoClick,
  onCobrancaClick,
  onEditarClick,
  onCancelarCobranca,
  onAlterarCobranca,
  onFecharFatura,
  onEmailDanfeClick,
  onenviarCobrancaClick,
  onVisualizarRejeicaoClick,
  onCancelarNotaClick,
  onCancelarFaturaClick,
  onEmitirNotaClick,
  onVisualizarBoletosClick,
  onReciboClick,
  onVerProdutosClick,
  onEventoClick,
  onCartaCorrecaoClick,
  onTermoBateriasClick,
  onEstornoClick,
  onEmitirDevolucaoClick,
  isSelecionada = false,
}: Props) {
  // É uma DI de devolução (gerada por estorno) quando tem codfatrel + natureza DEVOLUCAO.
  const ehDI =
    !!fatura?.codfatrel &&
    String(fatura?.descrcfop || '').toUpperCase().includes('DEVOLU');
       
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1 rounded-full transition-all text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          title="Mais ações"
        >
          <CircleChevronDown
            size={18}
            className={`transition-transform duration-300 ${
              open ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="left"
        align="start"
        sideOffset={5}
        collisionPadding={8}
        className="bg-white dark:bg-zinc-800 border rounded-md shadow text-sm z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto"
      >
        <DropdownMenuItem
          onClick={onEmitirNotaClick}
          disabled={
            fatura.nfe_status === '100' ||
            fatura.cancel === 'S' ||
            fatura.nfe_status === 'C' ||
            fatura.denegada === 'S'
          }
          title={
            fatura.nfe_status === '100'
              ? 'Nota já autorizada'
              : fatura.cancel === 'S' || fatura.nfe_status === 'C'
                ? 'Nota cancelada'
                : fatura.denegada === 'S'
                  ? 'Nota denegada'
                  : 'Emitir a NF-e desta fatura'
          }
          className="group flex items-center gap-2 px-2 py-2 hover:bg-green-700 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <FileText className="size-4 text-green-700 group-hover:text-white transition group-disabled:text-gray-400" />
          Emitir Nota Fiscal
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onEspelhoClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-blue-600 hover:text-white transition"
        >
          <FileText className="size-4 text-gray-600 group-hover:text-white transition" />
          Vizualizar Nota
        </DropdownMenuItem>

        {onEventoClick && (
          <DropdownMenuItem
            onClick={onEventoClick}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-indigo-600 hover:text-white transition"
          >
            <History className="size-4 text-indigo-600 group-hover:text-white transition" />
            Evento
          </DropdownMenuItem>
        )}

        {onVerProdutosClick && (
          <DropdownMenuItem
            onClick={onVerProdutosClick}
            disabled={!isSelecionada}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-purple-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
          >
            <List className="size-4 text-purple-600 group-hover:text-white transition group-disabled:text-gray-400" />
            Ver produtos da fatura
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={onVisualizarRejeicaoClick}
          disabled={!fatura.mensagem_rejeicao && !fatura.motivocancelamento && (!fatura.nfe_motivo || fatura.nfe_status === 'A')}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-yellow-600 hover:text-white transition"
        >
          <FileText className="size-4 text-yellow-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Visualizar Rejeição da Nota
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onCancelarNotaClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-red-700 hover:text-white transition"
        >
          <FileText className="size-4 text-red-700 group-hover:text-white transition" />
          Cancelar Nota Fiscal
        </DropdownMenuItem>

        {onCancelarFaturaClick && (
          <DropdownMenuItem
            onClick={onCancelarFaturaClick}
            // REGRA: só cancela a fatura quando a NF-e já foi EMITIDA (autorizada, status 100)
            // e a fatura ainda não está cancelada.
            disabled={fatura.cancel === 'S' || fatura.nfe_status !== '100'}
            className={`group flex items-center gap-2 px-2 py-2 transition ${
              fatura.cancel !== 'S' && fatura.nfe_status === '100'
                ? 'hover:bg-red-800 hover:text-white'
                : 'opacity-50 cursor-not-allowed'
            }`}
            title={
              fatura.nfe_status !== '100'
                ? 'Só é possível cancelar a fatura após a NF-e ser emitida (autorizada)'
                : fatura.cancel === 'S'
                  ? 'Fatura já cancelada'
                  : 'Cancelar o faturamento (NF-e + fatura + contas a receber + venda)'
            }
          >
            <Ban className={`size-4 transition ${
              fatura.cancel !== 'S' && fatura.nfe_status === '100'
                ? 'text-red-800 group-hover:text-white'
                : 'text-gray-400'
            }`} />
            Cancelar Fatura
          </DropdownMenuItem>
        )}

        {onCartaCorrecaoClick && (
          <DropdownMenuItem
            onClick={onCartaCorrecaoClick}
            disabled={
              fatura.nfe_status !== '100' ||
              String(fatura.nfe_modelo ?? '55') === '65'
            }
            title={
              fatura.nfe_status !== '100'
                ? 'Só é possível para NF-e autorizada'
                : String(fatura.nfe_modelo ?? '55') === '65'
                  ? 'Carta de Correção não vale para NFC-e'
                  : 'Gerar Carta de Correção Eletrônica'
            }
            className="group flex items-center gap-2 px-2 py-2 hover:bg-teal-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
          >
            <FileSignature className="size-4 text-teal-600 group-hover:text-white transition group-disabled:text-gray-400" />
            Carta de Correção
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={onCobrancaClick}
          // REGRA: gerar cobrança (inclui a agrupada) exige a NF-e EMITIDA (autorizada, 100)
          // e que a fatura ainda não tenha cobrança.
          disabled={fatura.cobranca === 'S' || fatura.nfe_status !== '100'}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.cobranca !== 'S' && fatura.nfe_status === '100'
              ? 'hover:bg-green-600 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
          title={
            fatura.nfe_status !== '100'
              ? 'Só é possível gerar cobrança após a NF-e ser emitida (autorizada)'
              : fatura.cobranca === 'S'
                ? 'Esta fatura já possui cobrança'
                : 'Gerar nova cobrança para esta fatura'
          }
        >
          <DollarSign className={`size-4 transition ${
            fatura.cobranca !== 'S' && fatura.nfe_status === '100'
              ? 'text-green-600 group-hover:text-white'
              : 'text-gray-400'
          }`} />
          Gerar Cobrança
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={fatura.cobranca === 'N' || fatura.tem_pagamento === true}
          onClick={onCancelarCobranca}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.cobranca === 'S' && fatura.tem_pagamento !== true
              ? 'hover:bg-red-600 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
          title={
            fatura.cobranca === 'N'
              ? 'Esta fatura não possui cobrança para cancelar'
              : fatura.tem_pagamento === true
                ? 'Cobrança com parcela(s) paga(s) não pode ser cancelada'
                : 'Cancelar cobrança existente'
          }
        >
          <DollarSign className={`size-4 transition ${
            fatura.cobranca === 'S' && fatura.tem_pagamento !== true
              ? 'text-red-600 group-hover:text-white'
              : 'text-gray-400'
          }`} />
          Cancelar Cobrança
        </DropdownMenuItem>

        {onAlterarCobranca && (() => {
          // Fiel ao Delphi + salvaguarda: habilita só com cobrança, sem parcela paga,
          // NÃO agrupada (membro de GP) e não cancelada/denegada.
          const podeAlterar =
            fatura.cobranca === 'S' &&
            fatura.tem_pagamento !== true &&
            !fatura.codgp &&
            fatura.agp !== 'S' &&
            fatura.cancel !== 'S' &&
            fatura.denegada !== 'S';
          return (
            <DropdownMenuItem
              onClick={onAlterarCobranca}
              disabled={!podeAlterar}
              className={`group flex items-center gap-2 px-2 py-2 transition ${
                podeAlterar
                  ? 'hover:bg-amber-600 hover:text-white'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              title={
                fatura.cobranca !== 'S'
                  ? 'Sem cobrança para alterar'
                  : fatura.tem_pagamento === true
                    ? 'Cobrança com parcela paga não pode ser alterada'
                    : fatura.codgp || fatura.agp === 'S'
                      ? 'Fatura agrupada — desagrupe o grupo antes de alterar'
                      : 'Alterar a cobrança (cancela os títulos atuais e gera novos)'
              }
            >
              <RefreshCw className={`size-4 transition ${
                podeAlterar ? 'text-amber-600 group-hover:text-white' : 'text-gray-400'
              }`} />
              Alterar Cobrança
            </DropdownMenuItem>
          );
        })()}

        <DropdownMenuItem
          onClick={onFecharFatura}
          disabled={fatura.cancel === 'S'}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.cancel !== 'S'
              ? 'hover:bg-emerald-600 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
          title={
            fatura.cancel === 'S'
              ? 'Fatura cancelada não pode ser fechada'
              : "Fechar a fatura (marca a venda como faturada, status 'F')"
          }
        >
          <Lock className={`size-4 transition ${
            fatura.cancel !== 'S'
              ? 'text-emerald-600 group-hover:text-white'
              : 'text-gray-400'
          }`} />
          Fechar Fatura
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onEditarClick}
          disabled={fatura.cancel === 'S'}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.cancel !== 'S'
              ? 'hover:bg-blue-500 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <Edit className="size-4 text-blue-500 group-hover:text-white transition" />
          Alterar Fatura
        </DropdownMenuItem>
         <DropdownMenuItem
          onClick={onVisualizarBoletosClick}
          className="group flex items-center gap-2 px-2 py-2 hover:bg-blue-700 hover:text-white transition"
        >
          <DollarSign className="size-4 text-blue-700 group-hover:text-white transition" />
          Visualizar Boletos
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onReciboClick}
          disabled={String(fatura.frmfat ?? '') !== '1'}
          title={
            String(fatura.frmfat ?? '') !== '1'
              ? 'Recibo disponível apenas para fatura à vista (recibo)'
              : 'Imprimir o recibo (comprovante de recebimento à vista)'
          }
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            String(fatura.frmfat ?? '') === '1'
              ? 'hover:bg-emerald-600 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <Receipt className="size-4 text-emerald-600 group-hover:text-white transition group-disabled:text-gray-400" />
          Recibo
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onEmailDanfeClick}
          disabled={fatura.nfe_status !== '100'}
          title={fatura.nfe_status !== '100' ? 'Disponível apenas para notas AUTORIZADAS' : 'Enviar a DANFE + XML por email'}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.nfe_status === '100'
              ? 'hover:bg-blue-500 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <Mail className="size-4 text-blue-500 group-hover:text-white transition" />
          Enviar Danfe
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onenviarCobrancaClick}
          disabled={fatura.cobranca !== 'S'}
          title={fatura.cobranca !== 'S' ? 'Disponível apenas para faturas com cobrança/boleto' : 'Enviar o boleto por email'}
          className={`group flex items-center gap-2 px-2 py-2 transition ${
            fatura.cobranca === 'S'
              ? 'hover:bg-blue-500 hover:text-white'
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <MailCheck className="size-4 text-blue-500 group-hover:text-white transition" />
          Enviar Cobrança
        </DropdownMenuItem>

        {onEmitirDevolucaoClick && ehDI && (
          <DropdownMenuItem
            onClick={onEmitirDevolucaoClick}
            disabled={fatura.nfe_status === '100'}
            title={
              fatura.nfe_status === '100'
                ? 'Devolução já emitida'
                : 'Emitir a NF-e de devolução desta DI'
            }
            className="group flex items-center gap-2 px-2 py-2 hover:bg-orange-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
          >
            <Undo2 className="size-4 text-orange-600 group-hover:text-white transition group-disabled:text-gray-400" />
            Emitir Nota DI (devolução)
          </DropdownMenuItem>
        )}

        {onEstornoClick && !ehDI && (
          <DropdownMenuItem
            onClick={onEstornoClick}
            disabled={fatura.nfe_status !== '100'}
            title={
              fatura.nfe_status !== '100'
                ? 'Só é possível estornar NF-e autorizada'
                : 'Estornar NF-e (gera devolução após 24h da autorização)'
            }
            className="group flex items-center gap-2 px-2 py-2 hover:bg-orange-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
          >
            <Undo2 className="size-4 text-orange-600 group-hover:text-white transition group-disabled:text-gray-400" />
            Estorno de NF-e
          </DropdownMenuItem>
        )}

        {onTermoBateriasClick && (
          <DropdownMenuItem
            onClick={onTermoBateriasClick}
            className="group flex items-center gap-2 px-2 py-2 hover:bg-lime-600 hover:text-white transition"
          >
            <BatteryCharging className="size-4 text-lime-600 group-hover:text-white transition" />
            Termo de Compromisso de Baterias
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
