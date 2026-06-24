import {
  serverTimestamp,
  setDoc,
  getDoc,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/firebase/config";
import { usersCol, userRef, getMany } from "./firestore";
import type { AppUser, Role } from "@/types";

/**
 * Loads the user's profile, creating it on first sign-in. New users are inactive
 * (pending admin approval) unless their email matches the bootstrap admin, who is
 * auto-promoted so you can never lock yourself out.
 */
export async function ensureUserProfile(user: User): Promise<AppUser> {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);
  const email = (user.email || "").toLowerCase();
  const isBootstrap = !!BOOTSTRAP_ADMIN_EMAIL && email === BOOTSTRAP_ADMIN_EMAIL;

  if (!snap.exists()) {
    const profile: Omit<AppUser, "id"> = {
      uid: user.uid,
      email,
      displayName: user.displayName || email,
      photoURL: user.photoURL || "",
      role: isBootstrap ? "admin" : "viewer",
      active: isBootstrap, // others wait for approval
      createdAt: serverTimestamp() as never,
      lastLoginAt: serverTimestamp() as never,
    };
    await setDoc(ref, profile);
    return { id: user.uid, ...profile };
  }

  // Existing user: refresh login time + promote bootstrap admin if needed.
  const patch: Record<string, unknown> = {
    lastLoginAt: serverTimestamp(),
    displayName: user.displayName || snap.data().displayName,
    photoURL: user.photoURL || snap.data().photoURL || "",
  };
  if (isBootstrap && (snap.data().role !== "admin" || !snap.data().active)) {
    patch.role = "admin";
    patch.active = true;
  }
  await updateDoc(ref, patch);
  return { id: user.uid, ...(snap.data() as Omit<AppUser, "id">), ...patch } as AppUser;
}

export function listUsers() {
  return getMany<AppUser>(usersCol, orderBy("createdAt", "desc"));
}

export function setUserRole(uid: string, role: Role) {
  return updateDoc(userRef(uid), { role });
}

export function setUserActive(uid: string, active: boolean) {
  return updateDoc(userRef(uid), { active });
}
