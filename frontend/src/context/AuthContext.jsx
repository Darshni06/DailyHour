import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const unsubProfile = useRef(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (unsubProfile.current) {
        unsubProfile.current();
        unsubProfile.current = null;
      }
      setUser(u);
      setProfile(null);
      setProfileError("");
      if (!u) {
        setLoading(false);
        return;
      }
      setLoading(true);
      unsubProfile.current = onSnapshot(
        doc(db, "users", u.uid),
        (snap) => {
          setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
          setLoading(false);
        },
        (err) => {
          setProfileError(err.message);
          setLoading(false);
        }
      );
    });
    return () => {
      unsubAuth();
      if (unsubProfile.current) unsubProfile.current();
    };
  }, []);

  const value = {
    user,
    profile,
    loading,
    profileError,
    isAdmin: profile?.role === "admin",
    isStaff: !!profile && (profile.role === "admin" || profile.role === "coordinator"),
    logout: () => signOut(auth),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
