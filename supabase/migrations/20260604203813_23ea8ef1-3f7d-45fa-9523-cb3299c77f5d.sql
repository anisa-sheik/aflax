
-- Add prayer status (on_time / late / missed)
ALTER TABLE public.prayer_logs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'on_time';

-- Daily check-ins (worship checklist)
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  quran_done boolean NOT NULL DEFAULT false,
  dhikr_done boolean NOT NULL DEFAULT false,
  dua_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins" ON public.daily_checkins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Quran bookmarks
CREATE TABLE IF NOT EXISTS public.quran_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  surah integer NOT NULL,
  ayah integer NOT NULL DEFAULT 1,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quran_bookmarks TO authenticated;
GRANT ALL ON public.quran_bookmarks TO service_role;
ALTER TABLE public.quran_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookmarks" ON public.quran_bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Prayer settings (calc method, offsets, notifications)
CREATE TABLE IF NOT EXISTS public.prayer_settings (
  user_id uuid PRIMARY KEY,
  method text NOT NULL DEFAULT 'MWL',
  fajr_offset integer NOT NULL DEFAULT 0,
  dhuhr_offset integer NOT NULL DEFAULT 0,
  asr_offset integer NOT NULL DEFAULT 0,
  maghrib_offset integer NOT NULL DEFAULT 0,
  isha_offset integer NOT NULL DEFAULT 0,
  notifications boolean NOT NULL DEFAULT false,
  latitude double precision,
  longitude double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prayer_settings TO authenticated;
GRANT ALL ON public.prayer_settings TO service_role;
ALTER TABLE public.prayer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prayer settings" ON public.prayer_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
