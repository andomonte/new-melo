import { useState, useEffect } from 'react';
import useDebounce from './useDebounce';

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

  const debouncedDoc = useDebounce(docValue, 2000);

  useEffect(() => {
    if (!isEnabled || !debouncedDoc || debouncedDoc.length < 6) {
      setMatches([]);
      return;
    }

    const check = async () => {
      setIsChecking(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/global/check-document?doc=${encodeURIComponent(debouncedDoc)}`,
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
