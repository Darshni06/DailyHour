export const DEFAULT_SETTINGS = {
  schoolName: "",
  countryCode: "91",
  days: [1, 2, 3, 4, 5, 6],
  periods: [
    { id: 1, label: "Period 1", start: "08:30", end: "09:15", isBreak: false },
    { id: 2, label: "Period 2", start: "09:15", end: "10:00", isBreak: false },
    { id: 3, label: "Period 3", start: "10:00", end: "10:45", isBreak: false },
    { id: 4, label: "Break", start: "10:45", end: "11:00", isBreak: true },
    { id: 5, label: "Period 4", start: "11:00", end: "11:45", isBreak: false },
    { id: 6, label: "Period 5", start: "11:45", end: "12:30", isBreak: false },
    { id: 7, label: "Lunch", start: "12:30", end: "13:15", isBreak: true },
    { id: 8, label: "Period 6", start: "13:15", end: "14:00", isBreak: false },
    { id: 9, label: "Period 7", start: "14:00", end: "14:45", isBreak: false },
  ],
};

export const slotKey = (day, periodId) => `d${day}p${periodId}`;
export const subDocId = (date, classId, periodId) => `${date}_${classId}_${periodId}`;
export const absenceDocId = (date, teacherId) => `${date}_${teacherId}`;

export function isAbsent(absMap, teacherId, periodId) {
  const a = absMap[teacherId];
  return !!a && (a.allDay || (a.periods || []).includes(periodId));
}

// periodId -> { cls, subject } for one teacher on one weekday
export function teacherSlotsOnDay(classes, teacherId, day, periods) {
  const out = {};
  for (const c of classes) {
    for (const p of periods) {
      const s = c.slots?.[slotKey(day, p.id)];
      if (s && s.teacherId === teacherId) out[p.id] = { cls: c, subject: s.subject || "" };
    }
  }
  return out;
}

export function teacherDayRows({ teacherId, day, classes, settings, absMap, subs, nameOf }) {
  const mine = teacherSlotsOnDay(classes, teacherId, day, settings.periods);
  return settings.periods.map((p) => {
    if (p.isBreak) return { period: p, tone: "break", title: p.label, sub: "", tag: "" };
    const slot = mine[p.id];
    if (slot) {
      if (isAbsent(absMap, teacherId, p.id)) {
        const cover = subs.find((s) => s.classId === slot.cls.id && s.periodId === p.id);
        return {
          period: p, tone: "absent", title: slot.cls.name, tag: "Absent",
          sub: cover ? `Covered by ${nameOf(cover.substituteId)}` : "No cover assigned yet",
        };
      }
      return { period: p, tone: "normal", title: slot.cls.name, sub: slot.subject, tag: "" };
    }
    const duty = subs.find((s) => s.substituteId === teacherId && s.periodId === p.id);
    if (duty) {
      const c = classes.find((x) => x.id === duty.classId);
      return {
        period: p, tone: "sub", title: c?.name || "Class", tag: "Cover",
        sub: `Covering for ${nameOf(duty.absentTeacherId)}`,
      };
    }
    return { period: p, tone: "free", title: "Free", sub: "", tag: "" };
  });
}

export function classDayRows({ cls, day, settings, absMap, subs, nameOf }) {
  return settings.periods.map((p) => {
    if (p.isBreak) return { period: p, tone: "break", title: p.label, sub: "", tag: "" };
    const s = cls.slots?.[slotKey(day, p.id)];
    if (!s) return { period: p, tone: "free", title: "No class", sub: "", tag: "" };
    if (isAbsent(absMap, s.teacherId, p.id)) {
      const cover = subs.find((x) => x.classId === cls.id && x.periodId === p.id);
      return cover
        ? { period: p, tone: "sub", title: nameOf(cover.substituteId), sub: `Covering for ${nameOf(s.teacherId)}`, tag: "Cover" }
        : { period: p, tone: "absent", title: nameOf(s.teacherId), sub: "Absent, no cover yet", tag: "Absent" };
    }
    return { period: p, tone: "normal", title: nameOf(s.teacherId), sub: s.subject || "", tag: "" };
  });
}

// Free teachers for one period, best first.
export function rankCandidates({ cls, subject, periodId, day, classes, absMap, subs, teachers, monthCounts, subjectsBy }) {
  const busy = new Set();
  for (const c of classes) {
    const s = c.slots?.[slotKey(day, periodId)];
    if (s && !isAbsent(absMap, s.teacherId, periodId)) busy.add(s.teacherId);
  }
  for (const s of subs) if (s.periodId === periodId) busy.add(s.substituteId);

  const knows = new Set(Object.values(cls.slots || {}).map((s) => s.teacherId));
  const wanted = (subject || "").trim().toLowerCase();

  return teachers
    .filter((t) => !busy.has(t.id) && !isAbsent(absMap, t.id, periodId))
    .map((t) => {
      const why = [];
      let score = 0;
      if (wanted && subjectsBy[t.id]?.has(wanted)) { score += 100; why.push("same subject"); }
      if (knows.has(t.id)) { score += 40; why.push("knows the class"); }
      const today = subs.filter((s) => s.substituteId === t.id).length;
      const month = monthCounts[t.id] || 0;
      if (month > 0) why.push(`${month} cover${month > 1 ? "s" : ""} this month`);
      score -= 25 * today + 8 * month;
      return { teacher: t, score, why };
    })
    .sort((a, b) => b.score - a.score || (a.teacher.name || "").localeCompare(b.teacher.name || ""));
}

export const randomToken = (n = 12) => {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => chars[x % chars.length]).join("");
};
