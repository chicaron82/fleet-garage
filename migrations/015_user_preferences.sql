-- User preferences: sidebar order, avatar, and app prefs
-- Persists across devices via Supabase; localStorage remains the fast-path cache.
create table if not exists user_preferences (
  user_id    text primary key,
  sidebar    jsonb,       -- { order: Module[], hidden: Module[] }
  avatar     text,        -- base64 data URL
  prefs      jsonb,       -- { darkMode, notifyNewFlags, notifyReleases }
  updated_at timestamptz not null default now()
);
