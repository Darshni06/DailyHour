export const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad = (n) => String(n).padStart(2, "0");

export const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromStr = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const todayStr = () => toStr(new Date());
export const addDays = (s, n) => {
  const d = fromStr(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};
// Monday = 1 ... Sunday = 7
export const weekday = (s) => {
  const g = fromStr(s).getDay();
  return g === 0 ? 7 : g;
};
export const prettyDate = (s) =>
  fromStr(s).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

export const monthBounds = (s) => {
  const d = fromStr(s);
  return [toStr(new Date(d.getFullYear(), d.getMonth(), 1)), toStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
};

export const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "pm" : "am"}`;
};
