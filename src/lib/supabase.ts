import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: {
    // Disable navigator lock — avoids lock conflicts from React Strict Mode's double-mount
    lock: (_name, _acquireTimeout, fn) => fn(),
  },
});
