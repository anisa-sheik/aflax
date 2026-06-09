ALTER TABLE public.quran_reading_state ADD COLUMN IF NOT EXISTS page integer NOT NULL DEFAULT 1;
ALTER TABLE public.quran_bookmarks ADD COLUMN IF NOT EXISTS page integer;
