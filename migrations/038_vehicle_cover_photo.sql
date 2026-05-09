-- Vehicle card cover photo
-- Nullable — most vehicles won't have one set yet.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
