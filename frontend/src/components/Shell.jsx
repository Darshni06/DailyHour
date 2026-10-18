import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useData } from "../context/DataContext.jsx";
import { Blocked, Icon, Logo, Splash } from "./ui.jsx";
import MyDay from "../pages/MyDay.jsx";
import MyWeek from "../pages/MyWeek.jsx";
import Classes from "../pages/Classes.jsx";
import Teachers from "../pages/Teachers.jsx";
import Substitutions from "../pages/Substitutions.jsx";
import Manage from "../pages/Manage.jsx";

const staffNav = [
  { to: "/", label: "Substitutions", icon: "calendar", end: true },
  { to: "/teachers", label: "Teachers", icon: "users" },
  { to: "/classes", label: "Classes", icon: "grid" },
  { to: "/manage", label: "Manage", icon: "sliders" },
];
const teacherNav = [
  { to: "/", label: "My day", icon: "sun", end: true },
  { to: "/week", label: "My week", icon: "table" },
  { to: "/classes", label: "Classes", icon: "grid" },
];

export default function Shell() {
  const { profile, isStaff, logout } = useAuth();
  const { ready, error } = useData();

  if (error)
    return (
      <Blocked title="Could not load the timetable" action={<button className="btn" onClick={logout}>Sign out</button>}>
        {error}
      </Blocked>
    );
  if (!(ready.u && ready.c && ready.s)) return <Splash />;

  const nav = isStaff ? staffNav : teacherNav;
  const links = nav.map((n) => (
    <NavLink key={n.to} to={n.to} end={n.end}>
      <Icon name={n.icon} />
      <span>{n.label}</span>
    </NavLink>
  ));
  const roleLabel = profile.role === "admin" ? "Admin" : profile.role === "coordinator" ? "Coordinator" : "Teacher";

  return (
    <div className="shell">
      <aside className="side noprint">
        <Logo />
        <nav className="side-nav">{links}</nav>
        <div className="me">
          <strong>{profile.name}</strong>
          <span>{roleLabel}</span>
          <button className="btn small ghost" onClick={logout}><Icon name="logout" size={16} />Sign out</button>
        </div>
      </aside>

      <header className="top noprint">
        <Logo size={28} />
        <button className="icon-btn" onClick={logout} aria-label="Sign out"><Icon name="logout" /></button>
      </header>

      <main className="main">
        <Routes>
          {isStaff ? (
            <>
              <Route path="/" element={<Substitutions />} />
              <Route path="/teachers" element={<Teachers />} />
              <Route path="/classes" element={<Classes />} />
              <Route path="/manage" element={<Manage />} />
            </>
          ) : (
            <>
              <Route path="/" element={<MyDay />} />
              <Route path="/week" element={<MyWeek />} />
              <Route path="/classes" element={<Classes />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="tabs noprint" aria-label="Main">{links}</nav>
    </div>
  );
}
