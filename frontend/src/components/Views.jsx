import { DAY_SHORT, fmtTime } from "../lib/dates.js";

export function DayList({ rows }) {
  return (
    <ol className="daylist">
      {rows.map((r) => (
        <li key={r.period.id} className={`row ${r.tone}`}>
          <div className="when">
            <strong>{fmtTime(r.period.start)}</strong>
            {r.tone !== "break" && <span>{r.period.label}</span>}
          </div>
          <div className="what">
            <div className="t">{r.title}</div>
            {r.sub && <div className="s">{r.sub}</div>}
          </div>
          {r.tag && <span className={`tag ${r.tone}`}>{r.tag}</span>}
        </li>
      ))}
    </ol>
  );
}

// cell(day, period) -> { title, sub } | null
export function WeekGrid({ settings, cell, onCell }) {
  return (
    <div className="gridwrap">
      <table className="grid">
        <thead>
          <tr>
            <th scope="col"><span className="sr">Period</span></th>
            {settings.days.map((d) => <th key={d} scope="col">{DAY_SHORT[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {settings.periods.map((p) =>
            p.isBreak ? (
              <tr key={p.id} className="brk">
                <th scope="row">{p.label}</th>
                <td colSpan={settings.days.length} />
              </tr>
            ) : (
              <tr key={p.id}>
                <th scope="row"><b>{p.label}</b><span>{fmtTime(p.start)}</span></th>
                {settings.days.map((d) => {
                  const c = cell(d, p);
                  const click = onCell ? () => onCell(d, p) : undefined;
                  return (
                    <td
                      key={d}
                      className={`${c ? "filled" : "empty-cell"} ${onCell ? "edit" : ""}`}
                      onClick={click}
                      onKeyDown={onCell ? (e) => (e.key === "Enter" || e.key === " ") && click() : undefined}
                      role={onCell ? "button" : undefined}
                      tabIndex={onCell ? 0 : undefined}
                    >
                      {c ? (
                        <>
                          <div className="t">{c.title}</div>
                          {c.sub && <div className="s">{c.sub}</div>}
                        </>
                      ) : onCell ? <span className="plus">+</span> : null}
                    </td>
                  );
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
