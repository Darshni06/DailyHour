import { Navigate, Route, Routes } from "react-router-dom";
import { configMissing } from "./firebase.js";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { DataProvider } from "./context/DataContext.jsx";
import { Blocked, Splash, ToastProvider } from "./components/ui.jsx";
import Shell from "./components/Shell.jsx";
import Login from "./pages/Login.jsx";
import SharedSheet from "./pages/SharedSheet.jsx";

function Gate() {
  const { user, profile, loading, profileError, logout } = useAuth();
  const out = <button className="btn" onClick={logout}>Sign out</button>;
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (profileError)
    return <Blocked title="Cannot read your account" action={out}>{profileError}. Ask the admin to check that the Firestore rules are deployed.</Blocked>;
  if (!profile)
    return <Blocked title="Your account is not set up" action={out}>Ask the school admin to add you in DailyHour.</Blocked>;
  if (profile.active === false)
    return <Blocked title="Your account is switched off" action={out}>Ask the school admin to turn it back on.</Blocked>;
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

export default function App() {
  if (configMissing)
    return (
      <Blocked title="Firebase is not connected yet">
        The environment variables are missing. Add the six VITE_FIREBASE_ values (see README, step 3), then restart or redeploy.
      </Blocked>
    );
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/s/:id" element={<SharedSheet />} />
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<Gate />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
