import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import type { ReactNode } from "react";

import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";

import {
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";
import type { LiveProfile } from "@/services/profileCache";

type AuthContextType = {
  user: User | null;
  /** Live Firestore profile of the signed-in user (updates in real time). */
  profile: LiveProfile | null;
  loading: boolean;
  profileCompleted: boolean;
  refreshProfileStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  profileCompleted: false,
  refreshProfileStatus: async () => {},
});

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  const [profile, setProfile] = useState<LiveProfile | null>(null);

  const [loading, setLoading] = useState(true);

  const [profileCompleted, setProfileCompleted] =
    useState(false);

  // Guards against attaching a profile listener for an auth session that has
  // already been replaced (rapid sign-in/sign-out).
  const authGenerationRef = useRef(0);
  const profileUnsubRef = useRef<(() => void) | null>(null);

  const applyProfileDoc = useCallback((uid: string, data: Record<string, any> | undefined) => {
    if (data) {
      setProfile({ uid, ...data } as LiveProfile);
      setProfileCompleted(Boolean(data.profileCompleted));
    } else {
      setProfile(null);
      setProfileCompleted(false);
    }
  }, []);

  const refreshProfileStatus = useCallback(async () => {
    if (!user) {
      setProfileCompleted(false);
      return;
    }

    const snap = await getDoc(
      doc(db, "users", user.uid)
    );

    applyProfileDoc(user.uid, snap.data() ?? undefined);
  }, [user, applyProfileDoc]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        const generation = ++authGenerationRef.current;

        setUser(firebaseUser);

        // Close any profile listener from the previous auth session.
        profileUnsubRef.current?.();
        profileUnsubRef.current = null;

        if (firebaseUser) {
          const snap = await getDoc(
            doc(db, "users", firebaseUser.uid)
          );

          if (generation !== authGenerationRef.current) return;

          applyProfileDoc(firebaseUser.uid, snap.data() ?? undefined);

          // Keep the signed-in user's profile reactive for the whole session:
          // profile edits (name, avatar, bio, verification, completion flag)
          // propagate everywhere that consumes AuthContext without refresh.
          profileUnsubRef.current = onSnapshot(
            doc(db, "users", firebaseUser.uid),
            (profileSnap) => {
              applyProfileDoc(firebaseUser.uid, profileSnap.data() ?? undefined);
            },
            (error: Error) => {
              console.error("Profile listener failed:", error);
            }
          );
        } else {
          setProfile(null);
          setProfileCompleted(false);
        }

        setLoading(false);
      }
    );

    return () => {
      authGenerationRef.current += 1;
      unsubscribe();
      profileUnsubRef.current?.();
      profileUnsubRef.current = null;
    };
  }, [applyProfileDoc]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileCompleted,
        refreshProfileStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
