import { useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../context/DataContext.jsx";
import { Empty } from "../components/ui.jsx";
import Viewer from "../components/Viewer.jsx";

export default function Teachers() {
  const { teachers } = useData();
  const [picked, setPicked] = useState("");
  const id = teachers.some((t) => t.id === picked) ? picked : teachers[0]?.id;

  if (!teachers.length)
    return (
      <div>
        <h1>Teachers</h1>
        <Empty title="No teachers yet">Add them under <Link to="/manage">Manage</Link>.</Empty>
      </div>
    );

  return (
    <div>
      <h1>Teachers</h1>
      <label className="field noprint">
        <span>Teacher</span>
        <select value={id} onChange={(e) => setPicked(e.target.value)}>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <Viewer key={id} kind="teacher" id={id} />
    </div>
  );
}
