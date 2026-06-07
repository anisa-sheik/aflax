import { supabase } from "@/integrations/supabase/client";
import {
  Award, BookOpen, Bookmark, Flame, Sparkles, Target, Sunrise, CheckCircle2, Trophy,
} from "lucide-react";

export type AchievementCode =
  | "joined"
  | "first_prayer"
  | "prayer_streak_7"
  | "prayer_streak_30"
  | "prayer_100"
  | "first_quran"
  | "quran_streak_7"
  | "quran_streak_30"
  | "first_bookmark"
  | "khatm_1"
  | "first_dhikr"
  | "first_goal";

export type Achievement = {
  code: AchievementCode;
  title: string;
  description: string;
  icon: any;
  tint: "primary" | "accent" | "amber";
};

export const ACHIEVEMENTS: Achievement[] = [
  { code: "joined",           title: "Bismillāh",            description: "Joined Deen Planner Pro",     icon: Sparkles,     tint: "primary" },
  { code: "first_prayer",     title: "First Prayer",         description: "Logged your first ṣalāh",     icon: Sunrise,      tint: "primary" },
  { code: "prayer_streak_7",  title: "7-Day Salah Streak",   description: "Prayed every day for a week", icon: Flame,        tint: "accent"  },
  { code: "prayer_streak_30", title: "30-Day Salah Streak",  description: "A full month of prayer",      icon: Flame,        tint: "amber"   },
  { code: "prayer_100",       title: "100 Prayers",          description: "Logged 100 prayers in total", icon: CheckCircle2, tint: "primary" },
  { code: "first_quran",      title: "Opened the Qur'an",    description: "Started reading the Qur'an",  icon: BookOpen,     tint: "primary" },
  { code: "quran_streak_7",   title: "7-Day Qur'an Streak",  description: "A week of consistent reading", icon: BookOpen,    tint: "accent"  },
  { code: "quran_streak_30",  title: "30-Day Qur'an Streak", description: "A month of daily Qur'an",     icon: BookOpen,     tint: "amber"   },
  { code: "first_bookmark",   title: "First Bookmark",       description: "Saved your first āyah",       icon: Bookmark,     tint: "primary" },
  { code: "khatm_1",          title: "First Khatm",          description: "Completed the entire Qur'an", icon: Trophy,       tint: "amber"   },
  { code: "first_dhikr",      title: "First Dhikr",          description: "Logged your first dhikr",     icon: Sparkles,     tint: "accent"  },
  { code: "first_goal",       title: "First Goal",           description: "Completed your first goal",   icon: Target,       tint: "primary" },
];

export const ACHIEVEMENT_BY_CODE: Record<AchievementCode, Achievement> =
  ACHIEVEMENTS.reduce((m, a) => ({ ...m, [a.code]: a }), {} as any);

export { Award };

function streak(dates: string[]): number {
  const set = new Set(dates);
  let s = 0; const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

/** Inspect user data and insert any newly-unlocked achievements. Cheap & idempotent. */
export async function syncAchievements(): Promise<AchievementCode[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [existing, prayers, quran, bookmarks, dhikr, goals, state] = await Promise.all([
    supabase.from("user_achievements").select("code").eq("user_id", user.id),
    supabase.from("prayer_logs").select("prayer_date").order("prayer_date", { ascending: false }).limit(400),
    supabase.from("quran_progress").select("read_date").order("read_date", { ascending: false }).limit(400),
    supabase.from("quran_bookmarks").select("id").limit(1),
    supabase.from("dhikr_sessions").select("id").limit(1),
    supabase.from("goals").select("done,progress,target").limit(50),
    supabase.from("quran_reading_state").select("surah,ayah").eq("user_id", user.id).maybeSingle(),
  ]);

  const have = new Set((existing.data ?? []).map((r: any) => r.code as AchievementCode));
  const unlock = (c: AchievementCode) => { if (!have.has(c)) toUnlock.add(c); };
  const toUnlock = new Set<AchievementCode>();

  unlock("joined");

  const prayerDates = (prayers.data ?? []).map((r: any) => r.prayer_date as string);
  if (prayerDates.length > 0) unlock("first_prayer");
  if (prayerDates.length >= 100) unlock("prayer_100");
  const pStreak = streak(prayerDates);
  if (pStreak >= 7) unlock("prayer_streak_7");
  if (pStreak >= 30) unlock("prayer_streak_30");

  const quranDates = (quran.data ?? []).map((r: any) => r.read_date as string);
  if (quranDates.length > 0) unlock("first_quran");
  const qStreak = streak(quranDates);
  if (qStreak >= 7) unlock("quran_streak_7");
  if (qStreak >= 30) unlock("quran_streak_30");

  if ((bookmarks.data ?? []).length > 0) unlock("first_bookmark");
  if ((dhikr.data ?? []).length > 0) unlock("first_dhikr");
  if ((goals.data ?? []).some((g: any) => g.done || (g.target && g.progress >= g.target))) unlock("first_goal");

  // Khatm: reading state at last surah (114) or last ayah area
  const s = state.data as any;
  if (s && s.surah === 114) unlock("khatm_1");

  if (toUnlock.size === 0) return [];
  const rows = Array.from(toUnlock).map(code => ({ user_id: user.id, code }));
  await supabase.from("user_achievements").insert(rows);
  return Array.from(toUnlock);
}
