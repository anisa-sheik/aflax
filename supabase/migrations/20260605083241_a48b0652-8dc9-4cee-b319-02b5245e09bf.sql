
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS preferred_method text DEFAULT 'MWL';

CREATE TABLE IF NOT EXISTS public.quran_reading_state (
  user_id uuid PRIMARY KEY,
  surah integer NOT NULL DEFAULT 1,
  ayah integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quran_reading_state TO authenticated;
GRANT ALL ON public.quran_reading_state TO service_role;

ALTER TABLE public.quran_reading_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reading state" ON public.quran_reading_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
