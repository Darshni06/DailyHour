import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseConfig } from "../firebase.js";

export function tempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

// Creates a login on a throwaway second Firebase app so the admin stays signed in.
export async function createAccount({ name, email, phone, role, createdBy }) {
  const cleanEmail = email.trim().toLowerCase();
  const password = tempPassword();
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  let uid;
  try {
    const sAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(sAuth, cleanEmail, password);
    uid = cred.user.uid;
    await signOut(sAuth);
  } finally {
    await deleteApp(secondary);
  }
  await setDoc(doc(db, "users", uid), {
    name: name.trim(),
    email: cleanEmail,
    phone: (phone || "").trim(),
    role,
    active: true,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return { uid, password, email: cleanEmail };
}

export function friendlyAuthError(e) {
  const c = e?.code || "";
  if (c.includes("email-already-in-use")) return "This email already has an account.";
  if (c.includes("invalid-email")) return "This email address is not valid.";
  if (c.includes("weak-password")) return "Password is too weak.";
  if (c.includes("too-many-requests")) return "Too many attempts. Wait a minute and try again.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return "Email or password is incorrect.";
  if (c.includes("network")) return "No internet connection.";
  if (c.includes("permission-denied")) return "You do not have permission to do that.";
  return e?.message || "Something went wrong.";
}
