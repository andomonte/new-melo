// /components/modals/ImportKickbackModal.tsx

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { DefaultButton } from '@/components/common/Buttons';
import Carregamento from '@/utils/carregamento';
import { Upload } from 'lucide-react';
import { importClientesKickback } from '@/data/kickback/clientes/cliente_kickback';

export type ClienteKickbackExcelRow = {
  codcli: string;
  class?: string;
  status: string;
  g: string;
};

interface ImportKickbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ImportKickbackModal: React.FC<ImportKickbackModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [importedData, setImportedData] = useState<ClienteKickbackExcelRow[]>(
    [],
  );
  const [importStatus, setImportStatus] = useState<
    'idle' | 'reading' | 'processing' | 'success' | 'error'
  >('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setImportedData([]);
    setImportStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();

      setImportStatus('reading');
      setImportedData([]);

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // --- DEPURANDO: RAW JSON DATA ---
          // Tenta ler a planilha considerando que a primeira linha pode não ser o cabeçalho final.
          // O 'raw' aqui significa o que a biblioteca XLXS.js leu, sem nosso processamento ainda.
          const rawJsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
            header: 1, // Isso faz com que retorne um array de arrays (linhas), onde a primeira linha lida é a linha 0
            defval: '', // Define valor padrão para células vazias
            blankrows: false, // Remove linhas completamente vazias
          });

          if (rawJsonData.length === 0) {
            toast({
              title: 'Erro de Leitura',
              description: 'Arquivo parece estar vazio ou não pôde ser lido.',
              variant: 'destructive',
            });
            setImportStatus('error');
            return;
          }

          // --- Lógica para encontrar o cabeçalho real e os dados ---
          // Vamos tentar ser mais flexíveis com nomes de colunas e linhas extras.
          const expectedHeadersLower = ['codcli', 'class', 'status', 'g'];
          let actualHeaderRow: string[] = [];
          let dataStartingRowIndex = -1;

          // Itera pelas primeiras 10 linhas para encontrar uma linha que se pareça com o cabeçalho
          for (let i = 0; i < Math.min(rawJsonData.length, 10); i++) {
            const row = rawJsonData[i];
            if (Array.isArray(row)) {
              // Converte a linha para minúsculas para comparação case-insensitive e remove espaços
              const lowerCaseRow = row.map((cell) =>
                String(cell || '')
                  .toLowerCase()
                  .trim(),
              );
              let foundCount = 0;
              for (const expectedHeader of expectedHeadersLower) {
                if (lowerCaseRow.includes(expectedHeader)) {
                  foundCount++;
                }
              }

              // Se encontrou a maioria dos cabeçalhos esperados (ou todos), considera esta a linha de cabeçalho
              if (
                foundCount >= expectedHeadersLower.length / 2 ||
                foundCount === expectedHeadersLower.length
              ) {
                actualHeaderRow = row.map((cell) => String(cell || '').trim()); // Mantém o case original do cabeçalho encontrado
                dataStartingRowIndex = i + 1;
                break;
              }
            }
          }

          if (dataStartingRowIndex === -1 || actualHeaderRow.length === 0) {
            toast({
              title: 'Formato Inesperado',
              description:
                'Não foi possível identificar as colunas esperadas (codcli, class, status, g). Verifique os cabeçalhos da planilha.',
              variant: 'destructive',
            });
            setImportStatus('error');
            return;
          }

          // Agora, mapeia os dados, usando o cabeçalho detectado para encontrar as colunas corretas.
          const processedData: ClienteKickbackExcelRow[] = [];

          for (let i = dataStartingRowIndex; i < rawJsonData.length; i++) {
            const rowData = rawJsonData[i];
            if (
              !Array.isArray(rowData) ||
              rowData.every((cell) => !String(cell).trim())
            ) {
              // Pula linhas que não são arrays ou são completamente vazias
              continue;
            }

            const getCellValueByIndex = (headerName: string) => {
              const headerIndex = actualHeaderRow.findIndex(
                (h) => h.toLowerCase() === headerName.toLowerCase(),
              );
              if (headerIndex !== -1 && rowData[headerIndex] !== undefined) {
                return rowData[headerIndex];
              }
              return ''; // Retorna string vazia se a coluna não for encontrada ou valor for undefined
            };

            const codcliRaw = String(getCellValueByIndex('codcli')).trim();
            let statusRaw = String(getCellValueByIndex('status'))
              .trim()
              .toUpperCase();
            const gRaw = String(getCellValueByIndex('g')).trim().toUpperCase();
            const classRaw = String(getCellValueByIndex('class')).trim();

            // Garante que o status seja apenas a primeira letra (A ou I)
            if (statusRaw.startsWith('ATIVO') || statusRaw === 'A')
              statusRaw = 'A';
            else if (statusRaw.startsWith('INATIVO') || statusRaw === 'I')
              statusRaw = 'I';
            else statusRaw = 'I'; // Default para Inativo se não for A ou I

            // Só adiciona a linha se codcli não for vazio
            if (codcliRaw) {
              processedData.push({
                codcli: codcliRaw.substring(0, 5),
                class: classRaw.substring(0, 50),
                status: statusRaw.substring(0, 1),
                g: gRaw.substring(0, 1),
              });
            }
          }

          if (processedData.length === 0) {
            toast({
              title: 'Arquivo Vazio ou Sem Registros Válidos',
              description:
                'Nenhum registro válido encontrado no arquivo após processamento. Verifique os cabeçalhos, a coluna "codcli" e se há dados preenchidos.',
              variant: 'destructive',
            });
            setImportStatus('error');
            return;
          }

          setImportedData(processedData);
          setImportStatus('idle');
          toast({
            title: 'Arquivo Lido',
            description: `${processedData.length} registros prontos para importação.`,
          });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error: any) {
          console.error(
            'Erro detalhado na leitura/processamento do arquivo:',
            error,
          );
          toast({
            title: 'Erro de Leitura Inesperado',
            description: `Não foi possível ler o arquivo. Detalhes técnicos: ${error.message}.`,
            variant: 'destructive',
          });
          setImportStatus('error');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleProcessData = async () => {
    if (importedData.length === 0) {
      toast({
        title: 'Nenhum Dado',
        description: 'Selecione um arquivo Excel primeiro.',
        variant: 'destructive',
      });
      return;
    }

    setImportStatus('processing');
    try {
      await importClientesKickback(importedData);

      setImportStatus('success');
      toast({
        title: 'Sucesso!',
        description: 'Dados importados com sucesso.',
        variant: 'default',
      });

      onSuccess();
      handleClose();
    } catch (error: any) {
      setImportStatus('error');
      toast({
        title: 'Erro no Processamento',
        description:
          error.response?.data?.message ||
          'Ocorreu um erro ao salvar os dados.',
        variant: 'destructive',
      });
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-md shadow-lg w-[90%] max-w-xl flex flex-col">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Importar Kickback de Clientes
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Selecione um arquivo Excel (.xlsx, .xls) com as colunas: **`codcli`**,
          **`class`**, **`status`**, e **`g`**.
        </p>
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          ref={fileInputRef}
          className="mb-4 text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          disabled={importStatus === 'reading' || importStatus === 'processing'}
        />

        {importStatus === 'reading' && (
          <Carregamento texto="Lendo arquivo..." />
        )}
        {importStatus === 'processing' && (
          <Carregamento texto="Processando dados..." />
        )}

        {importedData.length > 0 && importStatus === 'idle' && (
          <p className="text-green-600 dark:text-green-400 mb-4 text-center">
            {importedData.length} registros prontos para serem processados.
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <DefaultButton
            onClick={handleClose}
            variant="cancel"
            text="Cancelar"
            disabled={
              importStatus === 'reading' || importStatus === 'processing'
            }
          />
          <DefaultButton
            onClick={handleProcessData}
            variant="confirm"
            text="Processar Dados"
            icon={<Upload size={18} />}
            disabled={
              importedData.length === 0 ||
              importStatus === 'reading' ||
              importStatus === 'processing'
            }
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ImportKickbackModal;
