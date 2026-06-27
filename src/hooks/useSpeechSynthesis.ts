import { useCallback, useState } from 'react';

// Read the assistant's answers aloud (Web Speech API SpeechSynthesis). Opt-in and
// persisted — you may not want FG talking on a quiet lot, so it's off until toggled on.
const STORAGE_KEY = 'fg_assistant_voice_readback';

function synthSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

export interface SpeechSynthesisApi {
  supported: boolean;
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  speak: (text: string) => void;
  cancel: () => void;
}

export function useSpeechSynthesis(): SpeechSynthesisApi {
  const supported = synthSupported();
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setEnabled = useCallback(
    (on: boolean) => {
      setEnabledState(on);
      try {
        localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
      } catch {
        /* private mode / unavailable — fine, just won't persist */
      }
      if (!on && supported) window.speechSynthesis.cancel();
    },
    [supported],
  );

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel(); // never stack utterances
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    },
    [supported],
  );

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, enabled, setEnabled, speak, cancel };
}
