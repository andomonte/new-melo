import { useState, useEffect, useRef } from 'react';

/**
 * Hook para salvar/carregar uma preferência específica de tela do usuário.
 * Usa a mesma API userPreferences mas com chave separada.
 *
 * Uso:
 * const [rangeData, setRangeData] = useScreenPreference('contas-a-pagar', 'MARIO', 'rangeData', 'semana');
 */
export function useScreenPreference<T extends string>(
  screenKey: string | undefined,
  userName: string | undefined,
  prefKey: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const loaded = useRef(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Carregar ao montar
  useEffect(() => {
    if (!screenKey || !userName) return;

    fetch(`/api/userPreferences?user=${encodeURIComponent(userName)}&screen=${encodeURIComponent(screenKey + '_' + prefKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences?.value) {
          setValue(data.preferences.value as T);
        }
        loaded.current = true;
      })
      .catch(() => { loaded.current = true; });
  }, [screenKey, userName, prefKey]);

  // Salvar quando mudar
  const setAndSave = (newValue: T) => {
    setValue(newValue);

    if (!screenKey || !userName || !loaded.current) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch('/api/userPreferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userName,
          screen: screenKey + '_' + prefKey,
          preferences: { value: newValue },
        }),
      }).catch(() => {});
    }, 500);
  };

  return [value, setAndSave];
}
