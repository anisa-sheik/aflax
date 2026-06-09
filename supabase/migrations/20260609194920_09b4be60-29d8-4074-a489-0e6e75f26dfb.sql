ALTER TABLE public.prayer_settings
  ADD COLUMN IF NOT EXISTS notify_prayers jsonb NOT NULL DEFAULT '["fajr","dhuhr","asr","maghrib","isha"]'::jsonb,
  ADD COLUMN IF NOT EXISTS notify_before_min integer NOT NULL DEFAULT 0;