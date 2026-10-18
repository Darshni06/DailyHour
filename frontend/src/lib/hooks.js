import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { monthBounds } from "./dates.js";

const EMPTY = [];

// Live absences and cover assignments for one date.
export function useDayData(date) {
  const [a, setA] = useState({ date: null, list: EMPTY });
  const [s, setS] = useState({ date: null, list: EMPTY });

  useEffect(() => {
    const read = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const u1 = onSnapshot(
      query(collection(db, "absences"), where("date", "==", date)),
      (snap) => setA({ date, list: read(snap) }),
      (e) => { console.error(e); setA({ date, list: EMPTY }); }
    );
    const u2 = onSnapshot(
      query(collection(db, "substitutions"), where("date", "==", date)),
      (snap) => setS({ date, list: read(snap) }),
      (e) => { console.error(e); setS({ date, list: EMPTY }); }
    );
    return () => { u1(); u2(); };
  }, [date]);

  const abs = a.date === date ? a.list : EMPTY;
  const subs = s.date === date ? s.list : EMPTY;
  const loaded = a.date === date && s.date === date;
  const absMap = useMemo(() => Object.fromEntries(abs.map((x) => [x.teacherId, x])), [abs]);
  return { abs, subs, absMap, loaded };
}

// Every cover assignment in the month of `date`, used to keep the load fair.
export function useMonthSubs(date) {
  const [start, end] = monthBounds(date);
  const [list, setList] = useState(EMPTY);
  useEffect(() => {
    const q = query(collection(db, "substitutions"), where("date", ">=", start), where("date", "<=", end));
    return onSnapshot(
      q,
      (snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error(e)
    );
  }, [start, end]);
  return list;
}
