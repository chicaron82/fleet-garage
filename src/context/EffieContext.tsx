// Effie's conversation + voice, lifted to a shared owner. The chat state (messages,
// in-flight send, proposals) AND the text-to-speech read-back used to live INSIDE
// FgAssistantFab; hoisting them here lets multiple surfaces render the SAME live thread
// and share ONE voice — the FAB today, and Effie's full-screen module next
// (docs/ticket-misc-effie-module.md). One provider, one conversation, one voice; the
// surfaces are just different windows onto it.
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useFgAssistant } from '../hooks/useFgAssistant';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { useKokoroSynthesis, type KokoroSynthesisApi } from '../hooks/useKokoroSynthesis';
import { stripForSpeech } from '../lib/speechText';

export interface EffieTts {
  enabled: boolean;
  speak: (text: string) => void;
  cancel: () => void;
  supportedOrEnabled: boolean;
  kokoro: KokoroSynthesisApi;
  webTts: ReturnType<typeof useSpeechSynthesis>;
}

type EffieContextValue = ReturnType<typeof useFgAssistant> & { tts: EffieTts };

const EffieContext = createContext<EffieContextValue | null>(null);

export function EffieProvider({ children }: { children: ReactNode }) {
  const conversation = useFgAssistant();
  const { messages, loading } = conversation;

  const webTts = useSpeechSynthesis();
  const kokoro = useKokoroSynthesis();
  // Kokoro takes priority when it can actually run (needs cross-origin isolation for
  // SharedArrayBuffer). If the user turned it on but this context can't run it — e.g. a
  // deploy missing the COOP/COEP headers — fall back to Web Speech so Effie still talks
  // instead of failing silently.
  const kokoroActive = kokoro.enabled && kokoro.available;
  const kokoroFellBack = kokoro.enabled && !kokoro.available && webTts.supported;
  const ttsEnabled = kokoroActive || webTts.enabled || kokoroFellBack;
  const ttsSpeak = kokoroActive ? kokoro.speak : webTts.speak;
  const ttsCancel = kokoroActive ? kokoro.cancel : webTts.cancel;
  const ttsSupportedOrEnabled = kokoro.enabled || webTts.supported;

  // Read the assistant's answer aloud once it lands, if read-back is on (each turn once).
  // Lives in the provider so read-back fires ONCE for the shared conversation, not
  // once per rendered surface. Seed to the restored thread's tail so a reload never
  // re-speaks a stale answer — only turns that land after mount are read.
  const spokenRef = useRef(messages.length - 1);
  useEffect(() => {
    if (loading) return;
    const i = messages.length - 1;
    const m = messages[i];
    if (m && m.role === 'assistant' && m.text && ttsEnabled && spokenRef.current !== i) {
      spokenRef.current = i;
      ttsSpeak(stripForSpeech(m.text)); // no "asterisk asterisk" from stray markdown
    }
  }, [messages, loading, ttsEnabled, ttsSpeak]);

  const value: EffieContextValue = {
    ...conversation,
    tts: { enabled: ttsEnabled, speak: ttsSpeak, cancel: ttsCancel, supportedOrEnabled: ttsSupportedOrEnabled, kokoro, webTts },
  };
  return <EffieContext.Provider value={value}>{children}</EffieContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEffie(): EffieContextValue {
  const ctx = useContext(EffieContext);
  if (!ctx) throw new Error('useEffie must be used within EffieProvider');
  return ctx;
}
