/**
 * Hook para gerenciar upload e parse do XML da DI
 */

import { useState, useCallback } from 'react';
import { parseDieXml, xmlToCabecalho } from '../utils/xmlParser';
import type { DieXmlParsed } from '../types/importacao';

export function useXmlUpload() {
  const [xmlParsed, setXmlParsed] = useState<DieXmlParsed | null>(null);
  const [xmlRaw, setXmlRaw] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setError('Arquivo deve ser XML');
      return;
    }

    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseDieXml(content);
        setXmlParsed(parsed);
        setXmlRaw(content);
        setFileName(file.name);
        setError('');
      } catch (err: any) {
        setError(err.message || 'Erro ao processar XML');
        setXmlParsed(null);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler arquivo');
      setLoading(false);
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const reset = useCallback(() => {
    setXmlParsed(null);
    setXmlRaw('');
    setFileName('');
    setError('');
    setLoading(false);
  }, []);

  const cabecalhoFromXml = xmlParsed ? xmlToCabecalho(xmlParsed) : null;

  return {
    xmlParsed,
    xmlRaw,
    fileName,
    error,
    loading,
    cabecalhoFromXml,
    handleDrop,
    handleFileInput,
    reset,
  };
}
