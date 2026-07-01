import { useEffect, useRef, useState } from 'react';

export function useSaveStatus() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const resetTimer = useRef(null);

  useEffect(() => {
    const clearReset = () => { if (resetTimer.current) clearTimeout(resetTimer.current); };
    const onStart = () => { clearReset(); setStatus('saving'); };
    const onSuccess = () => {
      clearReset();
      setStatus('saved');
      resetTimer.current = setTimeout(() => setStatus('idle'), 2000);
    };
    const onError = () => {
      clearReset();
      setStatus('error');
      resetTimer.current = setTimeout(() => setStatus('idle'), 2000);
    };

    window.addEventListener('aba:save-start', onStart);
    window.addEventListener('aba:save-success', onSuccess);
    window.addEventListener('aba:save-error', onError);
    return () => {
      clearReset();
      window.removeEventListener('aba:save-start', onStart);
      window.removeEventListener('aba:save-success', onSuccess);
      window.removeEventListener('aba:save-error', onError);
    };
  }, []);

  return { status };
}
