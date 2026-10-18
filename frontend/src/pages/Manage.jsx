import { useState } from "react";
import { Segmented } from "../components/ui.jsx";
import People from "./manage/People.jsx";
import ClassList from "./manage/ClassList.jsx";
import Periods from "./manage/Periods.jsx";
import ImportCsv from "./manage/ImportCsv.jsx";

export default function Manage() {
  const [tab, setTab] = useState("people");
  return (
    <div>
      <h1>Manage</h1>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "people", label: "People" },
          { value: "classes", label: "Classes" },
          { value: "periods", label: "Periods" },
          { value: "import", label: "Import" },
        ]}
      />
      <div className="tabbody">
        {tab === "people" && <People />}
        {tab === "classes" && <ClassList />}
        {tab === "periods" && <Periods />}
        {tab === "import" && <ImportCsv />}
      </div>
    </div>
  );
}
