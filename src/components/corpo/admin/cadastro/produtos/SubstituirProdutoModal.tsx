import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useConfirmarSalvar } from '@/hooks/useConfirmarSalvar';
import api from '@/components/services/api';
import { Loader2, Search, Check, Undo2 } from 'lucide-react';

interface ProdutoInfo {
  codprod: string;
  ref: string;
  descr: string;
  aplic_extendida: string;
  codmarca: string;
  marca_nome: string;
  qtest: number | string;
  local: string;
}

interface SubstituirProdutoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** produto da linha (precisa ao menos de codprod) */
  produto: { codprod: string } | null;
  onSuccess: () => void;
}

function Linha({ rotulo, valor, cor }: { rotulo: string; valor?: React.ReactNode; cor?: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 font-semibold text-primary">{rotulo}</span>
      <span className={cor}>{valor}</span>
    </div>
  );
}

export const SubstituirProdutoModal: React.FC<SubstituirProdutoModalProps> = ({
  isOpen,
  onClose,
  produto,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { pedirConfirmacao, ConfirmacaoSalvarModal } = useConfirmarSalvar();

  const [atual, setAtual] = useState<ProdutoInfo | null>(null);
  const [candidato, setCandidato] = useState<ProdutoInfo | null>(null);
  const [refBusca, setRefBusca] = useState('');
  const [resultados, setResultados] = useState<ProdutoInfo[]>([]);
  const [erro, setErro] = useState(''); // mensagem de validação (vermelho)
  const [jaSubstituido, setJaSubstituido] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const alerta = (message: string) =>
    pedirConfirmacao(() => {}, {
      title: 'Atenção',
      message,
      type: 'warning',
      confirmText: 'OK',
      somenteOk: true,
    });

  // Ao abrir: carrega status do produto atual
  useEffect(() => {
    if (!isOpen || !produto?.codprod) return;
    setCandidato(null);
    setRefBusca('');
    setResultados([]);
    setErro('');
    setJaSubstituido(false);
    setAtual(null);
    setCarregando(true);
    api
      .get(`/api/produtos/substituir-status?codprod=${produto.codprod}`)
      .then(({ data }) => {
        setAtual(data.atual || null);
        if (data.substituido) {
          // este produto já foi substituído -> mostra o substituto atual + Desfazer
          setCandidato(data.substituido);
          setJaSubstituido(true);
        }
      })
      .catch(() => toast({ title: 'Erro ao carregar produto', variant: 'destructive' }))
      .finally(() => setCarregando(false));
  }, [isOpen, produto, toast]);

  const validarCandidato = useCallback(
    async (cand: ProdutoInfo) => {
      if (!atual) return;
      if (cand.codprod === atual.codprod) {
        setErro('Você NÃO pode substituir um produto por ele mesmo.');
        return;
      }
      try {
        const { data } = await api.get(
          `/api/produtos/substituir-status?codprod=${cand.codprod}`,
        );
        if (data.substituido) {
          setErro(
            `Este produto foi substituído (Ref.: ${data.substituido.ref}). A operação não poderá ser concluída.`,
          );
          return;
        }
        if (data.substituto) {
          setErro(
            `Este produto é substituto de outro (Ref.: ${data.substituto.ref}). A operação não poderá ser concluída.`,
          );
          return;
        }
      } catch {
        /* segue para checagem de marca */
      }
      if (String(cand.codmarca) !== String(atual.codmarca)) {
        setErro('Produto com marca diferente. A operação não poderá ser concluída.');
        return;
      }
      setErro('');
    },
    [atual],
  );

  const localizar = async () => {
    const termo = refBusca.trim();
    if (!termo) {
      alerta('Referência inválida.');
      return;
    }
    setBuscando(true);
    setErro('');
    setResultados([]);
    try {
      const { data } = await api.get(
        `/api/produtos/substituir-buscar?termo=${encodeURIComponent(termo)}`,
      );
      const lista: ProdutoInfo[] = data.produtos || [];
      if (lista.length === 0) {
        alerta('Nenhum produto localizado para essa referência.');
        return;
      }
      setResultados(lista);
    } catch (e: any) {
      alerta(e?.response?.data?.error || 'Erro ao localizar produto.');
    } finally {
      setBuscando(false);
    }
  };

  const selecionar = async (prod: ProdutoInfo) => {
    setResultados([]);
    setCandidato(prod);
    setErro('');
    await validarCandidato(prod);
  };

  const confirmar = () => {
    if (!atual || !candidato || erro) return;
    pedirConfirmacao(
      async () => {
        setSalvando(true);
        try {
          const { data } = await api.post('/api/produtos/substituir', {
            codprod_original: atual.codprod,
            codprod_substituto: candidato.codprod,
          });
          toast({ title: data.message || 'Operação realizada com sucesso.' });
          onSuccess();
          onClose();
        } catch (e: any) {
          alerta(e?.response?.data?.error || 'Falha durante a operação.');
        } finally {
          setSalvando(false);
        }
      },
      {
        title: 'Substituir produto',
        message: 'Deseja continuar e substituir o produto?',
        type: 'warning',
        confirmText: 'Sim, substituir',
      },
    );
  };

  const desfazer = () => {
    if (!atual || !candidato) return;
    pedirConfirmacao(
      async () => {
        setSalvando(true);
        try {
          const { data } = await api.post('/api/produtos/substituir-desfazer', {
            codprod_original: atual.codprod,
            codprod_substituto: candidato.codprod,
          });
          toast({ title: data.message || 'Operação realizada com sucesso.' });
          onSuccess();
          onClose();
        } catch (e: any) {
          alerta(e?.response?.data?.error || 'Falha durante a operação.');
        } finally {
          setSalvando(false);
        }
      },
      {
        title: 'Desfazer substituição',
        message: 'Este produto foi substituído. Deseja desfazer a substituição?',
        type: 'warning',
        confirmText: 'Sim, desfazer',
      },
    );
  };

  const marcaDiferente =
    !!candidato && !!atual && String(candidato.codmarca) !== String(atual.codmarca);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Substituir Produto</DialogTitle>
          <DialogDescription>
            Substitui este produto por outro de mesma marca. Reversível pelo
            botão Desfazer.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Este produto */}
            <div className="border rounded-md p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Este produto
              </p>
              <div className="space-y-1">
                <Linha rotulo="Referência:" valor={atual?.ref} />
                <Linha rotulo="Marca:" valor={atual?.marca_nome} />
                <Linha rotulo="Aplicação:" valor={atual?.aplic_extendida} />
                <Linha rotulo="Qtde Est.:" valor={String(atual?.qtest ?? '')} />
              </div>
            </div>

            {/* Substituir por este */}
            <div className="border rounded-md p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Substituir por este
              </p>
              <div className="flex items-end gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-xs block mb-0.5">Localizar Referência</label>
                  <Input
                    value={refBusca}
                    onChange={(e) => setRefBusca(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && localizar()}
                    placeholder="Digite a referência e Enter"
                    disabled={jaSubstituido}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={localizar}
                  disabled={buscando || jaSubstituido}
                >
                  {buscando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Lista de resultados (Localizar Produto...) */}
              {resultados.length > 0 && (
                <div className="mb-3 border rounded-md max-h-56 overflow-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="text-left px-2 py-1.5 border-b">Referência</th>
                        <th className="text-left px-2 py-1.5 border-b">Marca</th>
                        <th className="text-center px-2 py-1.5 border-b w-14">Est.</th>
                        <th className="text-left px-2 py-1.5 border-b">Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((p) => (
                        <tr
                          key={p.codprod}
                          onClick={() => selecionar(p)}
                          className="odd:bg-muted/20 hover:bg-accent cursor-pointer"
                        >
                          <td className="px-2 py-1 border-b whitespace-nowrap">{p.ref}</td>
                          <td className="px-2 py-1 border-b whitespace-nowrap">{p.marca_nome}</td>
                          <td className="px-2 py-1 border-b text-center">{String(p.qtest)}</td>
                          <td className="px-2 py-1 border-b">{p.descr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="space-y-1">
                <Linha
                  rotulo="Referência:"
                  valor={candidato?.ref}
                  cor={erro ? 'text-red-600 font-medium' : undefined}
                />
                <Linha
                  rotulo="Marca:"
                  valor={candidato?.marca_nome}
                  cor={marcaDiferente ? 'text-red-600 font-medium' : undefined}
                />
                <Linha rotulo="Aplicação:" valor={candidato?.aplic_extendida} />
                <div className="flex gap-2 text-sm">
                  <span className="w-28 shrink-0 font-semibold text-primary">Locação:</span>
                  <span>{candidato?.local}</span>
                  <span className="ml-4 font-semibold text-primary">Estoque:</span>
                  <span>{candidato ? String(candidato.qtest) : ''}</span>
                </div>
              </div>

              {erro && (
                <p className="mt-2 text-sm text-red-600 font-medium">{erro}</p>
              )}
              {jaSubstituido && (
                <p className="mt-2 text-sm text-amber-600">
                  Este produto já foi substituído. Você pode desfazer a
                  substituição abaixo.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          {jaSubstituido && (
            <Button
              variant="destructive"
              onClick={desfazer}
              disabled={salvando}
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Undo2 className="w-4 h-4 mr-1" />
              )}
              Desfazer
            </Button>
          )}
          {!jaSubstituido && (
            <Button
              onClick={confirmar}
              disabled={salvando || !candidato || !!erro}
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Confirmar
            </Button>
          )}
        </div>
      </DialogContent>
      {ConfirmacaoSalvarModal}
    </Dialog>
  );
};

export default SubstituirProdutoModal;
