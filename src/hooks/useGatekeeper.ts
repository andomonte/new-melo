import { useState, useEffect } from 'react';
import useDebounce from './useDebounce';
import { limparDocumentoAlfa } from '@/utils/cnpjAlfanumerico';

interface Match {
  type: 'CLIENTE' | 'FORNECEDOR' | 'TRANSPORTADORA';
  id: string;
  name: string;
  doc: string;
}

interface UseGatekeeperResult {
  isChecking: boolean;
  matches: Match[];
  error: string | null;
  reset: () => void;
}

export function useGatekeeper(
  docValue: string,
  isEnabled: boolean = true,
): UseGatekeeperResult {
  const [isChecking, setIsChecking] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  const debouncedDoc = useDebounce(docValue, 700);

  useEffect(() => {
    // Limpa mantendo letras (CNPJ alfanumérico); o documento na tela vem mascarado.
    const docLimpo = limparDocumentoAlfa(debouncedDoc || '');
    // Só verifica quando o CPF (11) ou CNPJ (14) está completo
    if (!isEnabled || (docLimpo.length !== 11 && docLimpo.length !== 14)) {
      setMatches([]);
      return;
    }

    const check = async () => {
      setIsChecking(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/global/check-document?doc=${encodeURIComponent(docLimpo)}`,
        );
        if (!res.ok) throw new Error('Failed to check document');
        const data = await res.json();

        if (data.found && data.matches && data.matches.length > 0) {
          setMatches(data.matches);
        } else {
          setMatches([]);
        }
      } catch (err: any) {
        setError(err.message);
        setMatches([]);
      } finally {
        setIsChecking(false);
      }
    };

    check();
  }, [debouncedDoc, isEnabled]);

  const reset = () => {
    setMatches([]);
    setError(null);
  };

  return { isChecking, matches, error, reset };
}
