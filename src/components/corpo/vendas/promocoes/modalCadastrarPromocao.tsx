import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
  Promocao,
  insertPromocao,
  ItemPromocao,
} from '@/data/promocoes/promocoes';
import { promocaoSchema } from '@/data/promocoes/promocoesSchema';
import ModalFormCadastrarPromocao from './_forms/modalFormCadastrarPromocao';
import { AuthContext } from '@/contexts/authContexts';
import { AdicionarProdutosAoCarrinhoModal } from './_forms/AdicionarProdutosAoCarrinhoModal';
import InfoModal from '@/components/common/infoModal';
import { CircleCheckBig } from 'lucide-react';

// ---------- helpers ----------
const dedupeByCodprod = (arr: ItemPromocao[]): ItemPromocao[] => {
  const seen = new Set<string>();
  const out: ItemPromocao[] = [];
  for (const it of arr) {
    const key = String(it.codprod ?? '');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
};

interface CadastrarPromocaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  promocaoToEdit?: Promocao;
  onSuccess?: (data: Promocao) => void;
}

const CadastrarPromocaoModal: React.FC<CadastrarPromocaoModalProps> = ({
  isOpen,
  onClose,
  promocaoToEdit,
  onSuccess,
}) => {
  const { user } = useContext(AuthContext);

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formTouched, setFormTouched] = useState(false);
  const [promocao, setPromocao] = useState<Promocao>(() => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (promocaoToEdit) {
      return {
        ...promocaoToEdit,
        data_inicio: promocaoToEdit.data_inicio
          ? formatDateTimeLocal(new Date(promocaoToEdit.data_inicio))
          : '',
        data_fim: promocaoToEdit.data_fim
          ? formatDateTimeLocal(new Date(promocaoToEdit.data_fim))
          : '',
      };
    } else {
      return {
        id_promocao: 0,
        nome_promocao: '',
        descricao_promocao: null,
        data_inicio: formatDateTimeLocal(now),
        data_fim: formatDateTimeLocal(futureDate),
        tipo_promocao: 'PROD',
        valor_desconto: 0,
        tipo_desconto: 'PERC',
        qtde_minima_ativacao: 1,
        qtde_maxima_total: null,
        qtde_maxima_por_cliente: null,
        ativa: true,
        criado_por: user?.usuario || 'USUARIO_DESCONHECIDO',
        observacoes: null,
      };
    }
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  const [isAddProductsModalOpen, setIsAddProductsModalOpen] = useState(false);
  const [itensDaPromocao, setItensDaPromocao] = useState<ItemPromocao[]>([]);
  const [itensOriginais, setItensOriginais] = useState<ItemPromocao[]>([]);

  const [openInfo, setOpenInfo] = useState(false);
  const [mensagemInfo, setMensagemInfo] = useState('');
  const [infoModalIcon, setInfoModalIcon] = useState<React.ReactElement | null>(
    null,
  );
  const [savedPromocaoData, setSavedPromocaoData] = useState<Promocao | null>(
    null,
  );

  const houveAlteracoesNosItens = useMemo(() => {
    const normalize = (arr: ItemPromocao[]) =>
      arr
        .map((item) =>
          JSON.stringify({
            codprod: item.codprod,
            desconto: item.valor_desconto_item,
            tipo_desconto_item: item.tipo_desconto_item,
            quantidade: item.qtd_total_item,
            qtde_minima_item: item.qtde_minima_item,
            qtde_maxima_item: item.qtde_maxima_item,
          }),
        )
        .sort()
        .join(',');

    return normalize(itensDaPromocao) !== normalize(itensOriginais);
  }, [itensDaPromocao, itensOriginais]);

  useEffect(() => {
    if (isOpen && !promocaoToEdit) {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      setPromocao({
        id_promocao: 0,
        nome_promocao: '',
        descricao_promocao: null,
        data_inicio: formatDateTimeLocal(now),
        data_fim: formatDateTimeLocal(futureDate),
        tipo_promocao: 'PROD',
        valor_desconto: 0,
        tipo_desconto: 'PERC',
        qtde_minima_ativacao: 1,
        qtde_maxima_total: null,
        qtde_maxima_por_cliente: null,
        ativa: true,
        criado_por: user?.usuario || 'USUARIO_DESCONHECIDO',
        observacoes: null,
      });

      setItensDaPromocao([]);
      setErrors({});
      setIsFormValid(false);
      setFormTouched(false);
    }
  }, [isOpen, promocaoToEdit, user]);

  useEffect(() => {
    if (!formTouched && !promocaoToEdit) {
      setIsFormValid(false);
      return;
    }
    const result = promocaoSchema.safeParse(promocao);
    if (!result.success) {
      const fieldErrors: { [key: string]: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path && err.path.length > 0) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      setIsFormValid(false);
    } else {
      setErrors({});
      setIsFormValid(true);
    }
  }, [promocao, formTouched, promocaoToEdit]);

  const handlePromocaoChange = (updatedFields: Partial<Promocao>) => {
    setFormTouched(true);
    setPromocao((prev) => ({ ...prev, ...updatedFields }));
  };

  const handleClear = useCallback(() => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    setPromocao({
      id_promocao: 0,
      nome_promocao: '',
      descricao_promocao: null,
      data_inicio: formatDateTimeLocal(now),
      data_fim: formatDateTimeLocal(futureDate),
      tipo_promocao: 'PROD',
      valor_desconto: 0,
      tipo_desconto: 'PERC',
      qtde_minima_ativacao: 1,
      qtde_maxima_total: null,
      qtde_maxima_por_cliente: null,
      ativa: true,
      criado_por: user?.usuario || 'USUARIO_DESCONHECIDO',
      observacoes: null,
    });
    setErrors({});
    setIsFormValid(false);
    setItensDaPromocao([]);
    setFormTouched(false);
  }, [user]);

  const handleSubmit = async () => {
    // impede submit duplo (clique repetido/StrictMode)
    if (isSaving) return;

    setIsSaving(true);
    setFormTouched(true);

    const combinedErrors: { [key: string]: string } = {};
    let formHasErrors = false;

    const result = promocaoSchema.safeParse(promocao);
    if (!result.success) {
      result.error.errors.forEach((err) => {
        if (err.path && err.path.length > 0) {
          combinedErrors[err.path[0].toString()] = err.message;
        }
      });
      formHasErrors = true;
    }

    // dedupe garantido antes de enviar
    const itensDedup = dedupeByCodprod(itensDaPromocao);

    if (promocao.tipo_promocao === 'PROD' && itensDedup.length === 0) {
      combinedErrors.itens_promocao = 'Adicione pelo menos um item à promoção.';
      formHasErrors = true;
    }

    if (formHasErrors) {
      setErrors(combinedErrors);
      setIsSaving(false);
      toast.error(
        'Verifique os campos destacados e adicione itens, se necessário.',
      );
      return;
    }

    const validatedData = result.data!;

    const promocaoParaEnvio: Promocao = {
      id_promocao: validatedData.id_promocao || 0,
      nome_promocao: validatedData.nome_promocao || '',
      descricao_promocao: validatedData.descricao_promocao || null,
      data_inicio: validatedData.data_inicio || '',
      data_fim: validatedData.data_fim || '',
      tipo_promocao: validatedData.tipo_promocao || 'PROD',
      valor_desconto: validatedData.valor_desconto || 0,
      tipo_desconto: validatedData.tipo_desconto || 'PERC',
      qtde_minima_ativacao: validatedData.qtde_minima_ativacao || 0,
      qtde_maxima_total: validatedData.qtde_maxima_total || null,
      qtde_maxima_por_cliente: validatedData.qtde_maxima_por_cliente || null,
      ativa: validatedData.ativa ?? true,
      criado_por:
        validatedData.criado_por || user?.usuario || 'USUARIO_DESCONHECIDO',
      observacoes: validatedData.observacoes || null,
      criado_em: validatedData.criado_em,
      itens_promocao: itensDedup,
    };

    try {
      const promocaoSalva = await insertPromocao({
        promocao: promocaoParaEnvio,
        itens: itensDedup,
      });

      setSavedPromocaoData(promocaoSalva);
      setMensagemInfo('Promoção cadastrada/atualizada com sucesso!');
      setInfoModalIcon(<CircleCheckBig className="text-green-500 w-6 h-6" />);
      setOpenInfo(true);
    } catch (error) {
      console.error('Erro ao salvar promoção:', error);
      toast.error(`Erro ao salvar promoção: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAdicionarItensModal = useCallback(() => {
    if (promocao.tipo_promocao === 'PROD') {
      setIsAddProductsModalOpen(true);
    } else {
      toast.error(
        'Selecione "Produto" como Tipo de Promoção para adicionar itens.',
      );
    }
  }, [promocao.tipo_promocao]);

  const handleCloseAdicionarItensModal = useCallback(() => {
    setIsAddProductsModalOpen(false);
  }, []);

  const handleConfirmSelectedProducts = useCallback(
    (selectedItems: ItemPromocao[]) => {
      setItensDaPromocao((prevItens) => {
        const codigosExistentes = new Set(
          prevItens.map((item) => item.codprod),
        );
        const novosItens = selectedItems.filter(
          (item) => !codigosExistentes.has(item.codprod),
        );
        return [...prevItens, ...novosItens];
      });
      setIsAddProductsModalOpen(false);
    },
    [],
  );

  const handleRemoveItemPromocao = useCallback((codigoToRemove: string) => {
    setItensDaPromocao((prevItens) => {
      const updatedItens = prevItens.filter(
        (item) => item.codprod !== codigoToRemove,
      );
      toast.success(`Item ${codigoToRemove} removido da promoção.`);
      return updatedItens;
    });
  }, []);

  useEffect(() => {
    if (promocaoToEdit && promocaoToEdit.itens_promocao) {
      const itensConvertidos = promocaoToEdit.itens_promocao.map(
        (item: any) => ({
          ...item,
          codprod: item.codigo ?? item.codprod ?? '',
          descr: item.descricao ?? item.descr ?? '',
        }),
      );
      setItensDaPromocao(itensConvertidos);
      setItensOriginais(itensConvertidos);
    } else if (!promocaoToEdit) {
      setItensDaPromocao([]);
      setItensOriginais([]);
    }
  }, [promocaoToEdit]);

  useEffect(() => {
    if (promocaoToEdit) {
      setFormTouched(true);
    }
  }, [promocaoToEdit]);

  const handleCloseModal = () => {
    if (!promocaoToEdit) {
      handleClear();
    }
    onClose();
  };

  const handleUpdateItensEditados = (novosItens: ItemPromocao[]) => {
    setItensDaPromocao(novosItens);
  };

  if (!isOpen) return null;

  return (
    <>
      <ModalFormCadastrarPromocao
        titulo={promocaoToEdit ? 'Editar Promoção' : 'Cadastrar Promoção'}
        handleSubmit={handleSubmit}
        handleClear={handleClear}
        handlePromocaoChange={handlePromocaoChange}
        onClose={handleCloseModal}
        promocao={promocao}
        error={errors}
        isSaving={isSaving}
        isFormValid={isFormValid || itensDaPromocao.length > 0}
        onOpenAdicionarItensModal={handleOpenAdicionarItensModal}
        itensAdicionados={itensDaPromocao}
        onRemoveItemPromocao={handleRemoveItemPromocao}
        onChangeItensAdicionados={handleUpdateItensEditados}
      />

      <AdicionarProdutosAoCarrinhoModal
        isOpen={isAddProductsModalOpen}
        onClose={handleCloseAdicionarItensModal}
        onConfirm={handleConfirmSelectedProducts}
        tipoPrecoCliente={'0'}
        promocao={promocao}
        houveAlteracoesNosItens={houveAlteracoesNosItens}
      />

      <InfoModal
        isOpen={openInfo}
        onClose={() => {
          setOpenInfo(false);
          if (onSuccess && savedPromocaoData) {
            onSuccess(savedPromocaoData);
          }
          setSavedPromocaoData(null);
          onClose();
        }}
        title="INFORMAÇÃO"
        icon={infoModalIcon === null ? undefined : infoModalIcon}
        content={mensagemInfo}
      />

      <Toaster />
    </>
  );
};

export default CadastrarPromocaoModal;
