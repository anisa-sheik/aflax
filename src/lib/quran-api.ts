// Lightweight Qur'an API client (alquran.cloud) — Arabic only.
// We fetch the tajweed-annotated edition and derive plain Uthmani text from it,
// so the reader can toggle tajweed colors without a second request.

import { tajweedToHtml, tajweedToPlain } from "./quran-tajweed";

export type Surah = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
};

export type Ayah = {
  number: number;
  numberInSurah: number;
  arabic: string;        // plain Uthmani
  tajweedHtml: string;   // safe HTML with <span class="tj tj-x">…</span>
};

const BASE = "https://api.alquran.cloud/v1";

let _surahCache: Surah[] | null = null;
export async function fetchSurahs(): Promise<Surah[]> {
  if (_surahCache) return _surahCache;
  const r = await fetch(`${BASE}/surah`);
  const j = await r.json();
  _surahCache = j.data as Surah[];
  return _surahCache;
}

const _ayahCache = new Map<number, Ayah[]>();
export async function fetchSurahAyahs(surah: number): Promise<Ayah[]> {
  if (_ayahCache.has(surah)) return _ayahCache.get(surah)!;
  const r = await fetch(`${BASE}/surah/${surah}/quran-tajweed`);
  const j = await r.json();
  const list: Ayah[] = (j.data.ayahs as any[]).map((a) => ({
    number: a.number,
    numberInSurah: a.numberInSurah,
    arabic: tajweedToPlain(a.text),
    tajweedHtml: tajweedToHtml(a.text),
  }));
  _ayahCache.set(surah, list);
  return list;
}
