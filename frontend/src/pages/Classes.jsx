import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { Empty } from "../components/ui.jsx";
import Viewer from "../components/Viewer.jsx";

export default function Classes() {
  const { isStaff } = useAuth();
  const { classes } = useData();
  const [picked, setPicked] = useState("");
  const id = classes.some((c) => c.id === picked) ? picked : classes[0]?.id;

  if (!classes.length)
    return (
      <div>
        <h1>Classes</h1>
        <Empty title="No classes yet">
          {isStaff ? <>Add classes under <Link to="/manage">Manage</Link>.</> : "Your coordinator has not added classes yet."}
        </Empty>
      </div>
    );

  return (
    <div>
      <h1>Classes</h1>
      <label className="field noprint">
        <span>Class</span>
        <select value={id} onChange={(e) => setPicked(e.target.value)}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <Viewer key={id} kind="class" id={id} canEdit={isStaff} />
    </div>
  );
}
