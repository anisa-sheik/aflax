// Lightweight Qur'an API client (alquran.cloud) — no auth required.
// Editions:
//  - quran-uthmani: Arabic text (Uthmani script)
//  - en.sahih: Sahih International (English)
//  - sv.bernstrom: Swedish (closest publicly available Scandinavian translation;
//    used as a Danish fallback because no Danish Qur'an translation is exposed
//    by major public APIs)

export type Surah = {
  number: number;
  name: string;             // Arabic
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
};

export type Ayah = {
  number: number;            // global ayah number
  numberInSurah: number;
  text: string;
  arabic: string;
  english: string;
  scandinavian: string;
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
  const editions = ["quran-uthmani", "en.sahih", "sv.bernstrom"].join(",");
  const r = await fetch(`${BASE}/surah/${surah}/editions/${editions}`);
  const j = await r.json();
  const [ar, en, sv] = j.data as any[];
  const list: Ayah[] = ar.ayahs.map((a: any, i: number) => ({
    number: a.number,
    numberInSurah: a.numberInSurah,
    text: a.text,
    arabic: a.text,
    english: en?.ayahs?.[i]?.text ?? "",
    scandinavian: sv?.ayahs?.[i]?.text ?? "",
  }));
  _ayahCache.set(surah, list);
  return list;
}
