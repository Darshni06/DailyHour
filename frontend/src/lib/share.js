import { DAY_NAMES, fmtTime, prettyDate } from "./dates.js";

export function waLink(phone, text, cc = "91") {
  const digits = (phone || "").replace(/\D/g, "");
  const num = digits ? (digits.length === 10 ? cc + digits : digits) : "";
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export async function nativeShare({ title, text, url }) {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch {
    return false;
  }
}

export async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
  }
  return true;
}

export function dayText(title, rows) {
  const lines = rows
    .filter((r) => r.tone !== "break" && r.tone !== "free")
    .map((r) => `${r.period.label} (${fmtTime(r.period.start)}): ${r.title}${r.sub ? `, ${r.sub}` : ""}${r.tag ? ` [${r.tag}]` : ""}`);
  return `${title}\n${lines.length ? lines.join("\n") : "No classes."}`;
}

export function weekText(title, settings, cellFn) {
  const out = [title];
  for (const d of settings.days) {
    const parts = [];
    for (const p of settings.periods) {
      if (p.isBreak) continue;
      const c = cellFn(d, p);
      if (c) parts.push(`${p.label}: ${c.title}${c.sub ? ` (${c.sub})` : ""}`);
    }
    out.push(`\n${DAY_NAMES[d]}\n${parts.length ? parts.join("\n") : "Free"}`);
  }
  return out.join("\n");
}

export function sheetText(date, items, url) {
  const lines = items.map(
    (i) =>
      `${i.period} (${i.time}) ${i.className}: ${
        i.substitute ? `${i.substitute}, covering ${i.absent}` : `no cover yet for ${i.absent}`
      }`
  );
  return [`Cover arrangements for ${prettyDate(date)}`, ...(lines.length ? lines : ["Nothing to cover."]), url ? `\nFull list: ${url}` : ""]
    .join("\n")
    .trim();
}
