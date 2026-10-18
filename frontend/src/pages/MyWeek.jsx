import { useAuth } from "../context/AuthContext.jsx";
import Viewer from "../components/Viewer.jsx";

export default function MyWeek() {
  const { profile } = useAuth();
  return (
    <div>
      <h1>My week</h1>
      <Viewer kind="teacher" id={profile.id} views={["week"]} />
    </div>
  );
}
