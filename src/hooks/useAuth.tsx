import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import toast from "react-hot-toast";
import { auth, googleProvider } from "@/firebase/config";
import { ensureUserProfile } from "@/services/users";
import type { AppUser, Role } from "@/types";

interface AuthState {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  role: Role | null;
  isActive: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Returns true when the current user's role is at or above `min`. */
  hasRole: (min: Role) => boolean;
}

const RANK: Record<Role, number> = { viewer: 0, worker: 1, manager: 2, admin: 3 };

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          setProfile(await ensureUserProfile(u));
        } catch (e) {
          console.error(e);
          toast.error("Could not load your profile. Try again.");
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  async function signIn() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        toast.error("Sign-in failed. Try again.");
      }
    }
  }

  async function signOut() {
    await fbSignOut(auth);
  }

  const role = profile?.role ?? null;
  const isActive = !!profile?.active;
  const hasRole = (min: Role) => !!role && isActive && RANK[role] >= RANK[min];

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, role, isActive, signIn, signOut, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
