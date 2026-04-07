import { useRef, useEffect, RefObject } from 'react';

export default function useFocus<T extends HTMLElement>(): RefObject<T> {
  const cliInputRef = useRef<T>(null);

  useEffect(() => {
    cliInputRef.current?.focus();
  }, []);

  return cliInputRef;
}
