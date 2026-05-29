import { useEffect, useRef, useState } from 'react';

export function useAutoSave(value, saveFn, delay = 800) {
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const timerRef = useRef(null);
  const saveFnRef = useRef(saveFn);

  // Keep saveFn ref up to date without triggering the effect
  useEffect(() => { saveFnRef.current = saveFn; }, [saveFn]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState('saving');
    timerRef.current = setTimeout(() => {
      saveFnRef.current(value);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1800);
    }, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, delay]);

  return { saveState };
}
