import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { CalculationMethod, Coordinates, PrayerTimes, HighLatitudeRule, Madhab } from 'adhan';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/firebase_messaging';

export const Route = createFileRoute('/api/public/notify-prayers')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify cron secret so only scheduled callers can trigger mass notifications.
        const auth = request.headers.get('authorization') ?? '';
        const expected = `Bearer ${process.env['CRON_SECRET'] ?? ''}`;
        if (!process.env['CRON_SECRET'] || auth !== expected) {
          return new Response('Unauthorized', { status: 401 });
        }

        const LOVABLE_API_KEY = process.env['LOVABLE_API_KEY'];
        const connectionApiKey = process.env['FIREBASE_MESSAGING_API_KEY'];
        if (!LOVABLE_API_KEY || !connectionApiKey) {
          return new Response('Push not configured', { status: 503 });
        }

        const supabaseAdmin = createClient<Database>(
          process.env['SUPABASE_URL']!,
          process.env['SUPABASE_SERVICE_ROLE_KEY']!,
          { auth: { persistSession: false } }
        );

        // Pull users who want prayer notifications and have a saved location.
        const { data: settingsRows } = await supabaseAdmin
          .from('prayer_settings')
          .select('user_id, method, latitude, longitude, timezone, notify_prayers, notify_before_min, fajr_offset, dhuhr_offset, asr_offset, maghrib_offset, isha_offset')
          .eq('notifications', true)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        const { data: tokensRows } = await supabaseAdmin
          .from('device_tokens')
          .select('user_id, token');

        const tokensByUser = new Map<string, string[]>();
        for (const row of tokensRows ?? []) {
          const arr = tokensByUser.get(row.user_id) ?? [];
          arr.push(row.token);
          tokensByUser.set(row.user_id, arr);
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 86400000);

        const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
        const PRAYER_LABELS: Record<string, string> = {
          fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr',
          asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
        };

        function methodParams(m: string) {
          switch (m) {
            case 'ISNA': return CalculationMethod.NorthAmerica();
            case 'Umm Al-Qura': return CalculationMethod.UmmAlQura();
            case 'Egyptian': return CalculationMethod.Egyptian();
            case 'Karachi': return CalculationMethod.Karachi();
            default: return CalculationMethod.MuslimWorldLeague();
          }
        }

        function computeForRow(row: any, date: Date) {
          const params = methodParams(row.method ?? 'MWL');
          params.madhab = Madhab.Shafi;
          const absLat = Math.abs(row.latitude);
          params.highLatitudeRule = absLat >= 48 ? HighLatitudeRule.TwilightAngle : HighLatitudeRule.MiddleOfTheNight;
          params.adjustments = {
            fajr: row.fajr_offset ?? 0,
            sunrise: 0,
            dhuhr: row.dhuhr_offset ?? 0,
            asr: row.asr_offset ?? 0,
            maghrib: row.maghrib_offset ?? 0,
            isha: row.isha_offset ?? 0,
          };
          return new PrayerTimes(new Coordinates(row.latitude, row.longitude), date, params);
        }

        type Due = { token: string; title: string; body: string; tag: string; path: string };
        const due: Due[] = [];
        const staleTokens: string[] = [];

        for (const row of settingsRows ?? []) {
          const tokens = tokensByUser.get(row.user_id);
          if (!tokens || tokens.length === 0) continue;

          const enabled = new Set<string>(
            Array.isArray(row.notify_prayers)
              ? (row.notify_prayers as string[]).filter((x): x is string => typeof x === 'string')
              : PRAYER_KEYS
          );
          const beforeMin = Math.max(0, row.notify_before_min ?? 0);
          const beforeMs = beforeMin * 60_000;


          const timesToday = computeForRow(row, today);
          const timesTomorrow = computeForRow(row, tomorrow);

          for (const k of PRAYER_KEYS) {
            if (k === 'sunrise') continue;
            if (!enabled.has(k)) continue;

            const at = (timesToday as any)[k] as Date;
            const reminderAt = new Date(at.getTime() - beforeMs);

            // Reminder window: [reminderAt, at)
            if (beforeMs > 0 && now >= reminderAt && now < at) {
              const dateKey = `${today.toISOString().slice(0, 10)}:${k}:r`;
              for (const token of tokens) {
                due.push({
                  token,
                  title: `${PRAYER_LABELS[k]} in ${beforeMin} min`,
                  body: `It's time to prepare for ${PRAYER_LABELS[k]}`,
                  tag: dateKey,
                  path: '/prayer',
                });
              }
            }

            // At-time window: [at, at + 5 min)
            if (now >= at && now.getTime() - at.getTime() < 5 * 60_000) {
              const dateKey = `${today.toISOString().slice(0, 10)}:${k}:a`;
              for (const token of tokens) {
                due.push({
                  token,
                  title: `${PRAYER_LABELS[k]} • وقت الصلاة`,
                  body: `It's time for ${PRAYER_LABELS[k]}`,
                  tag: dateKey,
                  path: '/prayer',
                });
              }
            }
          }

          // Fajr reminder for tomorrow (handles users with early morning notifications crossing midnight)
          const fajrTomorrow = timesTomorrow.fajr;
          const fajrReminderTomorrow = new Date(fajrTomorrow.getTime() - beforeMs);
          if (beforeMs > 0 && now >= fajrReminderTomorrow && now < fajrTomorrow) {
            const dateKey = `${tomorrow.toISOString().slice(0, 10)}:fajr:r`;
            for (const token of tokens) {
              due.push({
                token,
                title: `Fajr in ${beforeMin} min`,
                body: 'Prepare for Fajr',
                tag: dateKey,
                path: '/prayer',
              });
            }
          }
        }

        // Deduplicate by token+tag so a device only gets one notification per event.
        const seen = new Set<string>();
        const uniqueDue: Due[] = [];
        for (const d of due) {
          const key = `${d.token}:${d.tag}`;
          if (seen.has(key)) continue;
          seen.add(key);
          uniqueDue.push(d);
        }

        let sent = 0;
        for (const d of uniqueDue) {
          const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': connectionApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: d.token,
                notification: { title: d.title, body: d.body },
                data: { tag: d.tag, path: d.path },
              },
            }),
          });

          if (res.ok) {
            sent++;
          } else {
            const text = await res.text();
            if (text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT')) {
              staleTokens.push(d.token);
            }
          }
        }

        // Clean stale tokens in batches.
        if (staleTokens.length > 0) {
          const uniqueStale = [...new Set(staleTokens)];
          for (let i = 0; i < uniqueStale.length; i += 100) {
            await supabaseAdmin.from('device_tokens').delete().in('token', uniqueStale.slice(i, i + 100));
          }
        }

        return Response.json({ ok: true, due: uniqueDue.length, sent, staleRemoved: staleTokens.length });
      },
    },
  },
});
