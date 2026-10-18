import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";
import { Icon, Logo } from "../components/ui.jsx";
import { prettyDate } from "../lib/dates.js";

// Public read-only page opened from the WhatsApp link. No sign-in needed.
export default function SharedSheet() {
  const { id } = useParams();
  const [data, setData] = useState(undefined);
  const [who, setWho] = useState("");

  useEffect(
    () => onSnapshot(doc(db, "publishedSheets", id), (s) => setData(s.exists() ? s.data() : null), () => setData(null)),
    [id]
  );

  const names = useMemo(
    () => [...new Set((data?.items || []).map((i) => i.substitute).filter(Boolean))].sort(),
    [data]
  );
  const items = (data?.items || []).filter((i) => !who || i.substitute === who);
  const updated = data?.updatedAt?.toDate?.().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="public">
      <header className="public-head">
        <Logo size={30} />
        <button className="btn small ghost noprint" onClick={() => window.print()}><Icon name="print" size={16} />Print</button>
      </header>

      {data === undefined && <p className="muted">Loading</p>}
      {data === null && (
        <div className="empty">
          <h3>This link is not valid</h3>
          <p>Ask your coordinator to send the latest link.</p>
        </div>
      )}

      {data && (
        <>
          <h1>Cover for {prettyDate(data.date)}</h1>
          <p className="muted">
            {data.schoolName ? `${data.schoolName}. ` : ""}
            {updated ? `Updated at ${updated}.` : ""}
          </p>

          {data.absent?.length > 0 && (
            <p><strong>Absent:</strong> {data.absent.map((a) => a.name + (a.allDay ? "" : " (part day)")).join(", ")}</p>
          )}

          {names.length > 1 && (
            <label className="field noprint">
              <span>Show only my periods</span>
              <select value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Everyone</option>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}

          {items.length === 0 ? (
            <div className="empty"><h3>Nothing to cover</h3></div>
          ) : (
            <ol className="daylist">
              {items.map((i, k) => (
                <li key={k} className={`row ${i.substitute ? "sub" : "absent"}`}>
                  <div className="when">
                    <strong>{i.period}</strong>
                    <span>{i.time}</span>
                  </div>
                  <div className="what">
                    <div className="t">{i.className}{i.subject ? `, ${i.subject}` : ""}</div>
                    <div className="s">
                      {i.substitute ? `${i.substitute} covers for ${i.absent}` : `No cover yet for ${i.absent}`}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
