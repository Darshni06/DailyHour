import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";
import { DEFAULT_SETTINGS } from "../lib/schedule.js";

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

const byName = (a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });

export function DataProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [settingsDoc, setSettingsDoc] = useState(null);
  const [ready, setReady] = useState({ u: false, c: false, s: false });
  const [error, setError] = useState("");

  useEffect(() => {
    const fail = (e) => setError(e.message || "Could not load data");
    const u1 = onSnapshot(
      collection(db, "users"),
      (s) => {
        setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        setReady((r) => ({ ...r, u: true }));
      },
      fail
    );
    const u2 = onSnapshot(
      collection(db, "classes"),
      (s) => {
        setClasses(s.docs.map((d) => ({ id: d.id, slots: {}, ...d.data() })).sort(byName));
        setReady((r) => ({ ...r, c: true }));
      },
      fail
    );
    const u3 = onSnapshot(
      doc(db, "settings", "school"),
      (s) => {
        setSettingsDoc(s.exists() ? s.data() : null);
        setReady((r) => ({ ...r, s: true }));
      },
      fail
    );
    return () => { u1(); u2(); u3(); };
  }, []);

  const value = useMemo(() => {
    const settings = { ...DEFAULT_SETTINGS, ...(settingsDoc || {}) };
    const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
    const teachers = users.filter((u) => u.role !== "admin" && u.active !== false).sort(byName);
    const subjectsBy = {};
    const subjectSet = new Set();
    for (const c of classes) {
      for (const s of Object.values(c.slots || {})) {
        const subj = (s.subject || "").trim();
        if (!subj) continue;
        subjectSet.add(subj);
        (subjectsBy[s.teacherId] ||= new Set()).add(subj.toLowerCase());
      }
    }
    return {
      users,
      usersById,
      teachers,
      classes,
      settings,
      subjectsBy,
      subjectList: [...subjectSet].sort(),
      nameOf: (id) => usersById[id]?.name || "Former teacher",
      ready,
      error,
    };
  }, [users, classes, settingsDoc, ready, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
