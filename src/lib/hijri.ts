export function hijriToday(): string {
  try {
    return new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
      day: "numeric", month: "long", year: "numeric",
    }).format(new Date());
  } catch { return ""; }
}
export function gregorianToday(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", day: "numeric", month: "long",
  }).format(new Date());
}
