import { useAuth } from "../context/AuthContext.jsx";
import Viewer from "../components/Viewer.jsx";

export default function MyDay() {
  const { profile } = useAuth();
  const first = (profile.name || "").split(" ")[0];
  return (
    <div>
      <h1>Hello, {first}</h1>
      <Viewer kind="teacher" id={profile.id} views={["day"]} />
    </div>
  );
}
