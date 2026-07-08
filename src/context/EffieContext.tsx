// Effie's conversation, voice, memory, and composer draft, lifted to a shared owner.
// All of this used to live INSIDE FgAssistantFab; hoisting it here lets multiple
// surfaces render the SAME live thread with ONE voice and ONE half-typed draft — the
// FAB today, and Effie's full-screen module next (docs/ticket-misc-effie-module.md).
// One provider, one conversation; the surfaces are just different windows onto it.
// (The draft lives here, not in the conversation component, so closing the FAB panel
// doesn't lose a half-typed message — and so it transfers into the module later.)
import {
  createContext, useContext, useEffect, useRef, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from 'react';
import { useFgAssistant } from '../hooks/useFgAssistant';
import { useEffieMemory } from '../hooks/useEffieMemory';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { useKokoroSynthesis, type KokoroSynthesisApi } from '../hooks/useKokoroSynthesis';
import { stripForSpeech } from '../lib/speechText';
import type { PhotoContext } from '../../api/_lib/photoRequest';

export interface EffieTts {
  enabled: boolean;
  speak: (text: string) => void;
  cancel: () => void;
  supportedOrEnabled: boolean;
  kokoro: KokoroSynthesisApi;
  webTts: ReturnType<typeof useSpeechSynthesis>;
}

/** The composer's in-progress state — shared so a half-typed draft survives the FAB
 *  panel closing (the conversation component unmounts) and carries between surfaces. */
export interface EffieComposer {
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  images: string[];
  setImages: Dispatch<SetStateAction<string[]>>;
  pendingPhotoContext: PhotoContext | null;
  setPendingPhotoContext: Dispatch<SetStateAction<PhotoContext | null>>;
}

type EffieContextValue = ReturnType<typeof useFgAssistant> & {
  tts: EffieTts;
  memory: ReturnType<typeof useEffieMemory>;
  composer: EffieComposer;
};

const EffieContext = createContext<EffieContextValue | null>(null);

export function EffieProvider({ children }: { children: ReactNode }) {
  const conversation = useFgAssistant();
  const { messages, loading } = conversation;
  const memory = useEffieMemory(); // needs only AuthContext (above the app) — safe this high

  // Composer draft — see the header comment for why this is provider-owned.
  const [draft, setDraft] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [pendingPhotoContext, setPendingPhotoContext] = useState<PhotoContext | null>(null);

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
    memory,
    composer: { draft, setDraft, images, setImages, pendingPhotoContext, setPendingPhotoContext },
  };
  return <EffieContext.Provider value={value}>{children}</EffieContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEffie(): EffieContextValue {
  const ctx = useContext(EffieContext);
  if (!ctx) throw new Error('useEffie must be used within EffieProvider');
  return ctx;
}
