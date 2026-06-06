// Parse alquran.cloud "quran-tajweed" markup into safe HTML with class names.
// Source format: `بِسْمِ [h:1[ٱ]للَّهِ [l[ل]رَّحْمَ[n[ـٰ]نِ` …
// Pattern: `[<rule>(:<digits>)?[<text>]`
// We emit <span class="tj tj-<rule>">text</span>.

const TOKEN = /\[([a-z])(?::\d+)?\[([^\]]+)\]/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function tajweedToHtml(input: string): string {
  let out = "";
  let last = 0;
  for (const m of input.matchAll(TOKEN)) {
    out += escapeHtml(input.slice(last, m.index!));
    out += `<span class="tj tj-${m[1]}">${escapeHtml(m[2])}</span>`;
    last = m.index! + m[0].length;
  }
  out += escapeHtml(input.slice(last));
  return out;
}

// Strip markup → plain Arabic (used as fallback / search / non-tajweed mode).
export function tajweedToPlain(input: string): string {
  return input.replace(TOKEN, (_a, _r, t) => t);
}
